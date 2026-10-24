import { TILE } from '../core/grid';
import { Vec2 } from '../core/math';
import { BALANCE } from '../data/balance';
import { PALETTE } from '../data/palette';
import { Runtime } from './types';

let reducedMotion = false;

/** 减少动效模式：粒子与震屏减半（无障碍） */
export function setReducedMotion(value: boolean): void {
  reducedMotion = value;
}

function centerOf(cell: Vec2): { x: number; y: number } {
  return { x: cell.x * TILE + TILE / 2, y: cell.y * TILE + TILE / 2 };
}

export interface BurstOptions {
  count?: number;
  color?: string | string[];
  speed?: number;
  size?: number;
  life?: number;
  gravity?: number;
  spread?: number;
}

export function burst(rt: Runtime, cell: Vec2, opts: BurstOptions = {}): void {
  const count = Math.round((opts.count ?? 10) * (reducedMotion ? 0.45 : 1));
  const colors = Array.isArray(opts.color) ? opts.color : [opts.color ?? PALETTE.effect.dust];
  const speed = opts.speed ?? 34;
  const life = opts.life ?? 0.5;
  const c = centerOf(cell);
  for (let i = 0; i < count; i++) {
    if (rt.particles.length >= BALANCE.fx.maxParticles) break;
    const angle = rt.rng.range(0, Math.PI * 2);
    const v = rt.rng.range(speed * 0.35, speed);
    rt.particles.push({
      x: c.x + rt.rng.range(-4, 4),
      y: c.y + rt.rng.range(-4, 4),
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      life: rt.rng.range(life * 0.6, life),
      maxLife: life,
      color: rt.rng.pick(colors),
      size: opts.size ?? 2,
      gravity: opts.gravity ?? 40,
    });
  }
}

export function stepDust(rt: Runtime, cell: Vec2): void {
  burst(rt, cell, { count: 4, color: PALETTE.effect.dust, speed: 18, size: 1, life: 0.34, gravity: 26 });
}

export function hitSparks(rt: Runtime, cell: Vec2): void {
  burst(rt, cell, {
    count: 16,
    color: [PALETTE.effect.hit, PALETTE.effect.spark, '#ffffff'],
    speed: 90,
    size: 2,
    life: 0.5,
    gravity: 90,
  });
}

export function warmRing(rt: Runtime, cell: Vec2): void {
  const c = centerOf(cell);
  const count = Math.round(28 * (reducedMotion ? 0.5 : 1));
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const r = 6 + rt.rng.range(0, 6);
    rt.particles.push({
      x: c.x + Math.cos(angle) * r,
      y: c.y + Math.sin(angle) * r,
      vx: Math.cos(angle) * 46,
      vy: Math.sin(angle) * 46,
      life: 0.55,
      maxLife: 0.55,
      color: i % 3 === 0 ? PALETTE.effect.warmCore : PALETTE.effect.warm,
      size: 2,
      gravity: -8,
    });
  }
}

export function pickupSparkle(rt: Runtime, cell: Vec2): void {
  burst(rt, cell, {
    count: 14,
    color: [PALETTE.effect.spark, '#ffe9a8', PALETTE.hud.good],
    speed: 52,
    size: 2,
    life: 0.6,
    gravity: 20,
  });
}

/** 粉笔头飞过的轨迹：沿路径撒白点（只加粒子，不建持久投射物） */
export function chalkTrail(rt: Runtime, from: Vec2, to: Vec2): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const steps = Math.max(1, Math.max(Math.abs(dx), Math.abs(dy)));
  const count = Math.max(2, Math.round(steps * 4 * (reducedMotion ? 0.6 : 1)));
  const a = centerOf(from);
  const b = centerOf(to);
  for (let i = 0; i <= count; i++) {
    if (rt.particles.length >= BALANCE.fx.maxParticles) break;
    const t = i / count;
    rt.particles.push({
      x: a.x + (b.x - a.x) * t + rt.rng.range(-1.5, 1.5),
      y: a.y + (b.y - a.y) * t + rt.rng.range(-1.5, 1.5),
      vx: -dx * 8 + rt.rng.range(-10, 10),
      vy: -dy * 8 + rt.rng.range(-10, 10),
      life: rt.rng.range(0.14, 0.3),
      maxLife: 0.3,
      color: i % 5 === 0 ? '#ffffff' : '#f2f5ef',
      size: 1,
      gravity: 8,
    });
  }
}

export function addShake(rt: Runtime, amount: number): void {
  if (reducedMotion) amount *= 0.4;
  rt.shake = Math.min(7, rt.shake + amount);
}

export function addFlash(rt: Runtime, amount: number): void {
  if (reducedMotion) amount *= 0.5;
  rt.flash = Math.min(1, rt.flash + amount);
}

export function updateEffects(rt: Runtime, dt: number): void {
  for (let i = rt.particles.length - 1; i >= 0; i--) {
    const p = rt.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      rt.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.gravity * dt;
    p.vx *= 0.98;
  }
  rt.shake = Math.max(0, rt.shake - rt.shake * Math.min(1, dt * BALANCE.fx.shakeDecay));
  rt.flash = Math.max(0, rt.flash - dt * 2.4);
  rt.warmPulse = Math.max(0, rt.warmPulse - dt * 1.6);
  rt.hurtVignette = Math.max(0, rt.hurtVignette - dt * 2.2);
  rt.hitstop = Math.max(0, rt.hitstop - dt);
}
