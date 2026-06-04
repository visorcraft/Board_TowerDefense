import { describe, it, expect } from "vitest";
import { defaultState } from "./state.js";
import { fireCannons, setCannonMode, selectTarget, tickEnemies, tickProjectiles, tickWaveSpawns, cannonStats, spawnPlaceParticles } from "./targeting.js";
import { placePiece } from "./economy.js";
import { buildWaveSpawns } from "./waves.js";
import { ensurePath, startWave, startNextRound, tick } from "./round.js";
import { createRng } from "./rng.js";

describe("targeting", () => {
  it("cannonStats matches design", () => {
    expect(cannonStats("single").multi).toBe(false);
    expect(cannonStats("multi").multi).toBe(true);
    expect(cannonStats("slow").slow).toBe(true);
    expect(cannonStats("pierce").pierce).toBe(true);
  });

  it("setCannonMode sets ring timer", () => {
    const s = defaultState();
    const p = placePiece(s, { role: "cannon", x: 400, y: 400, orientation: 0, mode: "single" })!;
    setCannonMode(p, "slow");
    expect(p.mode).toBe("slow");
    expect(p.ringTimerMs).toBe(6000);
  });

  it("selectTarget finds nearest enemy in arc", () => {
    const s = defaultState();
    const p = placePiece(s, { role: "cannon", x: 400, y: 400, orientation: 0, mode: "single" })!;
    s.enemies.push({
      id: 1,
      kind: "walker",
      hp: 1,
      maxHp: 1,
      speed: 60,
      reward: 1,
      damage: 1,
      slowTimerMs: 0,
      slowFactor: 1,
      pos: { x: 500, y: 380 },
      path: [],
      pathIndex: 0,
      lane: 0,
      size: 14,
      enteredAt: 0,
      pierceDamageLeft: 1,
    });
    s.enemies.push({
      id: 2,
      kind: "boss",
      hp: 40,
      maxHp: 40,
      speed: 30,
      reward: 50,
      damage: 3,
      slowTimerMs: 0,
      slowFactor: 1,
      pos: { x: 450, y: 450 },
      path: [],
      pathIndex: 0,
      lane: 0,
      size: 36,
      enteredAt: 0,
      pierceDamageLeft: 1,
    });
    const t = selectTarget(p, s.enemies);
    expect(t).not.toBeNull();
    expect(t!.kind).toBe("boss");
  });

  it("fireCannons creates a projectile", () => {
    const s = defaultState();
    s.phase = "wave";
    const p = placePiece(s, { role: "cannon", x: 400, y: 400, orientation: 0, mode: "single" })!;
    s.enemies.push({
      id: 1,
      kind: "walker",
      hp: 1,
      maxHp: 1,
      speed: 60,
      reward: 1,
      damage: 1,
      slowTimerMs: 0,
      slowFactor: 1,
      pos: { x: 500, y: 400 },
      path: [],
      pathIndex: 0,
      lane: 0,
      size: 14,
      enteredAt: 0,
      pierceDamageLeft: 1,
    });
    fireCannons(s, 16);
    expect(s.projectiles.length).toBeGreaterThanOrEqual(1);
  });

  it("pierce projectile hits multiple enemies", () => {
    const s = defaultState();
    s.phase = "wave";
    const p = placePiece(s, { role: "cannon", x: 400, y: 400, orientation: 0, mode: "pierce" })!;
    s.projectiles.push({
      id: 1,
      x: 400,
      y: 400,
      vx: 200,
      vy: 0,
      damage: 2,
      pierce: true,
      slow: false,
      ttlMs: 1500,
      lifeMs: 0,
      hitIds: new Set(),
      sourcePieceId: p.id,
      isMulti: false,
    });
    s.enemies.push({
      id: 1, kind: "walker", hp: 1, maxHp: 1, speed: 60, reward: 1, damage: 1,
      slowTimerMs: 0, slowFactor: 1, pos: { x: 410, y: 400 }, path: [], pathIndex: 0, lane: 0, size: 14, enteredAt: 0, pierceDamageLeft: 1,
    });
    s.enemies.push({
      id: 2, kind: "walker", hp: 1, maxHp: 1, speed: 60, reward: 1, damage: 1,
      slowTimerMs: 0, slowFactor: 1, pos: { x: 430, y: 400 }, path: [], pathIndex: 0, lane: 0, size: 14, enteredAt: 0, pierceDamageLeft: 1,
    });
    tickProjectiles(s, 200);
    const dead = s.enemies.length;
    expect(dead).toBeLessThan(2);
  });

  it("tickEnemies advances position along path", () => {
    const s = defaultState();
    s.enemies.push({
      id: 1, kind: "walker", hp: 1, maxHp: 1, speed: 60, reward: 1, damage: 1,
      slowTimerMs: 0, slowFactor: 1, pos: { x: 100, y: 200 },
      path: [{ x: 100, y: 200 }, { x: 800, y: 200 }],
      pathIndex: 0, lane: 0, size: 14, enteredAt: 0, pierceDamageLeft: 1,
    });
    tickEnemies(s, 1000);
    expect(s.enemies[0].pos.x).toBe(160);
  });
});

describe("economy and round", () => {
  it("placePiece deducts gold", () => {
    const s = defaultState();
    const before = s.gold;
    const p = placePiece(s, { role: "cannon", x: 200, y: 200, orientation: 0, mode: "single" });
    expect(p).not.toBeNull();
    expect(s.gold).toBe(before - 25);
  });

  it("placePiece returns null when broke", () => {
    const s = defaultState();
    s.gold = 0;
    const p = placePiece(s, { role: "cannon", x: 200, y: 200, orientation: 0, mode: "single" });
    expect(p).toBeNull();
  });

  it("startWave + clear wave transitions to next", () => {
    const s = defaultState();
    s.waveIndex = 0;
    s.rng = createRng(99);
    startWave(s);
    expect(s.phase).toBe("wave");
    s.waveEnemiesRemaining = 0;
    s.waveSpawnQueue = [];
    s.enemies = [];
    tick(s, 16);
    expect(s.waveIndex).toBe(1);
    expect(s.phase).toBe("build");
  });

  it("ensurePath produces non-empty per-lane paths", () => {
    const s = defaultState();
    ensurePath(s);
    for (let i = 0; i < 3; i++) {
      expect(s.paths[i].length).toBeGreaterThan(0);
    }
  });
});
