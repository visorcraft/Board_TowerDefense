import { PLAYFIELD, CANVAS_WIDTH, defaultState } from "./game/state.js";
import { tick, pieceAt, roleForPlacement, ensurePath, startWave, resetRound } from "./game/round.js";
import type { InputSource } from "./board/boardInput.js";
import { type DevContact } from "./board/boardInput.js";
import type { PieceMappingTable } from "./board/pieceMapping.js";
import { drawBackground, drawEnemies, drawHud, drawParticles, drawPieces, drawPhaseOverlay, drawProjectiles, setupCanvas } from "./render/canvas.js";
import { CANNON_MODES, type CannonMode, type GameState, type Role } from "./game/types.js";
import { setCannonMode } from "./game/targeting.js";
import { placePiece } from "./game/economy.js";
import { AudioBus } from "./audio/cues.js";
import { SaveStore } from "./board/saveStore.js";
import { PauseMenu } from "./board/pauseMenu.js";
import { DiagnosticLog, drawDiagnostic } from "./diagnostic.js";
import { Board } from "@board.fun/web-sdk";

interface DragState {
  pieceId: number;
  startX: number;
  startY: number;
  pointerId: number;
  mode: "move" | "rotate";
  startOrientation: number;
  pointerStartAngle: number;
}

export interface AppOptions {
  canvas: HTMLCanvasElement;
  input: InputSource;
  mapping: PieceMappingTable;
  save: SaveStore;
  pause: PauseMenu;
  audio: AudioBus;
}

export class App {
  private state: GameState = defaultState();
  private canvas: HTMLCanvasElement;
  private input: InputSource;
  private mapping: PieceMappingTable;
  private save: SaveStore;
  private pause: PauseMenu;
  private audio: AudioBus;
  private diagLog = new DiagnosticLog();
  private tickFrame = 0;
  private lastTs = 0;
  private rafId = 0;
  private drag: DragState | null = null;
  private prevContacts: Map<number, { x: number; y: number; orientation: number; phase: string; isTouched: boolean }> = new Map();
  private lastShotAt = new Map<number, number>();
  private debugMsg = "—";
  private appId = "";

  constructor(opts: AppOptions) {
    this.canvas = opts.canvas;
    this.input = opts.input;
    this.mapping = opts.mapping;
    this.save = opts.save;
    this.pause = opts.pause;
    this.audio = opts.audio;
  }

  setAppId(id: string): void {
    this.appId = id;
    this.pause.setGameId(id);
  }

