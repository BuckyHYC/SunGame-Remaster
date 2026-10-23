import { BALANCE } from '../data/balance';
import { chebyshev } from '../core/math';
import { PALETTE } from '../data/palette';
import { burst, warmRing, addFlash, addShake } from './fx';
import { occupiedCell } from './move';
import { say, sayLine, unlock } from './events';
import { sendMatesHome } from './mates';
import { Runtime } from './types';

/**
 * 核心技能「温暖了！请同学们回到座位上。」
 * 成本是温暖值（35/100），空了也照样扣 —— 按空就是真浪费。
 */
export function useSkill(rt: Runtime): void {
  if (rt.status !== 'playing') return;

  if (rt.mode === 'duel' && rt.skillUses >= BALANCE.duel.skillUses) {
    say(rt, '温暖了……但今天已经喊不动了。', 2);
    rt.pendingSfx.push('bump');
    return;
  }

  if (rt.warmth < BALANCE.skill.cost) {
    say(rt, `温暖值不够（${Math.floor(rt.warmth)}/${BALANCE.skill.cost}）`, 2);
    rt.pendingSfx.push('bump');
    return;
  }

  rt.warmth -= BALANCE.skill.cost;
  rt.skillUses += 1;
  rt.warmPulse = 1;
  addFlash(rt, 0.62);
  addShake(rt, 2.4);

  const origin = occupiedCell(rt.player.move, rt.player.cell);
  warmRing(rt, origin);
  rt.pendingSfx.push('warm');
  sayLine(rt, 'warm-skill', 2);
  unlock(rt, 'skill-used');

  const sentHome = sendMatesHome(rt, BALANCE.skill.radius);
  const chaserCell = occupiedCell(rt.chaser.move, rt.chaser.cell);
  const caughtChaser = chebyshev(chaserCell, origin) <= BALANCE.skill.radius;

  if (caughtChaser) {
    staggerChaser(rt);
    burst(rt, rt.chaser.cell, {
      count: 16,
      color: [PALETTE.effect.warm, '#fff6e0', PALETTE.hud.warmth],
      speed: 44,
      size: 2,
      life: 0.55,
      gravity: -8,
    });
  }

  if (!caughtChaser && sentHome === 0) {
    rt.missedSkills += 1;
    sayLine(rt, 'skill-miss', 2);
    unlock(rt, 'skill-miss');
  }
}

/** 被温暖到：按回座位，硬直 2.5 秒 */
function staggerChaser(rt: Runtime): void {
  const c = rt.chaser;
  c.state = 'stagger';
  c.staggerLeft = BALANCE.chaser.staggerMs / 1000;
  c.move = null;
  c.hop = null;
  c.onDesk = false;
  c.chargesLeft = 1;
  c.timer = 0;
  c.cell = { x: rt.chaserHome.x, y: rt.chaserHome.y };
  c.pos = { x: c.cell.x, y: c.cell.y };
  c.facing = 'down';
}
