import { CANVAS_HEIGHT, CANVAS_WIDTH, PLAYFIELD } from "../game/state.js";
import type { GameState, PlacedPiece, Enemy, Projectile, Particle, Vec2 } from "../game/types.js";
import { LANE_COUNT } from "../game/round.js";
import { PALETTE, rgba } from "./palette.js";
import {
  blockSprite,
  cannonSprite,
  drawCircle,
  drawSprite,
  drawText,
  fillRect,
  laneColor,
  laneColorDim,
  laneColorRgba,
  ringSprite,
  stairSprite,
  strokeRect,
} from "./sprites.js";
import { cannonModeColor } from "../game/targeting.js";

const SPRITES = {
  cannon: cannonSprite(),
  block: blockSprite(),
  stair: stairSprite(),
  ring: ringSprite(),
};

export function setupCanvas(canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; scale: number } {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("2d context unavailable");
  ctx.imageSmoothingEnabled = false;
  const scale = Math.min(window.innerWidth / CANVAS_WIDTH, window.innerHeight / CANVAS_HEIGHT);
  canvas.style.width = `${Math.floor(CANVAS_WIDTH * scale)}px`;
  canvas.style.height = `${Math.floor(CANVAS_HEIGHT * scale)}px`;
  return { ctx, scale };
}

export function drawBackground(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.fillStyle = PALETTE.bg0;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  grad.addColorStop(0, rgba(PALETTE.lane[0], 0.05));
  grad.addColorStop(1, rgba(PALETTE.lane[2], 0.04));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  const playLeft = PLAYFIELD.goalX;
  const playRight = PLAYFIELD.spawnX;
  const playTop = PLAYFIELD.top;
  const playBottom = PLAYFIELD.bottom;
  const laneHeight = (playBottom - playTop) / LANE_COUNT;
  for (let i = 0; i < LANE_COUNT; i++) {
    const y = playTop + i * laneHeight;
    fillRect(ctx, playLeft, y, playRight - playLeft, laneHeight, i % 2 === 0 ? "#0d1326" : "#0a0f1f");
  }
  for (let i = 1; i < LANE_COUNT; i++) {
    const y = Math.floor(playTop + i * laneHeight);
    strokeRect(ctx, playLeft, y, playRight - playLeft, 1, laneColorDim(i), 1);
  }
  for (let i = 0; i < LANE_COUNT; i++) {
    const path = state.paths[i];
    if (!path || path.length < 2) continue;
    ctx.strokeStyle = laneColorRgba(i, 0.35);
    ctx.lineWidth = 6;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (const p of path) ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  drawGoal(ctx);
  drawSpawn(ctx);
  drawFrame(ctx, playLeft, playTop, playRight - playLeft, playBottom - playTop);
  void state;
}

function drawGoal(ctx: CanvasRenderingContext2D): void {
  const x = PLAYFIELD.goalX - 30;
  const y = (PLAYFIELD.top + PLAYFIELD.bottom) / 2;
  const w = 60;
  const h = 220;
  fillRect(ctx, x, y - h / 2, w, h, "#3a1a25");
  strokeRect(ctx, x, y - h / 2, w, h, PALETTE.hp, 4);
  drawText(ctx, "GOAL", x + w / 2, y - h / 2 - 28, PALETTE.hp, 18, "center", "middle");
}

function drawSpawn(ctx: CanvasRenderingContext2D): void {
  const x = PLAYFIELD.spawnX - 30;
  const y = (PLAYFIELD.top + PLAYFIELD.bottom) / 2;
  const w = 60;
  const h = 220;
  fillRect(ctx, x, y - h / 2, w, h, "#1a2238");
  strokeRect(ctx, x, y - h / 2, w, h, "#5fb3ff", 4);
  drawText(ctx, "SPAWN", x + w / 2, y - h / 2 - 28, "#5fb3ff", 18, "center", "middle");
}

function drawFrame(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  strokeRect(ctx, x - 4, y - 4, w + 8, h + 8, PALETTE.panelLine, 2);
}

export function drawPieces(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const p of state.pieces) {
    drawPiece(ctx, p);
  }
}

