import { Board } from "@board.fun/web-sdk";
import type { BoardPauseResult } from "@board.fun/web-sdk";

export interface PauseHooks {
  onRestart(): void;
  onMuteToggle(): void;
  onDiagnosticToggle(): void;
  onNextWave(): void;
  onVisitShop(): void;
  onVolumeChange(music: number, sfx: number): void;
  onResume(): void;
  onQuit(): void | Promise<void>;
  onDebug(msg: string): void;
}

/**
 * Ignore terminal (quit/exit) pause actions for this long after install.
 *
 * The native host's `getPauseResult()` is sticky and lives in the host process,
 * not the WebView: it keeps returning the LAST action and there is no API to
 * clear it (only a device reboot does). On relaunch it re-delivers the previous
 * session's "Exit", which would immediately quit the new session — the
 * "splash, then back to the launcher" bug. The user cannot reach the system
 * pause menu and pick Exit within the first few seconds of a launch, so any
 * terminal action seen this early is necessarily that stale leftover.
 */
export const STARTUP_QUIT_GRACE_MS = 3000;

/** True for any host action that should tear the app down (quit/exit/save-and-quit/discard). */
export function isTerminalPauseAction(rawAction: string): boolean {
  const a = String(rawAction ?? "").toLowerCase().replace(/\s+/g, "_").replace(/['']/g, "");
  return (
    a.includes("quit") ||
    a.includes("exit") ||
    a === "save" ||
    a === "dont_save" ||
    a === "no_save" ||
    a === "discard"
  );
}

export interface PauseGateState {
  /** Dedupe key of the last DISPATCHED action (the sticky poll re-reports it every 150ms). */
  lastKey: string;
  /** The terminal action present at launch — the host's sticky leftover from the previous session. */
  staleTerminalKey: string | null;
  /** True once the user has genuinely interacted with THIS session's pause menu. */
  unlocked: boolean;
}

export function freshPauseGate(): PauseGateState {
  return { lastKey: "", staleTerminalKey: null, unlocked: false };
}

/**
 * Decide whether a freshly observed pause result should be dispatched, mutating
 * `state`. Pure so it can be unit-tested without the host bridge.
 *
 * The host's `getPauseResult()` is sticky and survives a relaunch (only a reboot
 * clears it), so on launch it re-delivers the previous session's quit. We must
 * suppress that WITHOUT blocking a genuine later quit of the same variant — the
 * two exit options are distinct strings ("save_and_quit" vs "quit"), so poisoning
 * the dedupe key with the stale value would silently drop whichever variant the
 * user last picked. Instead:
 *
 * - Terminal actions: ignored while they look like the stale leftover (seen in the
 *   startup grace window, or equal to the leftover value) AND the user has not yet
 *   interacted. The stale value is NEVER written to `lastKey`, so a genuine quit is
 *   not deduped against it. The OTHER variant always has a distinct key and works.
 * - Non-terminal actions (resume / restart / shop / audio): deduped against the
 *   150ms poll, and dispatching one is proof of genuine interaction → `unlocked`.
 */
export function decidePauseDispatch(
  state: PauseGateState,
  result: { action: string; customButtonId?: string },
  msSinceInstall: number,
  graceMs: number,
): { dispatch: boolean; reason: string } {
  const key = `${String(result.action ?? "")}|${String(result.customButtonId ?? "")}`;
  const terminal = isTerminalPauseAction(result.action);
  const withinGrace = msSinceInstall < graceMs;

  // The first terminal seen at launch — before the user could have interacted —
  // is the host's sticky leftover from the previous session.
  if (terminal && state.staleTerminalKey === null && withinGrace && !state.unlocked) {
    state.staleTerminalKey = key;
  }
  // The leftover value is pending continuously until the user picks something new,
  // so we can only trust that it is GONE once the host's result moves off it. Any
  // different value (a Resume/Restart/audio change, the other exit variant, or a
  // null read handled by the caller) proves that — after which a same-variant quit
  // is genuine. This never fires during gameplay, where the poll keeps returning
  // the leftover unchanged.
  if (state.staleTerminalKey !== null && key !== state.staleTerminalKey) {
    state.unlocked = true;
  }

  if (terminal) {
    if (key === state.lastKey) return { dispatch: false, reason: "dup" };
    if (!state.unlocked && (withinGrace || key === state.staleTerminalKey)) {
      return { dispatch: false, reason: withinGrace ? "startup-grace" : "stale-startup-quit" };
    }
    state.lastKey = key; // genuine quit: dedupe re-reads while the app tears down
    return { dispatch: true, reason: "ok" };
  }

  if (key === state.lastKey) return { dispatch: false, reason: "dup" };
  state.lastKey = key;
  state.unlocked = true;
  return { dispatch: true, reason: "ok" };
}

export class PauseMenu {
  private unsubscribe: (() => void) | null = null;
  private hooks: PauseHooks | null = null;
  private musicVolume = 0.18;
  private sfxVolume = 0.6;
  private contextSet = false;
  private lastEvent: string = "—";
  private reapplyTimer: number | null = null;
  private pollTimer: number | null = null;
  private pollCount = 0;
  private gate: PauseGateState = freshPauseGate();
  private installedAtMs = 0;
  private gameId = "";

