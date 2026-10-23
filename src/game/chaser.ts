import { DIRS, DIR_VEC, Dir, Vec2, chebyshev, eq, facingFromDelta } from '../core/math';
import { BALANCE } from '../data/balance';
import { PALETTE } from '../data/palette';
import { addShake, burst, hitSparks, stepDust } from './fx';
import { advanceMove, movePosition, occupiedCell, startMove } from './move';
import { say, sayLine, unlock } from './events';
import { Runtime } from './types';

const ATTACK_STATES: ReadonlySet<string> = new Set(['windup', 'strike', 'recover']);

function playerCell(rt: Runtime): Vec2 {
  const p = rt.player;
  return occupiedCell(p.move, p.cell);
}

export function updateChaser(rt: Runtime, dt: number, p2Dir: Dir | null, controlled: boolean): void {
  const c = rt.chaser;
  c.breath += dt;
  c.alertPulse = Math.max(0, c.alertPulse - dt);

  if (c.state === 'stagger') {
    c.staggerLeft -= dt;
    if (c.staggerLeft <= 0) {
      c.state = 'patrol';
      c.timer = 0.25;
    }
    return;
  }

  if (c.hop) {
    const h = c.hop;
    h.t += dt / h.dur;
    if (h.t >= 1) {
      c.cell = { x: h.to.x, y: h.to.y };
      c.pos = { x: c.cell.x, y: c.cell.y };
      c.hop = null;
      c.onDesk = rt.grid.isDesk(c.cell.x, c.cell.y);
      c.state = 'patrol';
      c.timer = BALANCE.chaser.patrolStepMs / 1000 / c.speedMul;
      if (c.onDesk) {
        sayLine(rt, 'chaser-jump-up', 2);
        unlock(rt, 'chaser-jumped-up');
      } else {
        sayLine(rt, 'chaser-jump-down', 1);
        unlock(rt, 'chaser-jumped-down');
      }
      stepDust(rt, c.cell);
    } else {
      c.pos = {
        x: h.from.x + (h.to.x - h.from.x) * h.t,
        y: h.from.y + (h.to.y - h.from.y) * h.t,
      };
    }
    return;
  }

  if (c.move) {
    const done = advanceMove(c.move, dt);
    c.pos = movePosition(c.move, c.cell);
    if (!done) return;
    c.cell = { x: c.move.to.x, y: c.move.to.y };
    c.move = null;
    c.pos = { x: c.cell.x, y: c.cell.y };
  }

  if (ATTACK_STATES.has(c.state)) {
    advanceAttack(rt, dt);
    return;
  }

  const target = playerCell(rt);
  const sees = canSeePlayer(rt, target);

  if (controlled) {
    manualStep(rt, dt, p2Dir);
    return;
  }

  if (sees) {
    c.lostTimer = 0;
    if (c.state === 'patrol') enterAlert(rt, target);
  } else {
    c.lostTimer += dt;
    if (c.state === 'chase' && c.lostTimer > 3) {
      c.state = 'patrol';
      c.timer = 0.25;
    }
  }

  if (c.state === 'alert') {
    c.timer -= dt;
    if (c.timer <= 0) {
      c.state = 'chase';
      c.timer = 0;
    }
    return;
  }

  if (c.state === 'chase') {
    chaseStep(rt, dt, target);
    return;
  }

  patrolStep(rt, dt);
}

function enterAlert(rt: Runtime, target: Vec2): void {
  const c = rt.chaser;
  c.state = 'alert';
  c.timer = BALANCE.chaser.alertMs / 1000;
  c.alertPulse = 1;
  c.facing = facingFromDelta(target.x - c.cell.x, target.y - c.cell.y, c.facing);
  rt.pendingSfx.push('click');
}

function manualStep(rt: Runtime, dt: number, p2Dir: Dir | null): void {
  const c = rt.chaser;
  const target = playerCell(rt);
  c.timer -= dt;
  if (p2Dir) {
    c.facing = p2Dir;
    const nx = c.cell.x + DIR_VEC[p2Dir].x;
    const ny = c.cell.y + DIR_VEC[p2Dir].y;
    if (rt.grid.isWalkable(nx, ny)) {
      c.move = startMove(c.cell, { x: nx, y: ny }, BALANCE.chaser.chaseStepMs);
      c.steps += 1;
      c.stepPhase = (c.stepPhase + 1) % 4;
      stepDust(rt, c.cell);
    } else if (c.timer <= 0) {
      c.timer = 0.3;
      rt.pendingSfx.push('bump');
    }
  }
  if (chebyshev(c.cell, target) <= 1 && c.timer <= 0) {
    startWindup(rt, target);
  }
}

