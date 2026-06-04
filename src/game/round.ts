import type { GameState, PlacedPiece, Role } from "./types.js";
import { blockedSetFromPieces, buildDefaultLanes, findPath } from "./pathing.js";
import { PLAYFIELD, BUILD_PHASE_MS, GOAL_HP_MAX } from "./state.js";
import { buildWaveSpawns } from "./waves.js";
import { tickEnemies, tickParticles, tickPieces, tickProjectiles, tickWaveSpawns, fireCannons } from "./targeting.js";
import { tickEconomy } from "./economy.js";
import { createRng } from "./rng.js";

export const LANE_COUNT = 3;

export function ensurePath(state: GameState): void {
  const blocked = blockedSetFromPieces(state.pieces);
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
  state.message = victory ? "Victory! The Bloogs are safe." : "Defeat. The goal fell.";
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
  state.path = [];
  state.paths = [[], [], []];
  state.pathVersion++;
  state.message = "Fresh round. Place pieces, then start the wave.";
  state.messageTimerMs = 4000;
}

export function tick(state: GameState, dtMs: number): void {
  if (state.paused) return;
  if (state.phase === "build") {
    state.phaseTimerMs = Math.max(0, state.phaseTimerMs - dtMs);
    tickEconomy(state, dtMs);
    if (state.phaseTimerMs <= 0) startWave(state);
  } else if (state.phase === "wave") {
    ensurePath(state);
    tickWaveSpawns(state, dtMs);
    tickPieces(state, dtMs);
    fireCannons(state, dtMs);
    tickProjectiles(state, dtMs);
    tickEnemies(state, dtMs);
    tickParticles(state, dtMs);
    if (state.waveEnemiesRemaining === 0 && state.waveSpawnQueue.length === 0 && state.enemies.length === 0) {
      if (state.waveIndex >= state.totalWaves - 1) {
        endRound(state, true);
      } else {
        startNextRound(state);
      }
    }
    if (state.goalHp <= 0) {
      endRound(state, false);
    }
  } else if (state.phase === "victory" || state.phase === "defeat") {
    state.phaseTimerMs = Math.max(0, state.phaseTimerMs - dtMs);
    tickParticles(state, dtMs);
    if (state.phaseTimerMs <= 0) {
      if (state.phase === "defeat") resetRound(state);
      else {
        state.phase = "build";
        state.phaseTimerMs = BUILD_PHASE_MS;
        state.message = "Continue building, or start a new run.";
        state.messageTimerMs = 3000;
      }
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
    if (dx * dx + dy * dy <= 28 * 28) return p;
  }
  return null;
}

export function roleForPlacement(role: Role, x: number, y: number, laneCount: number): { x: number; y: number; lane: number } {
  const laneHeight = (PLAYFIELD.bottom - PLAYFIELD.top) / laneCount;
  const lane = Math.max(0, Math.min(laneCount - 1, Math.floor((y - PLAYFIELD.top) / laneHeight)));
  return { x, y, lane };
}