  async start(): Promise<void> {
    this.installPause();
    this.installInput();
    const loaded = await this.save.load();
    if (loaded) {
      this.applyProgress(loaded);
    }
    ensurePath(this.state);
    this.audio.startMusic();
    this.lastTs = performance.now();
    const loop = (ts: number): void => {
      this.frame(ts);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
    this.audio.setVolumeListener((m, s) => {
      this.pause.setMusicVolume(m);
      this.pause.setSfxVolume(s);
    });
  }

  stop(): void {
    cancelAnimationFrame(this.rafId);
    this.input.stop();
    this.pause.uninstall();
    this.audio.stopMusic();
  }

  private installPause(): void {
    this.pause.install({
      onRestart: () => {
        this.state.paused = false;
        resetRound(this.state);
        this.audio.play("clear");
      },
      onMuteToggle: () => {
        const m = !this.audio.getMuted();
        this.audio.setMuted(m);
        this.state.message = m ? "Audio muted" : "Audio unmuted";
        this.state.messageTimerMs = 1500;
      },
      onDiagnosticToggle: () => {
        if (!this.state.diagnostic) this.diagLog.reset();
        this.state.diagnostic = !this.state.diagnostic;
        this.state.message = this.state.diagnostic
          ? "Diagnostic ON. Place pieces one at a time and read their glyphId."
          : "Diagnostic OFF.";
        this.state.messageTimerMs = 3000;
      },
      onVolumeChange: (m, s) => {
        this.audio.setMusicVolume(m);
        this.audio.setSfxVolume(s);
      },
      onResume: () => {
        this.state.paused = false;
      },
      onQuit: () => {
        if (this.state.saveDirty) {
          void this.save.save(this.state);
        }
        if (Board.isOnDevice) Board.application.quit();
      },
      onDebug: (msg) => {
        this.debugMsg = msg;
        (this.state as GameState & { debugMsg?: string }).debugMsg = msg;
      },
    });
    this.pause.setGameId(this.appId);
  }

  private installInput(): void {
    this.input.onFrame((frame) => {
      this.handleInputFrame(frame);
    });
    this.input.start();
  }

  private applyProgress(p: import("./game/types.js").PersistedProgress): void {
    this.state.highestWave = p.highestWave;
    this.state.victories = p.victories;
    for (const m of p.unlockedModes) {
      if (!this.state.unlockedModes.includes(m)) this.state.unlockedModes.push(m);
    }
  }

  private frame(ts: number): void {
    const dt = Math.min(64, ts - this.lastTs);
    this.lastTs = ts;
    this.tickFrame = (this.tickFrame + 1) % 1000000;
    if (!this.state.paused) {
      tick(this.state, dt);
    }
    this.render();
  }

  private render(): void {
    const { ctx, scale: _scale } = setupCanvas(this.canvas);
    void _scale;
    if (this.state.diagnostic) {
      drawDiagnostic(ctx, this.diagLog, this.mapping, Board.isOnDevice);
      this.drawDiagButton(ctx);
      return;
    }
    drawBackground(ctx, this.state);
    drawPieces(ctx, this.state);
    drawEnemies(ctx, this.state);
    drawProjectiles(ctx, this.state);
    drawParticles(ctx, this.state);
    drawHud(ctx, this.state, this.tickFrame);
    this.drawDiagButton(ctx);
    drawPhaseOverlay(ctx, this.state);
  }

  private drawDiagButton(ctx: CanvasRenderingContext2D): void {
    const w = 96;
    const h = 96;
    const x = CANVAS_WIDTH - w - 32;
    const y = 88;
    const fill = "#1a2238";
    const stroke = this.state.diagnostic ? "#ffce4a" : "#5fb3ff";
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 4;
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    ctx.font = "32px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = stroke;
    ctx.fillText("DIAG", x + w / 2, y + h / 2);
  }

  private handleInputFrame(frame: import("./board/boardInput.js").InputFrame): void {
    this.diagLog.update(frame.contacts, this.mapping, performance.now());
    if (frame.devStartWave) {
      this.audio.resume();
      startWave(this.state);
    }
    if (frame.devRestart) {
      resetRound(this.state);
      this.audio.play("clear");
    }
    if (frame.diagnostic !== undefined) {
      if (frame.diagnostic && !this.state.diagnostic) this.diagLog.reset();
      this.state.diagnostic = frame.diagnostic;
    }
    if (frame.longPress) {
      this.toggleDiagnostic("long-press");
      return;
    }
    if (frame.devRotateLeft) {
      const target = this.findSelectedCannon();
      if (target) target.orientation = (target.orientation - 8 + 360) % 360;
    }
    if (frame.devRotateRight) {
      const target = this.findSelectedCannon();
      if (target) target.orientation = (target.orientation + 8) % 360;
    }
    for (const c of frame.contacts) {
      if (c.phase === "Began") {
        const x = c.x;
        const y = c.y;
        const btnX = CANVAS_WIDTH - 96 - 32;
        const btnY = 88;
        if (x >= btnX && x <= btnX + 96 && y >= btnY && y <= btnY + 96) {
          this.toggleDiagnostic("DIAG button");
          return;
        }
      }
    }
    this.handleContacts(frame.contacts);
  }

  private toggleDiagnostic(source: string): void {
    if (!this.state.diagnostic) this.diagLog.reset();
    this.state.diagnostic = !this.state.diagnostic;
    this.state.message = this.state.diagnostic
      ? `Diagnostic ON (${source}). Place pieces one at a time.`
      : "Diagnostic OFF.";
    this.state.messageTimerMs = 3000;
  }

  private findSelectedCannon() {
    let best: import("./game/types.js").PlacedPiece | null = null;
    let bestT = Number.POSITIVE_INFINITY;
    for (const id of this.lastShotAt.keys()) {
      const t = this.lastShotAt.get(id) ?? 0;
      if (t < bestT) {
        bestT = t;
        const p = this.state.pieces.find((x) => x.id === id);
        if (p && p.role === "cannon") best = p;
      }
    }
    return best;
  }

  private handleContacts(contacts: ReadonlyArray<DevContact>): void {
    for (const c of contacts) {
      const prev = this.prevContacts.get(c.contactId);
      const began = c.phase === "Began";
      const ended = c.phase === "Ended" || c.phase === "Canceled";
      const lifted = prev?.isTouched && !c.isTouched;
      if (began || (prev && (c.phase === "Moved" || c.phase === "Stationary") && !this.drag)) {
      if (began) this.audio.resume();
      if (c.glyphId > 0) {
        this.onPieceBegan(c);
      } else if (c.type === "Finger" && began) {
        this.onFingerBegan(c);
      }
      }
      if (this.drag && c.contactId === this.drag.pieceId) {
        this.updateDrag(c);
      }
      if (ended || lifted) {
        if (this.drag && c.contactId === this.drag.pieceId) {
          this.endDrag();
        }
      }
      if (c.phase !== "Ended" && c.phase !== "Canceled") {
        this.prevContacts.set(c.contactId, {
          x: c.x,
          y: c.y,
          orientation: c.orientation,
          phase: c.phase,
          isTouched: c.isTouched,
        });
      } else {
        this.prevContacts.delete(c.contactId);
        this.lastShotAt.delete(c.contactId);
      }
    }
  }

  private onPieceBegan(c: DevContact): void {
    if (!c.pieceRole) return;
    const role = c.pieceRole === "unknown" ? "cannon" : c.pieceRole;
    const placed = placePiece(this.state, {
      role,
      x: c.x,
      y: c.y,
      orientation: c.orientation,
      mode: "single",
    });
    if (placed) {
      this.audio.play(role === "ring" ? "ring" : "place");
      if (c.pieceRole === "unknown") {
        this.state.message = `Unknown piece (glyphId=${c.glyphId}); placed as cannon. Update pieceset.json.`;
        this.state.messageTimerMs = 2500;
      }
      ensurePath(this.state);
      this.drag = {
        pieceId: placed.id,
        startX: placed.x,
        startY: placed.y,
        pointerId: c.contactId,
        mode: role === "stair" ? "move" : role === "cannon" ? "rotate" : "move",
        startOrientation: placed.orientation,
        pointerStartAngle: 0,
      };
    }
  }

  private onFingerBegan(c: DevContact): void {
    const existing = pieceAt(this.state, c.x, c.y);
    if (existing) {
      this.drag = {
        pieceId: existing.id,
        startX: existing.x,
        startY: existing.y,
        pointerId: c.contactId,
        mode: existing.role === "cannon" ? "rotate" : "move",
        startOrientation: existing.orientation,
        pointerStartAngle: 0,
      };
      return;
    }
    const role: Role = this.input.getDevPlace();
    if (this.state.phase !== "build") {
      this.state.message = "Wait for the next build phase.";
      this.state.messageTimerMs = 1200;
      return;
    }
    const placement = roleForPlacement(role, c.x, c.y, 3);
    const placed = placePiece(this.state, {
      role,
      x: placement.x,
      y: placement.y,
      orientation: 0,
      mode: "single",
    });
    if (placed) {
      this.audio.play(role === "ring" ? "ring" : "place");
      ensurePath(this.state);
      this.drag = {
        pieceId: placed.id,
        startX: placed.x,
        startY: placed.y,
        pointerId: c.contactId,
        mode: role === "cannon" ? "rotate" : "move",
        startOrientation: 0,
        pointerStartAngle: 0,
      };
    } else {
      this.state.message = `Not enough gold for ${role}.`;
      this.state.messageTimerMs = 1200;
    }
  }

  private updateDrag(c: DevContact): void {
    if (!this.drag) return;
    const p = this.state.pieces.find((x) => x.id === this.drag!.pieceId);
    if (!p) {
      this.drag = null;
      return;
    }
    if (this.drag.mode === "move") {
      p.x = clamp(c.x, PLAYFIELD.goalX + 16, PLAYFIELD.spawnX - 16);
      p.y = clamp(c.y, PLAYFIELD.top + 16, PLAYFIELD.bottom - 16);
    } else {
      const dx = c.x - p.x;
      const dy = c.y - p.y;
      p.orientation = (Math.atan2(dy, dx) * 180) / Math.PI;
    }
  }

  private endDrag(): void {
    this.drag = null;
    ensurePath(this.state);
  }

  isDebug(): boolean {
    return this.state.diagnostic;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export type { CannonMode };
