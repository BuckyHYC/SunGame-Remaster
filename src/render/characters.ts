import { TILE } from '../core/grid';
import { Dir } from '../core/math';
import { PALETTE } from '../data/palette';
import { fill, pixelLine, shadow } from './art';

function mirrorAt(ctx: CanvasRenderingContext2D, px: number, draw: () => void): void {
  ctx.save();
  ctx.translate(2 * px + TILE, 0);
  ctx.scale(-1, 1);
  draw();
  ctx.restore();
}

export interface HumanOptions {
  px: number;
  py: number;
  facing: Dir;
  walk: number;
  t: number;
}

const P = PALETTE.player;

export interface PlayerDrawOptions extends HumanOptions {
  hurt: number;
  invuln: boolean;
  dashing: boolean;
  dead: boolean;
  celebrate: boolean;
}

export function drawPlayer(ctx: CanvasRenderingContext2D, o: PlayerDrawOptions): void {
  const { px, py } = o;
  if (o.dead) {
    drawDeadPlayer(ctx, o);
    return;
  }
  const blink = o.invuln && Math.floor(o.t * 22) % 2 === 0;
  shadow(ctx, px + 12, py + 22, 8, 3, 0.26);
  if (blink) ctx.save();
  if (blink) ctx.globalAlpha = 0.45;

  if (o.dashing) {
    fill(ctx, P.trail, px + 2, py + 12, 6, 8);
    fill(ctx, P.trail, px + 1, py + 14, 4, 4);
  }

  const bob = o.walk === 1 || o.walk === 3 ? 1 : 0;
  const legL = o.walk === 1 ? 1 : 0;
  const legR = o.walk === 3 ? 1 : 0;

  const body = () => {
    if (o.facing === 'up') {
      drawPlayerBack(ctx, px, py, bob, legL, legR);
    } else if (o.facing === 'down') {
      drawPlayerFront(ctx, px, py, bob, legL, legR);
    } else {
      const left = o.facing === 'left';
      const render = () => drawPlayerSide(ctx, px, py, bob, legL, legR);
      if (left) mirrorAt(ctx, px, render);
      else render();
    }
  };
  body();

  if (o.hurt > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.75, o.hurt);
    fill(ctx, '#ffffff', px + 4, py + 1, 16, 22);
    ctx.restore();
  }
  if (blink) ctx.restore();

  if (o.celebrate) {
    const hop = Math.sin(o.t * 6) * 2;
    fill(ctx, PALETTE.effect.spark, px + 3, py + hop, 2, 2);
    fill(ctx, PALETTE.effect.spark, px + 19, py + 2 + hop, 2, 2);
  }
}

function drawPlayerFront(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  bob: number,
  legL: number,
  legR: number,
): void {
  const y = py - bob;
  // 腿与鞋
  fill(ctx, P.pants, px + 8, y + 18, 3, 4 - legL);
  fill(ctx, P.pants, px + 13, y + 18, 3, 4 - legR);
  fill(ctx, P.shoe, px + 7, y + 21 - legL, 4, 2);
  fill(ctx, P.shoe, px + 13, y + 21 - legR, 4, 2);
  // 身体
  fill(ctx, P.shirt, px + 7, y + 11, 10, 8);
  fill(ctx, P.shirtShade, px + 7, y + 17, 10, 2);
  fill(ctx, P.shirtShade, px + 7, y + 11, 1, 8);
  // 领口
  fill(ctx, P.collar, px + 9, y + 11, 6, 2);
  fill(ctx, P.collar, px + 11, y + 13, 2, 1);
  // 手臂
  fill(ctx, P.shirt, px + 5, y + 12, 2, 6);
  fill(ctx, P.shirt, px + 17, y + 12, 2, 6);
  fill(ctx, P.skin, px + 5, y + 17, 2, 2);
  fill(ctx, P.skin, px + 17, y + 17, 2, 2);
  // 头与头发
  fill(ctx, P.skin, px + 7, y + 3, 10, 9);
  fill(ctx, P.hair, px + 6, y + 1, 12, 4);
  fill(ctx, P.hair, px + 6, y + 4, 2, 5);
  fill(ctx, P.hair, px + 16, y + 4, 2, 5);
  fill(ctx, P.skinShade, px + 8, y + 10, 8, 1);
  // 眼镜（原版孙巨的标志）
  fill(ctx, P.glass, px + 8, y + 5, 3, 3);
  fill(ctx, P.glass, px + 13, y + 5, 3, 3);
  fill(ctx, P.glass, px + 11, y + 6, 2, 1);
  fill(ctx, '#4c5a7a', px + 8, y + 5, 1, 1);
  fill(ctx, '#4c5a7a', px + 13, y + 5, 1, 1);
  // 嘴
  fill(ctx, P.skinShade, px + 11, y + 9, 2, 1);
  // 抱着的书
  fill(ctx, P.book, px + 3, y + 14, 5, 5);
  fill(ctx, P.bookPage, px + 4, y + 15, 3, 3);
  fill(ctx, P.bookPage, px + 4, y + 16, 3, 1);
}

