import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./game/state.js";
import { drawText, fillRect, strokeRect } from "./render/sprites.js";
import { PALETTE, rgba } from "./render/palette.js";
import type { DevContact } from "./board/boardInput.js";
import type { PieceMappingTable } from "./board/pieceMapping.js";

export interface DiagnosticEntry {
  contactId: number;
  glyphId: number;
  type: string;
  phase: string;
  x: number;
  y: number;
  orientation: number;
  isTouched: boolean;
  role: string;
  time: number;
}

const MAX_LOG = 28;
const MAX_SEEN = 64;

export class DiagnosticLog {
  entries: DiagnosticEntry[] = [];
  seen: Map<number, DiagnosticEntry> = new Map();
  glyphSummary: Map<number, { count: number; role: string; lastX: number; lastY: number; lastOrientation: number }> = new Map();

  update(contacts: ReadonlyArray<DevContact>, mapping: PieceMappingTable, now: number): void {
    for (const c of contacts) {
      const existing = this.seen.get(c.contactId);
      const role = c.glyphId > 0 ? mapping.roleFor(c.glyphId) : "finger";
      const entry: DiagnosticEntry = {
        contactId: c.contactId,
        glyphId: c.glyphId,
        type: c.type,
        phase: c.phase,
        x: Math.round(c.x),
        y: Math.round(c.y),
        orientation: Math.round(c.orientation),
        isTouched: c.isTouched,
        role,
        time: now,
      };
      this.seen.set(c.contactId, entry);
      if (c.glyphId > 0) {
        const cur = this.glyphSummary.get(c.glyphId) ?? { count: 0, role, lastX: 0, lastY: 0, lastOrientation: 0 };
        cur.count++;
        cur.lastX = entry.x;
        cur.lastY = entry.y;
        cur.lastOrientation = entry.orientation;
        cur.role = role;
        this.glyphSummary.set(c.glyphId, cur);
      }
      this.entries.unshift(entry);
      if (this.entries.length > MAX_LOG) this.entries.length = MAX_LOG;
    }
    if (this.seen.size > MAX_SEEN) {
      const ids = [...this.seen.keys()].slice(0, this.seen.size - MAX_SEEN);
      for (const id of ids) this.seen.delete(id);
    }
  }

  reset(): void {
    this.entries = [];
    this.seen.clear();
    this.glyphSummary.clear();
  }
}

export function drawDiagnostic(
  ctx: CanvasRenderingContext2D,
  log: DiagnosticLog,
  mapping: PieceMappingTable,
  onDevice: boolean,
): void {
  fillRect(ctx, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, "#04060d");
  drawText(ctx, "DIAGNOSTIC — Long-press to return", 32, 24, PALETTE.gold, 28, "left", "top");
  drawText(ctx, onDevice ? "Board hardware" : "Dev mouse fallback", 32, 56, onDevice ? "#7be0a4" : "#ffb74f", 18, "left", "top");
  drawText(ctx, "Map physical Pieces to roles by placing them on the Board.", 32, 80, PALETTE.textDim, 16, "left", "top");
  drawText(ctx, "Long-press anywhere for 1.5s to toggle this screen.", 32, 98, PALETTE.textDim, 14, "left", "top");

  const lx = 32;
  const ly = 120;
  const lw = CANVAS_WIDTH - 64;
  const lh = CANVAS_HEIGHT - 280;
  fillRect(ctx, lx, ly, lw, lh, "#0a0f1f");
  strokeRect(ctx, lx, ly, lw, lh, PALETTE.panelLine, 2);
  drawText(ctx, "Live contact log", lx + 16, ly + 12, PALETTE.text, 20, "left", "top");
  const headers = ["id", "glyph", "type", "phase", "x", "y", "rot", "touched", "role"];
  const cols = [80, 100, 110, 130, 240, 320, 400, 500, 620];
  const rowY = ly + 50;
  for (let i = 0; i < headers.length; i++) {
    drawText(ctx, headers[i], lx + cols[i], rowY, PALETTE.textDim, 16, "left", "top");
  }
  const lineH = 22;
  for (let i = 0; i < log.entries.length; i++) {
    const e = log.entries[i];
    const y = rowY + 30 + i * lineH;
    if (y > ly + lh - 20) break;
    drawText(ctx, String(e.contactId), lx + cols[0], y, PALETTE.text, 16, "left", "top");
    drawText(ctx, String(e.glyphId), lx + cols[1], y, PALETTE.text, 16, "left", "top");
    drawText(ctx, e.type, lx + cols[2], y, PALETTE.text, 16, "left", "top");
    drawText(ctx, e.phase, lx + cols[3], y, PALETTE.text, 16, "left", "top");
    drawText(ctx, String(e.x), lx + cols[4], y, PALETTE.text, 16, "left", "top");
    drawText(ctx, String(e.y), lx + cols[5], y, PALETTE.text, 16, "left", "top");
    drawText(ctx, String(e.orientation), lx + cols[6], y, PALETTE.text, 16, "left", "top");
    drawText(ctx, e.isTouched ? "Y" : "n", lx + cols[7], y, e.isTouched ? "#7be0a4" : PALETTE.textDim, 16, "left", "top");
    drawText(ctx, e.role, lx + cols[8], y, e.role === "unknown" ? PALETTE.hp : PALETTE.text, 16, "left", "top");
  }

  const sx = 32;
  const sy = CANVAS_HEIGHT - 140;
  const sw = CANVAS_WIDTH - 64;
  const sh = 110;
  fillRect(ctx, sx, sy, sw, sh, "#0a0f1f");
  strokeRect(ctx, sx, sy, sw, sh, PALETTE.panelLine, 2);
  drawText(ctx, "Glyph summary — observed glyph IDs", sx + 16, sy + 12, PALETTE.text, 20, "left", "top");
  drawText(ctx, "glyph", sx + 16, sy + 44, PALETTE.textDim, 14, "left", "top");
  drawText(ctx, "role", sx + 100, sy + 44, PALETTE.textDim, 14, "left", "top");
  drawText(ctx, "count", sx + 220, sy + 44, PALETTE.textDim, 14, "left", "top");
  drawText(ctx, "last x,y", sx + 320, sy + 44, PALETTE.textDim, 14, "left", "top");
  drawText(ctx, "last rot", sx + 460, sy + 44, PALETTE.textDim, 14, "left", "top");
  drawText(ctx, "label", sx + 580, sy + 44, PALETTE.textDim, 14, "left", "top");
  const sorted = [...log.glyphSummary.entries()].sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < sorted.length && i < 4; i++) {
    const [gid, info] = sorted[i];
    const y = sy + 64 + i * 14;
    const label = mapping.entryFor(gid)?.label ?? "?";
    drawText(ctx, String(gid), sx + 16, y, PALETTE.text, 14, "left", "top");
    drawText(ctx, info.role, sx + 100, y, info.role === "unknown" ? PALETTE.hp : PALETTE.text, 14, "left", "top");
    drawText(ctx, String(info.count), sx + 220, y, PALETTE.text, 14, "left", "top");
    drawText(ctx, `${info.lastX},${info.lastY}`, sx + 320, y, PALETTE.text, 14, "left", "top");
    drawText(ctx, String(info.lastOrientation), sx + 460, y, PALETTE.text, 14, "left", "top");
    drawText(ctx, label, sx + 580, y, PALETTE.text, 14, "left", "top");
  }

  drawText(ctx, "Mapping source: " + (mapping.raw().description ?? "default"), 32, CANVAS_HEIGHT - 18, rgba(PALETTE.text, 0.6), 14, "left", "top");
}
