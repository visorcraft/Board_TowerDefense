import { describe, it, expect } from "vitest";
import { defaultState } from "./state.js";
import { canOpenShop, openShop, closeShop } from "./round.js";

describe("shop availability", () => {
  it("opens during the build phase (the Visit Shop fix)", () => {
    const s = defaultState();
    expect(s.phase).toBe("build");
    expect(canOpenShop(s)).toBe(true);
    openShop(s);
    expect(s.shopOpen).toBe(true);
  });

  it("opens between waves", () => {
    const s = defaultState();
    s.phase = "wave";
    s.betweenWave = true;
    expect(canOpenShop(s)).toBe(true);
    openShop(s);
    expect(s.shopOpen).toBe(true);
  });

  it("does NOT open during an active wave", () => {
    const s = defaultState();
    s.phase = "wave";
    s.betweenWave = false;
    expect(canOpenShop(s)).toBe(false);
    openShop(s);
    expect(s.shopOpen).toBe(false);
  });

  it("closeShop clears the flag", () => {
    const s = defaultState();
    openShop(s);
    closeShop(s);
    expect(s.shopOpen).toBe(false);
  });
});