function advanceAttack(rt: Runtime, dt: number): void {
  const c = rt.chaser;
  c.timer -= dt;
  if (c.state === 'windup') {
    if (c.timer > 0) return;
    c.state = 'strike';
    c.timer = BALANCE.chaser.strikeMs / 1000;
    resolveStrike(rt);
    return;
  }
  if (c.state === 'strike') {
    if (c.timer > 0) return;
    if (c.chargesLeft > 1) {
      c.chargesLeft -= 1;
      c.state = 'windup';
      c.timer = (BALANCE.chaser.windupMs * 0.85) / 1000;
      c.facing = facingFromDelta(rt.player.cell.x - c.cell.x, rt.player.cell.y - c.cell.y, c.facing);
      rt.pendingSfx.push('windup');
    } else {
      c.state = 'recover';
      c.timer = BALANCE.chaser.recoverMs / 1000;
    }
    return;
  }
  if (c.state === 'recover') {
    if (c.timer > 0) return;
    c.state = canSeePlayer(rt, playerCell(rt)) ? 'chase' : 'patrol';
    c.timer = 0.1;
  }
}

function startWindup(rt: Runtime, target: Vec2): void {
  const c = rt.chaser;
  c.state = 'windup';
  c.timer = BALANCE.chaser.windupMs / 1000;
  c.facing = facingFromDelta(target.x - c.cell.x, target.y - c.cell.y, c.facing);
  c.chargesLeft = rt.def.chaser.charges;
  rt.pendingSfx.push('windup');
  addShake(rt, 1.1);
  if (!c.warned) {
    c.warned = true;
    sayLine(rt, 'chaser-windup', 2);
    unlock(rt, 'chaser-windup');
  }
}

function resolveStrike(rt: Runtime): void {
  const c = rt.chaser;
  const strikeCell = { x: c.cell.x + DIR_VEC[c.facing].x, y: c.cell.y + DIR_VEC[c.facing].y };
  rt.pendingSfx.push('swing');
  const target = playerCell(rt);
  if (eq(strikeCell, target)) {
    hitPlayer(rt);
    return;
  }
  // 挥空：剑风粒子
  burst(rt, strikeCell, {
    count: 9,
    color: [PALETTE.chaser.sword, '#ffffff', PALETTE.effect.chalk],
    speed: 46,
    size: 1,
    life: 0.3,
    gravity: 30,
  });
}

function chaseStep(rt: Runtime, dt: number, target: Vec2): void {
  const c = rt.chaser;
  if (chebyshev(c.cell, target) <= 1) {
    startWindup(rt, target);
    return;
  }
  c.timer -= dt;
  if (c.timer > 0) return;
  c.timer = BALANCE.chaser.chaseStepMs / 1000 / c.speedMul;
  const next = bestStepToward(rt, target);
  if (next) moveChaser(rt, next);
}

function patrolStep(rt: Runtime, dt: number): void {
  const c = rt.chaser;
  if (c.onDesk) {
    c.timer -= dt;
    if (c.timer <= 0) {
      const options = rt.grid
        .neighbors(c.cell)
        .filter((cell) => !rt.grid.isDesk(cell.x, cell.y));
      if (options.length > 0) {
        startHop(rt, rt.rng.pick(options), false);
      } else {
        c.timer = 0.4;
      }
    }
    return;
  }

  c.timer -= dt;
  if (c.timer > 0) return;
  c.timer = BALANCE.chaser.patrolStepMs / 1000 / c.speedMul;

  if (rt.rng.chance(rt.def.chaser.jumpChance)) {
    const desks: Vec2[] = [];
    for (const dir of DIRS) {
      const d = DIR_VEC[dir];
      const nx = c.cell.x + d.x;
      const ny = c.cell.y + d.y;
      if (rt.grid.isDesk(nx, ny)) desks.push({ x: nx, y: ny });
    }
    if (desks.length > 0) {
      startHop(rt, rt.rng.pick(desks), true);
      return;
    }
  }

  const options = rt.grid.neighbors(c.cell);
  if (options.length === 0) return;
  // 尽量不原地打转：优先不回头
  const forward = options.filter(
    (n) => !(n.x === c.cell.x - DIR_VEC[c.facing].x && n.y === c.cell.y - DIR_VEC[c.facing].y),
  );
  const pool = forward.length > 0 ? forward : options;
  const next = rt.rng.pick(pool);
  c.facing = facingFromDelta(next.x - c.cell.x, next.y - c.cell.y, c.facing);
  moveChaser(rt, next);
}

