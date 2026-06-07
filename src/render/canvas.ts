import { CANVAS_HEIGHT, CANVAS_WIDTH, PLAYFIELD } from "../game/state.js";
import type { GameState, PlacedPiece, Enemy, Projectile, Particle, Vec2, PieceUpgrades } from "../game/types.js";
import { MAX_UPGRADE_LEVEL, UPGRADE_COST_PER_LEVEL } from "../game/types.js";
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
import { cannonModeColor, RING_ZAP_RADIUS } from "../game/targeting.js";

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
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (const p of path) ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  drawGoal(ctx);
  drawSpawn(ctx);
  drawFrame(ctx, playLeft, playTop, playRight - playLeft, playBottom - playTop);
  void state;
}

function drawGoal(ctx: CanvasRenderingContext2D): void {
  const x = PLAYFIELD.spawnX - 30;
  const y = (PLAYFIELD.top + PLAYFIELD.bottom) / 2;
  const w = 60;
  const h = 220;
  fillRect(ctx, x, y - h / 2, w, h, "#3a1a25");
  strokeRect(ctx, x, y - h / 2, w, h, PALETTE.hp, 4);
  drawText(ctx, "GOAL", x + w / 2, y - h / 2 - 28, PALETTE.hp, 18, "center", "middle");
}

function drawSpawn(ctx: CanvasRenderingContext2D): void {
  const x = PLAYFIELD.goalX - 30;
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
    drawCircle(ctx, p.x, p.y, 29, rgba(cannonModeColor(p.mode), 0.5), false);
  }
  if (p.role === "ring") {
    drawCircle(ctx, p.x, p.y, RING_ZAP_RADIUS, rgba(PALETTE.piece.ring, 0.15), true);
    drawCircle(ctx, p.x, p.y, RING_ZAP_RADIUS, rgba(PALETTE.piece.ring, 0.45), false);
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
  const cx = e.pos.x;
  const cy = e.pos.y;
  const r = e.size;
  // outer glow
  const glow = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 1.3);
  glow.addColorStop(0, "rgba(0,0,0,0)");
  glow.addColorStop(0.7, "rgba(0,0,0,0)");
  glow.addColorStop(1, rgba(color, 0.25));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.3, 0, Math.PI * 2);
  ctx.fill();
  // body
  const body = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.3, r * 0.1, cx, cy, r * 0.9);
  body.addColorStop(0, "#ffffff");
  body.addColorStop(0.3, color);
  body.addColorStop(1, "#1a1f30");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // rim
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = rgba("#ffffff", 0.3);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (e.kind === "swarm") {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const dx = Math.cos(a) * r * 0.6;
      const dy = Math.sin(a) * r * 0.6;
      ctx.fillStyle = rgba("#ffffff", 0.5);
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (e.slowTimerMs > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
    ctx.strokeStyle = "#5fb3ff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (e.kind === "boss") {
    const bossGlow = ctx.createRadialGradient(cx, cy, r, cx, cy, r + 14);
    bossGlow.addColorStop(0, "rgba(255,95,122,0.4)");
    bossGlow.addColorStop(1, "rgba(255,95,122,0)");
    ctx.fillStyle = bossGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 14, 0, Math.PI * 2);
    ctx.fill();
  }
  if (e.hp < e.maxHp) {
    const w = r * 2;
    const hp = e.hp / e.maxHp;
    ctx.fillStyle = "#1a0a10";
    ctx.fillRect(cx - w / 2, cy - r - 10, w, 5);
    const hpGrad = ctx.createLinearGradient(cx - w / 2, 0, cx - w / 2 + w * hp, 0);
    hpGrad.addColorStop(0, "#ff3040");
    hpGrad.addColorStop(1, color);
    ctx.fillStyle = hpGrad;
    ctx.fillRect(cx - w / 2, cy - r - 10, w * hp, 5);
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - w / 2, cy - r - 10, w, 5);
  }
}

