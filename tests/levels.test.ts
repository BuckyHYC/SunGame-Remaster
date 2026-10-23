import { describe, expect, it } from 'vitest';
import { DUEL_LEVEL, ENDLESS_LEVEL, LEVELS } from '../src/game/levels';
import { shortestPath, validateAllLevels, validateLevel } from '../src/game/validate';

describe('关卡数据', () => {
  const all = validateAllLevels();

  it('全部关卡都通过校验', () => {
    expect(all.size).toBe(LEVELS.length + 2);
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

  it('无尽/双人关也有终点与出生点', () => {
    for (const def of [ENDLESS_LEVEL, DUEL_LEVEL]) {
      const level = validateLevel(def);
      expect(level.grid.path(level.meta.spawn, level.meta.exit)).not.toBeNull();
    }
  });
});