function drawPlayerBack(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  bob: number,
  legL: number,
  legR: number,
): void {
  const y = py - bob;
  fill(ctx, P.pants, px + 8, y + 18, 3, 4 - legL);
  fill(ctx, P.pants, px + 13, y + 18, 3, 4 - legR);
  fill(ctx, P.shoe, px + 7, y + 21 - legL, 4, 2);
  fill(ctx, P.shoe, px + 13, y + 21 - legR, 4, 2);
  fill(ctx, P.shirt, px + 7, y + 11, 10, 8);
  fill(ctx, P.shirtShade, px + 7, y + 17, 10, 2);
  fill(ctx, P.shirt, px + 5, y + 12, 2, 6);
  fill(ctx, P.shirt, px + 17, y + 12, 2, 6);
  fill(ctx, P.skin, px + 5, y + 17, 2, 2);
  fill(ctx, P.skin, px + 17, y + 17, 2, 2);
  // 后脑勺：整块头发
  fill(ctx, P.skin, px + 7, y + 3, 10, 9);
  fill(ctx, P.hair, px + 6, y + 1, 12, 11);
  fill(ctx, P.hair, px + 9, y + 4, 6, 1);
  fill(ctx, '#2f2c33', px + 9, y + 8, 6, 1);
  // 书包带
  fill(ctx, '#6b4a2a', px + 8, y + 12, 2, 7);
  fill(ctx, '#6b4a2a', px + 14, y + 12, 2, 7);
}

function drawPlayerSide(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  bob: number,
  legL: number,
  legR: number,
): void {
  const y = py - bob;
  fill(ctx, P.pants, px + 9, y + 18, 3, 4 - legL);
  fill(ctx, P.pants, px + 13, y + 19, 3, 3 - legR);
  fill(ctx, P.shoe, px + 8, y + 21 - legL, 4, 2);
  fill(ctx, P.shoe, px + 13, y + 22 - legR, 4, 2);
  // 身体（侧面较窄）
  fill(ctx, P.shirt, px + 8, y + 11, 8, 8);
  fill(ctx, P.shirtShade, px + 8, y + 17, 8, 2);
  fill(ctx, P.collar, px + 8, y + 11, 3, 2);
  // 手臂前后摆
  fill(ctx, P.shirt, px + 15, y + 12, 2, 6);
  fill(ctx, P.skin, px + 15, y + 17, 2, 2);
  // 头
  fill(ctx, P.skin, px + 8, y + 3, 10, 9);
  fill(ctx, P.hair, px + 8, y + 1, 11, 4);
  fill(ctx, P.hair, px + 8, y + 4, 3, 6);
  fill(ctx, P.hair, px + 16, y + 4, 3, 3);
  fill(ctx, P.skinShade, px + 16, y + 10, 2, 1);
  // 单边眼镜 + 侧脸嘴
  fill(ctx, P.glass, px + 13, y + 5, 3, 3);
  fill(ctx, '#4c5a7a', px + 13, y + 5, 1, 1);
  fill(ctx, P.skinShade, px + 16, y + 8, 1, 1);
  // 抱着的书在身前
  fill(ctx, P.book, px + 4, y + 13, 5, 6);
  fill(ctx, P.bookPage, px + 5, y + 14, 3, 4);
}

