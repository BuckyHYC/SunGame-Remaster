import { TILE } from '../core/grid';
import { Vec2 } from '../core/math';
import { PALETTE } from '../data/palette';
import { BALANCE } from '../data/balance';
import { LevelData } from '../game/validate';
import { Runtime } from '../game/types';
import { drawStaticLayer } from './tiles';
import { drawChaser, drawMate, drawPlayer, ChaserPose } from './characters';
import {
  drawChaserTelegraph,
  drawExitState,
  drawFlash,
  drawHurtVignette,
  drawInteractHint,
  drawLowHpBorder,
  drawNight,
  drawObjectiveRing,
  drawParticles,
  drawPickup,
  drawSeatGlow,
  drawWarmPulse,
} from './effects';

function walkFrame(t: number): number {
  return Math.floor(t * 4) % 4;
}

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private staticCanvas: HTMLCanvasElement | null = null;
  private staticKey = '';

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法获取 Canvas 2D 上下文');
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
  }

  get width(): number {
    return this.canvas.width;
  }

  get height(): number {
    return this.canvas.height;
  }

  private ensureStatic(data: LevelData): void {
    const key = `${data.def.id}:${data.grid.w}x${data.grid.h}`;
    if (this.staticCanvas && this.staticKey === key) return;
    const cache = document.createElement('canvas');
    cache.width = this.canvas.width;
    cache.height = this.canvas.height;
    const cctx = cache.getContext('2d');
    if (!cctx) return;
    cctx.imageSmoothingEnabled = false;
    drawStaticLayer(cctx, data.grid, data.meta.seats, data.meta.pickups, data.meta.exit, data.def.decor ?? []);
    this.staticCanvas = cache;
    this.staticKey = key;
  }

  drawRuntime(rt: Runtime, data: LevelData): void {
    this.ensureStatic(data);
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;
    const t = rt.clock;

    ctx.clearRect(0, 0, W, H);
    ctx.save();

    if (rt.shake > 0.08) {
      const sx = Math.round(Math.sin(t * 61) * rt.shake * 0.6);
      const sy = Math.round(Math.cos(t * 47) * rt.shake * 0.6);
      ctx.translate(sx, sy);
    }

    if (this.staticCanvas) ctx.drawImage(this.staticCanvas, 0, 0);

    // 空座位的呼吸光
    for (const seat of data.meta.seats) {
      const mate = rt.mates.find((m) => m.seat.x === seat.x && m.seat.y === seat.y);
      if (!mate || mate.state !== 'seated') {
        drawSeatGlow(ctx, seat.x * TILE, seat.y * TILE, t);
      }
    }

    drawExitState(ctx, rt.exit.x * TILE, rt.exit.y * TILE, rt.exitOpen, t);

    // 彩蛋
    for (const pickup of rt.pickups) {
      if (pickup.taken) continue;
      drawPickup(ctx, pickup.cell.x * TILE, pickup.cell.y * TILE, pickup.kind, pickup.bob, t);
    }

    // 角色按 y 排序，做出前后遮挡
    type Drawable = { y: number; x: number; draw: () => void };
    const drawables: Drawable[] = [];

    for (const mate of rt.mates) {
      const px = mate.pos.x * TILE;
      const py = mate.pos.y * TILE;
      const pose = mate.state === 'seated' ? 'seated' : mate.move ? 'walking' : 'scared';
      drawables.push({
        y: mate.pos.y,
        x: mate.pos.x,
        draw: () => {
          if (mate.state === 'scared') drawObjectiveRing(ctx, px, py, t + mate.id);
          drawMate(ctx, {
            px,
            py,
            facing: mate.facing,
            walk: mate.move ? walkFrame(mate.move.t) : 0,
            t,
            variant: mate.variant,
            pose,
            shiver: t + mate.id * 0.7,
          });
          if (mate.state === 'scared' && nearPlayer(rt, mate.pos) && rt.status === 'playing') {
            drawInteractHint(ctx, px, py, t);
          }
        },
      });
    }

    {
      const c = rt.chaser;
      const px = c.pos.x * TILE;
      const air = c.hop ? c.hop.t : 0;
      const py = c.pos.y * TILE;
      const pose = chaserPose(c.state);
      drawables.push({
        y: c.pos.y - (air > 0 ? 0.5 : 0),
        x: c.pos.x,
        draw: () => {
          drawChaser(ctx, {
            px,
            py,
            facing: c.facing,
            walk: c.move ? walkFrame(c.move.t) : 0,
            t,
            pose,
            swing: c.state === 'windup' ? 1 - c.timer / (BALANCE.chaser.windupMs / 1000) : 0,
            hop: air,
            onDesk: c.onDesk,
          });
          if (c.state === 'alert') {
            drawChaserTelegraph(ctx, px, py, c.facing, 'alert', c.alertPulse);
          }
          if (c.state === 'windup') {
            drawChaserTelegraph(
              ctx,
              px,
              py,
              c.facing,
              'windup',
              1 - c.timer / (BALANCE.chaser.windupMs / 1000),
            );
          }
          if (c.state === 'strike') {
            drawChaserTelegraph(ctx, px, py, c.facing, 'strike', 1 - c.timer / (BALANCE.chaser.strikeMs / 1000));
          }
        },
      });
    }

    {
      const p = rt.player;
      const px = p.pos.x * TILE;
      const py = p.pos.y * TILE;
      const dead = rt.status === 'lost' && rt.loseReason === 'hit';
      drawables.push({
        y: p.pos.y,
        x: p.pos.x,
        draw: () =>
          drawPlayer(ctx, {
            px,
            py,
            facing: p.facing,
            walk: p.move ? walkFrame(p.move.t) : 0,
            t,
            hurt: p.hurtFlash,
            invuln: p.invuln > 0,
            dashing: p.dashLeft > 0,
            dead,
            celebrate: rt.status === 'won',
          }),
      });
    }

    drawables.sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
    // 角色统一加一点描边阴影，从课桌阵里跳出来
    ctx.save();
    ctx.shadowColor = 'rgba(26, 17, 8, 0.55)';
    ctx.shadowBlur = 2.5;
    ctx.shadowOffsetY = 1;
    for (const d of drawables) d.draw();
    ctx.restore();

    drawParticles(ctx, rt.particles);
    if (rt.warmPulse > 0) {
      drawWarmPulse(ctx, { x: rt.player.pos.x, y: rt.player.pos.y }, rt.warmPulse);
    }

    if (rt.night) {
      const windows = windowCells(data);
      drawNight(
        ctx,
        W,
        H,
        { x: rt.player.pos.x * TILE + TILE / 2, y: rt.player.pos.y * TILE + TILE / 2 },
        windows,
        t,
      );
    }

    ctx.restore();

    drawHurtVignette(ctx, W, H, rt.hurtVignette);
    if (rt.player.hp === 1 && rt.status === 'playing') drawLowHpBorder(ctx, W, H, t);
    drawFlash(ctx, W, H, rt.flash);
  }

  /** 标题页背景：同一间教室，静止的群像 */
  drawShowcase(data: LevelData, t: number): void {
    this.ensureStatic(data);
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;
    ctx.clearRect(0, 0, W, H);
    if (this.staticCanvas) ctx.drawImage(this.staticCanvas, 0, 0);

    const spawn = data.meta.spawn;
    const chaser = data.meta.chaser;
    drawExitState(ctx, data.meta.exit.x * TILE, data.meta.exit.y * TILE, false, t);

    for (const pickup of data.meta.pickups) {
      drawPickup(ctx, pickup.x * TILE, pickup.y * TILE, 0, pickup.x, t);
    }

    drawMergeSort(ctx, t, data);
    drawParticles(ctx, []);

    // 只压一点点，让画面仍看得见（标题文字自己带阴影）
    ctx.save();
    const grad = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, W * 0.75);
    grad.addColorStop(0, 'rgba(0,0,0,0.08)');
    grad.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    void spawn;
    void chaser;
  }
}

