import { describe, it, expect } from "vitest";
import { defaultState, encodeProgress, applyProgress } from "./state.js";
import { createRng } from "./rng.js";

describe("state", () => {
  it("defaultState seeds with 30 gold and full goal", () => {
    const s = defaultState();
    expect(s.gold).toBe(30);
    expect(s.goalHp).toBe(20);
    expect(s.phase).toBe("build");
  });

  it("applyProgress merges unlocks without duplicates", () => {
    const s = defaultState();
    applyProgress(s, { highestWave: 3, victories: 1, unlockedModes: ["multi", "single"], version: 1 });
    expect(s.highestWave).toBe(3);
    expect(s.victories).toBe(1);
    expect(s.unlockedModes).toContain("multi");
    expect(s.unlockedModes).toContain("single");
    expect(new Set(s.unlockedModes).size).toBe(s.unlockedModes.length);
  });

  it("encodeProgress round-trips via JSON", () => {
    const s = defaultState();
    s.highestWave = 5;
    s.victories = 2;
    s.unlockedModes = ["single", "multi", "slow", "pierce"];
    const enc = encodeProgress(s);
    const json = JSON.stringify(enc);
    const back = JSON.parse(json);
    expect(back.highestWave).toBe(5);
    expect(back.unlockedModes.length).toBe(4);
  });

  it("rng is independent between states", () => {
    const s1 = defaultState();
    const s2 = defaultState();
    expect(s1.rng.state).toBe(s2.rng.state);
    s1.rng = createRng(11);
    s2.rng = createRng(22);
    expect(s1.rng.state).not.toBe(s2.rng.state);
  });
});
