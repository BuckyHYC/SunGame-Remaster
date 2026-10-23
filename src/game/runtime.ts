import { BALANCE } from '../data/balance';
import { HY_LINES } from '../data/lines';
import { Rng } from '../core/rng';
import { Vec2, chebyshev, eq } from '../core/math';
import { Grid } from '../core/grid';
import { hitPlayer, updateChaser } from './chaser';
import { setReducedMotion, updateEffects } from './fx';
import { updateMates, interactMate, pickMateStart } from './mates';
import { occupiedCell } from './move';
import { updatePlayer } from './player';
import { useSkill } from './skill';
import { say, sayLine, unlock } from './events';
import { LevelData } from './validate';
import { FrameCommand, GameMode, Runtime } from './types';

export interface RuntimeOptions {
  seed?: number;
  reducedMotion?: boolean;
}

export function createRuntime(level: LevelData, mode: GameMode, options: RuntimeOptions = {}): Runtime {
  const seed = options.seed ?? Math.floor(Math.random() * 0xffffffff);
  setReducedMotion(options.reducedMotion === true);
  const rng = new Rng(seed);
  const { def, grid, meta } = level;

  const endless = mode === 'endless';
  const duel = mode === 'duel';
  const requireSeated = endless ? Number.POSITIVE_INFINITY : meta.seats.length;

  const rt: Runtime = {
    def,
    grid: grid as Grid,
    rng,
    mode,
    night: def.night && !duel,
    player: {
      cell: { x: meta.spawn.x, y: meta.spawn.y },
      pos: { x: meta.spawn.x, y: meta.spawn.y },
      facing: 'right',
      move: null,
      hp: BALANCE.player.hp,
      maxHp: BALANCE.player.hp,
      invuln: 0,
      dashLeft: 0,
      dashCooldown: 0,
      stepPhase: 0,
      hurtFlash: 0,
      idleTime: 0,
      noise: 0,
      bumpCd: 0,
    },
    chaser: {
      cell: { x: meta.chaser.x, y: meta.chaser.y },
      pos: { x: meta.chaser.x, y: meta.chaser.y },
      facing: 'down',
      state: 'patrol',
      timer: 0.6,
      move: null,
      onDesk: false,
      hop: null,
      stepPhase: 0,
      chargesLeft: 1,
      speedMul: 1,
      staggerLeft: 0,
      alertPulse: 0,
      breath: 0,
      lostTimer: 0,
      warned: false,
    },
    mates: [],
    pickups: [],
    time: 0,
    timeLimit: endless ? Number.POSITIVE_INFINITY : def.timeLimit,
    timeLeft: endless ? Number.POSITIVE_INFINITY : def.timeLimit,
    warmth: endless ? BALANCE.skill.maxWarmth : BALANCE.skill.startWarmth,
    seated: 0,
    requireSeated,
    exitOpen: false,
    hits: 0,
    missedSkills: 0,
    collected: 0,
    skillUses: 0,
    particles: [],
    shake: 0,
    flash: 0,
    warmPulse: 0,
    hitstop: 0,
    status: 'playing',
    loseReason: null,
    duelWinner: null,
    pendingSfx: [],
    pendingDialogs: [],
    pendingUnlocks: [],
    wave: 0,
    waveTimer: 0,
    clock: 0,
    hurtVignette: 0,
    spawn: { x: meta.spawn.x, y: meta.spawn.y },
    exit: { x: meta.exit.x, y: meta.exit.y },
    chaserHome: { x: meta.chaser.x, y: meta.chaser.y },
  };

  meta.seats.forEach((seat, index) => {
    const start = duel ? seat : pickMateStart(rt, seat);
    rt.mates.push({
      id: index,
      seat: { x: seat.x, y: seat.y },
      cell: { x: start.x, y: start.y },
      pos: { x: start.x, y: start.y },
      facing: 'down',
      state: duel ? 'seated' : 'scared',
      move: null,
      variant: index % 5,
      lineId: HY_LINES[(def.pickupOffset + index) % HY_LINES.length].id,
      wanderTimer: rng.range(0.4, 1.4),
      stepPhase: 0,
      scareCooldown: 0,
    });
  });

  meta.pickups.forEach((cell, index) => {
    if (duel) return;
    rt.pickups.push({
      cell: { x: cell.x, y: cell.y },
      lineId: HY_LINES[(def.pickupOffset + index) % HY_LINES.length].id,
      taken: false,
      kind: (def.index + index) % 5,
      bob: rng.range(0, Math.PI * 2),
    });
  });

  if (duel) rt.seated = rt.mates.length;

  return rt;
}