function drawDeadPlayer(ctx: CanvasRenderingContext2D, o: PlayerDrawOptions): void {
  const { px, py } = o;
  const spin = Math.sin(o.t * 2) * 0.1;
  ctx.save();
  ctx.translate(px + 12, py + 12);
  ctx.rotate(spin);
  ctx.translate(-px - 12, -py - 12);
  fill(ctx, P.shirt, px + 5, py + 12, 14, 7);
  fill(ctx, P.skin, px + 3, py + 9, 8, 8);
  fill(ctx, P.hair, px + 2, py + 8, 9, 3);
  fill(ctx, P.glass, px + 4, py + 11, 3, 2);
  fill(ctx, P.pants, px + 16, py + 13, 6, 3);
  fill(ctx, P.shoe, px + 20, py + 12, 3, 2);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* 舞剑同学                                                            */
/* ------------------------------------------------------------------ */

export type ChaserPose =
  | 'walk'
  | 'alert'
  | 'windup'
  | 'strike'
  | 'recover'
  | 'stagger'
  | 'jump'
  | 'sit';

export interface ChaserDrawOptions extends HumanOptions {
  pose: ChaserPose;
  /** 0..1：挥剑动作进度 */
  swing: number;
  hop: number;
  onDesk: boolean;
}

const C = PALETTE.chaser;

export function drawChaser(ctx: CanvasRenderingContext2D, o: ChaserDrawOptions): void {
  const { px, py } = o;
  const air = o.hop > 0 ? Math.sin(o.hop * Math.PI) * 10 : 0;
  const y = py - air;
  shadow(ctx, px + 12, py + 22, 7 + (o.hop > 0 ? 2 : 0), 2.5, 0.3);

  if (o.pose === 'sit') {
    drawChaserSitting(ctx, px, py, o.t);
    return;
  }

  const facingLeft = o.facing === 'left';
  const render = (): void => drawChaserBody(ctx, px, y, o);
  if (facingLeft) mirrorAt(ctx, px, render);
  else render();
}

function drawChaserBody(ctx: CanvasRenderingContext2D, px: number, py: number, o: ChaserDrawOptions): void {
  const tuck = o.pose === 'jump' ? 2 : 0;
  // 腿
  fill(ctx, C.pants, px + 8, py + 18 - tuck, 3, 4 + tuck);
  fill(ctx, C.pants, px + 13, py + 18 - tuck, 3, 4 + tuck);
  fill(ctx, '#0d0d10', px + 7, py + 21, 4, 2);
  fill(ctx, '#0d0d10', px + 13, py + 21, 4, 2);
  // 身体
  const bodyColor = o.pose === 'windup' || o.pose === 'strike' ? C.rage : C.shirt;
  fill(ctx, bodyColor, px + 6, py + 11, 12, 8);
  fill(ctx, C.shirtShade, px + 6, py + 17, 12, 2);
  fill(ctx, '#151a26', px + 6, py + 16, 12, 1);
  // 手臂
  fill(ctx, bodyColor, px + 4, py + 12, 2, 6);
  fill(ctx, bodyColor, px + 18, py + 11, 2, 7);
  fill(ctx, C.skin, px + 4, py + 17, 2, 2);
  fill(ctx, C.skin, px + 18, py + 17, 2, 2);
  // 兜帽 + 脸
  fill(ctx, C.hood, px + 6, py + 1, 12, 9);
  fill(ctx, C.hood, px + 7, py + 9, 10, 3);
  fill(ctx, C.hood, px + 5, py + 2, 1, 6);
  fill(ctx, C.hood, px + 18, py + 2, 1, 6);
  fill(ctx, C.skinShade, px + 9, py + 5, 6, 4);
  // 红眼（愤怒时更亮）
  const eyeColor = o.pose === 'windup' || o.pose === 'strike' ? '#ff3b3b' : '#c9463f';
  fill(ctx, eyeColor, px + 10, py + 6, 1, 2);
  fill(ctx, eyeColor, px + 14, py + 6, 1, 2);
  // 剑
  drawSword(ctx, px, py, o);
  // 跳跃时的尘土
  if (o.pose === 'jump') {
    fill(ctx, '#e8dcc2', px + 5, py + 19, 2, 1);
    fill(ctx, '#e8dcc2', px + 18, py + 19, 2, 1);
  }
  // 落桌标记
  if (o.onDesk) {
    fill(ctx, 'rgba(0,0,0,0.22)', px + 6, py + 22, 12, 2);
  }
}

function drawSword(ctx: CanvasRenderingContext2D, px: number, py: number, o: ChaserDrawOptions): void {
  const hand = { x: px + 19, y: py + 14 };
  const pose = o.pose;
  // 剑柄
  fill(ctx, C.hilt, hand.x - 1, hand.y, 3, 3);
  fill(ctx, '#e0c088', hand.x - 1, hand.y + 2, 3, 1);

  if (pose === 'windup' || pose === 'recover') {
    // 举过头顶
    pixelLine(ctx, C.sword, hand.x + 1, hand.y - 3, 1, -2, 7, 2);
    pixelLine(ctx, C.swordDark, hand.x + 1, hand.y - 3, 1, -2, 3, 2);
  } else if (pose === 'strike') {
    // 横扫
    pixelLine(ctx, C.sword, hand.x + 1, hand.y - 1, 2, 1, 9, 2);
    pixelLine(ctx, '#ffffff', hand.x + 2, hand.y - 1, 2, 1, 4, 1);
  } else if (pose === 'alert') {
    pixelLine(ctx, C.sword, hand.x, hand.y - 2, 0, -2, 6, 2);
  } else {
    // 垂剑
    pixelLine(ctx, C.sword, hand.x, hand.y + 2, 0, 2, 5, 2);
    pixelLine(ctx, C.swordDark, hand.x, hand.y + 4, 0, 2, 2, 1);
  }
  if (pose === 'windup') {
    // 剑身泛红
    fill(ctx, '#ff6b6b', hand.x + 2, hand.y - 9, 2, 2);
    fill(ctx, '#ffb3b3', hand.x + 2, hand.y - 7, 1, 1);
  }
}

function drawChaserSitting(ctx: CanvasRenderingContext2D, px: number, py: number, t: number): void {
  fill(ctx, C.shirt, px + 6, py + 12, 12, 6);
  fill(ctx, C.hood, px + 6, py + 4, 12, 8);
  fill(ctx, C.skinShade, px + 9, py + 8, 6, 3);
  fill(ctx, '#c9463f', px + 10, py + 9, 1, 1);
  fill(ctx, '#c9463f', px + 14, py + 9, 1, 1);
  // 眩晕星星
  for (let i = 0; i < 3; i++) {
    const a = t * 3 + (i * Math.PI * 2) / 3;
    const sx = px + 12 + Math.cos(a) * 7;
    const sy = py + 1 + Math.sin(a) * 2;
    fill(ctx, C.dizzy, sx, sy, 2, 2);
  }
}

/* ------------------------------------------------------------------ */
/* 同学                                                                */
/* ------------------------------------------------------------------ */

export type MatePose = 'seated' | 'scared' | 'walking';

export interface MateDrawOptions extends HumanOptions {
  variant: number;
  pose: MatePose;
  /** 被吓得发抖的相位 */
  shiver: number;
}

export function drawMate(ctx: CanvasRenderingContext2D, o: MateDrawOptions): void {
  const { px, py } = o;
  const variant = PALETTE.mates[o.variant % PALETTE.mates.length];
  shadow(ctx, px + 12, py + 22, 7, 2.5, 0.22);

  if (o.pose === 'seated') {
    drawMateSitting(ctx, px, py, variant);
    return;
  }

  const tremble = o.pose === 'scared' ? Math.round(Math.sin(o.shiver * 18) * 0.8) : 0;
  const bob = o.pose === 'walking' && (o.walk === 1 || o.walk === 3) ? 1 : 0;
  const y = py - bob;
  const x = px + tremble;

  const render = (): void => {
    // 腿
    fill(ctx, '#2b3243', x + 8, y + 18, 3, 4);
    fill(ctx, '#2b3243', x + 13, y + 18, 3, 4);
    fill(ctx, '#1a1d26', x + 7, y + 21, 4, 2);
    fill(ctx, '#1a1d26', x + 13, y + 21, 4, 2);
    // 身体
    fill(ctx, variant.shirt, x + 7, y + 11, 10, 8);
    fill(ctx, 'rgba(0,0,0,0.14)', x + 7, y + 17, 10, 2);
    // 手臂（害怕时举起）
    if (o.pose === 'scared') {
      fill(ctx, variant.shirt, x + 4, y + 8, 2, 6);
      fill(ctx, variant.shirt, x + 18, y + 8, 2, 6);
      fill(ctx, variant.skin, x + 4, y + 6, 2, 2);
      fill(ctx, variant.skin, x + 18, y + 6, 2, 2);
    } else {
      fill(ctx, variant.shirt, x + 5, y + 12, 2, 6);
      fill(ctx, variant.shirt, x + 17, y + 12, 2, 6);
      fill(ctx, variant.skin, x + 5, y + 17, 2, 2);
      fill(ctx, variant.skin, x + 17, y + 17, 2, 2);
    }
    // 头
    fill(ctx, variant.skin, x + 7, y + 3, 10, 9);
    drawMateHair(ctx, x, y, variant);
    // 表情
    if (o.pose === 'scared') {
      fill(ctx, '#1b1b1b', x + 9, y + 6, 2, 3);
      fill(ctx, '#1b1b1b', x + 14, y + 6, 2, 3);
      fill(ctx, '#7a4a4a', x + 11, y + 10, 2, 1);
      // 汗滴
      fill(ctx, '#9fd8ff', x + 18, y + 4, 1, 2);
    } else {
      fill(ctx, '#1b1b1b', x + 9, y + 6, 2, 2);
      fill(ctx, '#1b1b1b', x + 14, y + 6, 2, 2);
      fill(ctx, '#8a5b4a', x + 11, y + 9, 2, 1);
    }
  };
  if (o.facing === 'left') mirrorAt(ctx, px, render);
  else render();
}

function drawMateHair(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  variant: { hair: string; style: string },
): void {
  const hair = variant.hair;
  switch (variant.style) {
    case 'twin':
      fill(ctx, hair, x + 6, y + 1, 12, 4);
      fill(ctx, hair, x + 4, y + 3, 3, 7);
      fill(ctx, hair, x + 17, y + 3, 3, 7);
      fill(ctx, hair, x + 6, y + 4, 2, 3);
      fill(ctx, hair, x + 16, y + 4, 2, 3);
      break;
    case 'glasses':
      fill(ctx, hair, x + 6, y + 1, 12, 3);
      fill(ctx, hair, x + 6, y + 3, 2, 4);
      fill(ctx, hair, x + 16, y + 3, 2, 4);
      fill(ctx, PALETTE.player.glass, x + 8, y + 5, 3, 3);
      fill(ctx, PALETTE.player.glass, x + 13, y + 5, 3, 3);
      fill(ctx, PALETTE.player.glass, x + 11, y + 6, 2, 1);
      break;
    case 'bob':
      fill(ctx, hair, x + 5, y + 1, 14, 5);
      fill(ctx, hair, x + 5, y + 4, 2, 6);
      fill(ctx, hair, x + 17, y + 4, 2, 6);
      break;
    case 'short':
      fill(ctx, hair, x + 6, y + 1, 12, 3);
      fill(ctx, hair, x + 7, y + 3, 2, 2);
      fill(ctx, hair, x + 15, y + 3, 2, 2);
      break;
    case 'cap':
    default:
      fill(ctx, '#3f6f8f', x + 5, y + 1, 14, 3);
      fill(ctx, '#35607c', x + 4, y + 3, 12, 2);
      fill(ctx, hair, x + 7, y + 4, 2, 2);
      fill(ctx, hair, x + 15, y + 4, 2, 2);
      break;
  }
}

function drawMateSitting(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  variant: { skin: string; hair: string; shirt: string; style: string },
): void {
  // 坐上椅面：身体下移，腿收到前面
  fill(ctx, '#2b3243', px + 7, py + 17, 4, 3);
  fill(ctx, '#2b3243', px + 13, py + 17, 4, 3);
  fill(ctx, variant.shirt, px + 7, py + 10, 10, 8);
  fill(ctx, 'rgba(0,0,0,0.12)', px + 7, py + 16, 10, 2);
  fill(ctx, variant.shirt, px + 5, py + 11, 2, 5);
  fill(ctx, variant.shirt, px + 17, py + 11, 2, 5);
  fill(ctx, variant.skin, px + 7, py + 2, 10, 9);
  drawMateHair(ctx, px, py, variant);
  fill(ctx, '#1b1b1b', px + 9, py + 6, 2, 2);
  fill(ctx, '#1b1b1b', px + 14, py + 6, 2, 2);
  fill(ctx, '#8a5b4a', px + 11, py + 9, 2, 1);
}
