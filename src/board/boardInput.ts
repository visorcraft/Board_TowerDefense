import { Board, BoardContactPhase, BoardContactType } from "@board.fun/web-sdk";
import type { BoardContact } from "@board.fun/web-sdk";
import type { Role } from "../game/types.js";

const LONG_PRESS_MS = 900;
const LONG_PRESS_MOVE_PX = 32;

export interface DevContact {
  contactId: number;
  x: number;
  y: number;
  orientation: number;
  isTouched: boolean;
  glyphId: number;
  type: "Finger" | "Glyph" | "Blob";
  phase: "Began" | "Moved" | "Stationary" | "Ended" | "Canceled";
  pieceRole?: Role;
}

export interface InputFrame {
  contacts: ReadonlyArray<DevContact>;
  diagnostic: boolean;
  devRotateLeft: boolean;
  devRotateRight: boolean;
  devModeCycle: boolean;
  devPlace: "cannon" | "block" | "stair" | "ring";
  devStartWave: boolean;
  devRestart: boolean;
  longPress: boolean;
}

export interface InputSource {
  start(): void;
  stop(): void;
  onFrame(cb: (frame: InputFrame) => void): void;
  isOnDevice(): boolean;
  setDevPlace(role: "cannon" | "block" | "stair" | "ring"): void;
  getDevPlace(): "cannon" | "block" | "stair" | "ring";
  setDevDiagnostic(on: boolean): void;
}

export function createBoardInput(pieceRoleForGlyph: (id: number) => Role): InputSource {
  const listeners: Array<(frame: InputFrame) => void> = [];
  const pressStart = new Map<number, { x: number; y: number; at: number; fired: boolean }>();
  let longPressFired = false;
  const cb = (contacts: ReadonlyArray<BoardContact>): void => {
    const now = performance.now();
    const next: DevContact[] = [];
    for (const c of contacts) {
      const dev: DevContact = {
        contactId: c.contactId,
        x: c.x,
        y: c.y,
        orientation: c.orientation,
        isTouched: c.isTouched,
        glyphId: c.glyphId,
        type:
          c.type === BoardContactType.Finger
            ? "Finger"
            : c.type === BoardContactType.Glyph
            ? "Glyph"
            : "Blob",
        phase:
          c.phase === BoardContactPhase.Began
            ? "Began"
            : c.phase === BoardContactPhase.Moved
            ? "Moved"
            : c.phase === BoardContactPhase.Stationary
            ? "Stationary"
            : c.phase === BoardContactPhase.Ended
            ? "Ended"
            : "Canceled",
        pieceRole: c.glyphId > 0 ? pieceRoleForGlyph(c.glyphId) : undefined,
      };
      next.push(dev);
      if (c.phase === BoardContactPhase.Began) {
        pressStart.set(c.contactId, { x: c.x, y: c.y, at: now, fired: false });
      } else if (c.phase === BoardContactPhase.Moved || c.phase === BoardContactPhase.Stationary) {
        const s = pressStart.get(c.contactId);
        if (s && !s.fired) {
          const dx = c.x - s.x;
          const dy = c.y - s.y;
          if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_PX) pressStart.delete(c.contactId);
          else if (now - s.at >= LONG_PRESS_MS) {
            s.fired = true;
            longPressFired = true;
          }
        }
      } else if (c.phase === BoardContactPhase.Ended || c.phase === BoardContactPhase.Canceled) {
        pressStart.delete(c.contactId);
      }
    }
    const frame: InputFrame = {
      contacts: next,
      diagnostic: false,
      devRotateLeft: false,
      devRotateRight: false,
      devModeCycle: false,
      devPlace: "cannon",
      devStartWave: false,
      devRestart: false,
      longPress: longPressFired,
    };
    longPressFired = false;
    for (const l of listeners) l(frame);
  };
  return {
    start(): void {
      if (!Board.isOnDevice) return;
      Board.input.subscribe(cb);
    },
    stop(): void {
      if (!Board.isOnDevice) return;
      Board.input.unsubscribe(cb);
    },
    onFrame(cb2): void {
      listeners.push(cb2);
    },
    isOnDevice(): boolean {
      return Board.isOnDevice;
    },
    setDevPlace(): void {},
    getDevPlace(): "cannon" | "block" | "stair" | "ring" {
      return "cannon";
    },
    setDevDiagnostic(): void {},
  };
}