export function drawProjectiles(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const p of state.projectiles) {
    const t = p.lifeMs / 1500;
    const color = p.slow ? "#5fb3ff" : p.pierce ? "#ff5f7a" : PALETTE.projectile;
    const r = (5 + 2 * (1 - t));
    // glow
    const glow = ctx.createRadialGradient(p.x, p.y, r * 0.3, p.x, p.y, r * 2);
    glow.addColorStop(0, color);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 2, 0, Math.PI * 2);
    ctx.fill();
    // core
    ctx.fillStyle = rgba("#ffffff", 1 - t * 0.3);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 0.6, 0, Math.PI * 2);
    ctx.fill();
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
  drawText(ctx, "Tower Defense", left, top, PALETTE.text, 32, "left", "top");
  drawText(ctx, `Wave ${state.waveIndex + 1} / ${state.totalWaves}`, left, top + 44, PALETTE.textDim, 20, "left", "top");
  drawText(ctx, `Phase: ${state.phase.toUpperCase()}`, left, top + 70, PALETTE.textDim, 18, "left", "top");
  if (state.phase === "build") {
    drawText(ctx, `Build time: ${(state.phaseTimerMs / 1000).toFixed(1)}s`, left, top + 94, PALETTE.gold, 18, "left", "top");
  }
  drawHudGold(ctx, state, left, top + 124);
  drawHudGoal(ctx, state, left, top + 162);
  drawHudProgress(ctx, state, CANVAS_WIDTH - 360, top);
  drawWaveProgress(ctx, state, tickFrame);
  drawShopHint(ctx, state, CANVAS_WIDTH / 2, top + 200, tickFrame);
  if (state.diagnostic) drawDebugStrip(ctx, state);
  if (state.messageTimerMs > 0) {
    const a = Math.min(1, state.messageTimerMs / 500);
    drawText(ctx, state.message, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 60, rgba(PALETTE.text, a), 26, "center", "middle");
  }
}

export function drawWaveProgress(ctx: CanvasRenderingContext2D, state: GameState, _tickFrame: number): void {
  if (state.phase === "victory" || state.phase === "defeat") return;
  if (state.phase === "build" && state.waveEnemiesTotal === 0) return;
  const w = 360;
  const h = 28;
  const x = Math.floor((CANVAS_WIDTH - w) / 2);
  const y = 24;
  const total = Math.max(1, state.waveEnemiesTotal);
  const cleared = total - state.waveEnemiesRemaining;
  const ratio = Math.max(0, Math.min(1, cleared / total));
  fillRect(ctx, x, y, w, h, "#161a28");
  strokeRect(ctx, x, y, w, h, PALETTE.panelLine, 2);
  fillRect(ctx, x, y, Math.floor(w * ratio), h, rgba("#5fb3ff", 0.7));
  const label = `Wave ${state.waveIndex + 1} — ${state.waveEnemiesRemaining} of ${total} remaining`;
  drawText(ctx, label, x + w / 2, y + h / 2, PALETTE.text, 16, "center", "middle");
}

export function drawPieceSellX(ctx: CanvasRenderingContext2D, piece: PlacedPiece, tickFrame: number): void {
  const cx = piece.x + 48;
  const cy = piece.y;
  const pulsing = (tickFrame % 60) < 30;
  fillRect(ctx, cx - 18, cy - 18, 36, 36, pulsing ? "#3a1a25" : "#2a0f17");
  strokeRect(ctx, cx - 18, cy - 18, 36, 36, PALETTE.hp, 3);
  ctx.lineWidth = 4;
  ctx.strokeStyle = PALETTE.hp;
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy - 8);
  ctx.lineTo(cx + 8, cy + 8);
  ctx.moveTo(cx + 8, cy - 8);
  ctx.lineTo(cx - 8, cy + 8);
  ctx.stroke();
  drawText(ctx, "SELL", cx + 30, cy - 24, PALETTE.hp, 14, "left", "middle");
  drawText(ctx, `${Math.ceil(((piece.role === "cannon" ? 25 : piece.role === "block" ? 8 : piece.role === "stair" ? 12 : piece.role === "ring" ? 30 : 0) / 2))}g`, cx + 30, cy + 4, PALETTE.gold, 18, "left", "middle");
}

export function pieceSellXBounds(piece: PlacedPiece): { x: number; y: number; w: number; h: number } {
  const cx = piece.x + 48;
  const cy = piece.y;
  return { x: cx - 22, y: cy - 22, w: 44, h: 44 };
}

export function drawPlayAgainButton(ctx: CanvasRenderingContext2D, tickFrame: number): void {
  const w = 480;
  const h = 120;
  const x = Math.floor((CANVAS_WIDTH - w) / 2);
  const y = Math.floor((CANVAS_HEIGHT - h) / 2) + 60;
  const pulsing = (tickFrame % 60) < 30;
  fillRect(ctx, x, y, w, h, pulsing ? "#1a2238" : "#13182a");
  strokeRect(ctx, x + 4, y + 4, w - 8, h - 8, "#ffce4a", 6);
  drawText(ctx, "PLAY AGAIN", x + w / 2, y + h / 2 - 8, PALETTE.gold, 56, "center", "middle");
  drawText(ctx, "(tap to start a new run)", x + w / 2, y + h + 28, PALETTE.textDim, 22, "center", "middle");
}

