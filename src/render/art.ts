/** 像素绘制小工具：所有坐标取整，保证 1:1 逻辑像素不被抗锯齿糊掉 */
export function fill(
  ctx: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function outline(
  ctx: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  w: number,
  h: number,
  thickness = 1,
): void {
  fill(ctx, color, x, y, w, thickness);
  fill(ctx, color, x, y + h - thickness, w, thickness);
  fill(ctx, color, x, y, thickness, h);
  fill(ctx, color, x + w - thickness, y, thickness, h);
}

export function shadow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  alpha = 0.28,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#1a1206';
  ctx.beginPath();
  ctx.ellipse(Math.round(cx), Math.round(cy), rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 沿方向铺一串 2×2 像素块，得到"像素直线"（剑刃/天线/粉笔） */
export function pixelLine(
  ctx: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  dx: number,
  dy: number,
  length: number,
  thickness = 2,
): void {
  const steps = Math.max(1, Math.round(length));
  for (let i = 0; i < steps; i++) {
    const px = x + (dx * i * 2) / Math.max(1, Math.abs(dx) + Math.abs(dy));
    const py = y + (dy * i * 2) / Math.max(1, Math.abs(dx) + Math.abs(dy));
    fill(ctx, color, px, py, thickness, thickness);
  }
}

/** 抖动值（确定性），用于纹理扰动 */
export function jitter(seed: number, index: number): number {
  const v = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453;
  return v - Math.floor(v);
}
