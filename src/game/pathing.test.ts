import { describe, it, expect } from "vitest";
import { buildDefaultLanes, findPath, blockedSetFromPieces, buildLanePath, COLS, ROWS } from "./pathing.js";
import type { PlacedPiece } from "./types.js";

describe("pathing", () => {
  it("buildLanePath returns four points in lane row", () => {
    const p = buildLanePath(1, 3);
    expect(p.length).toBe(4);
    for (let i = 1; i < p.length; i++) {
      expect(p[i].y).toBe(p[0].y);
    }
  });

  it("findPath returns start->end when nothing blocked", () => {
    const start = { x: 96, y: 200 };
    const end = { x: 1800, y: 200 };
    const res = findPath(start, end, new Set(), 0, 3);
    expect(res.unreachable).toBe(false);
    expect(res.path[0]).toEqual(start);
    expect(res.path[res.path.length - 1]).toEqual(end);
  });

  it("findPath detours around a single block", () => {
    const start = { x: 96, y: 200 };
    const end = { x: 1800, y: 200 };
    const blocked = new Set<string>();
    const startTile = { col: Math.floor((96 - 96) / 24), row: Math.floor((200 - 160) / 24) };
    const midCol = 30;
    blocked.add(midCol + "," + startTile.row);
    const res = findPath(start, end, blocked, 0, 3);
    expect(res.path.length).toBeGreaterThan(2);
    const ys = new Set(res.path.map((p) => Math.round(p.y)));
    expect(ys.size).toBeGreaterThan(1);
  });

  it("blockedSetFromPieces ignores non-blocks", () => {
    const pieces: PlacedPiece[] = [
      { id: 1, role: "cannon", x: 200, y: 200, orientation: 0, mode: "single", ringTimerMs: 0, fireCooldownMs: 0, hp: 1, zapTimerMs: 0 },
      { id: 2, role: "block", x: 200, y: 200, orientation: 0, mode: "single", ringTimerMs: 0, fireCooldownMs: 0, hp: 3, zapTimerMs: 0 },
    ];
    const set = blockedSetFromPieces(pieces);
    expect(set.size).toBe(1);
  });

  it("COLS and ROWS are positive", () => {
    expect(COLS).toBeGreaterThan(0);
    expect(ROWS).toBeGreaterThan(0);
  });

  it("default lanes produce non-empty paths", () => {
    const lanes = buildDefaultLanes(3);
    expect(lanes.length).toBe(3);
    for (const lane of lanes) {
      expect(lane.length).toBe(4);
    }
  });
});
