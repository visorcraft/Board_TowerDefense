import { describe, it, expect } from "vitest";
import { isTerminalPauseAction, decidePauseDispatch, STARTUP_QUIT_GRACE_MS } from "./pauseMenu.js";

describe("isTerminalPauseAction", () => {
  it("recognizes host quit variants (any case / spacing)", () => {
    for (const a of ["quit", "QUIT", "Save and Quit", "SAVE_AND_QUIT", "save_and_quit", "Exit", "EXIT", "discard", "no_save", "dont_save"]) {
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
    const state = { lastKey: "" };
    // Fresh session: host still holds the previous session's Exit; poll sees it ~1.5s in.
    const d = decidePauseDispatch(state, { action: "save_and_quit" }, 1500, STARTUP_QUIT_GRACE_MS);
    expect(d.dispatch).toBe(false);
  });

  it("dispatches a genuine quit after the startup window", () => {
    const state = { lastKey: "" };
    const d = decidePauseDispatch(state, { action: "save_and_quit" }, 20000, STARTUP_QUIT_GRACE_MS);
    expect(d.dispatch).toBe(true);
  });

  it("does not suppress non-terminal actions during startup", () => {
    const state = { lastKey: "" };
    expect(decidePauseDispatch(state, { action: "resume" }, 200, STARTUP_QUIT_GRACE_MS).dispatch).toBe(true);
  });

  it("dedupes the sticky poll (same action only fires once)", () => {
    const state = { lastKey: "" };
    const first = decidePauseDispatch(state, { action: "custom_action", customButtonId: "restart" }, 20000, STARTUP_QUIT_GRACE_MS);
    const second = decidePauseDispatch(state, { action: "custom_action", customButtonId: "restart" }, 20150, STARTUP_QUIT_GRACE_MS);
    expect(first.dispatch).toBe(true);
    expect(second.dispatch).toBe(false);
  });

  it("lets a real quit through once the user has interacted (resume then quit, same session)", () => {
    const state = { lastKey: "" };
    // Stale quit at launch — suppressed but recorded so the 150ms poll stops re-firing it.
    expect(decidePauseDispatch(state, { action: "quit" }, 1000, STARTUP_QUIT_GRACE_MS).dispatch).toBe(false);
    // User opens the menu and resumes (genuine, distinct action).
    expect(decidePauseDispatch(state, { action: "resume" }, 30000, STARTUP_QUIT_GRACE_MS).dispatch).toBe(true);
    // User now genuinely quits — different from the previous key, so it dispatches.
    expect(decidePauseDispatch(state, { action: "quit" }, 60000, STARTUP_QUIT_GRACE_MS).dispatch).toBe(true);
  });
});
