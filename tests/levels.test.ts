import { describe, expect, it } from 'vitest';
import { DUEL_LEVEL, ENDLESS_LEVEL, LEVELS, getLevel } from '../src/game/levels';
import { shortestPath, validateAllLevels, validateLevel } from '../src/game/validate';

describe('关卡数据', () => {
  const all = validateAllLevels();

  it('全部关卡都通过校验', () => {
    expect(all.size).toBe(LEVELS.length + 2);
  });

  it('战役关扩到 7 关，章节号连续', () => {
    expect(LEVELS.length).toBe(7);
    const chapters = LEVELS.map((level) => level.chapter ?? 1);
    expect(chapters).toEqual([...chapters].sort((a, b) => a - b));
    expect([...new Set(chapters)]).toEqual([1, 2, 3]);
  });

  it('每关正好 3 条三星目标，而且类型各不相同', () => {
    for (const def of LEVELS) {
      const goals = def.stars ?? [];
      expect(goals).toHaveLength(3);
      expect(new Set(goals.map((goal) => goal.type)).size).toBe(3);
    }
  });

  it('每张地图尺寸统一为 21×14', () => {
    for (const level of all.values()) {
      expect(level.grid.w).toBe(21);
      expect(level.grid.h).toBe(14);
    }
  });

  it('每关最少 3 个座位、2 个彩蛋', () => {
    for (const def of LEVELS) {
      const level = validateLevel(def);
      expect(level.meta.seats.length).toBeGreaterThanOrEqual(3);
      expect(level.meta.pickups.length).toBeGreaterThanOrEqual(2);
      expect(level.requireSeated).toBe(level.meta.seats.length);
    }
  });

  it('出生点到终点至少 12 步（短于原版的 19 步就是设计事故）', () => {
    for (const def of LEVELS) {
      const steps = shortestPath(validateLevel(def));
      expect(steps).toBeGreaterThanOrEqual(12);
    }
  });

  it('四张新图的最短路径不小于 16 步', () => {
    for (const id of ['classroom-4', 'corridor-1', 'classroom-5', 'night-1']) {
      expect(shortestPath(validateLevel(getLevel(id)))).toBeGreaterThanOrEqual(16);
    }
  });

  it('needKey 的关卡有钥匙，其余关卡没有多放的钥匙', () => {
    for (const def of LEVELS) {
      const level = validateLevel(def);
      if (def.needKey) expect(level.meta.key).not.toBeNull();
      else expect(level.meta.key).toBeNull();
    }
  });

  it('粉笔头数量与关卡表一致', () => {
    const counts: Record<string, number> = {};
    for (const def of LEVELS) counts[def.id] = validateLevel(def).meta.chalk.length;
    expect(counts).toEqual({
      'classroom-1': 0,
      'classroom-2': 0,
      'classroom-3': 0,
      'classroom-4': 0,
      'corridor-1': 1,
      'classroom-5': 3,
      'night-1': 2,
    });
  });

  it('无尽/双人关也有终点与出生点', () => {
    for (const def of [ENDLESS_LEVEL, DUEL_LEVEL]) {
      const level = validateLevel(def);
      expect(level.grid.path(level.meta.spawn, level.meta.exit)).not.toBeNull();
    }
  });
});
