import type { EnemySpawn, GameState, EnemyKind, Enemy, Vec2 } from "./types.js";
import { ENEMY_DEFS } from "./state.js";
import { rngInt, rngNext, rngPick } from "./rng.js";

const LANE_COUNT = 3;

const WAVE_DEFS: Array<{
  size: number;
  composition: Array<{ kind: EnemyKind; weight: number }>;
  spacing: [number, number];
}> = [
  { size: 8, composition: [{ kind: "walker", weight: 1 }], spacing: [700, 1100] },
  { size: 12, composition: [{ kind: "walker", weight: 1 }, { kind: "runner", weight: 0.4 }], spacing: [550, 950] },
  { size: 18, composition: [{ kind: "walker", weight: 1 }, { kind: "runner", weight: 0.7 }, { kind: "tank", weight: 0.2 }], spacing: [450, 800] },
  { size: 22, composition: [{ kind: "walker", weight: 0.6 }, { kind: "runner", weight: 1 }, { kind: "tank", weight: 0.5 }, { kind: "swarm", weight: 0.4 }], spacing: [380, 700] },
  { size: 26, composition: [{ kind: "runner", weight: 1 }, { kind: "tank", weight: 0.7 }, { kind: "swarm", weight: 0.7 }], spacing: [320, 600] },
  { size: 1, composition: [{ kind: "boss", weight: 1 }], spacing: [0, 0] },
];

export function buildWaveSpawns(state: GameState, waveIndex: number): EnemySpawn[] {
  const def = WAVE_DEFS[Math.min(waveIndex, WAVE_DEFS.length - 1)];
  const queue: EnemySpawn[] = [];
  const pool: EnemyKind[] = [];
  for (const c of def.composition) {
    const n = Math.round(c.weight * 10);
    for (let i = 0; i < n; i++) pool.push(c.kind);
  }
  if (waveIndex === WAVE_DEFS.length - 1) {
    queue.push({ kind: "boss", delayMs: 800, lane: 1 });
    return queue;
  }
  let t = 600;
  for (let i = 0; i < def.size; i++) {
    const kind = rngPick(state.rng, pool);
    const lane = rngInt(state.rng, 0, LANE_COUNT);
    queue.push({ kind, delayMs: t, lane });
    const [a, b] = def.spacing;
    t += a + rngNext(state.rng) * (b - a);
  }
  return queue;
}

export function enemySpawnToEnemy(spawn: EnemySpawn, id: number, path: Vec2[], enteredAt: number): Enemy {
  const def = ENEMY_DEFS[spawn.kind];
  return {
    id,
    kind: spawn.kind,
    hp: def.hp,
    maxHp: def.hp,
    speed: def.speed,
    reward: def.reward,
    damage: def.damage,
    slowTimerMs: 0,
    slowFactor: 1,
    pos: { x: path[0].x, y: path[0].y },
    path: path.map((p) => ({ x: p.x, y: p.y })),
    pathIndex: 0,
    lane: spawn.lane,
    size: def.size,
    enteredAt,
    pierceDamageLeft: 1,
  };
}

