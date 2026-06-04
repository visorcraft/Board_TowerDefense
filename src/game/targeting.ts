import { CANNON_MODES, type CannonMode, type Enemy, type GameState, type PlacedPiece, type Vec2 } from "./types.js";
import { rngRange } from "./rng.js";
import { ENEMY_DEFS, PLAYFIELD } from "./state.js";
import { enemySpawnToEnemy } from "./waves.js";

export const ACQUISITION_RANGE = 360;
export const FIRE_RANGE = 380;
export const RING_AURA_RANGE = 200;
export const RING_DURATION_MS = 6000;

export function setCannonMode(piece: PlacedPiece, mode: CannonMode): void {
  piece.mode = mode;
  piece.ringTimerMs = RING_DURATION_MS;
}

export function tickPieces(state: GameState, dtMs: number): void {
  for (const p of state.pieces) {
    if (p.ringTimerMs > 0) {
      p.ringTimerMs = Math.max(0, p.ringTimerMs - dtMs);
    }
    if (p.role !== "cannon") continue;
    if (p.ringTimerMs <= 0) {
      p.mode = p.mode === "multi" || p.mode === "slow" || p.mode === "pierce" ? "single" : p.mode;
    }
    p.fireCooldownMs = Math.max(0, p.fireCooldownMs - dtMs);
  }
}

export function selectTarget(piece: PlacedPiece, enemies: ReadonlyArray<Enemy>): Enemy | null {
  let best: Enemy | null = null;
  let bestDistSq = ACQUISITION_RANGE * ACQUISITION_RANGE;
  for (const e of enemies) {
    const dx = e.pos.x - piece.x;
    const dy = e.pos.y - piece.y;
    const distSq = dx * dx + dy * dy;
    if (distSq > bestDistSq) continue;
    const angleTo = (Math.atan2(dy, dx) * 180) / Math.PI;
    let diff = angleTo - piece.orientation;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    if (Math.abs(diff) > 50) continue;
    if (best === null || priority(e) > priority(best)) {
      best = e;
      bestDistSq = distSq;
    } else if (priority(e) === priority(best) && distSq < (best.pos.x - piece.x) ** 2 + (best.pos.y - piece.y) ** 2) {
      best = e;
      bestDistSq = distSq;
    }
  }
  return best;
}

function priority(e: Enemy): number {
  switch (e.kind) {
    case "boss":
      return 100;
    case "tank":
      return 60;
    case "runner":
      return 40;
    case "walker":
      return 30;
    case "swarm":
      return 20;
  }
}

export function fireCannons(state: GameState, dtMs: number): void {
  for (const p of state.pieces) {
    if (p.role !== "cannon") continue;
    if (p.fireCooldownMs > 0) continue;
    const target = selectTarget(p, state.enemies);
    if (!target) continue;
    const dx = target.pos.x - p.x;
    const dy = target.pos.y - p.y;
    const desiredAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
    p.orientation = lerpAngle(p.orientation, desiredAngle, 0.4);
    let diff = desiredAngle - p.orientation;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    if (Math.abs(diff) > 6) continue;
    shoot(state, p, target);
  }
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return a + diff * t;
}

