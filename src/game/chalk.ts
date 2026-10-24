import { DIR_VEC, Vec2, eq } from '../core/math';
import { BALANCE } from '../data/balance';
import { PALETTE } from '../data/palette';
import { burst, chalkTrail } from './fx';
import { occupiedCell } from './move';
import { say, sayLine, unlock } from './events';
import { cureMate } from './converted';
import { Runtime } from './types';

/**
 * 粉笔头：地图上的 `c` 格是弹药，按 Q 朝面向方向扔出去。
 * 成本是弹药本身，打空也照样消耗 —— 和「温暖了」形成"花钱 / 花子弹"的两种解法。
 */

export function pickupChalk(rt: Runtime, cell: Vec2): boolean {
  const drop = rt.chalkDrops.find((d) => !d.taken && eq(d.cell, cell));
  if (!drop) return false;
  drop.taken = true;
  const before = rt.player.chalk;
  rt.player.chalk = Math.min(BALANCE.chalk.max, rt.player.chalk + 1);
  rt.pendingSfx.push('pickup');
  if (rt.player.chalk > before) {
    sayLine(rt, 'chalk-picked', 1);
    unlock(rt, 'chalk-picked');
  } else {
    say(rt, '口袋里已经装不下粉笔头了。', 1);
  }
  burst(rt, cell, {
    count: 10,
    color: ['#f2f5ef', '#ffffff', PALETTE.effect.chalk],
    speed: 36,
    size: 1,
    life: 0.45,
    gravity: 20,
  });
  return true;
}

export function throwChalk(rt: Runtime): void {
  if (rt.status !== 'playing') return;
  const p = rt.player;

  if (p.chalk <= 0) {
    if (p.bumpCd <= 0) {
      p.bumpCd = 0.3;
      rt.pendingSfx.push('bump');
      say(rt, '手里没有粉笔头了。', 1);
    }
    return;
  }

  p.chalk -= 1;
  rt.chalkThrown += 1;
  p.throwFlash = 0.18;

  const from = occupiedCell(p.move, p.cell);
  const dir = DIR_VEC[p.facing];
  let last: Vec2 = from;

  for (let i = 1; i <= BALANCE.chalk.range; i++) {
    const cell = { x: from.x + dir.x * i, y: from.y + dir.y * i };
    if (!rt.grid.isWalkable(cell.x, cell.y)) break;
    last = cell;

    const mate = rt.mates.find((m) => m.state === 'converted' && eq(m.cell, cell));
    if (mate) {
      chalkTrail(rt, from, cell);
      burst(rt, cell, {
        count: 10,
        color: ['#f2f5ef', '#ffffff'],
        speed: 40,
        size: 1,
        life: 0.4,
        gravity: 40,
      });
      cureMate(rt, mate);
      return;
    }

    if (eq(occupiedCell(rt.chaser.move, rt.chaser.cell), cell)) {
      chalkTrail(rt, from, cell);
      interruptChaser(rt, cell);
      return;
    }
  }

  chalkTrail(rt, from, last);
  rt.pendingSfx.push('chalk');
}

/** 粉笔头打断：短硬直，不把他按回座位（那是「温暖了」的活） */
function interruptChaser(rt: Runtime, cell: Vec2): void {
  const c = rt.chaser;
  c.state = 'stagger';
  c.staggerLeft = BALANCE.chalk.staggerMs / 1000;
  c.move = null;
  c.hop = null;
  c.onDesk = false;
  c.chargesLeft = 1;
  c.timer = 0;
  c.pos = { x: c.cell.x, y: c.cell.y };
  rt.pendingSfx.push('chalk');
  burst(rt, cell, {
    count: 16,
    color: ['#f2f5ef', '#ffffff', PALETTE.effect.chalk],
    speed: 54,
    size: 1,
    life: 0.45,
    gravity: 60,
  });
  say(rt, '粉笔头正中！他被砸懵了一下。', 2);
}
