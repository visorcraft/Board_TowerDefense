import { PALETTE, rgba } from "./palette.js";

export interface Sprite {
  size: number;
  data: Uint8Array;
}

export function makeSolid(size: number, color: [number, number, number]): Sprite {
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = color[0];
    data[i * 4 + 1] = color[1];
    data[i * 4 + 2] = color[2];
    data[i * 4 + 3] = 255;
  }
  return { size, data };
}

export function cannonSprite(): Sprite {
  const s = 28;
  const data = new Uint8Array(s * s * 4);
  const body = hex("#fff2a8");
  const dark = hex("#8a7832");
  const barrel = hex("#1a2238");
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const cx = x - s / 2;
      const cy = y - s / 2;
      const r = Math.hypot(cx, cy);
      const i = (y * s + x) * 4;
      if (r < s / 2 - 1) {
        if (Math.abs(cx) < 4 && cy < 0) {
          data[i] = barrel[0];
          data[i + 1] = barrel[1];
          data[i + 2] = barrel[2];
        } else if (r > s / 2 - 3) {
          data[i] = dark[0];
          data[i + 1] = dark[1];
          data[i + 2] = dark[2];
        } else {
          data[i] = body[0];
          data[i + 1] = body[1];
          data[i + 2] = body[2];
        }
        data[i + 3] = 255;
      }
    }
  }
  return { size: s, data };
}

export function blockSprite(): Sprite {
  const s = 28;
  const data = new Uint8Array(s * s * 4);
  const body = hex("#bfbfbf");
  const dark = hex("#3a3a3a");
  const hi = hex("#ffffff");
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const i = (y * s + x) * 4;
      if (x < 2 || y < 2 || x >= s - 2 || y >= s - 2) {
        data[i] = dark[0];
        data[i + 1] = dark[1];
        data[i + 2] = dark[2];
      } else if (x + y < 4) {
        data[i] = hi[0];
        data[i + 1] = hi[1];
        data[i + 2] = hi[2];
      } else {
        data[i] = body[0];
        data[i + 1] = body[1];
        data[i + 2] = body[2];
      }
      data[i + 3] = 255;
    }
  }
  return { size: s, data };
}

export function stairSprite(): Sprite {
  const s = 28;
  const data = new Uint8Array(s * s * 4);
  const body = hex("#7adfff");
  const dark = hex("#1f5570");
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const i = (y * s + x) * 4;
      const step = Math.floor((x / s) * 3) + Math.floor((y / s) * 3);
      if (x < 2 || y < 2 || x >= s - 2 || y >= s - 2) {
        data[i] = dark[0];
        data[i + 1] = dark[1];
        data[i + 2] = dark[2];
      } else if ((x + y) % 6 < 3) {
        data[i] = body[0];
        data[i + 1] = body[1];
        data[i + 2] = body[2];
      } else {
        data[i] = dark[0];
        data[i + 1] = dark[1];
        data[i + 2] = dark[2];
      }
      data[i + 3] = 255;
      void step;
    }
  }
  return { size: s, data };
}

export function ringSprite(): Sprite {
  const s = 28;
  const data = new Uint8Array(s * s * 4);
  const body = hex("#ff7adf");
  const dark = hex("#552a4f");
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const cx = x - s / 2;
      const cy = y - s / 2;
      const r = Math.hypot(cx, cy);
      const i = (y * s + x) * 4;
      const ringR = s / 2 - 3;
      const innerR = s / 2 - 8;
      if (r <= ringR && r >= innerR) {
        data[i] = body[0];
        data[i + 1] = body[1];
        data[i + 2] = body[2];
        data[i + 3] = 255;
      } else if (r > ringR && r < s / 2) {
        data[i] = dark[0];
        data[i + 1] = dark[1];
        data[i + 2] = dark[2];
        data[i + 3] = 255;
      }
    }
  }
  return { size: s, data };
}

function hex(s: string): [number, number, number] {
  const h = s.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function drawSprite(ctx: CanvasRenderingContext2D, sprite: Sprite, x: number, y: number, rotationDeg: number): void {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate((rotationDeg * Math.PI) / 180);
  const clamped = new Uint8ClampedArray(sprite.data.length);
  clamped.set(sprite.data);
  const imageData = new ImageData(clamped, sprite.size, sprite.size);
  const off = new OffscreenCanvas(sprite.size, sprite.size);
  const octx = off.getContext("2d");
  if (!octx) {
    ctx.restore();
    return;
  }
  octx.putImageData(imageData, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off, -sprite.size / 2, -sprite.size / 2);
  ctx.restore();
}

export function drawCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, fill = true): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

export function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, size: number, align: CanvasTextAlign = "left", baseline: CanvasTextBaseline = "top"): void {
  ctx.font = `${size}px monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

export function strokeRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, lineWidth = 2): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(x, y, w, h);
}

export function fillRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

export function laneColor(i: number): string {
  return PALETTE.lane[i % PALETTE.lane.length];
}
export function laneColorDim(i: number): string {
  return PALETTE.laneDim[i % PALETTE.laneDim.length];
}

export function laneColorRgba(i: number, a: number): string {
  return rgba(laneColor(i), a);
}
