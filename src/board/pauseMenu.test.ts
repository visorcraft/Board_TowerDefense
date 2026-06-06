import { describe, it, expect } from "vitest";
import { isTerminalPauseAction, decidePauseDispatch, freshPauseGate, STARTUP_QUIT_GRACE_MS } from "./pauseMenu.js";

const GRACE = STARTUP_QUIT_GRACE_MS;
// Real OS 1.10.0 strings (the docs' "quit"/"save_and_quit" are wrong for this host).
const SAVED = "EXIT_GAME_SAVED"; // Exit -> Save Game
const UNSAVED = "EXIT_GAME_UNSAVED"; // Exit -> Don't Save

describe("isTerminalPauseAction", () => {
  it("recognizes host quit variants incl. the real EXIT_GAME_* strings", () => {
    for (const a of [SAVED, UNSAVED, "quit", "QUIT", "Save and Quit", "Exit", "discard", "no_save", "dont_save"]) {
      expect(isTerminalPauseAction(a)).toBe(true);
    }
  });

  it("does not treat resume / custom / restart as terminal", () => {
    for (const a of ["resume", "RESUME", "custom_action", "custom_button", "restart", "Restart Round"]) {
      expect(isTerminalPauseAction(a)).toBe(false);
    }
  });
});

describe("decidePauseDispatch", () => {
  it("ignores a stale quit re-delivered right after launch (the relaunch bug)", () => {
    const g = freshPauseGate();
    expect(decidePauseDispatch(g, { action: UNSAVED }, 1500, GRACE).dispatch).toBe(false);
  });

  it("keeps ignoring the sticky leftover for the whole session (no relaunch bounce)", () => {
    const g = freshPauseGate();
    expect(decidePauseDispatch(g, { action: UNSAVED }, 1500, GRACE).dispatch).toBe(false);
    // Still pending many seconds later with no interaction -> stays suppressed.
    for (const t of [4000, 10000, 60000]) {
      expect(decidePauseDispatch(g, { action: UNSAVED }, t, GRACE).dispatch).toBe(false);
    }
  });

  it("dispatches a genuine quit after the startup window when there was no leftover", () => {
    const g = freshPauseGate();
    expect(decidePauseDispatch(g, { action: SAVED }, 20000, GRACE).dispatch).toBe(true);
  });

  it("does not suppress non-terminal actions during startup", () => {
    const g = freshPauseGate();
    expect(decidePauseDispatch(g, { action: "resume" }, 200, GRACE).dispatch).toBe(true);
  });

  it("dedupes the sticky poll (same action only fires once)", () => {
    const g = freshPauseGate();
    expect(decidePauseDispatch(g, { action: "custom_action", customButtonId: "restart" }, 20000, GRACE).dispatch).toBe(true);
    expect(decidePauseDispatch(g, { action: "custom_action", customButtonId: "restart" }, 20150, GRACE).dispatch).toBe(false);
  });

  it("FIX: a non-terminal interaction unlocks, then the SAME exit variant as the leftover works", () => {
    const g = freshPauseGate();
    expect(decidePauseDispatch(g, { action: UNSAVED }, 1000, GRACE).dispatch).toBe(false); // leftover
    expect(decidePauseDispatch(g, { action: "resume" }, 30000, GRACE).dispatch).toBe(true); // moves result off leftover
    expect(decidePauseDispatch(g, { action: UNSAVED }, 60000, GRACE).dispatch).toBe(true); // now genuine
  });

  it("FIX: the OTHER exit variant always works and itself unlocks the leftover variant", () => {
    const g = freshPauseGate();
    expect(decidePauseDispatch(g, { action: UNSAVED }, 1000, GRACE).dispatch).toBe(false); // leftover
    expect(decidePauseDispatch(g, { action: SAVED }, 20000, GRACE).dispatch).toBe(true); // distinct -> dispatch + unlock
    expect(decidePauseDispatch(g, { action: UNSAVED }, 25000, GRACE).dispatch).toBe(true); // leftover variant now genuine
  });

  it("residual: same-variant quit with zero interaction stays suppressed (use the other variant)", () => {
    const g = freshPauseGate();
    expect(decidePauseDispatch(g, { action: UNSAVED }, 1000, GRACE).dispatch).toBe(false);
    expect(decidePauseDispatch(g, { action: UNSAVED }, 20000, GRACE).dispatch).toBe(false);
  });

  it("does not false-fire the leftover during gameplay (continuous identical reads stay suppressed)", () => {
    const g = freshPauseGate();
    let dispatched = 0;
    for (let t = 1500; t <= 120000; t += 150) {
      if (decidePauseDispatch(g, { action: UNSAVED }, t, GRACE).dispatch) dispatched++;
    }
    expect(dispatched).toBe(0);
  });
});
