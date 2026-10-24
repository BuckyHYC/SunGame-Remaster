import { DIR_VEC, Dir, eq } from '../core/math';
import { BALANCE } from '../data/balance';
import { PALETTE } from '../data/palette';
import { pickupSparkle, stepDust, burst } from './fx';
import { advanceMove, movePosition, startMove } from './move';
import { say, sayLine, unlock } from './events';
import { Runtime } from './types';
import { LINE_BY_ID } from '../data/lines';
import { pickupChalk } from './chalk';
import { tryOpenExit } from './exit';

export interface PlayerCommand {
  dir: Dir | null;
  dash: boolean;
}

export function updatePlayer(rt: Runtime, dt: number, cmd: PlayerCommand): void {
  const p = rt.player;
  p.invuln = Math.max(0, p.invuln - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt);
  p.dashCooldown = Math.max(0, p.dashCooldown - dt);
  p.noise = Math.max(0, p.noise - dt);
  p.bumpCd = Math.max(0, p.bumpCd - dt);
  p.stun = Math.max(0, p.stun - dt);
  p.throwFlash = Math.max(0, p.throwFlash - dt);

  // 冲刺：短促 3 格，带冷却，会把位置暴露给舞剑同学
  if (cmd.dash && p.dashCooldown <= 0 && !p.move && p.stun <= 0) {
    p.dashLeft = BALANCE.player.dashCells;
    p.dashCooldown = BALANCE.player.dashCooldownMs / 1000;
    p.noise = Math.max(p.noise, 0.6);
    rt.pendingSfx.push('dash');
    burst(rt, p.cell, {
      count: 8,
      color: [PALETTE.effect.dust, '#ffffff'],
      speed: 40,
      size: 1,
      life: 0.36,
      gravity: 20,
    });
  }

  if (p.move) {
    const done = advanceMove(p.move, dt);
    p.pos = movePosition(p.move, p.cell);
    if (done) {
      p.cell = p.move.to;
      p.move = null;
      onArrive(rt);
    }
    return;
  }

  if (p.dashLeft > 0) {
    p.idleTime += dt;
    if (p.idleTime > 0.22) {
      p.dashLeft = 0;
      p.idleTime = 0;
    }
  } else {
    p.idleTime = 0;
  }

  // 被入伙同学推开后短暂站不稳，不能起步
  if (p.stun > 0) return;

  if (!cmd.dir) return;

  p.facing = cmd.dir;
  const target = { x: p.cell.x + DIR_VEC[cmd.dir].x, y: p.cell.y + DIR_VEC[cmd.dir].y };
  if (!rt.grid.isWalkable(target.x, target.y)) {
    if (p.bumpCd <= 0) {
      p.bumpCd = 0.3;
      rt.pendingSfx.push('bump');
    }
    return;
  }

  const dashing = p.dashLeft > 0;
  const dur = dashing ? BALANCE.player.dashStepMs : BALANCE.player.stepMs;
  p.move = startMove(p.cell, target, dur);
  p.steps += 1;
  p.pos = { x: p.cell.x, y: p.cell.y };
  if (dashing) {
    p.dashLeft -= 1;
    p.noise = Math.max(p.noise, 0.45);
  } else {
    p.dashLeft = 0;
  }
  p.stepPhase = (p.stepPhase + 1) % 4;
  rt.pendingSfx.push('step');
  stepDust(rt, p.cell);
}

function onArrive(rt: Runtime): void {
  const p = rt.player;
  for (const pickup of rt.pickups) {
    if (pickup.taken) continue;
    if (pickup.cell.x === p.cell.x && pickup.cell.y === p.cell.y) {
      pickup.taken = true;
      rt.collected += 1;
      rt.pendingSfx.push('pickup');
      rt.pendingUnlocks.push(pickup.lineId);
      pickupSparkle(rt, pickup.cell);
      const line = LINE_BY_ID.get(pickup.lineId);
      if (line) say(rt, line.text, 1, line.id);
      break;
    }
  }

  // 粉笔头：变成投掷弹药
  pickupChalk(rt, p.cell);

  // 后门钥匙
  if (!rt.hasKey && rt.keyCell && eq(p.cell, rt.keyCell)) {
    rt.hasKey = true;
    rt.pendingSfx.push('door');
    sayLine(rt, 'key-taken', 2);
    unlock(rt, 'key-taken');
    burst(rt, p.cell, {
      count: 14,
      color: ['#ffd166', '#fff3d6', PALETTE.effect.spark],
      speed: 46,
      size: 2,
      life: 0.55,
      gravity: 10,
    });
    tryOpenExit(rt);
  }
}
