import { PALETTE, rgba } from "./palette.js";

export interface Sprite {
  size: number;
  data: Uint8Array;
  image: CanvasImageSource;
}

const EMPTY = new Uint8Array(0);

function makeSprite(size: number, draw: (ctx: OffscreenCanvasRenderingContext2D, s: number) => void): Sprite {
  const off = new OffscreenCanvas(size, size);
  const octx = off.getContext("2d")!;
  draw(octx, size);
  return { size, data: EMPTY, image: off };
}

export function cannonSprite(): Sprite {
  return makeSprite(52, (ctx, s) => {
    const cx = s / 2;
    const cy = s / 2 - 2;
    // shadow
    ctx.beginPath();
    ctx.ellipse(cx, s - 6, 18, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fill();
    // body base (dark metal circle)
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    const body = ctx.createRadialGradient(cx - 4, cy - 6, 3, cx, cy, 18);
    body.addColorStop(0, "#6b6b7d");
    body.addColorStop(0.4, "#4a4a5c");
    body.addColorStop(0.8, "#2a2a3a");
    body.addColorStop(1, "#1a1a28");
    ctx.fillStyle = body;
    ctx.fill();
    // body rim
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.strokeStyle = "#8a8a9c";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // inner highlight
    ctx.beginPath();
    ctx.arc(cx - 3, cy - 3, 8, 0, Math.PI * 2);
    const hl = ctx.createRadialGradient(cx - 3, cy - 3, 2, cx - 3, cy - 3, 8);
    hl.addColorStop(0, "rgba(255,255,255,0.25)");
    hl.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hl;
    ctx.fill();
    // barrel
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI / 2);
    // barrel body
    ctx.fillStyle = "#f0c040";
    ctx.fillRect(-4, -28, 8, 22);
    const bGrad = ctx.createLinearGradient(-4, 0, 4, 0);
    bGrad.addColorStop(0, "#c09020");
    bGrad.addColorStop(0.3, "#f0c040");
    bGrad.addColorStop(0.5, "#ffe080");
    bGrad.addColorStop(0.7, "#f0c040");
    bGrad.addColorStop(1, "#c09020");
    ctx.fillStyle = bGrad;
    ctx.fillRect(-4, -28, 8, 22);
    // barrel tip
    ctx.fillStyle = "#1a1a2a";
    ctx.fillRect(-5, -30, 10, 5);
    // muzzle flash glow
    const muzzle = ctx.createRadialGradient(0, -30, 1, 0, -34, 10);
    muzzle.addColorStop(0, "rgba(255,255,200,0.9)");
    muzzle.addColorStop(0.3, "rgba(255,200,50,0.5)");
    muzzle.addColorStop(1, "rgba(255,200,50,0)");
    ctx.fillStyle = muzzle;
    ctx.fillRect(-12, -40, 24, 16);
    ctx.restore();
    // mode indicator ring (outer)
    ctx.beginPath();
    ctx.arc(cx, cy, 21, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,242,168,0.5)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  });
}

