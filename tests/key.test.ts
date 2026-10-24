import { describe, expect, it } from 'vitest';
import { getLevel } from '../src/game/levels';
import { createRuntime, stepRuntime } from '../src/game/runtime';
import { validateLevel } from '../src/game/validate';
import { FrameCommand, Runtime } from '../src/game/types';

const idle: FrameCommand = {
  p1: null,
  p2: null,
  skill: false,
  interact: false,
  dash: false,
  throw: false,
};

function make(levelId: string, seed = 5150): Runtime {
  return createRuntime(validateLevel(getLevel(levelId)), 'campaign', { seed });
}

function seatEveryMate(rt: Runtime): void {
  for (const mate of rt.mates) {
    mate.state = 'seated';
    mate.move = null;
  }
}

describe('后门钥匙', () => {
  it('走廊值日：座位齐了但没钥匙，后门不会开，并提示一次', () => {
    const rt = make('corridor-1');
    expect(rt.keyCell).not.toBeNull();
    expect(rt.hasKey).toBe(false);

    seatEveryMate(rt);
    stepRuntime(rt, 1 / 60, idle);

    expect(rt.seated).toBe(rt.requireSeated);
    expect(rt.exitOpen).toBe(false);
    expect(rt.keyHintShown).toBe(true);

    // 再跑一段时间也不会重复刷提示
    for (let i = 0; i < 30; i++) stepRuntime(rt, 1 / 60, idle);
    expect(rt.exitOpen).toBe(false);
  });

  it('走到钥匙格才拿到钥匙，随后后门打开', () => {
    const rt = make('corridor-1');
    seatEveryMate(rt);
    stepRuntime(rt, 1 / 60, idle);
    expect(rt.exitOpen).toBe(false);

    const key = rt.keyCell!;
    rt.player.cell = { x: key.x + 1, y: key.y };
    rt.player.pos = { x: key.x + 1, y: key.y };
    rt.player.move = {
      from: { x: key.x + 1, y: key.y },
      to: { x: key.x, y: key.y },
      t: 0.99,
      dur: 0.11,
    };
    stepRuntime(rt, 1 / 60, idle);

    expect(rt.hasKey).toBe(true);
    expect(rt.exitOpen).toBe(true);
    expect(rt.pendingUnlocks).toContain('key-taken');
  });

  it('开门后走到后门就通关', () => {
    const rt = make('corridor-1');
    seatEveryMate(rt);
    rt.hasKey = true;
    stepRuntime(rt, 1 / 60, idle);
    expect(rt.exitOpen).toBe(true);

    rt.player.cell = { x: rt.exit.x, y: rt.exit.y };
    rt.player.pos = { x: rt.exit.x, y: rt.exit.y };
    rt.player.move = null;
    stepRuntime(rt, 1 / 60, idle);
    expect(rt.status).toBe('won');
  });

  it('不需要钥匙的关卡：座位齐就直接开门', () => {
    const rt = make('classroom-1');
    expect(rt.keyCell).toBeNull();
    expect(rt.hasKey).toBe(true);

    seatEveryMate(rt);
    stepRuntime(rt, 1 / 60, idle);
    expect(rt.exitOpen).toBe(true);
  });

  it('没有粉笔头的关卡不会生成粉笔掉落', () => {
    expect(make('classroom-1').chalkDrops).toHaveLength(0);
    expect(make('classroom-5').chalkDrops).toHaveLength(3);
  });
});
