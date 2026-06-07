import type { GameState, PlacedPiece, Role, PieceUpgrades } from "./types.js";
import { MAX_UPGRADE_LEVEL, UPGRADE_COST_PER_LEVEL } from "./types.js";
import { blockedSetFromPieces, buildDefaultLanes, findPath } from "./pathing.js";
import { PLAYFIELD, BUILD_PHASE_MS, GOAL_HP_MAX } from "./state.js";
import { buildWaveSpawns } from "./waves.js";
import { tickEnemies, tickParticles, tickPieces, tickProjectiles, tickWaveSpawns, fireCannons } from "./targeting.js";
import { tickEconomy } from "./economy.js";
import { createRng } from "./rng.js";

export const LANE_COUNT = 3;

export function ensurePath(state: GameState): void {
  const blocked = blockedSetFromPieces(state.pieces, state.upgrades.blockSize);
  const lanes = buildDefaultLanes(LANE_COUNT);
  for (let i = 0; i < lanes.length; i++) {
    const start = lanes[i][0];
    const end = lanes[i][lanes[i].length - 1];
    const res = findPath(start, end, blocked, i, LANE_COUNT);
    state.paths[i] = res.path;
  }
  state.path = state.paths[0];
  state.pathVersion++;
}

export function startWave(state: GameState): void {
  if (state.phase !== "build") return;
  if (state.waveIndex >= state.totalWaves) return;
  state.waveSpawnQueue = buildWaveSpawns(state, state.waveIndex);
  state.waveSpawnTimerMs = 0;
  state.waveEnemiesRemaining = state.waveSpawnQueue.length;
  state.waveEnemiesTotal = state.waveSpawnQueue.length;
  state.phase = "wave";
  state.phaseTimerMs = 0;
  state.message = `Wave ${state.waveIndex + 1} of ${state.totalWaves}: incoming!`;
  state.messageTimerMs = 2200;
}

export function startNextRound(state: GameState): void {
  state.waveIndex++;
  if (state.waveIndex > state.highestWave) {
    state.highestWave = state.waveIndex;
    state.saveDirty = true;
  }
  state.phase = "build";
  state.phaseTimerMs = BUILD_PHASE_MS;
  state.message = `Build phase for wave ${state.waveIndex + 1}.`;
  state.messageTimerMs = 3000;
}

export function endRound(state: GameState, victory: boolean): void {
  state.phase = victory ? "victory" : "defeat";
  state.phaseTimerMs = victory ? 6000 : 5000;
  state.message = victory ? "Victory! All waves cleared." : "Defeat. The goal fell.";
  state.messageTimerMs = victory ? 6000 : 5000;
  if (victory) {
    state.victories++;
    state.saveDirty = true;
    for (const m of ["multi", "slow", "pierce"] as const) {
      if (!state.unlockedModes.includes(m)) state.unlockedModes.push(m);
    }
  }
}

export function resetRound(state: GameState): void {
  state.rng = createRng((Date.now() & 0xffffffff) >>> 0);
  state.phase = "build";
  state.phaseTimerMs = BUILD_PHASE_MS;
  state.waveIndex = 0;
  state.goalHp = GOAL_HP_MAX;
  state.gold = 30;
  state.pieces = [];
  state.enemies = [];
  state.projectiles = [];
  state.particles = [];
  state.waveSpawnQueue = [];
  state.waveSpawnTimerMs = 0;
  state.waveEnemiesRemaining = 0;
  state.waveEnemiesTotal = 0;
  state.path = [];
  state.paths = [[], [], []];
  state.pathVersion++;
  state.selectedPieceId = null;
  state.selectionTimerMs = 0;
  state.betweenWave = false;
  state.shopOpen = false;
  state.upgrades = { ringZap: 0, cannonRate: 0, stairSlow: 0, blockSize: 0 };
  state.message = "New game. Place pieces, then start the wave.";
  state.messageTimerMs = 4000;
}