export function blockSprite(): Sprite {
  return makeSprite(52, (ctx, s) => {
    const cx = s / 2;
    const cy = s / 2;
    // shadow
    ctx.beginPath();
    ctx.ellipse(cx, s - 5, 18, 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fill();
    // main block body
    const bw = 32;
    const bh = 32;
    const bx = cx - bw / 2;
    const by = cy - bh / 2;
    // beveled top (lighter)
    const topGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
    topGrad.addColorStop(0, "#959595");
    topGrad.addColorStop(0.15, "#bfbfbf");
    topGrad.addColorStop(0.5, "#808080");
    topGrad.addColorStop(0.85, "#606060");
    topGrad.addColorStop(1, "#404040");
    ctx.fillStyle = topGrad;
    roundRect(ctx, bx, by, bw, bh, 5);
    ctx.fill();
    // top highlight bevel
    const bevelGrad = ctx.createLinearGradient(bx, by, bx, by + 8);
    bevelGrad.addColorStop(0, "rgba(255,255,255,0.3)");
    bevelGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = bevelGrad;
    roundRect(ctx, bx + 3, by + 2, bw - 6, 8, 3);
    ctx.fill();
    // border
    ctx.beginPath();
    roundRect(ctx, bx, by, bw, bh, 5);
    ctx.strokeStyle = "#303030";
    ctx.lineWidth = 2;
    ctx.stroke();
    // inner line pattern (mortar)
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx + bw / 2, by + 2);
    ctx.lineTo(bx + bw / 2, by + bh - 2);
    ctx.moveTo(bx + 2, by + bh / 2);
    ctx.lineTo(bx + bw - 2, by + bh / 2);
    ctx.stroke();
    // subtle corner highlights
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.beginPath();
    ctx.arc(bx + 6, by + 6, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

export function stairSprite(): Sprite {
  return makeSprite(52, (ctx, s) => {
    const cx = s / 2;
    // shadow
    ctx.beginPath();
    ctx.ellipse(cx, s - 6, 18, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fill();
    // three steps from bottom to top
    const stepW = 30;
    const stepH = 10;
    const stepGap = 3;
    const baseY = s - 18;
    for (let i = 0; i < 3; i++) {
      const y = baseY - i * (stepH + stepGap);
      const w = stepW - i * 8;
      const x = cx - w / 2;
      // step body
      const grad = ctx.createLinearGradient(x, y, x, y + stepH);
      grad.addColorStop(0, "#5ac8ff");
      grad.addColorStop(0.3, "#3aa0e0");
      grad.addColorStop(0.7, "#2a80c0");
      grad.addColorStop(1, "#1a4060");
      ctx.fillStyle = grad;
      roundRect(ctx, x, y, w, stepH, 3);
      ctx.fill();
      // step border
      ctx.beginPath();
      roundRect(ctx, x, y, w, stepH, 3);
      ctx.strokeStyle = "#6adfff";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // step top glow
      const topGlow = ctx.createLinearGradient(x, y, x, y + 4);
      topGlow.addColorStop(0, "rgba(255,255,255,0.3)");
      topGlow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = topGlow;
      roundRect(ctx, x + 2, y + 1, w - 4, 4, 2);
      ctx.fill();
    }
  });
}

export function ringSprite(): Sprite {
  return makeSprite(52, (ctx, s) => {
    const cx = s / 2;
    const cy = s / 2;
    // outer glow
    const outerGlow = ctx.createRadialGradient(cx, cy, 14, cx, cy, 24);
    outerGlow.addColorStop(0, "rgba(255,122,223,0.0)");
    outerGlow.addColorStop(0.5, "rgba(255,122,223,0.15)");
    outerGlow.addColorStop(1, "rgba(255,122,223,0)");
    ctx.fillStyle = outerGlow;
    ctx.fillRect(cx - 24, cy - 24, 48, 48);
    // inner glow
    const innerGlow = ctx.createRadialGradient(cx, cy, 6, cx, cy, 16);
    innerGlow.addColorStop(0, "rgba(255,122,223,0.4)");
    innerGlow.addColorStop(1, "rgba(255,122,223,0)");
    ctx.fillStyle = innerGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.fill();
    // main ring
    ctx.beginPath();
    ctx.arc(cx, cy, 15, 0, Math.PI * 2);
    ctx.arc(cx, cy, 10, Math.PI * 2, 0, true);
    const ringGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 15);
    ringGrad.addColorStop(0, "#ff7adf");
    ringGrad.addColorStop(0.3, "#ff40cc");
    ringGrad.addColorStop(0.7, "#cc20aa");
    ringGrad.addColorStop(1, "#ff7adf");
    ctx.fillStyle = ringGrad;
    ctx.fill();
    // ring highlight
    ctx.beginPath();
    ctx.arc(cx - 2, cy - 3, 12.5, Math.PI * 0.6, Math.PI * 1.3);
    ctx.strokeStyle = "rgba(255,255,255,0.3)"; 
    ctx.lineWidth = 2;
    ctx.stroke();
    // sparkle dots around the ring
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      const r = 18;
      const sx = cx + Math.cos(a) * r;
      const sy = cy + Math.sin(a) * r;
      ctx.fillStyle = "rgba(255,200,255,0.6)";
      ctx.beginPath();
      ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export function makeSolid(size: number, color: [number, number, number]): Sprite {
  return makeSprite(size, (ctx, s) => {
    ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
    ctx.fillRect(0, 0, s, s);
  });
}

function roundRect(ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export function drawSprite(ctx: CanvasRenderingContext2D, sprite: Sprite, x: number, y: number, rotationDeg: number): void {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate((rotationDeg * Math.PI) / 180);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(sprite.image, -sprite.size / 2, -sprite.size / 2);
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