function drawPiece(ctx: CanvasRenderingContext2D, p: PlacedPiece): void {
  ctx.save();
  ctx.translate(Math.round(p.x), Math.round(p.y));
  const sprite = spriteFor(p);
  drawSprite(ctx, sprite, 0, 0, p.orientation);
  ctx.restore();
  if (p.ringTimerMs > 0) {
    const t = p.ringTimerMs / 6000;
    drawCircle(ctx, p.x, p.y, 30, rgba(PALETTE.piece.ring, 0.2 + 0.4 * t), false);
  }
  if (p.role === "cannon") {
    drawCircle(ctx, p.x, p.y, 18, rgba(cannonModeColor(p.mode), 0.6), false);
  }
  if (p.hp < (p.role === "block" ? 3 : 1)) {
    drawText(ctx, "x" + p.hp, p.x + 18, p.y - 22, PALETTE.hp, 14, "left", "middle");
  }
}

function spriteFor(p: PlacedPiece) {
  switch (p.role) {
    case "cannon":
      return SPRITES.cannon;
    case "block":
      return SPRITES.block;
    case "stair":
      return SPRITES.stair;
    case "ring":
      return SPRITES.ring;
    default:
      return SPRITES.cannon;
  }
}

export function drawEnemies(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const e of state.enemies) {
    drawEnemy(ctx, e);
  }
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy): void {
  const color = PALETTE.enemy[e.kind];
  drawCircle(ctx, e.pos.x, e.pos.y, e.size, color, true);
  drawCircle(ctx, e.pos.x, e.pos.y, e.size, "#1a1f30", false);
  if (e.slowTimerMs > 0) {
    drawCircle(ctx, e.pos.x, e.pos.y, e.size + 4, "#5fb3ff", false);
  }
  if (e.kind === "boss") {
    drawCircle(ctx, e.pos.x, e.pos.y, e.size + 8, rgba(color, 0.3), true);
  }
  if (e.hp < e.maxHp) {
    const w = e.size * 2;
    const hp = e.hp / e.maxHp;
    fillRect(ctx, e.pos.x - w / 2, e.pos.y - e.size - 10, w, 4, "#3a1a25");
    fillRect(ctx, e.pos.x - w / 2, e.pos.y - e.size - 10, w * hp, 4, color);
  }
}

export function drawProjectiles(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const p of state.projectiles) {
    const t = p.lifeMs / 1500;
    const color = p.slow ? "#5fb3ff" : p.pierce ? "#ff5f7a" : PALETTE.projectile;
    drawCircle(ctx, p.x, p.y, 5 + 2 * (1 - t), rgba(color, 1 - t * 0.4), true);
  }
  void state;
}

export function drawParticles(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const p of state.particles) {
    const a = p.lifeMs / p.maxLifeMs;
    drawCircle(ctx, p.x, p.y, p.size * a, rgba(p.color, a), true);
  }
  void state;
}

export function drawHud(ctx: CanvasRenderingContext2D, state: GameState, tickFrame: number): void {
  const top = 24;
  const left = 32;
  drawText(ctx, "Tower Defense — Save the Bloogs", left, top, PALETTE.text, 32, "left", "top");
  drawText(ctx, `Wave ${state.waveIndex + 1} / ${state.totalWaves}`, left, top + 44, PALETTE.textDim, 20, "left", "top");
  drawText(ctx, `Phase: ${state.phase.toUpperCase()}`, left, top + 70, PALETTE.textDim, 18, "left", "top");
  if (state.phase === "build") {
    drawText(ctx, `Build time: ${(state.phaseTimerMs / 1000).toFixed(1)}s`, left, top + 94, PALETTE.gold, 18, "left", "top");
  }
  drawHudGold(ctx, state, left, top + 124);
  drawHudGoal(ctx, state, left, top + 162);
  drawHudProgress(ctx, state, CANVAS_WIDTH - 360, top);
  drawShopHint(ctx, state, CANVAS_WIDTH / 2, top + 200, tickFrame);
  drawDebugStrip(ctx, state);
  if (state.messageTimerMs > 0) {
    const a = Math.min(1, state.messageTimerMs / 500);
    drawText(ctx, state.message, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 60, rgba(PALETTE.text, a), 26, "center", "middle");
  }
}

function drawHudGold(ctx: CanvasRenderingContext2D, state: GameState, x: number, y: number): void {
  drawText(ctx, "GOLD", x, y, PALETTE.goldDark, 16, "left", "top");
  drawText(ctx, Math.floor(state.gold).toString(), x, y + 18, PALETTE.gold, 32, "left", "top");
}

