import { Board } from "@board.fun/web-sdk";
import type { BoardPauseResult } from "@board.fun/web-sdk";

export interface PauseHooks {
  onRestart(): void;
  onMuteToggle(): void;
  onDiagnosticToggle(): void;
  onVolumeChange(music: number, sfx: number): void;
  onResume(): void;
  onQuit(): void;
  onDebug(msg: string): void;
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
  private lastPollKey = "";
  private gameId = "";

  install(hooks: PauseHooks): void {
    this.hooks = hooks;
    if (!Board.isOnDevice) return;
    const apply = (): void => {
      try {
        Board.pause.setContext({
          gameId: this.gameId || undefined,
          gameName: "Tower Defense",
          offerSaveOption: true,
          customButtons: [
            { id: "restart", title: "Restart Round", icon: "circulararrow" },
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
    this.reapplyTimer = window.setInterval(apply, 5000);
    this.unsubscribe = Board.pause.onResult((result) => {
      this.lastEvent = `push/${result.action}${result.customButtonId ? "/" + result.customButtonId : ""}`;
      this.hooks?.onDebug("pause evt: " + this.lastEvent);
      this.dispatch(result);
    });
    this.pollTimer = window.setInterval(() => {
      this.pollCount++;
      if (this.pollCount % 10 === 0 && this.lastPollKey === "") {
        this.hooks?.onDebug(`polling (n=${this.pollCount})`);
      }
      let result: BoardPauseResult | null = null;
      try {
        result = Board.pause.pollResult();
      } catch (e) {
        this.hooks?.onDebug("pollResult threw: " + String(e));
        return;
      }
      if (!result) return;
      const key = `${String(result.action ?? "")}|${String(result.customButtonId ?? "")}`;
      if (key === this.lastPollKey) return;
      this.lastPollKey = key;
      this.lastEvent = `poll/${result.action}${result.customButtonId ? "/" + result.customButtonId : ""}`;
      this.hooks?.onDebug("pause evt: " + this.lastEvent);
      this.dispatch(result);
    }, 500);
  }

  private dispatch(result: BoardPauseResult): void {
    if (!this.hooks) return;
    const raw = String(result.action ?? "");
    const action = raw.toLowerCase().replace(/\s+/g, "_");
    const buttonId = result.customButtonId ? String(result.customButtonId).toLowerCase() : "";
    try {
      switch (action) {
        case "resume":
          this.hooks.onResume();
          break;
        case "quit":
          this.hooks.onQuit();
          break;
        case "save_and_quit":
        case "save_and__quit":
          this.hooks.onQuit();
          break;
        case "custom_action":
        case "custom_button":
        case "customaction":
          if (buttonId === "restart") this.hooks.onRestart();
          else if (buttonId === "diagnostic") this.hooks.onDiagnosticToggle();
          else if (buttonId === "mute") this.hooks.onMuteToggle();
          else this.hooks.onDebug("unknown customButtonId: " + String(result.customButtonId));
          break;
        default:
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
