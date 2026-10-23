import { describe, expect, it } from 'vitest';
import { parseMap } from '../src/core/grid';

describe('网格解析', () => {
  it('正常地图能解析出元数据', () => {
    const { grid, meta } = parseMap([
      '######',
      '#P...#',
      '#.D..#',
      '#.E.X#',
      '######',
    ]);
    expect(grid.w).toBe(6);
    expect(grid.h).toBe(5);
    expect(meta.spawn).toEqual({ x: 1, y: 1 });
    expect(meta.exit).toEqual({ x: 4, y: 3 });
    expect(meta.chaser).toEqual({ x: 2, y: 3 });
    expect(meta.seats).toEqual([]);
    expect(meta.pickups).toEqual([]);
  });

  it('座位数字与彩蛋会被收集', () => {
    const { meta } = parseMap([
      '######',
      '#P1.*#',
      '#...2#',
      '#.E.X#',
      '######',
    ]);
    expect(meta.seats).toHaveLength(2);
    expect(meta.seats[0]).toEqual({ x: 2, y: 1 });
    expect(meta.pickups).toHaveLength(1);
  });

  it('宽度不一致会报中文错误', () => {
    expect(() => parseMap(['###', '#P#', '####', '###', '###'])).toThrow(/宽度/);
  });

  it('太矮的地图直接拒绝', () => {
    expect(() => parseMap(['###', '#P#', '###'])).toThrow(/太矮/);
  });

  it('缺少出生点/终点/舞剑会报错', () => {
    expect(() => parseMap(['######', '#.X..#', '#.E..#', '#....#', '######'])).toThrow(/出生点/);
    expect(() => parseMap(['######', '#P...#', '#.E..#', '#....#', '######'])).toThrow(/终点/);
    expect(() => parseMap(['######', '#P.X.#', '#....#', '#....#', '######'])).toThrow(/舞剑/);
  });

  it('未知字符会指出坐标', () => {
    expect(() => parseMap(['######', '#P...#', '#.?..#', '#.E..#', '######'])).toThrow(/（2,2）/);
  });
});

describe('寻路与视线', () => {
  const { grid } = parseMap([
    '#######',
    '#P....#',
    '#.DDD.#',
    '#.....#',
    '#..E..#',
    '#....X#',
    '#######',
  ]);

  it('BFS 给出最短步数', () => {
    const path = grid.path({ x: 1, y: 1 }, { x: 5, y: 5 });
    expect(path).not.toBeNull();
    expect(path).toHaveLength(8);
    expect(path?.[path.length - 1]).toEqual({ x: 5, y: 5 });
  });

  it('课桌挡路但不挡视线，货架两者都挡', () => {
    expect(grid.isBlocked(3, 2)).toBe(true);
    expect(grid.blocksSight(3, 2)).toBe(false);

    const shelfGrid = parseMap([
      '######',
      '#P.S.#',
      '#....#',
      '#..E.#',
      '#..X.#',
      '######',
    ]).grid;
    expect(shelfGrid.blocksSight(3, 1)).toBe(true);
    expect(shelfGrid.lineOfSight({ x: 1, y: 1 }, { x: 5, y: 1 }, 9)).toBe(false);
    expect(shelfGrid.lineOfSight({ x: 1, y: 1 }, { x: 1, y: 4 }, 9)).toBe(true);
  });

  it('被墙围死时返回 null', () => {
    const { grid: sealed } = parseMap([
      '######',
      '#P#.E#',
      '##...#',
      '#..X.#',
      '######',
    ]);
    expect(sealed.path({ x: 1, y: 1 }, { x: 3, y: 3 })).toBeNull();
  });

  it('距离场把障碍绕开', () => {
    const dist = grid.distanceField({ x: 1, y: 1 });
    expect(dist[1 * grid.w + 1]).toBe(0);
    expect(dist[5 * grid.w + 5]).toBe(8);
    expect(dist[2 * grid.w + 3]).toBe(-1);
  });

  it('随机可走格只会落在可通行格上', () => {
    const rng = {
      next: () => 0.42,
      int: () => 0,
      pick: <T>(items: readonly T[]) => items[0],
    } as never;
    const cell = grid.randomWalkable(rng);
    expect(grid.isWalkable(cell.x, cell.y)).toBe(true);
  });
});