function shoot(state: GameState, p: PlacedPiece, target: Enemy): void {
  const baseCooldown = 700;
  const baseDamage = 1;
  let cooldown = baseCooldown;
  let damage = baseDamage;
  let pierce = false;
  let slow = false;
  let multi = false;
  switch (p.mode) {
    case "single":
      cooldown = 700;
      break;
    case "multi":
      cooldown = 600;
      multi = true;
      break;
    case "slow":
      cooldown = 850;
      slow = true;
      break;
    case "pierce":
      cooldown = 900;
      pierce = true;
      damage = 2;
      break;
  }
  p.fireCooldownMs = cooldown;
  const speed = 720;
  const rad = (p.orientation * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  spawnProjectile(state, p, dx * speed, dy * speed, damage, pierce, slow, multi);
}

function spawnProjectile(
  state: GameState,
  p: PlacedPiece,
  vx: number,
  vy: number,
  damage: number,
  pierce: boolean,
  slow: boolean,
  multi: boolean,
): void {
  state.projectiles.push({
    id: state.nextProjectileId++,
    x: p.x,
    y: p.y,
    vx,
    vy,
    damage,
    pierce,
    slow,
    ttlMs: 1500,
    lifeMs: 0,
    hitIds: new Set(),
    sourcePieceId: p.id,
    isMulti: multi,
  });
  if (multi) {
    const spread = 0.18;
    for (const sign of [-1, 1]) {
      const a = Math.atan2(vy, vx) + sign * spread;
      const s = Math.hypot(vx, vy);
      state.projectiles.push({
        id: state.nextProjectileId++,
        x: p.x,
        y: p.y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        damage,
        pierce,
        slow,
        ttlMs: 1500,
        lifeMs: 0,
        hitIds: new Set(),
        sourcePieceId: p.id,
        isMulti: true,
      });
    }
  }
}

export function tickProjectiles(state: GameState, dtMs: number): void {
  const dt = dtMs / 1000;
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.lifeMs += dtMs;
    p.ttlMs -= dtMs;
    if (p.ttlMs <= 0 || p.x < -50 || p.x > 2000 || p.y < -50 || p.y > 1200) {
      state.projectiles.splice(i, 1);
      continue;
    }
    for (const e of state.enemies) {
      if (p.hitIds.has(e.id)) continue;
      const dx = e.pos.x - p.x;
      const dy = e.pos.y - p.y;
      const r = e.size + 4;
      if (dx * dx + dy * dy <= r * r) {
        applyHit(state, e, p);
        p.hitIds.add(e.id);
        if (!p.pierce) {
          state.projectiles.splice(i, 1);
          break;
        }
      }
    }
  }
}

function applyHit(state: GameState, e: Enemy, p: import("./types.js").Projectile): void {
  if (e.kind === "tank" && p.slow) {
    e.hp -= 0;
  } else {
    e.hp -= p.damage;
  }
  if (p.slow && e.kind !== "tank") {
    e.slowTimerMs = 1500;
    e.slowFactor = 0.55;
  }
  spawnHitParticles(state, e.pos.x, e.pos.y, p.isMulti ? 4 : 2, p.slow ? "#5fb3ff" : "#fff2a8");
  if (e.hp <= 0) {
    state.gold += e.reward;
    state.waveEnemiesRemaining = Math.max(0, state.waveEnemiesRemaining - 1);
    spawnDeathParticles(state, e.pos.x, e.pos.y, e.kind);
    const idx = state.enemies.findIndex((x) => x.id === e.id);
    if (idx >= 0) state.enemies.splice(idx, 1);
  }
}

export function tickEnemies(state: GameState, dtMs: number): void {
  const dt = dtMs / 1000;
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    if (e.slowTimerMs > 0) {
      e.slowTimerMs = Math.max(0, e.slowTimerMs - dtMs);
      if (e.slowTimerMs <= 0) e.slowFactor = 1;
    }
    const speed = e.speed * e.slowFactor;
    let moved = speed * dt;
    while (moved > 0 && e.pathIndex < e.path.length - 1) {
      const target = e.path[e.pathIndex + 1];
      const dx = target.x - e.pos.x;
      const dy = target.y - e.pos.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= moved) {
        e.pos.x = target.x;
        e.pos.y = target.y;
        e.pathIndex++;
        moved -= dist;
      } else {
        e.pos.x += (dx / dist) * moved;
        e.pos.y += (dy / dist) * moved;
        moved = 0;
      }
    }
    if (e.pathIndex >= e.path.length - 1) {
      state.goalHp = Math.max(0, state.goalHp - e.damage);
      state.waveEnemiesRemaining = Math.max(0, state.waveEnemiesRemaining - 1);
      const idx = state.enemies.findIndex((x) => x.id === e.id);
      if (idx >= 0) state.enemies.splice(idx, 1);
      state.message = `${e.kind} reached the goal!`;
      state.messageTimerMs = 1500;
    }
  }
}

