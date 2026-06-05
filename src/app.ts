import { PLAYFIELD, CANVAS_WIDTH, defaultState } from "./game/state.js";
import { tick, pieceAt, roleForPlacement, ensurePath, startWave, resetRound, startWaveFromBetween, openShop, closeShop, buyUpgrade } from "./game/round.js";
import type { InputSource } from "./board/boardInput.js";
import { type DevContact } from "./board/boardInput.js";
import type { PieceMappingTable } from "./board/pieceMapping.js";
import { drawBackground, drawEnemies, drawHud, drawParticles, drawPieces, drawPhaseOverlay, drawPieceSellX, drawPlayAgainButton, drawProjectiles, drawBetweenWaveOverlay, drawShopOverlay, pieceSellXBounds, playAgainButtonBounds, shopBuyButtonBounds, shopDoneButtonBounds, setupCanvas } from "./render/canvas.js";
import { CANNON_MODES, type CannonMode, type GameState, type Role, type PieceUpgrades } from "./game/types.js";
import { setCannonMode } from "./game/targeting.js";
import { placePiece, sellPiece } from "./game/economy.js";
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

  private ctx: CanvasRenderingContext2D | null = null;

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
    const r = setupCanvas(this.canvas);
    this.ctx = r.ctx;
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
        this.stop();
        if (Board.isOnDevice) {
          try {
            Board.application.quit();
          } catch (e) {
            this.debugMsg = "quit threw: " + String(e);
          }
        }
      },
      onNextWave: () => {
        startWaveFromBetween(this.state);
        this.audio.play("wave");
      },
      onVisitShop: () => {
        if (this.state.betweenWave) openShop(this.state);
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
    if (this.state.selectionTimerMs > 0) {
      this.state.selectionTimerMs = Math.max(0, this.state.selectionTimerMs - dt);
      if (this.state.selectionTimerMs <= 0) {
        this.state.selectedPieceId = null;
      }
    }
    this.render();
  }

  private render(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (this.state.diagnostic) {
      drawDiagnostic(ctx, this.diagLog, this.mapping, Board.isOnDevice);
      this.drawDiagButton(ctx);
      return;
    }
    drawBackground(ctx, this.state);
    drawPieces(ctx, this.state);
    if (this.state.selectedPieceId !== null) {
      const sel = this.state.pieces.find((p) => p.id === this.state.selectedPieceId);
      if (sel) drawPieceSellX(ctx, sel, this.tickFrame);
    }
    drawEnemies(ctx, this.state);
    drawProjectiles(ctx, this.state);
    drawParticles(ctx, this.state);
    drawHud(ctx, this.state, this.tickFrame);
    this.drawDiagButton(ctx);
    if (this.state.shopOpen) {
      drawShopOverlay(ctx, this.state);
    } else if (this.state.betweenWave) {
      drawBetweenWaveOverlay(ctx, this.state, this.tickFrame);
    }
    if (this.state.phase === "victory") {
      drawPlayAgainButton(ctx, this.tickFrame);
    }
    drawPhaseOverlay(ctx, this.state);
  }

  private drawDiagButton(_ctx: CanvasRenderingContext2D): void {
    // DIAG button removed; diagnostic is reachable via System Menu → Diagnostic Screen
    // or by long-pressing anywhere on the canvas.
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
      const isFirstSeen = !prev && !ended;
      const lifted = prev?.isTouched && !c.isTouched;
      const trigger = began || isFirstSeen;
      if (trigger || (prev && (c.phase === "Moved" || c.phase === "Stationary") && !this.drag)) {
      if (trigger) this.audio.resume();
      if (c.glyphId > 0) {
        this.onPieceBegan(c);
      } else if (c.type === "Finger" && trigger) {
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
    if (this.state.shopOpen) {
      const db = shopDoneButtonBounds();
      if (c.x >= db.x && c.x <= db.x + db.w && c.y >= db.y && c.y <= db.y + db.h) {
        closeShop(this.state);
        this.state.message = "Shop closed.";
        this.state.messageTimerMs = 1200;
        return;
      }
      for (const key of ["ringZap", "cannonRate", "stairSlow", "blockSize"] as Array<keyof PieceUpgrades>) {
        const bb = shopBuyButtonBounds(key, this.state);
        if (c.x >= bb.x && c.x <= bb.x + bb.w && c.y >= bb.y && c.y <= bb.y + bb.h) {
          const result = buyUpgrade(this.state, key);
          if (result > 0) {
            this.audio.play("ring");
            this.state.message = "Upgraded " + key + " to lvl " + this.state.upgrades[key] + " for " + result + "g.";
            this.state.messageTimerMs = 2000;
          } else if (result === -1) {
            this.state.message = "Already max level.";
            this.state.messageTimerMs = 1500;
          } else {
            this.state.message = "Not enough gold.";
            this.state.messageTimerMs = 1500;
          }
          return;
        }
      }
      this.state.message = "tap@" + Math.round(c.x) + "," + Math.round(c.y) + " (no btn)";
      this.state.messageTimerMs = 800;
      return;
    }
    if (this.state.betweenWave) {
      this.state.shopOpen = false;
      this.state.message = "Starting wave " + (this.state.waveIndex + 1) + "...";
      this.state.messageTimerMs = 1500;
      startWaveFromBetween(this.state);
      this.audio.play("wave");
      return;
    }
    if (this.state.selectedPieceId !== null) {
      const sel = this.state.pieces.find((p) => p.id === this.state.selectedPieceId);
      if (sel) {
        const bounds = pieceSellXBounds(sel);
        if (c.x >= bounds.x && c.x <= bounds.x + bounds.w && c.y >= bounds.y && c.y <= bounds.y + bounds.h) {
          const refund = sellPiece(this.state, sel.id);
          this.state.selectedPieceId = null;
          this.state.message = `Sold ${sel.role} for ${refund}g.`;
          this.state.messageTimerMs = 1800;
          this.audio.play("ring");
          return;
        }
      }
    }
    if (this.state.phase === "victory") {
      const pb = playAgainButtonBounds();
      if (c.x >= pb.x && c.x <= pb.x + pb.w && c.y >= pb.y && c.y <= pb.y + pb.h) {
        resetRound(this.state);
        this.state.message = "New run. Place pieces, then start the wave.";
        this.state.messageTimerMs = 2400;
        return;
      }
    }
    const existing = pieceAt(this.state, c.x, c.y);
    if (existing) {
      this.state.selectedPieceId = existing.id;
      this.state.selectionTimerMs = 6000;
      this.audio.play("ring");
      return;
    }
    this.state.selectedPieceId = null;
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
