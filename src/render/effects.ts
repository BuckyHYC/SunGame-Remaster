import { TILE } from '../core/grid';
import { Vec2 } from '../core/math';
import { PALETTE } from '../data/palette';
import { Particle } from '../game/types';
import { fill } from './art';

let nightCanvas: HTMLCanvasElement | null = null;

export function drawPickup(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  kind: number,
  bobPhase: number,
  t: number,
): void {
  const bob = Math.round(Math.sin(t * 3 + bobPhase) * 2);
  const y = py + 6 + bob;
  // 光晕
  ctx.save();
  ctx.globalAlpha = 0.35 + Math.sin(t * 3 + bobPhase) * 0.1;
  fill(ctx, PALETTE.effect.spark, px + 9, y + 2, 6, 6);
  ctx.restore();

  switch (kind % 5) {
    case 0: // 奶茶
      fill(ctx, '#f3e6cf', px + 9, y + 3, 6, 8);
      fill(ctx, '#d9c9ad', px + 9, y + 3, 1, 8);
      fill(ctx, '#c98a4b', px + 9, y + 4, 6, 2);
      fill(ctx, '#8a5a2b', px + 10, y + 1, 1, 3);
      fill(ctx, '#5c3b1c', px + 12, y + 6, 3, 1);
      break;
    case 1: // 错题本
      fill(ctx, '#c04a4a', px + 8, y + 5, 8, 8);
      fill(ctx, '#a13c3c', px + 8, y + 5, 2, 8);
      fill(ctx, '#f0e6cf', px + 11, y + 7, 4, 4);
      fill(ctx, '#b9ad8f', px + 12, y + 8, 2, 1);
      break;
    case 2: // 黑板擦
      fill(ctx, '#4a4f5a', px + 8, y + 7, 8, 4);
      fill(ctx, '#5f6673', px + 8, y + 6, 8, 2);
      fill(ctx, '#d8d3c4', px + 9, y + 10, 6, 2);
      break;
    case 3: // 小纸条
      fill(ctx, '#f5edd6', px + 8, y + 7, 8, 6);
      fill(ctx, '#d6caa8', px + 9, y + 9, 6, 1);
      fill(ctx, '#d6caa8', px + 9, y + 11, 4, 1);
      fill(ctx, '#d6caa8', px + 14, y + 7, 2, 2);
      break;
    default: // 粉笔头
      fill(ctx, '#f2f5ef', px + 9, y + 7, 6, 3);
      fill(ctx, '#e2e8e0', px + 14, y + 7, 1, 3);
      fill(ctx, '#ffd9a0', px + 11, y + 10, 2, 1);
      break;
  }
}

export function drawExitState(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  open: boolean,
  t: number,
): void {
  if (open) {
    const pulse = 0.45 + Math.sin(t * 4) * 0.18;
    ctx.save();
    ctx.globalAlpha = pulse;
    fill(ctx, PALETTE.exitOpen, px + 1, py + 1, TILE - 2, TILE - 2);
    ctx.restore();
    fill(ctx, '#d8ffe8', px + 6, py + 6, TILE - 12, TILE - 12);
    // 向上的箭头
    const ay = py + 8 + Math.round(Math.sin(t * 4) * 1.5);
    fill(ctx, '#0f3b24', px + 11, ay, 2, 6);
    fill(ctx, '#0f3b24', px + 9, ay + 2, 2, 2);
    fill(ctx, '#0f3b24', px + 13, ay + 2, 2, 2);
    fill(ctx, '#0f3b24', px + 8, ay + 4, 2, 2);
    fill(ctx, '#0f3b24', px + 14, ay + 4, 2, 2);
  } else {
    // 锁住：铁链 + 挂锁
    fill(ctx, '#8a90a0', px + 4, py + 8, TILE - 8, 2);
    fill(ctx, '#6d7382', px + 4, py + 13, TILE - 8, 2);
    fill(ctx, '#b8bfcc', px + 10, py + 10, 4, 5);
    fill(ctx, '#5d6370', px + 11, py + 11, 2, 2);
  }
}

export function drawSeatGlow(ctx: CanvasRenderingContext2D, px: number, py: number, t: number): void {
  ctx.save();
  ctx.globalAlpha = 0.25 + Math.sin(t * 2.5) * 0.08;
  fill(ctx, PALETTE.seatEmpty, px + 5, py + 10, 14, 14);
  ctx.restore();
}

