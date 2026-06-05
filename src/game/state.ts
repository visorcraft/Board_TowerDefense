import { createRng } from "./rng.js";
import type { GameState, PersistedProgress } from "./types.js";
import { CANNON_MODES } from "./types.js";

export const CANVAS_WIDTH = 1920;
export const CANVAS_HEIGHT = 1080;
export const PLAYFIELD = {
  margin: 96,
  goalX: 96,
  spawnX: CANVAS_WIDTH - 96,
  top: 160,
  bottom: CANVAS_HEIGHT - 160,
};

export const GOAL_HP_MAX = 20;
export const BLOCK_REMOVAL_COST = 5;
export const BUILD_PHASE_MS = 18_000;
export const WAVE_INTERMISSION_MS = 1500;
export const ENEMY_CAP = 32;
export const TILE_SIZE = 24;

export const GOLD_PER_SECOND = 5;
export const PASSIVE_GOLD_PER_MS = GOLD_PER_SECOND / 1000;

export const ENEMY_DEFS = {
  walker: { hp: 1, speed: 60, reward: 3, damage: 1, size: 14 },
  runner: { hp: 1, speed: 110, reward: 4, damage: 1, size: 12 },
  tank: { hp: 5, speed: 40, reward: 8, damage: 1, size: 20 },
  swarm: { hp: 1, speed: 85, reward: 2, damage: 1, size: 9 },
  boss: { hp: 40, speed: 28, reward: 50, damage: 3, size: 36 },
};

export function defaultState(): GameState {
  return {
    rng: createRng(0xc0ffee),
    phase: "build",
    phaseTimerMs: BUILD_PHASE_MS,
    waveIndex: 0,
    goalHp: GOAL_HP_MAX,
    goalMaxHp: GOAL_HP_MAX,
    gold: 30,
    pieces: [],
    enemies: [],
    projectiles: [],
    particles: [],
    path: [],
    paths: [[], [], []],
    pathVersion: 0,
    nextPieceId: 1,
    nextEnemyId: 1,
    nextProjectileId: 1,
    nextParticleId: 1,
    highestWave: 0,
    victories: 0,
    unlockedModes: ["single"],
    waveEnemiesRemaining: 0,
    waveEnemiesTotal: 0,
    waveSpawnQueue: [],
    waveSpawnTimerMs: 0,
    totalWaves: 6,
    saveDirty: false,
    blockRemovalCost: BLOCK_REMOVAL_COST,
    buildPhaseMs: BUILD_PHASE_MS,
    paused: false,
    diagnostic: false,
    laneColors: [0x4f8fff, 0xff7a4f, 0x7aff4f],
    message: "Build phase: place pieces, then start the wave.",
    messageTimerMs: 4000,
    selectedPieceId: null,
    selectionTimerMs: 0,
    betweenWave: false,
    shopOpen: false,
    upgrades: { ringZap: 0, cannonRate: 0, stairSlow: 0, blockSize: 0 },
  };
}

export function applyProgress(state: GameState, progress: PersistedProgress | null): void {
  if (!progress) return;
  state.highestWave = Math.max(state.highestWave, progress.highestWave);
  state.victories = Math.max(state.victories, progress.victories);
  for (const m of progress.unlockedModes) {
    if (!state.unlockedModes.includes(m) && CANNON_MODES.includes(m)) {
      state.unlockedModes.push(m);
    }
  }
}

export function encodeProgress(state: GameState): PersistedProgress {
  return {
    highestWave: state.highestWave,
    victories: state.victories,
    unlockedModes: [...state.unlockedModes],
    version: 1,
  };
}
