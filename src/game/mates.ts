import { DIRS, DIR_VEC, Vec2, chebyshev } from '../core/math';
import { BALANCE } from '../data/balance';
import { PALETTE } from '../data/palette';
import { burst } from './fx';
import { advanceMove, movePosition, occupiedCell, startMove } from './move';
import { say, sayLine, unlock } from './events';
import { MateState, Runtime } from './types';

function chaserCell(rt: Runtime): Vec2 {
  const c = rt.chaser;
  return occupiedCell(c.move, c.cell);
}

export function updateMates(rt: Runtime, dt: number): void {
  let removed = false;

  for (const mate of rt.mates) {
    mate.scareCooldown = Math.max(0, mate.scareCooldown - dt);

    // 离场：起身走向后门，到门口渐渐淡出
    if (mate.state === 'leaving') {
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
      if (mate.cell.x === rt.exit.x && mate.cell.y === rt.exit.y) {
        mate.fade = Math.max(0, mate.fade - dt / 0.7);
        if (mate.fade <= 0) removed = true;
        continue;
      }
      const path = rt.grid.path(mate.cell, rt.exit);
      const next = path && path.length > 0 ? path[0] : null;
      if (!next) {
        mate.fade = Math.max(0, mate.fade - dt / 0.7);
        if (mate.fade <= 0) removed = true;
        continue;
      }
      const dir = dirOf(mate.cell, next);
      if (dir) mate.facing = dir;
      mate.move = startMove(mate.cell, next, BALANCE.mate.stepMs);
      continue;
    }

    if (mate.move) {
      const done = advanceMove(mate.move, dt);
      mate.pos = movePosition(mate.move, mate.cell);
      if (done) {
        mate.cell = { x: mate.move.to.x, y: mate.move.to.y };
        mate.move = null;
        mate.pos = { x: mate.cell.x, y: mate.cell.y };
        if (mate.state === 'returning' && mate.cell.x === mate.seat.x && mate.cell.y === mate.seat.y) {
          seatMate(rt, mate);
        }
      }
      continue;
    }

    if (mate.state === 'seated') continue;

    const distToChaser = chebyshev(mate.cell, chaserCell(rt));
    if (mate.scareCooldown <= 0 && distToChaser <= BALANCE.mate.scareDistance) {
      scareAway(rt, mate.id);
      continue;
    }

    if (mate.state === 'returning') {
      const path = rt.grid.path(mate.cell, mate.seat);
      const next = path && path.length > 0 ? path[0] : null;
      if (next) {
        const dir = dirOf(mate.cell, next);
        if (dir) mate.facing = dir;
        mate.move = startMove(mate.cell, next, BALANCE.mate.stepMs);
      } else if (mate.cell.x === mate.seat.x && mate.cell.y === mate.seat.y) {
        seatMate(rt, mate);
      }
      continue;
    }

    // scared：乱走（课间/晚自习）
    if (rt.def.wander) {
      mate.wanderTimer -= dt;
      if (mate.wanderTimer <= 0) {
        mate.wanderTimer = rt.rng.range(0.9, 1.8);
        const options = rt.grid.neighbors(mate.cell);
        if (options.length > 0) {
          const next = rt.rng.pick(options);
          const dir = dirOf(mate.cell, next);
          if (dir) mate.facing = dir;
          mate.move = startMove(mate.cell, next, BALANCE.mate.stepMs * 1.6);
        }
      }
    }
  }

  if (removed) rt.mates = rt.mates.filter((m) => !(m.state === 'leaving' && m.fade <= 0));
}

/** 坐下：同一把椅子上如果已经有人，坐得最久的那位会起身让座 */
function seatMate(rt: Runtime, mate: MateState): void {
  const occupant = rt.mates.find(
    (m) => m !== mate && m.state === 'seated' && m.seat.x === mate.seat.x && m.seat.y === mate.seat.y,
  );
  if (occupant) startLeaving(rt, occupant);

  mate.state = 'seated';
  mate.seatedAt = rt.time;
  mate.fade = 1;
  mate.pos = { x: mate.cell.x, y: mate.cell.y };
  rt.seatedTotal += 1;
  rt.pendingSfx.push('seated');
  sayLine(rt, 'mate-seated', 1);
  unlock(rt, 'mate-seated');
  burst(rt, mate.cell, {
    count: 10,
    color: [PALETTE.hud.good, PALETTE.effect.spark],
    speed: 34,
    size: 1,
    life: 0.5,
    gravity: -12,
  });
}