export function playAgainButtonBounds(): { x: number; y: number; w: number; h: number } {
  const w = 480;
  const h = 120;
  const x = Math.floor((CANVAS_WIDTH - w) / 2);
  const y = Math.floor((CANVAS_HEIGHT - h) / 2) + 60;
  return { x, y, w, h };
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
    drawText(ctx, it.role === "ring" ? "zap aura" : "tap to place", x0 + w / 2, y0 + 76, "#7c87a8", 12, "center", "top");
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
    drawText(ctx, "All waves cleared. You win!", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40, PALETTE.text, 28, "center", "middle");
  } else if (state.phase === "defeat") {
    ctx.fillStyle = rgba("#000", 0.7);
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawText(ctx, "DEFEAT", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40, PALETTE.hp, 96, "center", "middle");
    drawText(ctx, "The goal has fallen. Try again.", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40, PALETTE.text, 28, "center", "middle");
    drawText(ctx, "Auto-restart in " + Math.ceil(state.phaseTimerMs / 1000) + "s", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 90, "#7c87a8", 22, "center", "middle");
  }
  void (null as unknown as Vec2);
}

const UPGRADE_KEYS: Array<keyof PieceUpgrades> = ["ringZap", "cannonRate", "stairSlow", "blockSize"];

export function drawBetweenWaveOverlay(ctx: CanvasRenderingContext2D, state: GameState, tickFrame: number): void {
  ctx.fillStyle = rgba("#000", 0.55);
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  const cx = CANVAS_WIDTH / 2;
  const cy = CANVAS_HEIGHT / 2;
  const pulse = (tickFrame % 60) < 30;
  drawText(ctx, "WAVE " + state.waveIndex + " CLEARED", cx, cy - 120, PALETTE.gold, 64, "center", "middle");
  drawText(ctx, Math.floor(state.gold) + "g — buy upgrades, or start the next wave", cx, cy - 40, PALETTE.text, 26, "center", "middle");

  const shopB = betweenWaveShopButtonBounds();
  fillRect(ctx, shopB.x, shopB.y, shopB.w, shopB.h, "#10182e");
  strokeRect(ctx, shopB.x, shopB.y, shopB.w, shopB.h, "#5fb3ff", 5);
  drawText(ctx, "VISIT SHOP", shopB.x + shopB.w / 2, shopB.y + shopB.h / 2, "#5fb3ff", 40, "center", "middle");

  const startB = betweenWaveStartButtonBounds();
  fillRect(ctx, startB.x, startB.y, startB.w, startB.h, pulse ? "#0a1f0a" : "#051005");
  strokeRect(ctx, startB.x, startB.y, startB.w, startB.h, "#7aff4f", 5);
  drawText(ctx, "NEXT WAVE", startB.x + startB.w / 2, startB.y + startB.h / 2, "#7aff4f", 40, "center", "middle");

  drawText(ctx, "(also in the System Menu)", cx, startB.y + startB.h + 34, PALETTE.textDim, 20, "center", "middle");
}

export function betweenWaveShopButtonBounds(): { x: number; y: number; w: number; h: number } {
  const w = 440;
  const h = 100;
  return { x: CANVAS_WIDTH / 2 - w - 30, y: CANVAS_HEIGHT / 2 + 40, w, h };
}

export function betweenWaveStartButtonBounds(): { x: number; y: number; w: number; h: number } {
  const w = 440;
  const h = 100;
  return { x: CANVAS_WIDTH / 2 + 30, y: CANVAS_HEIGHT / 2 + 40, w, h };
}