function drawMergeSort(ctx: CanvasRenderingContext2D, t: number, data: LevelData): void {
  const player = data.meta.spawn;
  drawPlayer(ctx, {
    px: player.x * TILE,
    py: player.y * TILE - 1,
    facing: 'right',
    walk: 0,
    t,
    hurt: 0,
    invuln: false,
    dashing: false,
    dead: false,
    celebrate: false,
  });
  const chaser = data.meta.chaser;
  drawChaser(ctx, {
    px: chaser.x * TILE,
    py: chaser.y * TILE,
    facing: 'left',
    walk: 0,
    t,
    pose: 'walk',
    swing: 0,
    hop: 0,
    onDesk: false,
  });
  data.meta.seats.forEach((seat, index) => {
    drawMate(ctx, {
      px: seat.x * TILE,
      py: seat.y * TILE,
      facing: 'down',
      walk: 0,
      t,
      variant: index % PALETTE.mates.length,
      pose: 'seated',
      shiver: t,
    });
    void index;
  });
}

function nearPlayer(rt: Runtime, pos: Vec2): boolean {
  const dx = Math.abs(pos.x - rt.player.pos.x);
  const dy = Math.abs(pos.y - rt.player.pos.y);
  return Math.max(dx, dy) <= 1.6;
}

function chaserPose(state: string): ChaserPose {
  switch (state) {
    case 'alert':
      return 'alert';
    case 'windup':
      return 'windup';
    case 'strike':
      return 'strike';
    case 'recover':
      return 'recover';
    case 'stagger':
      return 'sit';
    case 'jump':
      return 'jump';
    default:
      return 'walk';
  }
}

function windowCells(data: LevelData): Vec2[] {
  const out: Vec2[] = [];
  for (let y = 0; y < data.grid.h; y++) {
    for (let x = 0; x < data.grid.w; x++) {
      if (data.grid.tileAt(x, y) === 'window') out.push({ x, y });
    }
  }
  return out;
}
