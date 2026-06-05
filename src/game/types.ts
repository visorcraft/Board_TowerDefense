export type Role = "cannon" | "block" | "stair" | "ring" | "unknown";

export interface PieceMappingEntry {
  glyphId: number;
  role: Role;
  label?: string;
  lane?: number;
  defaultMode?: CannonMode;
}

export interface PieceMapping {
  description: string;
  defaultLaneColors: number[];
  entries: PieceMappingEntry[];
  fingerPlacement: {
    placePiece: "lmb" | "rmb" | "mmb";
    rotatePiece: "q" | "e" | "r";
    cycleMode: "f" | "tab";
  };
}

export type CannonMode = "single" | "multi" | "slow" | "pierce";

export const CANNON_MODES: CannonMode[] = ["single", "multi", "slow", "pierce"];

export interface Vec2 {
  x: number;
  y: number;
}

export interface PlacedPiece {
  id: number;
  role: Role;
  x: number;
  y: number;
  orientation: number;
  mode: CannonMode;
  ringTimerMs: number;
  fireCooldownMs: number;
  hp: number;
  zapTimerMs: number;
}

export type EnemyKind = "walker" | "runner" | "tank" | "swarm" | "boss";

export interface Enemy {
  id: number;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  speed: number;
  reward: number;
  damage: number;
  slowTimerMs: number;
  slowFactor: number;
  pos: Vec2;
  path: Vec2[];
  pathIndex: number;
  lane: number;
  size: number;
  swarmOffset?: Vec2;
  enteredAt: number;
  pierceDamageLeft: number;
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  pierce: boolean;
  slow: boolean;
  ttlMs: number;
  lifeMs: number;
  hitIds: Set<number>;
  sourcePieceId: number;
  isMulti: boolean;
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifeMs: number;
  maxLifeMs: number;
  size: number;
  color: string;
  kind: "hit" | "death" | "place" | "ring";
}

export type Phase = "build" | "wave" | "victory" | "defeat";

export interface GameState {
  rng: SeededRng;
  phase: Phase;
  phaseTimerMs: number;
  waveIndex: number;
  goalHp: number;
  goalMaxHp: number;
  gold: number;
  pieces: PlacedPiece[];
  enemies: Enemy[];
  projectiles: Projectile[];
  particles: Particle[];
  path: Vec2[];
  paths: Vec2[][];
  pathVersion: number;
  nextPieceId: number;
  nextEnemyId: number;
  nextProjectileId: number;
  nextParticleId: number;
  highestWave: number;
  victories: number;
  unlockedModes: CannonMode[];
  waveEnemiesRemaining: number;
  waveEnemiesTotal: number;
  waveSpawnQueue: EnemySpawn[];
  waveSpawnTimerMs: number;
  totalWaves: number;
  saveDirty: boolean;
  blockRemovalCost: number;
  buildPhaseMs: number;
  paused: boolean;
  diagnostic: boolean;
  laneColors: number[];
  message: string;
  messageTimerMs: number;
  selectedPieceId: number | null;
  selectionTimerMs: number;
  betweenWave: boolean;
  shopOpen: boolean;
  upgrades: PieceUpgrades;
}

export interface PieceUpgrades {
  ringZap: number;
  cannonRate: number;
  stairSlow: number;
  blockSize: number;
}

export const MAX_UPGRADE_LEVEL = 3;
export const UPGRADE_COST_PER_LEVEL = [20, 40, 80, 160];

export interface EnemySpawn {
  kind: EnemyKind;
  delayMs: number;
  lane: number;
}

export interface SeededRng {
  seed: number;
  state: number;
}

export interface FrameSnapshot {
  pieces: ReadonlyArray<PlacedPiece>;
  enemies: ReadonlyArray<Enemy>;
  projectiles: ReadonlyArray<Projectile>;
  particles: ReadonlyArray<Particle>;
}

export interface PersistedProgress {
  highestWave: number;
  victories: number;
  unlockedModes: CannonMode[];
  version: number;
}