/** 起身离场：教室坐满后有人要让出椅子，会走到后门口再消失 */
export function startLeaving(rt: Runtime, mate: MateState): void {
  mate.state = 'leaving';
  mate.move = null;
  mate.seatedAt = 0;
  mate.fade = 1;
  rt.pendingSfx.push('step');
  burst(rt, mate.cell, {
    count: 6,
    color: ['#fff3d6', PALETTE.effect.spark],
    speed: 20,
    size: 1,
    life: 0.5,
    gravity: -16,
  });
}

function dirOf(from: Vec2, to: Vec2): 'up' | 'down' | 'left' | 'right' | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

/** 被舞剑同学吓跑：瞬移到远处，并留下那条原版提示语 */
export function scareAway(rt: Runtime, mateId: number): void {
  const mate = rt.mates.find((m) => m.id === mateId);
  if (!mate) return;
  const chaser = chaserCell(rt);
  const cell = rt.grid.randomWalkable(
    rt.rng,
    (c) => !(c.x === mate.seat.x && c.y === mate.seat.y),
    { cell: chaser, minDistance: BALANCE.mate.respawnMinDistance },
  );
  mate.cell = { x: cell.x, y: cell.y };
  mate.pos = { x: cell.x, y: cell.y };
  mate.move = null;
  mate.state = 'scared';
  mate.scareCooldown = 1.6;
  mate.wanderTimer = rt.rng.range(0.6, 1.2);
  mate.facing = dirOf(cell, chaser) ?? mate.facing;
  rt.pendingSfx.push('bump');
  burst(rt, cell, {
    count: 8,
    color: [PALETTE.effect.dust, '#ffffff'],
    speed: 30,
    size: 1,
    life: 0.4,
    gravity: 30,
  });
  sayLine(rt, 'chaser-scare', 2);
  unlock(rt, 'mate-scared');
}

/** 玩家按 E：把相邻的同学喊回座位 */
export function interactMate(rt: Runtime): boolean {
  const p = occupiedCell(rt.player.move, rt.player.cell);
  let best: { id: number; dist: number } | null = null;
  for (const mate of rt.mates) {
    if (mate.state !== 'scared') continue;
    const dist = chebyshev(mate.cell, p);
    if (dist <= 1 && (!best || dist < best.dist)) best = { id: mate.id, dist };
  }
  if (!best) return false;
  const mate = rt.mates.find((m) => m.id === best.id);
  if (!mate) return false;
  mate.state = 'returning';
  mate.wanderTimer = 0;
  rt.pendingSfx.push('seated');
  say(rt, '同学跟着你回座位了。', 1);
  burst(rt, mate.cell, {
    count: 6,
    color: [PALETTE.hud.warmth, '#fff3d6'],
    speed: 26,
    size: 1,
    life: 0.4,
    gravity: -10,
  });
  return true;
}

/** 「温暖了」把范围内的同学一次性送回座位 */
export function sendMatesHome(rt: Runtime, radius: number): number {
  const p = occupiedCell(rt.player.move, rt.player.cell);
  let count = 0;
  for (const mate of rt.mates) {
    if (mate.state === 'seated' || mate.state === 'leaving') continue;
    if (chebyshev(mate.cell, p) > radius) continue;
    mate.state = 'returning';
    mate.wanderTimer = 0;
    count++;
  }
  return count;
}

/** 同学随机起步位置：离座位远一点，逼玩家去找 */
export function pickMateStart(rt: Runtime, seat: Vec2): Vec2 {
  const cell = rt.grid.randomWalkable(
    rt.rng,
    (c) => chebyshev(c, seat) >= 4 && !rt.mates.some((m) => m.cell.x === c.x && m.cell.y === c.y),
    { cell: seat, minDistance: 4 },
  );
  return cell;
}

/** 同学朝某个方向抖动一下（渲染用） */
export function mateShiver(mate: { stepPhase: number }): number {
  return Math.sin(mate.stepPhase) * 0.5;
}

export const MATE_DIRS = DIRS.map((d) => DIR_VEC[d]);