  install(hooks: PauseHooks): void {
    this.hooks = hooks;
    this.installedAtMs = performance.now();
    this.gate = freshPauseGate();
    if (!Board.isOnDevice) return;
    const apply = (): void => {
      try {
        Board.pause.setContext({
          gameId: this.gameId || undefined,
          gameName: "Tower Defense",
          offerSaveOption: true,
          customButtons: [
            { id: "restart", title: "Restart Round", icon: "circulararrow" },
            { id: "next_wave", title: "Next Wave", icon: "square" },
            { id: "visit_shop", title: "Visit Shop", icon: "square" },
            { id: "diagnostic", title: "Diagnostic Screen", icon: "square" },
            { id: "mute", title: "Mute / Unmute", icon: "square" },
          ],
          audioTracks: [
            { id: "music", name: "Music", value: Math.round(this.musicVolume * 100) },
            { id: "sfx", name: "SFX", value: Math.round(this.sfxVolume * 100) },
          ],
        });
        this.contextSet = true;
        this.hooks?.onDebug("pause ctx set");
      } catch (e) {
        this.hooks?.onDebug("pause ctx set FAILED: " + String(e));
      }
    };
    const ready = Board.session.areServicesReady();
    if (ready) {
      apply();
    } else {
      const interval = window.setInterval(() => {
        if (Board.session.areServicesReady()) {
          window.clearInterval(interval);
          apply();
        }
      }, 200);
      window.setTimeout(() => window.clearInterval(interval), 15000);
    }
    this.reapplyTimer = null;
    this.unsubscribe = Board.pause.onResult((result) => {
      this.handleResult(result, "push");
    });
    this.pollTimer = window.setInterval(() => {
      this.pollCount++;
      if (this.pollCount % 10 === 0 && this.gate.lastKey === "") {
        this.hooks?.onDebug(`polling (n=${this.pollCount})`);
      }
      let result: BoardPauseResult | null = null;
      try {
        result = Board.pause.pollResult();
      } catch (e) {
        this.hooks?.onDebug("pollResult threw: " + String(e));
        return;
      }
      if (!result) {
        // A null read means the host no longer holds the leftover — genuine quits
        // (even of the leftover's variant) are safe from here on.
        if (this.gate.staleTerminalKey !== null) this.gate.unlocked = true;
        return;
      }
      this.handleResult(result, "poll");
    }, 150);
  }

  /**
   * Dedupe (the sticky poll re-reports the same action every 150ms) and guard
   * against the host re-delivering a previous session's quit at launch, then
   * dispatch. Shared by the poll and push channels so a result handled on one
   * is not re-fired on the other.
   */
  private handleResult(result: BoardPauseResult, source: "poll" | "push"): void {
    const ms = performance.now() - this.installedAtMs;
    const decision = decidePauseDispatch(this.gate, result, ms, STARTUP_QUIT_GRACE_MS);
    if (!decision.dispatch) {
      if (decision.reason === "stale-startup-quit" || decision.reason === "startup-grace") {
        this.hooks?.onDebug(`ignored stale ${source} quit: ${result.action}`);
      }
      return;
    }
    this.lastEvent = `${source}/${result.action}${result.customButtonId ? "/" + result.customButtonId : ""}`;
    this.hooks?.onDebug("pause evt: " + this.lastEvent);
    this.dispatch(result);
  }

  private dispatch(result: BoardPauseResult): void {
    if (!this.hooks) return;
    const raw = String(result.action ?? "");
    const action = raw.toLowerCase().replace(/\s+/g, "_").replace(/['']/g, "");
    const buttonId = result.customButtonId ? String(result.customButtonId).toLowerCase() : "";
    this.hooks.onDebug("pause action: " + raw + " -> " + action);
    try {
      if (action === "resume") {
        this.hooks.onResume();
      } else if (isTerminalPauseAction(raw)) {
        this.hooks.onQuit();
      } else if (action === "custom_action" || action === "custom_button" || action === "customaction") {
        if (buttonId === "restart") this.hooks.onRestart();
        else if (buttonId === "diagnostic") this.hooks.onDiagnosticToggle();
        else if (buttonId === "mute") this.hooks.onMuteToggle();
        else if (buttonId === "next_wave") this.hooks.onNextWave();
        else if (buttonId === "visit_shop") this.hooks.onVisitShop();
        else this.hooks.onDebug("unknown customButtonId: " + String(result.customButtonId));
      } else {
        this.hooks.onDebug("unknown action: " + raw);
      }
    } catch (e) {
      this.hooks.onDebug("handler throw: " + String(e));
    }
    if (result.audioTracks) {
      for (const t of result.audioTracks) {
        if (t.id === "music") {
          this.musicVolume = t.value / 100;
          this.hooks.onVolumeChange(this.musicVolume, this.sfxVolume);
        } else if (t.id === "sfx") {
          this.sfxVolume = t.value / 100;
          this.hooks.onVolumeChange(this.musicVolume, this.sfxVolume);
        }
      }
    }
  }

  setGameId(id: string): void {
    this.gameId = id;
  }

  getStatus(): { contextSet: boolean; lastEvent: string; isOnDevice: boolean } {
    return { contextSet: this.contextSet, lastEvent: this.lastEvent, isOnDevice: Board.isOnDevice };
  }

  setMusicVolume(v: number): void {
    this.musicVolume = v;
    if (Board.isOnDevice) {
      Board.pause.updateContext({ audioTracks: [{ id: "music", name: "Music", value: Math.round(v * 100) }] });
    }
  }

  setSfxVolume(v: number): void {
    this.sfxVolume = v;
    if (Board.isOnDevice) {
      Board.pause.updateContext({ audioTracks: [{ id: "sfx", name: "SFX", value: Math.round(v * 100) }] });
    }
  }

  uninstall(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.reapplyTimer !== null) {
      window.clearInterval(this.reapplyTimer);
      this.reapplyTimer = null;
    }
    if (this.pollTimer !== null) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (Board.isOnDevice) {
      Board.pause.clearContext();
    }
  }

  isOnDevice(): boolean {
    return Board.isOnDevice;
  }
}