export function stepRuntime(rt: Runtime, dt: number, cmd: FrameCommand): void {
  rt.clock += dt;
  updateEffects(rt, dt);
  if (rt.status !== 'playing') return;
  if (rt.hitstop > 0) return;

  const step = Math.min(dt, 0.05);
  rt.time += step;
  rt.timeLeft = rt.timeLimit - rt.time;
  rt.warmth = Math.min(BALANCE.skill.maxWarmth, rt.warmth + BALANCE.skill.regenPerSec * step);

  if (cmd.skill) useSkill(rt);
  if (cmd.interact) interactMate(rt);

  updatePlayer(rt, step, { dir: cmd.p1, dash: cmd.dash });
  updateChaser(rt, step, cmd.p2, rt.mode === 'duel');
  updateMates(rt, step);

  const seated = rt.mates.filter((m) => m.state === 'seated').length;
  if (seated !== rt.seated) {
    rt.seated = seated;
    if (!rt.exitOpen && rt.mode !== 'endless' && seated >= rt.requireSeated) {
      rt.exitOpen = true;
      rt.pendingSfx.push('door');
      say(rt, '同学都回座位了，后门开了！', 2);
    }
  }

  checkCollision(rt);
  checkOutcome(rt);
  updateEndless(rt, step);
}

function checkCollision(rt: Runtime): void {
  if (rt.status !== 'playing') return;
  const playerCell = occupiedCell(rt.player.move, rt.player.cell);
  const chaserCell = occupiedCell(rt.chaser.move, rt.chaser.cell);
  if (eq(playerCell, chaserCell)) {
    hitPlayer(rt);
    return;
  }
  // 迎面交换位置也算撞上
  const pm = rt.player.move;
  const cm = rt.chaser.move;
  if (pm && cm && pm.t > 0.35 && cm.t > 0.35) {
    if (eq(pm.to, rt.chaser.cell) && eq(cm.to, rt.player.cell)) hitPlayer(rt);
  }
}

function checkOutcome(rt: Runtime): void {
  if (rt.status !== 'playing') {
    if (rt.status === 'lost' && rt.mode === 'duel' && rt.duelWinner === null) {
      rt.duelWinner = 'chaser';
    }
    return;
  }

  const playerCell = occupiedCell(rt.player.move, rt.player.cell);
  // 必须完整踏进门口才算数：动画走到一半不算，观感与判定一致
  const atExit = rt.player.move === null && playerCell.x === rt.exit.x && playerCell.y === rt.exit.y;

  if (rt.mode === 'duel') {
    // 双人只比"抓不抓得到"：后门锁着，撑满 60 秒就算孙巨赢
    if (rt.time >= rt.timeLimit) {
      rt.status = 'won';
      rt.duelWinner = 'runner';
      rt.pendingSfx.push('win');
      say(rt, '撑住了 60 秒！', 2);
    }
    return;
  }

  if (rt.mode === 'campaign' && rt.exitOpen && atExit) {
    rt.status = 'won';
    unlock(rt, 'level-clear');
    sayLine(rt, 'win-clear', 2);
    rt.pendingSfx.push('win');
    return;
  }

  if (rt.time >= rt.timeLimit) {
    rt.status = 'lost';
    rt.loseReason = 'time';
    unlock(rt, 'time-up');
    sayLine(rt, 'lose-time', 2);
    rt.pendingSfx.push('lose');
  }
}

function updateEndless(rt: Runtime, dt: number): void {
  if (rt.mode !== 'endless' || rt.status !== 'playing') return;
  rt.waveTimer += dt;
  if (rt.waveTimer < BALANCE.endless.waveSeconds) return;
  rt.waveTimer -= BALANCE.endless.waveSeconds;
  rt.wave += 1;
  rt.chaser.speedMul = Math.min(
    BALANCE.endless.maxSpeedMultiplier,
    1 + rt.wave * BALANCE.chaser.speedRampPerWave,
  );
  rt.pendingSfx.push('bell');
  say(rt, `第 ${rt.wave} 波：他更快了。`, 2);
}

/** 供 UI 查询的可达性辅助（座位是否还有同学没回去） */
export function remainingSeats(rt: Runtime): number {
  return rt.mates.filter((m) => m.state !== 'seated').length;
}

/** 用于 HUD 的暖意/距离等派生值 */
export function nearestUnseatedDistance(rt: Runtime): number {
  const p = occupiedCell(rt.player.move, rt.player.cell);
  let best = Number.POSITIVE_INFINITY;
  for (const mate of rt.mates) {
    if (mate.state === 'seated') continue;
    best = Math.min(best, chebyshev(mate.cell, p));
  }
  return best;
}

export type { Vec2 };
