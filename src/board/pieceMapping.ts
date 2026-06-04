import type { PieceMapping, PieceMappingEntry, Role } from "../game/types.js";

const DEFAULT_MAPPING: PieceMapping = {
  description: "Built-in fallback mapping (no JSON loaded).",
  defaultLaneColors: [16744448, 16756398, 16752048],
  entries: [
    { glyphId: 11, role: "cannon", label: "Cannon A" },
    { glyphId: 12, role: "cannon", label: "Cannon B" },
    { glyphId: 21, role: "block", label: "Block A" },
    { glyphId: 22, role: "block", label: "Block B" },
    { glyphId: 31, role: "stair", label: "Stair 0", lane: 0 },
    { glyphId: 32, role: "stair", label: "Stair 1", lane: 1 },
    { glyphId: 33, role: "stair", label: "Stair 2", lane: 2 },
    { glyphId: 41, role: "ring", label: "Ring" },
  ],
  fingerPlacement: { placePiece: "lmb", rotatePiece: "q", cycleMode: "f" },
};

export class PieceMappingTable {
  private byGlyph: Map<number, PieceMappingEntry> = new Map();
  private data: PieceMapping;

  constructor(mapping: PieceMapping) {
    this.data = mapping;
    for (const e of mapping.entries) this.byGlyph.set(e.glyphId, e);
  }

  static async load(url: string = "./pieceset.json"): Promise<PieceMappingTable> {
    try {
      const r = await fetch(url);
      if (!r.ok) return new PieceMappingTable(DEFAULT_MAPPING);
      const j = (await r.json()) as PieceMapping;
      return new PieceMappingTable(j);
    } catch {
      return new PieceMappingTable(DEFAULT_MAPPING);
    }
  }

  static fromJson(j: PieceMapping): PieceMappingTable {
    return new PieceMappingTable(j);
  }

  static defaultMapping(): PieceMappingTable {
    return new PieceMappingTable(DEFAULT_MAPPING);
  }

  roleFor(glyphId: number): Role {
    return this.byGlyph.get(glyphId)?.role ?? "unknown";
  }

  entryFor(glyphId: number): PieceMappingEntry | undefined {
    return this.byGlyph.get(glyphId);
  }

  entries(): ReadonlyArray<PieceMappingEntry> {
    return this.data.entries;
  }

  laneColors(): number[] {
    return this.data.defaultLaneColors;
  }

  raw(): PieceMapping {
    return this.data;
  }
}
