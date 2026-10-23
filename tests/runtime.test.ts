import { describe, expect, it } from 'vitest';
import { createRuntime, stepRuntime } from '../src/game/runtime';
import { validateLevel } from '../src/game/validate';
import { getLevel } from '../src/game/levels';
import { FrameCommand, Runtime } from '../src/game/types';
import { Dir, chebyshev } from '../src/core/math';

const idle: FrameCommand = { p1: null, p2: null, skill: false, interact: false, dash: false };

function makeRuntime(levelId = 'classroom-1', seed = 20250419, mode: 'campaign' | 'endless' | 'duel' = 'campaign'): Runtime {
  const data = validateLevel(getLevel(levelId));
  return createRuntime(data, mode, { seed });
}

function run(rt: Runtime, seconds: number, cmd: Partial<FrameCommand> = {}, onStep?: (rt: Runtime) => void): void {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) {
    stepRuntime(rt, 1 / 60, { ...idle, ...cmd });
    onStep?.(rt);
    if (rt.status !== 'playing') break;
  }
}

function teleport(rt: Runtime, mateIndex: number, dir: Dir): void {  const mate = rt.mates[mateIndex];
  const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
  const nx = mate.cell.x + d[0];
  const ny = mate.cell.y + d[1];
  rt.player.cell = { x: nx, y: ny };
  rt.player.pos = { x: nx, y: ny };
  rt.player.move = null;
}

/** 把舞剑同学钉在角落：只验主线的端到端测试用 */
function pinChaser(rt: Runtime): void {
  rt.chaser.state = 'stagger';
  rt.chaser.staggerLeft = 9;
  rt.chaser.move = null;
  rt.chaser.hop = null;
  rt.chaser.cell = { x: 19, y: 1 };
  rt.chaser.pos = { x: 19, y: 1 };
  rt.player.invuln = 9;
}

describe('运行时：胜负与目标', () => {
  it('开局有暖意、同学散落在座位上、后门未开', () => {
    const rt = makeRuntime();
    expect(rt.player.hp).toBe(3);
    expect(rt.mates).toHaveLength(3);
    expect(rt.seated).toBe(0);
    expect(rt.exitOpen).toBe(false);
    expect(rt.mates.every((m) => m.state === 'scared')).toBe(true);
  });

  it('同学全部归位后后门才开', () => {
    const rt = makeRuntime();
    for (const mate of rt.mates) {
      mate.state = 'seated';
      mate.cell = { ...mate.seat };
    }
    stepRuntime(rt, 1 / 60, idle);
    expect(rt.seated).toBe(3);
    expect(rt.exitOpen).toBe(true);
  });

  it('走进终点即通关（后门已开）', () => {
    const rt = makeRuntime();
    rt.exitOpen = true;
    rt.player.cell = { x: rt.exit.x, y: rt.exit.y };
    rt.player.pos = { ...rt.exit };
    stepRuntime(rt, 1 / 60, idle);
    expect(rt.status).toBe('won');
  });

  it('超时判负并给出原版文案', () => {
    const rt = makeRuntime();
    // 每帧维持无敌，模拟「一直活着但拖到时间结束」的玩家
    run(rt, rt.timeLimit + 1, {}, (r) => {
      r.player.hp = 3;
      r.player.invuln = 1;
    });
    expect(rt.status).toBe('lost');
    expect(rt.loseReason).toBe('time');
    expect(rt.pendingDialogs.some((d) => d.text === '时间到！游戏失败')).toBe(true);
  });

  it('无尽模式不会因为时间结束', () => {
    const rt = makeRuntime('endless', 7, 'endless');
    run(rt, 80, {}, (r) => {
      r.player.hp = 3;
    });
    expect(rt.status).toBe('playing');
    expect(rt.wave).toBeGreaterThan(0);
    expect(rt.chaser.speedMul).toBeGreaterThan(1);
  });
});

