import { describe, it, expect } from "vitest";
import { createRng, rngInt, rngNext, rngPick, rngRange, rngChance } from "./rng.js";

describe("rng", () => {
  it("createRng seeds state", () => {
    const r = createRng(42);
    expect(r.seed).toBe(42);
    expect(typeof r.state).toBe("number");
  });

  it("rngNext is deterministic for same seed", () => {
    const a = createRng(7);
    const b = createRng(7);
    const seqA = [rngNext(a), rngNext(a), rngNext(a)];
    const seqB = [rngNext(b), rngNext(b), rngNext(b)];
    expect(seqA).toEqual(seqB);
  });

  it("rngInt is in range", () => {
    const r = createRng(1);
    for (let i = 0; i < 100; i++) {
      const v = rngInt(r, 5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(10);
    }
  });

  it("rngPick returns an element", () => {
    const r = createRng(2);
    const arr = [10, 20, 30];
    for (let i = 0; i < 50; i++) {
      const v = rngPick(r, arr);
      expect(arr).toContain(v);
    }
  });

  it("rngRange is in [min, max)", () => {
    const r = createRng(3);
    for (let i = 0; i < 100; i++) {
      const v = rngRange(r, -1, 1);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThan(1);
    }
  });

  it("rngChance is approximately stable", () => {
    const r = createRng(99);
    let hits = 0;
    for (let i = 0; i < 1000; i++) {
      if (rngChance(r, 0.3)) hits++;
    }
    expect(hits).toBeGreaterThan(220);
    expect(hits).toBeLessThan(380);
  });
});
