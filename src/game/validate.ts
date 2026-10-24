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

  const same = (a: Vec2, b: Vec2): boolean => a.x === b.x && a.y === b.y;
  const onSeat = (cell: Vec2): boolean => meta.seats.some((s) => same(s, cell));
  const onPickup = (cell: Vec2): boolean => meta.pickups.some((p) => same(p, cell));

  for (const seat of meta.seats) {
    if (!grid.isWalkable(seat.x, seat.y)) issues.push(`座位 (${seat.x},${seat.y}) 不可通行`);
  }
  for (const pickup of meta.pickups) {
    if (onSeat(pickup)) {
      issues.push(`彩蛋 (${pickup.x},${pickup.y}) 压在座位上`);
    }
  }

  // 粉笔头：可拾取弹药，必须可达且不和别的标记重叠
  for (const [i, cell] of meta.chalk.entries()) {
    if (!grid.path(meta.spawn, cell)) issues.push(`第 ${i + 1} 个粉笔头 (${cell.x},${cell.y}) 从出生点不可达`);
    if (onSeat(cell)) issues.push(`粉笔头 (${cell.x},${cell.y}) 压在座位上`);
    if (onPickup(cell)) issues.push(`粉笔头 (${cell.x},${cell.y}) 和彩蛋重叠`);
  }

  // 钥匙：只有 needKey 的关卡才允许出现，且必须可达
  if (def.needKey === true) {
    if (!meta.key) {
      issues.push('本关需要钥匙，但地图上没有 K');
    } else {
      if (!grid.path(meta.spawn, meta.key)) issues.push(`钥匙 (${meta.key.x},${meta.key.y}) 从出生点不可达`);
      if (onSeat(meta.key)) issues.push(`钥匙 (${meta.key.x},${meta.key.y}) 压在座位上`);
      if (onPickup(meta.key)) issues.push(`钥匙 (${meta.key.x},${meta.key.y}) 和彩蛋重叠`);
    }
  } else if (meta.key) {
    issues.push(`地图上放了钥匙 (${meta.key.x},${meta.key.y})，但关卡没有 needKey`);
  }

  // 三星目标：战役关必须正好 3 条；无尽/双人只是沿用模板，不参与星级结算
  const isCampaign = LEVELS.some((level) => level.id === def.id);
  const starGoals = def.stars ?? [];
  if (isCampaign && starGoals.length !== 3) {
    issues.push(`三星目标必须正好 3 条，现在是 ${starGoals.length} 条`);
  }
  if (isCampaign) {
    for (const goal of starGoals) {
      if (goal.type !== 'under-time') continue;
      const limit = goal.value ?? 0;
      if (limit <= 0 || limit >= def.timeLimit) {
        issues.push(`限时目标 ${limit}s 必须大于 0 且小于关卡时限 ${def.timeLimit}s`);
      }
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
