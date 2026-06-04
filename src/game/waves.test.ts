import { describe, it, expect } from "vitest";
import { buildWaveSpawns } from "./waves.js";
import { defaultState } from "./state.js";
import { createRng } from "./rng.js";

describe("waves", () => {
  it("wave 0 is mostly walkers", () => {
    const s = defaultState();
    s.rng = createRng(123);
    const queue = buildWaveSpawns(s, 0);
    expect(queue.length).toBeGreaterThan(0);
    expect(queue.every((q) => q.kind === "walker")).toBe(true);
  });

  it("last wave is the boss", () => {
    const s = defaultState();
    s.rng = createRng(456);
    const lastIdx = 5;
    const queue = buildWaveSpawns(s, lastIdx);
    expect(queue.length).toBe(1);
    expect(queue[0].kind).toBe("boss");
    expect(queue[0].lane).toBe(1);
  });

  it("intermediate waves include mixed kinds", () => {
    const s = defaultState();
    s.rng = createRng(789);
    const queue = buildWaveSpawns(s, 3);
    const kinds = new Set(queue.map((q) => q.kind));
    expect(kinds.size).toBeGreaterThan(1);
  });

  it("spawn delays are monotonic non-decreasing", () => {
    const s = defaultState();
    s.rng = createRng(1010);
    const queue = buildWaveSpawns(s, 2);
    for (let i = 1; i < queue.length; i++) {
      expect(queue[i].delayMs).toBeGreaterThanOrEqual(queue[i - 1].delayMs);
    }
  });
});
