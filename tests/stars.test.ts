import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SaveStore } from '../src/core/save';
import { getLevel } from '../src/game/levels';
import { createRuntime } from '../src/game/runtime';
import { validateLevel } from '../src/game/validate';
import { evaluateStars } from '../src/game/stars';
import { Runtime } from '../src/game/types';

function make(levelId: string, seed = 771): Runtime {
  return createRuntime(validateLevel(getLevel(levelId)), 'campaign', { seed });
}

describe('三星目标', () => {
  it('舞剑课：无伤 + 无人入伙 + 65 秒内 = 三星', () => {
    const rt = make('classroom-4');
    rt.hits = 0;
    rt.convertedTotal = 0;
    rt.time = 60;

    const result = evaluateStars(rt, getLevel('classroom-4'));
    expect(result.goals).toHaveLength(3);
    expect(result.stars).toBe(3);

    rt.convertedTotal = 1;
    expect(evaluateStars(rt, getLevel('classroom-4')).stars).toBe(2);

    rt.time = 70;
    expect(evaluateStars(rt, getLevel('classroom-4')).stars).toBe(1);

    rt.hits = 2;
    expect(evaluateStars(rt, getLevel('classroom-4')).stars).toBe(0);
  });

  it('月考：不扔粉笔这条独立成立', () => {
    const rt = make('classroom-5');
    rt.hits = 0;
    rt.chalkThrown = 0;
    rt.time = 70;
    expect(evaluateStars(rt, getLevel('classroom-5')).stars).toBe(3);

    rt.chalkThrown = 1;
    expect(evaluateStars(rt, getLevel('classroom-5')).stars).toBe(2);
  });

  it('自习课：不放「温暖了」也要单独判定', () => {
    const rt = make('classroom-1');
    rt.skillUses = 0;
    rt.time = 55;
    expect(evaluateStars(rt, getLevel('classroom-1')).stars).toBe(3);

    rt.skillUses = 1;
    expect(evaluateStars(rt, getLevel('classroom-1')).stars).toBe(2);
  });
});

describe('星级存档', () => {
  const memory = new Map<string, string>();

  beforeEach(() => {
    memory.clear();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => memory.get(key) ?? null,
        setItem: (key: string, value: string) => {
          memory.set(key, value);
        },
        removeItem: (key: string) => {
          memory.delete(key);
        },
      },
    });
  });

  it('星星取历史最大值，分数仍按最好的一局保留', () => {
    const save = new SaveStore();
    save.recordResult('classroom-4', { rank: 'C', score: 600, time: 40, stars: 2 });
    save.recordResult('classroom-4', { rank: 'D', score: 500, time: 50, stars: 3 });

    const best = save.bestFor('classroom-4');
    expect(best?.stars).toBe(3);
    expect(best?.score).toBe(600);
  });

  it('旧档没有 stars 字段时按 0 处理', () => {
    const raw = {
      version: 1,
      best: { 'classroom-1': { rank: 'S', score: 940, time: 40, at: 1 } },
      collection: [],
      settings: { sfx: true, reducedMotion: false },
      stats: { plays: 1, wins: 1, bestEndless: 0 },
    };
    memory.set('sungame.remaster.save.v1', JSON.stringify(raw));

    const save = new SaveStore();
    expect(save.bestFor('classroom-1')?.score).toBe(940);
    expect(save.bestFor('classroom-1')?.stars).toBe(0);
  });
});