function drawHudGoal(ctx: CanvasRenderingContext2D, state: GameState, x: number, y: number): void {
  drawText(ctx, "GOAL", x, y, "#7c87a8", 16, "left", "top");
  const w = 240;
  const h = 22;
  fillRect(ctx, x, y + 22, w, h, PALETTE.hpBack);
  fillRect(ctx, x, y + 22, (w * state.goalHp) / state.goalMaxHp, h, PALETTE.hp);
  strokeRect(ctx, x, y + 22, w, h, "#3a1a25", 2);
  drawText(ctx, `${state.goalHp} / ${state.goalMaxHp}`, x + w / 2, y + 22 + h / 2 + 1, "#fff", 16, "center", "middle");
}

function drawHudProgress(ctx: CanvasRenderingContext2D, state: GameState, x: number, y: number): void {
  drawText(ctx, "PROGRESS", x, y, "#7c87a8", 16, "left", "top");
  drawText(ctx, `Highest wave: ${state.highestWave}`, x, y + 22, PALETTE.text, 18, "left", "top");
  drawText(ctx, `Victories: ${state.victories}`, x, y + 46, PALETTE.text, 18, "left", "top");
  drawText(ctx, `Unlocked: ${state.unlockedModes.join(", ")}`, x, y + 70, PALETTE.text, 18, "left", "top");
  void state;
}

function drawShopHint(ctx: CanvasRenderingContext2D, state: GameState, x: number, y: number, tickFrame: number): void {
  const y0 = y;
  const items: Array<{ key: string; role: "cannon" | "block" | "stair" | "ring"; cost: number }> = [
    { key: "1", role: "cannon", cost: 25 },
    { key: "2", role: "block", cost: 8 },
    { key: "3", role: "stair", cost: 12 },
    { key: "4", role: "ring", cost: 30 },
  ];
  const w = 130;
  const h = 90;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const x0 = x - (items.length * (w + 12)) / 2 + i * (w + 12);
    const canAfford = state.gold >= it.cost;
    const pulsing = canAfford && (tickFrame + i) % 60 < 30;
    fillRect(ctx, x0, y0, w, h, canAfford ? "#1a2238" : "#161a28");
    strokeRect(ctx, x0, y0, w, h, canAfford ? "#5fb3ff" : "#3a3f55", 2);
    if (pulsing) {
      strokeRect(ctx, x0 - 2, y0 - 2, w + 4, h + 4, "#ffce4a", 2);
    }
    drawText(ctx, `[${it.key}]`, x0 + 8, y0 + 8, "#7c87a8", 16, "left", "top");
    drawText(ctx, it.role.toUpperCase(), x0 + w / 2, y0 + 28, "#e6ecff", 18, "center", "top");
    drawText(ctx, `${it.cost}g`, x0 + w / 2, y0 + 54, canAfford ? PALETTE.gold : "#7c87a8", 22, "center", "top");
    drawText(ctx, it.role === "ring" ? "tap a cannon" : "tap to place", x0 + w / 2, y0 + 76, "#7c87a8", 12, "center", "top");
  }
  drawText(ctx, "[Space] Start wave   [D]/Long-press/DIAG   [R] Restart", x, y0 + h + 28, "#7c87a8", 16, "center", "top");
  drawText(ctx, "Tap to place • Drag to move • Press Q/E to rotate • System menu = pause", x, y0 + h + 52, "#7c87a8", 14, "center", "top");
  void state;
}

function drawDebugStrip(ctx: CanvasRenderingContext2D, state: GameState): void {
  const y = CANVAS_HEIGHT - 28;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, y, CANVAS_WIDTH, 28);
  ctx.font = "16px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const dbg = (state as GameState & { debugMsg?: string }).debugMsg ?? "—";
  ctx.fillStyle = "#7c87a8";
  ctx.fillText(`pause: ${dbg}`, 16, y + 14);
}

export function drawPhaseOverlay(ctx: CanvasRenderingContext2D, state: GameState): void {
  if (state.phase === "victory") {
    ctx.fillStyle = rgba("#000", 0.6);
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawText(ctx, "VICTORY", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40, PALETTE.gold, 96, "center", "middle");
    drawText(ctx, "All waves cleared. The Bloogs are safe.", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40, PALETTE.text, 28, "center", "middle");
  } else if (state.phase === "defeat") {
    ctx.fillStyle = rgba("#000", 0.7);
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawText(ctx, "DEFEAT", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40, PALETTE.hp, 96, "center", "middle");
    drawText(ctx, "The goal has fallen. Try again.", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40, PALETTE.text, 28, "center", "middle");
    drawText(ctx, "Auto-restart in " + Math.ceil(state.phaseTimerMs / 1000) + "s", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 90, "#7c87a8", 22, "center", "middle");
  }
  void (null as unknown as Vec2);
}