export function drawShopOverlay(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.fillStyle = rgba("#000", 0.75);
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawText(ctx, "UPGRADE SHOP", CANVAS_WIDTH / 2, 48, PALETTE.gold, 52, "center", "top");
  drawText(ctx, Math.floor(state.gold) + "g available   (tap ✕ DONE, top-left, to close)", CANVAS_WIDTH / 2, 108, PALETTE.text, 22, "center", "top");
  const cardW = 380;
  const cardH = 260;
  const gap = 40;
  const totalW = UPGRADE_KEYS.length * cardW + (UPGRADE_KEYS.length - 1) * gap;
  const left = Math.floor((CANVAS_WIDTH - totalW) / 2);
  const top = 160;
  for (let i = 0; i < UPGRADE_KEYS.length; i++) {
    const key = UPGRADE_KEYS[i];
    const x = left + i * (cardW + gap);
    const y = top;
    const level = state.upgrades[key];
    const maxed = level >= MAX_UPGRADE_LEVEL;
    const cost = maxed ? 0 : UPGRADE_COST_PER_LEVEL[level];
    const canAfford = !maxed && state.gold >= cost;
    fillRect(ctx, x, y, cardW, cardH, "#0d1326");
    strokeRect(ctx, x, y, cardW, cardH, maxed ? "#ffce4a" : canAfford ? "#5fb3ff" : "#3a3f55", 3);
    const role = roleForUpgradeKey(key);
    drawText(ctx, roleName(role), x + cardW / 2, y + 20, roleColor(role), 36, "center", "top");
    drawText(ctx, upgradeLabelName(key), x + cardW / 2, y + 64, PALETTE.textDim, 18, "center", "top");
    drawText(ctx, "Level " + level + "/" + MAX_UPGRADE_LEVEL, x + cardW / 2, y + 100, PALETTE.text, 22, "center", "top");
    if (!maxed) {
      drawText(ctx, upgradeDescText(key, level), x + cardW / 2, y + 140, PALETTE.textDim, 16, "center", "top");
      drawText(ctx, cost + "g", x + cardW / 2, y + 178, canAfford ? PALETTE.gold : PALETTE.hp, 28, "center", "top");
      const btnW = cardW - 20;
      const btnH = 56;
      const btnX = x + 10;
      const btnY = y + cardH - btnH - 8;
      fillRect(ctx, btnX, btnY, btnW, btnH, canAfford ? "#1a2238" : "#161a28");
      strokeRect(ctx, btnX, btnY, btnW, btnH, canAfford ? "#5fb3ff" : "#3a3f55", 3);
      drawText(ctx, "BUY", btnX + btnW / 2, btnY + btnH / 2, canAfford ? PALETTE.gold : "#7c87a8", 30, "center", "middle");
    } else {
      drawText(ctx, "MAX LEVEL", x + cardW / 2, y + 150, "#ffce4a", 32, "center", "top");
    }
  }
  const done = shopDoneButtonBounds();
  fillRect(ctx, done.x, done.y, done.w, done.h, "#1a2238");
  strokeRect(ctx, done.x, done.y, done.w, done.h, "#5fb3ff", 4);
  drawText(ctx, "✕ DONE", done.x + done.w / 2, done.y + done.h / 2, PALETTE.text, 36, "center", "middle");
}

export function shopBuyButtonBounds(key: keyof PieceUpgrades, state: GameState): { x: number; y: number; w: number; h: number } {
  const cardW = 380;
  const cardH = 260;
  const gap = 40;
  const totalW = UPGRADE_KEYS.length * cardW + (UPGRADE_KEYS.length - 1) * gap;
  const left = Math.floor((CANVAS_WIDTH - totalW) / 2);
  const top = 160;
  const i = UPGRADE_KEYS.indexOf(key);
  const x = left + i * (cardW + gap);
  const btnW = cardW - 20;
  const btnH = 56;
  const btnX = x + 10;
  const btnY = top + cardH - btnH - 8;
  return { x: btnX, y: btnY, w: btnW, h: btnH };
}

export function shopDoneButtonBounds(): { x: number; y: number; w: number; h: number } {
  // Top-left, above the playfield — clear of the bottom-edge and top-right bezel
  // noise that classifies as stray Glyph taps and used to close the shop.
  return { x: 60, y: 36, w: 320, h: 92 };
}

function roleForUpgradeKey(key: keyof PieceUpgrades): string {
  switch (key) {
    case "ringZap": return "ring";
    case "cannonRate": return "cannon";
    case "stairSlow": return "stair";
    case "blockSize": return "block";
  }
}

function roleName(role: string): string {
  switch (role) {
    case "ring": return "SHAPESHIFTER RING";
    case "cannon": return "CANNON";
    case "stair": return "STAIR";
    case "block": return "BLOCK";
  }
  return role.toUpperCase();
}

function roleColor(role: string): string {
  switch (role) {
    case "ring": return PALETTE.piece.ring;
    case "cannon": return PALETTE.piece.cannon;
    case "stair": return PALETTE.piece.stair;
    case "block": return PALETTE.piece.block;
  }
  return PALETTE.text;
}

function upgradeLabelName(key: keyof PieceUpgrades): string {
  switch (key) {
    case "ringZap": return "Zap damage";
    case "cannonRate": return "Fire rate";
    case "stairSlow": return "Slow strength";
    case "blockSize": return "Block size";
  }
}

function upgradeDescText(key: keyof PieceUpgrades, level: number): string {
  const nl = level + 1;
  switch (key) {
    case "ringZap": return (0.15 + level * 0.1).toFixed(2) + " → " + (0.15 + nl * 0.1).toFixed(2) + " dmg/tick";
    case "cannonRate": return ((1 - level * 0.2) * 100).toFixed(0) + " → " + ((1 - nl * 0.2) * 100).toFixed(0) + "% cooldown";
    case "stairSlow": return (0.55 - level * 0.15).toFixed(2) + " → " + (0.55 - nl * 0.15).toFixed(2) + "× speed";
    case "blockSize": return (level + 1) + " → " + (nl + 1) + " tile radius";
  }
}