export function drawObjectiveRing(ctx: CanvasRenderingContext2D, px: number, py: number, t: number): void {
  const r = 3 + Math.sin(t * 4) * 1.2;
  ctx.save();
  ctx.globalAlpha = 0.5;
  fill(ctx, PALETTE.hud.warmth, px + 12 - r, py + 22, r * 2, 2);
  ctx.globalAlpha = 0.28;
  fill(ctx, PALETTE.hud.warmth, px + 12 - r - 1, py + 21, r * 2 + 2, 1);
  ctx.restore();
}

export function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
  for (const p of particles) {
    const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
    ctx.globalAlpha = alpha;
    fill(ctx, p.color, p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

export function drawWarmPulse(
  ctx: CanvasRenderingContext2D,
  origin: Vec2,
  progress: number,
): void {
  const t = 1 - progress;
  const r = 6 + t * 66;
  const cx = origin.x * TILE + TILE / 2;
  const cy = origin.y * TILE + TILE / 2;
  ctx.save();
  ctx.globalAlpha = Math.max(0, progress) * 0.55;
  ctx.strokeStyle = PALETTE.effect.warmCore;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = Math.max(0, progress) * 0.3;
  ctx.strokeStyle = PALETTE.effect.warm;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawChaserTelegraph(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  facing: string,
  kind: 'alert' | 'windup' | 'strike',
  progress: number,
): void {
  const cx = px + TILE / 2;
  const cy = py + TILE / 2;
  const dir = facing === 'up' ? -1 : facing === 'down' ? 1 : 0;
  const horiz = facing === 'left' ? -1 : facing === 'right' ? 1 : 0;

  if (kind === 'alert') {
    // 头顶感叹号
    const bounce = Math.round(Math.sin(progress * 12) * 1);
    fill(ctx, '#ffdc6b', px + 11, py - 8 + bounce, 3, 6);
    fill(ctx, '#ffdc6b', px + 11, py - 1 + bounce, 3, 2);
  }

  if (kind === 'windup') {
    // 身前红色扇形预告：告诉玩家"这一格会被砍"
    ctx.save();
    ctx.globalAlpha = 0.22 + progress * 0.35;
    const tx = cx + horiz * TILE;
    const ty = cy + dir * TILE;
    fill(ctx, '#ff4d4d', tx - 10, ty - 10, 20, 20);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.45 + Math.sin(progress * 20) * 0.15;
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (kind === 'strike') {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - progress);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const sweep = 0.6;
    if (horiz !== 0) {
      ctx.arc(cx, cy, 20, horiz > 0 ? -sweep : Math.PI - sweep, horiz > 0 ? sweep : Math.PI + sweep);
    } else if (dir !== 0) {
      ctx.arc(cx, cy, 20, dir > 0 ? Math.PI / 2 - sweep : -Math.PI / 2 - sweep, dir > 0 ? Math.PI / 2 + sweep : -Math.PI / 2 + sweep);
    }
    ctx.stroke();
    ctx.restore();
  }
}

export function drawInteractHint(ctx: CanvasRenderingContext2D, px: number, py: number, t: number): void {
  const y = py - 12 + Math.round(Math.sin(t * 5) * 1.5);
  fill(ctx, '#12161d', px + 7, y, 10, 10);
  fill(ctx, '#ffd166', px + 8, y + 1, 8, 1);
  fill(ctx, '#ffd166', px + 8, y + 1, 1, 8);
  fill(ctx, '#ffd166', px + 8, y + 4, 5, 1);
  fill(ctx, '#ffd166', px + 8, y + 8, 8, 1);
}

/** 后门钥匙：金色钥匙 + 呼吸光晕 */
export function drawKey(ctx: CanvasRenderingContext2D, px: number, py: number, t: number): void {
  const bob = Math.round(Math.sin(t * 2.4) * 2);
  ctx.save();
  ctx.globalAlpha = 0.26 + Math.sin(t * 2.4) * 0.08;
  fill(ctx, PALETTE.effect.spark, px + 7, py + 5 + bob, 10, 10);
  ctx.restore();

  const y = py + 7 + bob;
  fill(ctx, '#ffd166', px + 8, y, 5, 5);
  fill(ctx, '#12161d', px + 10, y + 2, 1, 1);
  fill(ctx, '#ffd166', px + 12, y + 1, 7, 2);
  fill(ctx, '#ffd166', px + 16, y + 3, 1, 3);
  fill(ctx, '#ffd166', px + 18, y + 3, 1, 2);
  fill(ctx, '#fff3d6', px + 9, y + 1, 3, 1);
  fill(ctx, '#b8862c', px + 8, y + 4, 5, 1);
}

/** 「再被吓一次就会入伙」的提示：头顶半个剑影 */
export function drawScareMark(ctx: CanvasRenderingContext2D, px: number, py: number, t: number): void {
  const bounce = Math.round(Math.sin(t * 6) * 1);
  const y = py - 7 + bounce;
  ctx.save();
  ctx.globalAlpha = 0.5 + Math.sin(t * 6) * 0.16;
  fill(ctx, '#ff8a8a', px + 13, y, 1, 6);
  fill(ctx, '#ff8a8a', px + 12, y + 5, 3, 1);
  fill(ctx, '#ffd166', px + 11, y + 6, 5, 1);
  ctx.restore();
}

/** 入伙同学的红色脚环：和普通同学一眼分开 */
export function drawConvertedRing(ctx: CanvasRenderingContext2D, px: number, py: number, t: number): void {
  ctx.save();
  ctx.globalAlpha = 0.34 + Math.sin(t * 5) * 0.12;
  ctx.strokeStyle = '#ff6b6b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(px + TILE / 2, py + TILE - 3.5, 9, 4, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawNight(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  focus: { x: number; y: number },
  windows: Vec2[],
  t: number,
): void {
  if (!nightCanvas || nightCanvas.width !== width || nightCanvas.height !== height) {
    nightCanvas = document.createElement('canvas');
    nightCanvas.width = width;
    nightCanvas.height = height;
  }
  const nctx = nightCanvas.getContext('2d');
  if (!nctx) return;
  nctx.globalCompositeOperation = 'source-over';
  nctx.clearRect(0, 0, width, height);
  nctx.fillStyle = 'rgba(5, 8, 16, 0.82)';
  nctx.fillRect(0, 0, width, height);

  nctx.globalCompositeOperation = 'destination-out';
  const radius = 62 + Math.sin(t * 2) * 3;
  const grad = nctx.createRadialGradient(focus.x, focus.y, 10, focus.x, focus.y, radius);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.82)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  nctx.fillStyle = grad;
  nctx.beginPath();
  nctx.arc(focus.x, focus.y, radius, 0, Math.PI * 2);
  nctx.fill();

  for (const cell of windows) {
    const wx = cell.x * TILE + TILE / 2;
    const wy = cell.y * TILE + TILE / 2 + 18;
    const wg = nctx.createRadialGradient(wx, wy, 2, wx, wy, 34);
    wg.addColorStop(0, 'rgba(0,0,0,0.7)');
    wg.addColorStop(1, 'rgba(0,0,0,0)');
    nctx.fillStyle = wg;
    nctx.beginPath();
    nctx.arc(wx, wy, 34, 0, Math.PI * 2);
    nctx.fill();
  }
  nctx.globalCompositeOperation = 'source-over';

  ctx.drawImage(nightCanvas, 0, 0);
  // 灯光暖色叠加
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const warm = ctx.createRadialGradient(focus.x, focus.y, 4, focus.x, focus.y, 58);
  warm.addColorStop(0, 'rgba(255, 214, 150, 0.16)');
  warm.addColorStop(1, 'rgba(255, 214, 150, 0)');
  ctx.fillStyle = warm;
  ctx.beginPath();
  ctx.arc(focus.x, focus.y, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawHurtVignette(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number,
): void {
  if (intensity <= 0.01) return;
  const grad = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.25,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.7,
  );
  grad.addColorStop(0, 'rgba(255, 60, 60, 0)');
  grad.addColorStop(1, `rgba(190, 20, 30, ${0.55 * intensity})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

export function drawLowHpBorder(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
): void {
  const pulse = 0.18 + Math.abs(Math.sin(t * 3)) * 0.22;
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#ff4d4d';
  ctx.fillRect(0, 0, width, 3);
  ctx.fillRect(0, height - 3, width, 3);
  ctx.fillRect(0, 0, 3, height);
  ctx.fillRect(width - 3, 0, 3, height);
  ctx.restore();
}

export function drawFlash(ctx: CanvasRenderingContext2D, width: number, height: number, amount: number): void {
  if (amount <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.8, amount);
  ctx.fillStyle = '#fff6e2';
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
