import { CANNON_MODES, type CannonMode, type Enemy, type GameState, type PlacedPiece, type Vec2 } from "./types.js";
import { rngRange } from "./rng.js";
import { ENEMY_DEFS, PLAYFIELD } from "./state.js";
import { enemySpawnToEnemy } from "./waves.js";

export const ACQUISITION_RANGE = 360;
export const FIRE_RANGE = 380;
export const RING_ZAP_RADIUS = 90;
export const RING_ZAP_RADIUS_SQ = RING_ZAP_RADIUS * RING_ZAP_RADIUS;
export const RING_ZAP_INTERVAL_MS = 250;
export const RING_ZAP_DAMAGE = 0.15;

export function setCannonMode(piece: PlacedPiece, mode: CannonMode): void {
  piece.mode = mode;
  piece.ringTimerMs = 6000;
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
  for (const p of state.pieces) {
    if (p.role !== "ring") continue;
    p.zapTimerMs += dtMs;
    while (p.zapTimerMs >= RING_ZAP_INTERVAL_MS) {
      p.zapTimerMs -= RING_ZAP_INTERVAL_MS;
      let hitCount = 0;
      const zapDamage = RING_ZAP_DAMAGE + state.upgrades.ringZap * 0.1;
      for (const e of state.enemies) {
        const dx = e.pos.x - p.x;
        const dy = e.pos.y - p.y;
        if (dx * dx + dy * dy <= RING_ZAP_RADIUS_SQ) {
          e.hp -= zapDamage;
          hitCount++;
          if (e.hp <= 0) {
            state.gold += e.reward;
            state.waveEnemiesRemaining = Math.max(0, state.waveEnemiesRemaining - 1);
            spawnDeathParticles(state, e.pos.x, e.pos.y, e.kind);
            const idx = state.enemies.findIndex((x) => x.id === e.id);
            if (idx >= 0) state.enemies.splice(idx, 1);
          } else {
            spawnHitParticles(state, e.pos.x, e.pos.y, 2, "#ff7adf");
          }
        }
      }
      if (hitCount === 0) {
        p.zapTimerMs = 0;
        break;
      }
    }
  }
}

export function selectTarget(piece: PlacedPiece, enemies: ReadonlyArray<Enemy>): Enemy | null {
  let best: Enemy | null = null;
  let bestPri = -1;
  let bestDistSq = ACQUISITION_RANGE * ACQUISITION_RANGE;
  const maxRangeSq = ACQUISITION_RANGE * ACQUISITION_RANGE;
  for (const e of enemies) {
    const dx = e.pos.x - piece.x;
    const dy = e.pos.y - piece.y;
    const distSq = dx * dx + dy * dy;
    if (distSq > maxRangeSq) continue;
    const angleTo = (Math.atan2(dy, dx) * 180) / Math.PI;
    let diff = angleTo - piece.orientation;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    if (Math.abs(diff) > 50) continue;
    const pri = priority(e);
    if (best === null || pri > bestPri || (pri === bestPri && distSq < bestDistSq)) {
      best = e;
      bestPri = pri;
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
    const aim = computeAim(p, target);
    p.orientation = lerpAngle(p.orientation, aim.angle, 0.5);
    let diff = aim.angle - p.orientation;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    if (Math.abs(diff) > 5) continue;
    shoot(state, p, target);
  }
}

const PROJECTILE_SPEED = 900;

function computeAim(p: PlacedPiece, target: import("./types.js").Enemy): { angle: number } {
  const dx = target.pos.x - p.x;
  const dy = target.pos.y - p.y;
  const dist = Math.hypot(dx, dy);
  let vx = 0;
  let vy = 0;
  if (target.pathIndex < target.path.length - 1) {
    const next = target.path[target.pathIndex + 1];
    const ndx = next.x - target.pos.x;
    const ndy = next.y - target.pos.y;
    const ndist = Math.hypot(ndx, ndy);
    if (ndist > 0) {
      const ts = target.speed * target.slowFactor;
      vx = (ndx / ndist) * ts;
      vy = (ndy / ndist) * ts;
    }
  }
  let timeToHit = dist / PROJECTILE_SPEED;
  for (let i = 0; i < 2; i++) {
    const fx = target.pos.x + vx * timeToHit;
    const fy = target.pos.y + vy * timeToHit;
    const fd = Math.hypot(fx - p.x, fy - p.y);
    timeToHit = fd / PROJECTILE_SPEED;
  }
  const leadX = target.pos.x + vx * timeToHit;
  const leadY = target.pos.y + vy * timeToHit;
  const angle = (Math.atan2(leadY - p.y, leadX - p.x) * 180) / Math.PI;
  return { angle };
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return a + diff * t;
}

function shoot(state: GameState, p: PlacedPiece, target: Enemy): void {
  const cdMult = 1 - state.upgrades.cannonRate * 0.2;
  const baseCooldown = 700 * cdMult;
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
      damage = 2;
      pierce = true;
      break;
  }
  p.fireCooldownMs = cooldown;
  const speed = PROJECTILE_SPEED;
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
  const STAIR_RADIUS = 36;
  const STAIR_RADIUS_SQ = STAIR_RADIUS * STAIR_RADIUS;
  const stairs: Array<{ x: number; y: number }> = [];
  for (const p of state.pieces) {
    if (p.role === "stair") stairs.push({ x: p.x, y: p.y });
  }
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    if (e.slowTimerMs > 0) {
      e.slowTimerMs = Math.max(0, e.slowTimerMs - dtMs);
      if (e.slowTimerMs <= 0) e.slowFactor = 1;
    }
    if (e.kind !== "tank") {
      for (const s of stairs) {
        const dx = e.pos.x - s.x;
        const dy = e.pos.y - s.y;
        if (dx * dx + dy * dy <= STAIR_RADIUS_SQ) {
          if (e.slowTimerMs <= 0) {
            const sf = 0.55 - state.upgrades.stairSlow * 0.15;
            e.slowTimerMs = 1800;
            e.slowFactor = Math.max(0.05, sf);
            spawnHitParticles(state, e.pos.x, e.pos.y, 6, "#7adfff");
          }
         }
      }
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
    const speedMult = 1 + 0.2 * state.waveIndex;
    enemy.speed *= speedMult;
    const hpMult = 1 + 0.5 * state.waveIndex;
    enemy.hp = Math.round(enemy.hp * hpMult);
    enemy.maxHp = Math.round(enemy.maxHp * hpMult);
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
