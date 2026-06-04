import { Board } from "@board.fun/web-sdk";
import type { GameState, PersistedProgress } from "../game/types.js";
import { encodeProgress } from "../game/state.js";

const SAVE_NAME = "Tower Defense Progress";
const APP_VERSION = "0.1.0";
const PROGRESS_VERSION = 1;

export class SaveStore {
  private lastSaveId: string | null = null;
  private lastError: string | null = null;

  isOnDevice(): boolean {
    return Board.isOnDevice;
  }

  async load(): Promise<PersistedProgress | null> {
    if (!Board.isOnDevice) {
      try {
        const raw = localStorage.getItem("towerdefense.progress");
        if (!raw) return null;
        return JSON.parse(raw) as PersistedProgress;
      } catch {
        return null;
      }
    }
    try {
      const list = await Board.save.list();
      if (list.length === 0) return null;
      const meta = list[0];
      const buf = await Board.save.load(meta.id);
      const json = new TextDecoder().decode(buf);
      const parsed = JSON.parse(json) as PersistedProgress;
      this.lastSaveId = meta.id;
      return parsed;
    } catch (err) {
      this.lastError = String(err);
      return null;
    }
  }

  async save(state: GameState): Promise<boolean> {
    const progress = encodeProgress(state);
    if (!Board.isOnDevice) {
      try {
        localStorage.setItem("towerdefense.progress", JSON.stringify(progress));
        return true;
      } catch {
        return false;
      }
    }
    try {
      const payload = new TextEncoder().encode(JSON.stringify(progress));
      if (this.lastSaveId) {
        await Board.save.update(this.lastSaveId, SAVE_NAME, payload, 0, APP_VERSION);
        return true;
      } else {
        const created = await Board.save.create(SAVE_NAME, payload, 0, APP_VERSION);
        if (created?.id) {
          this.lastSaveId = created.id;
          return true;
        }
        return false;
      }
    } catch (err) {
      this.lastError = String(err);
      return false;
    }
  }

  lastErrorMessage(): string | null {
    return this.lastError;
  }

  getSaveId(): string | null {
    return this.lastSaveId;
  }
}

export { PROGRESS_VERSION };