describe('运行时：玩家与技能', () => {
  it('按方向键会走一格', () => {
    const rt = makeRuntime();
    const start = { ...rt.player.cell };
    run(rt, 0.4, { p1: 'up' });
    expect(rt.player.cell).not.toEqual(start);
  });

  it('「温暖了」扣温暖值，打空时记空放', () => {
    const rt = makeRuntime();
    const before = rt.warmth;
    stepRuntime(rt, 1 / 60, { ...idle, skill: true });
    expect(rt.warmth).toBeLessThan(before);
    expect(rt.missedSkills).toBe(1);
    expect(rt.pendingDialogs.some((d) => d.text === '温暖了！请同学们回到座位上。')).toBe(true);
  });

  it('温暖值不足时按不出来', () => {
    const rt = makeRuntime();
    rt.warmth = 1;
    stepRuntime(rt, 1 / 60, { ...idle, skill: true });
    expect(rt.skillUses).toBe(0);
    expect(rt.warmth).toBeLessThanOrEqual(4);
  });

  it('站在舞剑同学身边用温暖了会把他按回座位', () => {
    const rt = makeRuntime();
    rt.chaser.cell = { ...rt.player.cell };
    rt.chaser.pos = { ...rt.player.cell };
    stepRuntime(rt, 1 / 60, { ...idle, skill: true });
    expect(rt.chaser.state).toBe('stagger');
    expect(rt.chaser.cell).toEqual(rt.chaserHome);
  });

  it('按 E 把相邻同学喊回座位，最终归位数 +1', () => {
    const rt = makeRuntime();
    teleport(rt, 0, 'right');
    const mate = rt.mates[0];
    expect(chebyshev(rt.player.cell, mate.cell)).toBeLessThanOrEqual(1);
    stepRuntime(rt, 1 / 60, { ...idle, interact: true });
    expect(mate.state).toBe('returning');
    run(rt, 20);
    expect(rt.mates[0].state).toBe('seated');
    expect(rt.seated).toBeGreaterThanOrEqual(1);
  });
});

describe('运行时：舞剑同学', () => {  it('贴脸会举剑并砍中静止的玩家', () => {
    const rt = makeRuntime();
    const p = rt.player.cell;
    rt.chaser.cell = { x: p.x + 1, y: p.y };
    rt.chaser.pos = { ...rt.chaser.cell };
    rt.chaser.state = 'chase';
    rt.player.hp = 3;
    let sawWindup = false;
    run(rt, 2.5, {}, (r) => {
      if (r.chaser.state === 'windup') sawWindup = true;
    });
    expect(sawWindup).toBe(true);
    expect(rt.player.hp).toBeLessThan(3);
  });

  it('暖意归零判负并弹出 You suck!', () => {
    const rt = makeRuntime();
    rt.player.hp = 1;
    rt.player.invuln = 0;
    rt.chaser.cell = { ...rt.player.cell };
    rt.chaser.pos = { ...rt.player.cell };
    stepRuntime(rt, 1 / 60, idle);
    expect(rt.status).toBe('lost');
    expect(rt.player.hp).toBe(0);
    expect(rt.pendingUnlocks).toContain('lose-suck');
  });

  it('舞剑同学不会走进墙里', () => {
    const rt = makeRuntime();
    run(rt, 8);
    for (const cell of [rt.chaser.cell, rt.player.cell]) {
      expect(rt.grid.isWalkable(cell.x, cell.y)).toBe(true);
    }
  });
});

describe('端到端：一局完整的自习课', () => {
  it('依次把三位同学喊回座位，再从后门离开', () => {
    const rt = makeRuntime('classroom-1', 4242);
    rt.timeLimit = 9999; // 主线流程测试不模拟「手速」，只验证规则链路
    const dt = 1 / 60;

    const driveTo = (target: { x: number; y: number }, maxFrames = 4000): boolean => {
      for (let i = 0; i < maxFrames; i++) {
        if (rt.player.cell.x === target.x && rt.player.cell.y === target.y && !rt.player.move) return true;
        pinChaser(rt); // 端到端只验「找人—归位—开门—离场」这条主线，追击 AI 另有测试
        if (rt.player.move) {
          stepRuntime(rt, dt, idle);
          continue;
        }
        const path = rt.grid.path(rt.player.cell, target);
        if (!path || path.length === 0) return false;
        const next = path[0];
        const dx = next.x - rt.player.cell.x;
        const dy = next.y - rt.player.cell.y;
        const dir: Dir = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';
        stepRuntime(rt, dt, { ...idle, p1: dir });
      }
      return false;
    };

    for (const mate of rt.mates) {
      const ok = driveTo(mate.cell);
      expect(ok).toBe(true);
      stepRuntime(rt, dt, { ...idle, interact: true });
      expect(mate.state).toBe('returning');
      for (let i = 0; i < 2000 && mate.state !== 'seated'; i++) {
        pinChaser(rt);
        stepRuntime(rt, dt, idle);
      }
      expect(mate.state).toBe('seated');
    }

    expect(rt.seated).toBe(3);
    expect(rt.exitOpen).toBe(true);

    const reached = driveTo(rt.exit);
    expect(reached).toBe(true);
    stepRuntime(rt, dt, idle);
    expect(rt.status).toBe('won');
    expect(rt.pendingUnlocks.length).toBeGreaterThan(0);
  });
});
