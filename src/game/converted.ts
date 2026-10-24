import { DIRS, DIR_VEC, Vec2, chebyshev, eq, facingFromDelta } from '../core/math';
import { BALANCE } from '../data/balance';
import { PALETTE } from '../data/palette';
import { addShake, burst, stepDust } from './fx';
import { advanceMove, movePosition, occupiedCell, startMove } from './move';
import { say, sayLine, unlock } from './events';
import { MateState, Runtime } from './types';

/**
 * 入伙：同学被舞剑同学吓到第 N 次后「学会舞剑」，反过来追玩家。
 * 设计律：可读（举剑前有红色预告）、可反制（只有「温暖了」能救回来）、
 * 不叠加伤害（只把你推开，暖意仍然只由舞剑同学消耗）。
 */

export function countConverted(rt: Runtime): number {
  return rt.mates.filter((m) => m.state === 'converted').length;
}

export function convertMate(rt: Runtime, mate: MateState): void {
  mate.state = 'converted';
  mate.move = null;
  mate.attack = null;
  mate.wanderTimer = 0.35;
  mate.scareCooldown = 1.2;
  mate.convertImmuneUntil = 0;
  mate.facing = 'down';
  mate.pos = { x: mate.cell.x, y: mate.cell.y };
  rt.convertedTotal += 1;
  rt.pendingSfx.push('windup');
  sayLine(rt, 'mate-converted', 2);
  unlock(rt, 'mate-converted');
  burst(rt, mate.cell, {
    count: 12,
    color: [PALETTE.chaser.sword, '#ffffff'],
    speed: 34,
    size: 1,
    life: 0.5,
    gravity: 20,
  });
}

export function cureMate(rt: Runtime, mate: MateState): void {
  if (mate.state !== 'converted') return;
  mate.state = 'returning';
  mate.attack = null;
  mate.move = null;
  mate.scareCount = 0;
  mate.convertImmuneUntil = rt.time + BALANCE.converted.cureImmuneMs / 1000;
  mate.wanderTimer = 0;
  rt.cured += 1;
  rt.pendingSfx.push('seated');
  sayLine(rt, 'warm-cure', 2);
  unlock(rt, 'warm-cure');
  burst(rt, mate.cell, {
    count: 10,
    color: [PALETTE.hud.warmth, '#fff3d6'],
    speed: 30,
    size: 1,
    life: 0.5,
    gravity: -12,
  });
}

export function updateConverted(rt: Runtime, dt: number): void {
  const target = occupiedCell(rt.player.move, rt.player.cell);

  for (const mate of rt.mates) {
    if (mate.state !== 'converted') continue;

    if (mate.move) {
      const done = advanceMove(mate.move, dt);
      mate.pos = movePosition(mate.move, mate.cell);
      if (done) {
        mate.cell = { x: mate.move.to.x, y: mate.move.to.y };
        mate.move = null;
        mate.pos = { x: mate.cell.x, y: mate.cell.y };
      }
      continue;
    }

    if (mate.attack) {
      advanceAttack(rt, mate, dt, target);
      continue;
    }

    const dist = chebyshev(mate.cell, target);
    if (dist <= 1) {
      startWindup(rt, mate, target);
      continue;
    }
    // 离得太远就站在原地看着你练剑，不无限追
    if (dist > BALANCE.converted.leash) continue;

    mate.wanderTimer -= dt;
    if (mate.wanderTimer > 0) continue;
    mate.wanderTimer = BALANCE.converted.stepMs / 1000;
    const next = bestStep(rt, mate.cell, target);
    if (!next) continue;
    mate.facing = facingFromDelta(next.x - mate.cell.x, next.y - mate.cell.y, mate.facing);
    mate.move = startMove(mate.cell, next, BALANCE.converted.stepMs);
    stepDust(rt, mate.cell);
  }
}

function startWindup(rt: Runtime, mate: MateState, target: Vec2): void {
  mate.facing = facingFromDelta(target.x - mate.cell.x, target.y - mate.cell.y, mate.facing);
  mate.attack = { state: 'windup', timer: BALANCE.converted.windupMs / 1000 };
  rt.pendingSfx.push('windup');
}

function advanceAttack(rt: Runtime, mate: MateState, dt: number, target: Vec2): void {
  const atk = mate.attack;
  if (!atk) return;
  atk.timer -= dt;

  if (atk.state === 'windup') {
    if (atk.timer > 0) return;
    atk.state = 'strike';
    atk.timer = BALANCE.converted.strikeMs / 1000;
    const strikeCell = {
      x: mate.cell.x + DIR_VEC[mate.facing].x,
      y: mate.cell.y + DIR_VEC[mate.facing].y,
    };
    rt.pendingSfx.push('swing');
    if (eq(strikeCell, target)) {
      shovePlayer(rt, mate.cell);
    } else {
      burst(rt, strikeCell, {
        count: 6,
        color: [PALETTE.chaser.sword, '#ffffff'],
        speed: 34,
        size: 1,
        life: 0.26,
        gravity: 24,
      });
    }
    return;
  }

  if (atk.state === 'strike') {
    if (atk.timer > 0) return;
    atk.state = 'recover';
    atk.timer = BALANCE.converted.recoverMs / 1000;
    return;
  }

  if (atk.timer <= 0) mate.attack = null;
}

/** 被入伙同学推到旁边一格：不掉暖意、不给无敌帧，只短暂站不稳 */
export function shovePlayer(rt: Runtime, from: Vec2): void {
  if (rt.status !== 'playing') return;
  const p = rt.player;
  const dx = Math.sign(p.cell.x - from.x);
  const dy = Math.sign(p.cell.y - from.y);
  const candidates: Vec2[] =
    dx === 0 && dy === 0
      ? []
      : [
          { x: p.cell.x + dx, y: p.cell.y + dy },
          { x: p.cell.x + dx, y: p.cell.y },
          { x: p.cell.x, y: p.cell.y + dy },
        ];
  for (const cell of candidates) {
    if (!rt.grid.isWalkable(cell.x, cell.y)) continue;
    if (cell.x === from.x && cell.y === from.y) continue;
    p.cell = cell;
    p.pos = { x: cell.x, y: cell.y };
    p.move = null;
    stepDust(rt, cell);
    break;
  }
  p.stun = Math.max(p.stun, BALANCE.converted.shoveStunMs / 1000);
  p.hurtFlash = Math.max(p.hurtFlash, 0.6);
  rt.pendingSfx.push('shove');
  addShake(rt, 1.8);
  burst(rt, p.cell, {
    count: 8,
    color: [PALETTE.effect.dust, '#ffffff'],
    speed: 30,
    size: 1,
    life: 0.4,
    gravity: 30,
  });
  say(rt, '被学舞剑的同学推了一把！', 1);
}

function bestStep(rt: Runtime, from: Vec2, target: Vec2): Vec2 | null {
  if (eq(from, target)) return null;
  const field = rt.grid.distanceField(target);
  let best: Vec2 | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const dir of DIRS) {
    const d = DIR_VEC[dir];
    const nx = from.x + d.x;
    const ny = from.y + d.y;
    if (!rt.grid.isWalkable(nx, ny)) continue;
    const value = field[ny * rt.grid.w + nx];
    if (value < 0) continue;
    if (value < bestDist) {
      bestDist = value;
      best = { x: nx, y: ny };
    }
  }
  return best;
}