function startHop(rt: Runtime, to: Vec2, up: boolean): void {
  const c = rt.chaser;
  c.hop = { from: { x: c.cell.x, y: c.cell.y }, to: { x: to.x, y: to.y }, t: 0, dur: BALANCE.chaser.jumpMs / 1000 };
  c.state = 'jump';
  rt.pendingSfx.push('jump');
  if (!up) c.timer = 0.1;
}

function moveChaser(rt: Runtime, to: Vec2): void {
  const c = rt.chaser;
  c.move = startMove(c.cell, to, BALANCE.chaser.chaseStepMs / c.speedMul);
  c.steps += 1;
  c.stepPhase = (c.stepPhase + 1) % 4;
  stepDust(rt, c.cell);
}

function bestStepToward(rt: Runtime, target: Vec2): Vec2 | null {
  const c = rt.chaser;
  const dist = rt.grid.distanceField(target);
  let best: Vec2 | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const dir of DIRS) {
    const d = DIR_VEC[dir];
    const nx = c.cell.x + d.x;
    const ny = c.cell.y + d.y;
    if (!rt.grid.isWalkable(nx, ny)) continue;
    const value = dist[ny * rt.grid.w + nx];
    if (value < 0) continue;
    const facingBonus = dir === c.facing ? -0.001 : 0;
    if (value + facingBonus < bestDist) {
      bestDist = value + facingBonus;
      best = { x: nx, y: ny };
    }
  }
  if (best) c.facing = facingFromDelta(best.x - c.cell.x, best.y - c.cell.y, c.facing);
  return best;
}

function canSeePlayer(rt: Runtime, target: Vec2): boolean {
  const c = rt.chaser;
  if (chebyshev(c.cell, target) <= BALANCE.chaser.proximityAlert) return true;
  if (rt.grid.lineOfSight(c.cell, target, rt.def.chaser.visionRange)) return true;
  if (rt.player.noise > 0 && chebyshev(c.cell, target) <= rt.def.chaser.hearingRange) return true;
  return false;
}

/** 被砍：扣暖意 + 击退 + 无敌帧；暖意归零判负 */
export function hitPlayer(rt: Runtime): void {
  const p = rt.player;
  if (p.invuln > 0 || rt.status !== 'playing') return;
  p.hp -= 1;
  rt.hits += 1;
  p.invuln = BALANCE.player.invulnMs / 1000;
  p.hurtFlash = 1;
  rt.hurtVignette = 1;
  rt.hitstop = 0.05;
  rt.pendingSfx.push('hurt');
  addShake(rt, 3.4);
  hitSparks(rt, p.cell);
  knockback(rt);

  if (p.hp <= 0) {
    p.hp = 0;
    rt.status = 'lost';
    rt.loseReason = 'hit';
    unlock(rt, 'player-hit');
    unlock(rt, 'player-down');
    sayLine(rt, 'hit-player', 2);
    rt.pendingSfx.push('lose');
  } else {
    say(rt, `被剑砍到了！暖意还剩 ${p.hp} 点`, 2);
  }
}

function knockback(rt: Runtime): void {
  const p = rt.player;
  const c = rt.chaser;
  const dx = Math.sign(p.cell.x - c.cell.x);
  const dy = Math.sign(p.cell.y - c.cell.y);
  const candidates: Vec2[] = [
    { x: p.cell.x + dx, y: p.cell.y + dy },
    { x: p.cell.x + dx, y: p.cell.y },
    { x: p.cell.x, y: p.cell.y + dy },
  ];
  for (const cell of candidates) {
    if (!rt.grid.isWalkable(cell.x, cell.y)) continue;
    if (cell.x === c.cell.x && cell.y === c.cell.y) continue;
    p.cell = cell;
    p.pos = { x: cell.x, y: cell.y };
    p.move = null;
    stepDust(rt, cell);
    return;
  }
}
