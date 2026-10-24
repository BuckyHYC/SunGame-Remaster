import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/data/balance';
import { getLevel } from '../src/game/levels';
import { createRuntime } from '../src/game/runtime';
import { validateLevel } from '../src/game/validate';
import { pickupChalk, throwChalk } from '../src/game/chalk';
import { Runtime } from '../src/game/types';

function make(levelId = 'classroom-5', seed = 998877): Runtime {
  return createRuntime(validateLevel(getLevel(levelId)), 'campaign', { seed });
}

function stand(rt: Runtime, x: number, y: number, facing: 'up' | 'down' | 'left' | 'right'): void {
  rt.player.cell = { x, y };
  rt.player.pos = { x, y };
  rt.player.move = null;
  rt.player.facing = facing;
}

function parkChaser(rt: Runtime, x: number, y: number): void {
  rt.chaser.cell = { x, y };
  rt.chaser.pos = { x, y };
  rt.chaser.move = null;
  rt.chaser.hop = null;
  rt.chaser.state = 'patrol';
}

describe('粉笔头', () => {
  it('踩到 c 格就捡起来，弹药 +1', () => {
    const rt = make();
    expect(rt.player.chalk).toBe(0);
    const drop = rt.chalkDrops[0];
    pickupChalk(rt, drop.cell);
    expect(drop.taken).toBe(true);
    expect(rt.player.chalk).toBe(1);
    expect(rt.pendingUnlocks).toContain('chalk-picked');
  });

  it('弹药有上限，捡满就不再增加', () => {
    const rt = make();
    for (const drop of rt.chalkDrops) pickupChalk(rt, drop.cell);
    expect(rt.chalkDrops.length).toBe(3);
    expect(rt.player.chalk).toBe(BALANCE.chalk.max);
    // 重复捡同一格不会再加
    pickupChalk(rt, rt.chalkDrops[0].cell);
    expect(rt.player.chalk).toBe(BALANCE.chalk.max);
  });

  it('扔中舞剑同学：硬直 0.8 秒，弹药与次数都要扣', () => {
    const rt = make();
    stand(rt, 2, 4, 'right');
    parkChaser(rt, 4, 4);
    rt.player.chalk = 1;

    throwChalk(rt);

    expect(rt.player.chalk).toBe(0);
    expect(rt.chalkThrown).toBe(1);
    expect(rt.chaser.state).toBe('stagger');
    expect(rt.chaser.staggerLeft).toBeCloseTo(BALANCE.chalk.staggerMs / 1000, 5);
    // 不把他按回座位
    expect(rt.chaser.cell).toEqual({ x: 4, y: 4 });
  });

  it('扔中入伙的同学：直接治愈，不进冷却', () => {
    const rt = make();
    stand(rt, 2, 4, 'right');
    parkChaser(rt, 19, 12);
    const mate = rt.mates[0];
    mate.state = 'converted';
    mate.cell = { x: 3, y: 4 };
    mate.pos = { x: 3, y: 4 };
    mate.move = null;
    mate.attack = null;
    rt.player.chalk = 1;

    throwChalk(rt);

    expect(mate.state).toBe('returning');
    expect(rt.cured).toBe(1);
    expect(rt.player.chalk).toBe(0);
  });

  it('被墙挡住就停在原地，弹药照样消耗', () => {
    const rt = make();
    stand(rt, 1, 2, 'right'); // (2,2) 是课桌
    parkChaser(rt, 19, 12);
    rt.player.chalk = 1;

    throwChalk(rt);

    expect(rt.player.chalk).toBe(0);
    expect(rt.chalkThrown).toBe(1);
    expect(rt.chaser.state).toBe('patrol');
  });

  it('没有弹药时按 Q 不会计入投掷次数', () => {
    const rt = make();
    stand(rt, 2, 4, 'right');
    parkChaser(rt, 4, 4);
    rt.player.chalk = 0;

    throwChalk(rt);

    expect(rt.chalkThrown).toBe(0);
    expect(rt.player.bumpCd).toBeGreaterThan(0);
    expect(rt.chaser.state).toBe('patrol');
  });
});