export function tick(state: GameState, dtMs: number): void {
  if (state.paused) return;
  if (state.phase === "build") {
    if (!state.betweenWave) {
      tickEconomy(state, dtMs);
      // Pause the build countdown (and its auto-start) while the shop is open, so
      // the wave can't start underneath the Visit Shop overlay.
      if (!state.shopOpen) {
        state.phaseTimerMs = Math.max(0, state.phaseTimerMs - dtMs);
        if (state.phaseTimerMs <= 0) startWave(state);
      }
    }
  } else if (state.phase === "wave") {
    tickWaveSpawns(state, dtMs);
    tickPieces(state, dtMs);
    fireCannons(state, dtMs);
    tickProjectiles(state, dtMs);
    tickEnemies(state, dtMs);
    tickParticles(state, dtMs);
    if (!state.betweenWave && state.waveEnemiesRemaining === 0 && state.waveSpawnQueue.length === 0 && state.enemies.length === 0) {
      if (state.waveIndex >= state.totalWaves - 1) {
        endRound(state, true);
      } else {
        state.waveIndex++;
        if (state.waveIndex > state.highestWave) {
          state.highestWave = state.waveIndex;
          state.saveDirty = true;
        }
        state.phase = "build";
        state.phaseTimerMs = 30000;
        state.betweenWave = true;
        state.shopOpen = false;
        state.message = "Wave cleared! Visit the shop or start next wave.";
        state.messageTimerMs = 5000;
      }
    }
    if (state.goalHp <= 0) {
      endRound(state, false);
    }
  } else if (state.phase === "victory") {
    tickParticles(state, dtMs);
  } else if (state.phase === "defeat") {
    state.phaseTimerMs = Math.max(0, state.phaseTimerMs - dtMs);
    tickParticles(state, dtMs);
    if (state.phaseTimerMs <= 0) {
      resetRound(state);
    }
  }
  if (state.messageTimerMs > 0) {
    state.messageTimerMs = Math.max(0, state.messageTimerMs - dtMs);
  }
}

export function pieceAt(state: GameState, x: number, y: number): PlacedPiece | null {
  for (const p of state.pieces) {
    const dx = p.x - x;
    const dy = p.y - y;
    if (dx * dx + dy * dy <= 26 * 26) return p;
  }
  return null;
}

export function startWaveFromBetween(state: GameState): void {
  if (!state.betweenWave) return;
  state.betweenWave = false;
  state.shopOpen = false;
  startWave(state);
}

/** The shop is available while placing pieces (build phase) or between waves — not mid-wave. */
export function canOpenShop(state: GameState): boolean {
  return state.betweenWave || state.phase === "build";
}

export function openShop(state: GameState): void {
  if (canOpenShop(state)) state.shopOpen = true;
}

export function closeShop(state: GameState): void {
  state.shopOpen = false;
}

export function buyUpgrade(state: GameState, upgrade: keyof PieceUpgrades): number {
  const level = state.upgrades[upgrade];
  if (level >= MAX_UPGRADE_LEVEL) return -1;
  const cost = UPGRADE_COST_PER_LEVEL[level];
  if (state.gold < cost) return -2;
  state.gold -= cost;
  state.upgrades[upgrade] = level + 1;
  state.saveDirty = true;
  return cost;
}

export function upgradeLabel(key: keyof PieceUpgrades): string {
  switch (key) {
    case "ringZap": return "Zap damage";
    case "cannonRate": return "Fire rate";
    case "stairSlow": return "Slow strength";
    case "blockSize": return "Block size";
  }
}

export function roleForUpgrade(key: keyof PieceUpgrades): string {
  switch (key) {
    case "ringZap": return "ring";
    case "cannonRate": return "cannon";
    case "stairSlow": return "stair";
    case "blockSize": return "block";
  }
}

export function upgradeDesc(key: keyof PieceUpgrades, level: number): string {
  const next = level + 1;
  switch (key) {
    case "ringZap": return "Zap dmg: " + (0.15 + level * 0.1).toFixed(2) + " → " + (0.15 + next * 0.1).toFixed(2) + "/tick";
    case "cannonRate": return "Cooldown: " + ((1 - level * 0.2) * 100).toFixed(0) + "% → " + ((1 - next * 0.2) * 100).toFixed(0) + "% of base";
    case "stairSlow": return "Slow: " + (0.55 - level * 0.15).toFixed(2) + "× → " + (0.55 - next * 0.15).toFixed(2) + "× speed";
    case "blockSize": return "Tiles: +" + (level + 1) + " → +" + (next + 1) + " blocked";
  }
}

export function roleForPlacement(role: Role, x: number, y: number, laneCount: number): { x: number; y: number; lane: number } {
  const laneHeight = (PLAYFIELD.bottom - PLAYFIELD.top) / laneCount;
  const lane = Math.max(0, Math.min(laneCount - 1, Math.floor((y - PLAYFIELD.top) / laneHeight)));
  return { x, y, lane };
}
