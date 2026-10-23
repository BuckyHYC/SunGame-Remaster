import { Grid, MapMeta, parseMap } from '../core/grid';
import { Vec2 } from '../core/math';
import { LevelDef, LEVELS, DUEL_LEVEL, ENDLESS_LEVEL } from './levels';

export interface LevelData {
  def: LevelDef;
  grid: Grid;
  meta: MapMeta;
  /** 必须归位的同学数 = 地图上的座位数 */
  requireSeated: number;
}

export interface ValidationIssue {
  level: string;
  message: string;
}

/**
 * 关卡数据校验：宽度/唯一出生点/座位与终点连通/彩蛋可达。
 * 任何一条不满足都直接抛中文错误 —— 让地图错误在启动时就暴露，而不是玩到一半卡死。
 */
export function validateLevel(def: LevelDef): LevelData {
  const { grid, meta } = parseMap(def.rows);
  const issues: string[] = [];

  if (meta.seats.length === 0) issues.push('没有任何座位（字符 1-5）');
  if (meta.pickups.length === 0) issues.push('没有任何彩蛋 *');

  for (const seat of meta.seats) {
    if (!grid.isWalkable(seat.x, seat.y)) issues.push(`座位 (${seat.x},${seat.y}) 不可通行`);
  }
  for (const pickup of meta.pickups) {
    if (meta.seats.some((s) => s.x === pickup.x && s.y === pickup.y)) {
      issues.push(`彩蛋 (${pickup.x},${pickup.y}) 压在座位上`);
    }
  }

  const spawnToExit = grid.path(meta.spawn, meta.exit);
  if (!spawnToExit) issues.push('出生点到终点不可达');

  for (const [i, seat] of meta.seats.entries()) {
    const fromSpawn = grid.path(meta.spawn, seat);
    if (!fromSpawn) issues.push(`第 ${i + 1} 个座位 (${seat.x},${seat.y}) 从出生点不可达`);
  }
  for (const [i, pickup] of meta.pickups.entries()) {
    if (!grid.path(meta.spawn, pickup)) issues.push(`第 ${i + 1} 个彩蛋 (${pickup.x},${pickup.y}) 不可达`);
  }
  if (!grid.isWalkable(meta.chaser.x, meta.chaser.y)) issues.push('舞剑同学出生点不可通行');
  if (meta.chaser.x === meta.spawn.x && meta.chaser.y === meta.spawn.y) {
    issues.push('舞剑同学与玩家出生点重合');
  }

  if (issues.length > 0) {
    throw new Error(`关卡「${def.name}」数据非法：\n- ${issues.join('\n- ')}`);
  }

  return { def, grid, meta, requireSeated: meta.seats.length };
}

export function validateAllLevels(): Map<string, LevelData> {
  const out = new Map<string, LevelData>();
  const all = [...LEVELS, ENDLESS_LEVEL, DUEL_LEVEL];
  const ids = new Set<string>();
  for (const def of all) {
    if (ids.has(def.id)) throw new Error(`关卡 id 重复：${def.id}`);
    ids.add(def.id);
    out.set(def.id, validateLevel(def));
  }
  return out;
}

/** 出生点到终点最短步数：用于平衡审查与文档表格 */
export function shortestPath(level: LevelData): number {
  const path = level.grid.path(level.meta.spawn, level.meta.exit);
  return path ? path.length : -1;
}

/** 座位到出生点的平均距离：衡量"找人"的行程成本 */
export function averageSeatDistance(level: LevelData, spawn: Vec2): number {
  if (level.meta.seats.length === 0) return 0;
  const sum = level.meta.seats.reduce((acc, seat) => {
    const p = level.grid.path(spawn, seat);
    return acc + (p ? p.length : 0);
  }, 0);
  return sum / level.meta.seats.length;
}