export function tickWaveSpawns(state: GameState, dtMs: number): void {
  if (state.phase !== "wave") return;
  if (state.waveSpawnQueue.length === 0) return;
  state.waveSpawnTimerMs += dtMs;
  while (state.waveSpawnQueue.length > 0 && state.waveSpawnTimerMs >= state.waveSpawnQueue[0].delayMs) {
    const spawn = state.waveSpawnQueue.shift()!;
    if (state.enemies.length >= 32) {
      state.waveSpawnQueue.unshift(spawn);
      state.waveSpawnTimerMs -= 200;
      return;
    }
    const path = state.paths[spawn.lane] ?? state.path;
    const enemy = enemySpawnToEnemy(spawn, state.nextEnemyId++, path, performance.now());
    state.enemies.push(enemy);
    state.waveSpawnTimerMs -= spawn.delayMs;
  }
}

export function tickParticles(state: GameState, dtMs: number): void {
  const dt = dtMs / 1000;
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.lifeMs -= dtMs;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
    if (p.lifeMs <= 0) state.particles.splice(i, 1);
  }
}

export function spawnHitParticles(state: GameState, x: number, y: number, n: number, color: string): void {
  for (let i = 0; i < n; i++) {
    state.particles.push({
      id: state.nextParticleId++,
      x,
      y,
      vx: rngRange(state.rng, -120, 120),
      vy: rngRange(state.rng, -120, 120),
      lifeMs: 280,
      maxLifeMs: 280,
      size: 3,
      color,
      kind: "hit",
    });
  }
}

export function spawnDeathParticles(state: GameState, x: number, y: number, kind: Enemy["kind"]): void {
  const n = kind === "boss" ? 60 : kind === "swarm" ? 6 : 14;
  const c = kind === "boss" ? "#ff5f7a" : kind === "tank" ? "#9b6dff" : kind === "runner" ? "#ffb74f" : "#7be0a4";
  for (let i = 0; i < n; i++) {
    state.particles.push({
      id: state.nextParticleId++,
      x,
      y,
      vx: rngRange(state.rng, -260, 260),
      vy: rngRange(state.rng, -260, 260),
      lifeMs: 900,
      maxLifeMs: 900,
      size: kind === "boss" ? 5 : 3,
      color: c,
      kind: "death",
    });
  }
}

export function spawnPlaceParticles(state: GameState, x: number, y: number, color: string): void {
  for (let i = 0; i < 10; i++) {
    state.particles.push({
      id: state.nextParticleId++,
      x,
      y,
      vx: rngRange(state.rng, -80, 80),
      vy: rngRange(state.rng, -120, -10),
      lifeMs: 500,
      maxLifeMs: 500,
      size: 3,
      color,
      kind: "place",
    });
  }
}

export function cannonStats(mode: CannonMode): { cooldownMs: number; damage: number; slow: boolean; pierce: boolean; multi: boolean } {
  switch (mode) {
    case "single":
      return { cooldownMs: 700, damage: 1, slow: false, pierce: false, multi: false };
    case "multi":
      return { cooldownMs: 600, damage: 1, slow: false, pierce: false, multi: true };
    case "slow":
      return { cooldownMs: 850, damage: 1, slow: true, pierce: false, multi: false };
    case "pierce":
      return { cooldownMs: 900, damage: 2, slow: false, pierce: true, multi: false };
  }
}

export function spawnRingParticles(state: GameState, x: number, y: number): void {
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    state.particles.push({
      id: state.nextParticleId++,
      x,
      y,
      vx: Math.cos(a) * 140,
      vy: Math.sin(a) * 140,
      lifeMs: 700,
      maxLifeMs: 700,
      size: 4,
      color: "#ff7adf",
      kind: "ring",
    });
  }
}

export const cannonModeColor = (mode: CannonMode): string => {
  switch (mode) {
    case "single":
      return "#fff2a8";
    case "multi":
      return "#ff8a3d";
    case "slow":
      return "#5fb3ff";
    case "pierce":
      return "#ff5f7a";
  }
};

export const LANE_COUNT = 3;
