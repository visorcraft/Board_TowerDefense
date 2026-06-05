import { TILE_SIZE, PLAYFIELD } from "./state.js";
import type { Vec2 } from "./types.js";

export const COLS = Math.floor((PLAYFIELD.spawnX - PLAYFIELD.goalX) / TILE_SIZE);
export const ROWS = Math.floor((PLAYFIELD.bottom - PLAYFIELD.top) / TILE_SIZE);
export const ORIGIN_X = PLAYFIELD.goalX;
export const ORIGIN_Y = PLAYFIELD.top;

export function tileOfPoint(p: Vec2): { col: number; row: number } {
  const col = Math.floor((p.x - ORIGIN_X) / TILE_SIZE);
  const row = Math.floor((p.y - ORIGIN_Y) / TILE_SIZE);
  return { col, row };
}

export function pointOfTile(col: number, row: number): Vec2 {
  return {
    x: ORIGIN_X + col * TILE_SIZE + TILE_SIZE / 2,
    y: ORIGIN_Y + row * TILE_SIZE + TILE_SIZE / 2,
  };
}

export function inBounds(col: number, row: number): boolean {
  return col >= 0 && col < COLS && row >= 0 && row < ROWS;
}

export function buildLanePath(lane: number, laneCount: number): Vec2[] {
  const usableRows = ROWS;
  const usableCols = COLS;
  const span = usableRows / laneCount;
  const centerRow = Math.floor(span * (lane + 0.5));
  const start = pointOfTile(0, centerRow);
  const end = pointOfTile(usableCols - 1, centerRow);
  const mid1 = pointOfTile(Math.floor(usableCols * 0.33), centerRow);
  const mid2 = pointOfTile(Math.floor(usableCols * 0.66), centerRow);
  return [start, mid1, mid2, end];
}

export interface PathResult {
  path: Vec2[];
  unreachable: boolean;
}

export function buildDefaultLanes(laneCount: number): Vec2[][] {
  const lanes: Vec2[][] = [];
  for (let i = 0; i < laneCount; i++) lanes.push(buildLanePath(i, laneCount));
  return lanes;
}

export function findPath(
  start: Vec2,
  end: Vec2,
  blocked: Set<string>,
  lane: number,
  laneCount: number,
): PathResult {
  const open: Array<{ col: number; row: number; f: number; g: number }> = [];
  const came = new Map<string, string>();
  const gScore = new Map<string, number>();
  const startCell = tileOfPoint(start);
  const endCell = tileOfPoint(end);
  open.push({ col: startCell.col, row: startCell.row, f: heuristic(startCell, endCell), g: 0 });
  gScore.set(cellKey(startCell.col, startCell.row), 0);
  const target = cellKey(endCell.col, endCell.row);
  let safety = 0;
  while (open.length > 0 && safety++ < 4000) {
    open.sort((a, b) => a.f - b.f);
    const cur = open.shift()!;
    const ck = cellKey(cur.col, cur.row);
    if (ck === target) {
      return { path: reconstruct(came, ck, start, end), unreachable: false };
    }
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nc = cur.col + dc;
      const nr = cur.row + dr;
      if (!inBounds(nc, nr)) continue;
      const nk = cellKey(nc, nr);
      if (blocked.has(nk)) continue;
      const lanePenalty = Math.abs(Math.floor((nr / ROWS) * laneCount) - lane) * 6;
      const step = 1 + (dc !== 0 && dr !== 0 ? 0.4 : 0) + lanePenalty;
      const tentative = cur.g + step;
      const prev = gScore.get(nk);
      if (prev === undefined || tentative < prev) {
        gScore.set(nk, tentative);
        came.set(nk, ck);
        const h = heuristic({ col: nc, row: nr }, endCell);
        open.push({ col: nc, row: nr, f: tentative + h, g: tentative });
      }
    }
  }
  return { path: [start, end], unreachable: true };
}

function heuristic(a: { col: number; row: number }, b: { col: number; row: number }): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

function reconstruct(
  came: Map<string, string>,
  endKey: string,
  start: Vec2,
  end: Vec2,
): Vec2[] {
  const cells: string[] = [];
  let cur: string | undefined = endKey;
  while (cur) {
    cells.push(cur);
    cur = came.get(cur);
  }
  cells.reverse();
  if (cells.length === 0) return [start, end];
  const pts: Vec2[] = cells.map((k) => {
    const [cs, rs] = k.split(",");
    return pointOfTile(parseInt(cs, 10), parseInt(rs, 10));
  });
  if (pts[0].x !== start.x || pts[0].y !== start.y) pts.unshift(start);
  if (pts[pts.length - 1].x !== end.x || pts[pts.length - 1].y !== end.y) pts.push(end);
  return simplify(pts);
}


function simplify(pts: Vec2[]): Vec2[] {
  if (pts.length < 3) return pts;
  const out: Vec2[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1];
    const b = pts[i];
    const c = pts[i + 1];
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (Math.abs(cross) > 0.01) out.push(b);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export function blockedSetFromPieces(
  pieces: Iterable<{ x: number; y: number; role: string }>,
  blockSizeLevel: number = 0,
): Set<string> {
  const out = new Set<string>();
  for (const p of pieces) {
    if (p.role !== "block") continue;
    const t = tileOfPoint(p);
    const radius = blockSizeLevel;
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        if (dr === 0 && dc === 0) {
          if (inBounds(t.col, t.row)) out.add(cellKey(t.col, t.row));
        } else if (inBounds(t.col + dc, t.row + dr)) {
          out.add(cellKey(t.col + dc, t.row + dr));
        }
      }
    }
  }
  return out;
}

export const cellKey = (c: number, r: number) => c + "," + r;
