import { describe, expect, it } from 'vitest';
import { getLevel } from '../src/game/levels';
import { createRuntime, stepRuntime } from '../src/game/runtime';
import { validateLevel } from '../src/game/validate';
import { countConverted, updateConverted } from '../src/game/converted';
import { scareAway } from '../src/game/mates';
import { FrameCommand, MateState, Runtime } from '../src/game/types';

const idle: FrameCommand = {
  p1: null,
  p2: null,
  skill: false,
  interact: false,
  dash: false,
  throw: false,
};

function make(levelId = 'classroom-4', seed = 424242): Runtime {
  return createRuntime(validateLevel(getLevel(levelId)), 'campaign', { seed });
}

/** 把玩家钉到某个格子，方便验证近距离交互 */
function placePlayer(rt: Runtime, x: number, y: number): void {
  rt.player.cell = { x, y };
  rt.player.pos = { x, y };
  rt.player.move = null;
}

function convertFirstMate(rt: Runtime): MateState {
  const mate = rt.mates[0];
  mate.scareCount = 1;
  scareAway(rt, mate.id);
  return mate;
}

describe('入伙：被舞剑同学教会', () => {
  it('第一次被吓只是换位置，第二次才入伙', () => {
    const rt = make();
    const mate = rt.mates[0];
    mate.state = 'scared';
    mate.scareCount = 0;

    scareAway(rt, mate.id);
    expect(mate.state).toBe('scared');
    expect(mate.scareCount).toBe(1);
    expect(rt.convertedTotal).toBe(0);

    scareAway(rt, mate.id);
    expect(mate.state).toBe('converted');
    expect(rt.convertedTotal).toBe(1);
    expect(countConverted(rt)).toBe(1);
    expect(rt.pendingUnlocks).toContain('mate-converted');
  });

  it('达到 convertMax 之后不再新增（本关上限 1）', () => {
    const rt = make();
    const first = convertFirstMate(rt);
    expect(first.state).toBe('converted');

    const second = rt.mates[1];
    second.scareCount = 1;
    scareAway(rt, second.id);
    expect(second.state).not.toBe('converted');
    expect(countConverted(rt)).toBe(1);
  });

  it('不启用入伙的关卡（自习课）吓多少次都不会入伙', () => {
    const rt = make('classroom-1');
    const mate = rt.mates[0];
    mate.scareCount = 1;
    scareAway(rt, mate.id);
    scareAway(rt, mate.id);
    expect(mate.state).toBe('scared');
    expect(rt.convertedTotal).toBe(0);
  });

  it('「温暖了」能把入伙的同学劝回来，并留下免疫时间', () => {
    const rt = make();
    const mate = convertFirstMate(rt);
    placePlayer(rt, mate.cell.x + 1, mate.cell.y);
    rt.player.facing = 'left';

    stepRuntime(rt, 1 / 60, { ...idle, skill: true });

    expect(mate.state).toBe('returning');
    expect(rt.cured).toBe(1);
    expect(countConverted(rt)).toBe(0);
    expect(mate.convertImmuneUntil).toBeGreaterThan(rt.time);
    expect(mate.scareCount).toBe(0);
  });

  it('按 E 喊不动入伙的同学', () => {
    const rt = make();
    const mate = convertFirstMate(rt);
    // 把其它同学先安置走，确保 E 只会碰到入伙的这位
    for (const other of rt.mates.slice(1)) other.state = 'seated';
    placePlayer(rt, mate.cell.x + 1, mate.cell.y);

    stepRuntime(rt, 1 / 60, { ...idle, interact: true });
    expect(mate.state).toBe('converted');
    const last = rt.pendingDialogs[rt.pendingDialogs.length - 1];
    expect(last?.text).toContain('喊不动');
  });

  it('入伙同学挥剑只会把玩家推开：不掉暖意、不加命中数', () => {
    const rt = make();
    const mate = convertFirstMate(rt);
    mate.cell = { x: 5, y: 4 };
    mate.pos = { x: 5, y: 4 };
    mate.facing = 'right';
    mate.move = null;
    mate.attack = null;
    placePlayer(rt, 6, 4);
    const hpBefore = rt.player.hp;

    for (let i = 0; i < Math.round(0.8 * 60); i++) updateConverted(rt, 1 / 60);

    expect(rt.player.cell.x).toBeGreaterThan(6);
    expect(rt.player.hp).toBe(hpBefore);
    expect(rt.hits).toBe(0);
    expect(rt.player.stun).toBeGreaterThan(0);
  });

  it('推开后短暂不能起步（stun 生效）', () => {
    const rt = make();
    const mate = convertFirstMate(rt);
    mate.cell = { x: 5, y: 4 };
    mate.pos = { x: 5, y: 4 };
    mate.facing = 'right';
    mate.move = null;
    mate.attack = null;
    placePlayer(rt, 6, 4);
    for (let i = 0; i < Math.round(0.6 * 60); i++) updateConverted(rt, 1 / 60);
    expect(rt.player.stun).toBeGreaterThan(0);

    const before = { ...rt.player.cell };
    stepRuntime(rt, 1 / 60, { ...idle, p1: 'up' });
    expect(rt.player.move).toBeNull();
    expect({ ...rt.player.cell }).toEqual(before);
  });

  it('超出 leash 就停下，不会一路追到底', () => {
    const rt = make();
    const mate = convertFirstMate(rt);
    mate.cell = { x: 1, y: 1 };
    mate.pos = { x: 1, y: 1 };
    mate.move = null;
    mate.attack = null;
    placePlayer(rt, 19, 12);
    const start = { ...mate.cell };

    for (let i = 0; i < 60; i++) updateConverted(rt, 1 / 60);
    expect(mate.cell).toEqual(start);
  });

  it('治愈免疫期内再被吓也不会立刻入伙', () => {
    const rt = make();
    const mate = convertFirstMate(rt);
    placePlayer(rt, mate.cell.x, mate.cell.y + 1);
    stepRuntime(rt, 1 / 60, { ...idle, skill: true });
    expect(mate.state).toBe('returning');

    mate.scareCount = 1;
    scareAway(rt, mate.id);
    expect(mate.state).not.toBe('converted');
    expect(rt.convertedTotal).toBe(1);
  });
});
