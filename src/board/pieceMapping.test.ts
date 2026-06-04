import { describe, it, expect } from "vitest";
import { PieceMappingTable } from "./pieceMapping.js";

describe("piece mapping", () => {
  it("default mapping has all roles", () => {
    const m = PieceMappingTable.defaultMapping();
    expect(m.roleFor(11)).toBe("cannon");
    expect(m.roleFor(21)).toBe("block");
    expect(m.roleFor(31)).toBe("stair");
    expect(m.roleFor(41)).toBe("ring");
    expect(m.roleFor(999)).toBe("unknown");
  });

  it("fromJson accepts a valid mapping", () => {
    const m = PieceMappingTable.fromJson({
      description: "test",
      defaultLaneColors: [0, 0, 0],
      entries: [{ glyphId: 100, role: "cannon", label: "X" }],
      fingerPlacement: { placePiece: "lmb", rotatePiece: "q", cycleMode: "f" },
    });
    expect(m.roleFor(100)).toBe("cannon");
    expect(m.entryFor(100)?.label).toBe("X");
  });

  it("laneColors returns configured colors", () => {
    const m = PieceMappingTable.fromJson({
      description: "t",
      defaultLaneColors: [0x111111, 0x222222, 0x333333],
      entries: [],
      fingerPlacement: { placePiece: "lmb", rotatePiece: "q", cycleMode: "f" },
    });
    expect(m.laneColors()).toEqual([0x111111, 0x222222, 0x333333]);
  });
});
