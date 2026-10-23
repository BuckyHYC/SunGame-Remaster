import { DIRS, DIR_VEC, Vec2, chebyshev } from './math';
import { Rng } from './rng';

export const TILE = 24;

export type TileKind =
  | 'wall'
  | 'blackboard'
  | 'window'
  | 'shelf'
  | 'desk'
  | 'teacher'
  | 'floor'
  | 'seat'
  | 'exit';

const BLOCKING_KINDS: ReadonlySet<TileKind> = new Set<TileKind>([
  'wall',
  'blackboard',
  'window',
  'shelf',
  'desk',
  'teacher',
]);

/** 挡视线的只有高家具；课桌很矮，可以看过去（也让「跳上桌」有意义） */
const SIGHT_BLOCKING: ReadonlySet<TileKind> = new Set<TileKind>([
  'wall',
  'blackboard',
  'window',
  'shelf',
]);

const CHAR_TO_TILE: Record<string, TileKind> = {
  '#': 'wall',
  B: 'blackboard',
  W: 'window',
  S: 'shelf',
  D: 'desk',
  T: 'teacher',
  '.': 'floor',
  ' ': 'floor',
  P: 'floor',
  E: 'floor',
  X: 'exit',
  '*': 'floor',
  '1': 'seat',
  '2': 'seat',
  '3': 'seat',
  '4': 'seat',
  '5': 'seat',
};

export interface MapMeta {
  spawn: Vec2;
  exit: Vec2;
  chaser: Vec2;
  seats: Vec2[];
  pickups: Vec2[];
  rows: string[];
}

export interface ParsedMap {
  grid: Grid;
  meta: MapMeta;
}

/** 解析 ASCII 关卡。字符含义见 CHAR_TO_TILE。 */
export function parseMap(rows: string[]): ParsedMap {
  if (rows.length < 5) throw new Error('地图太矮');
  const width = rows[0].length;
  for (let y = 0; y < rows.length; y++) {
    if (rows[y].length !== width) {
      throw new Error(`地图第 ${y} 行宽度 ${rows[y].length}，应为 ${width}`);
    }
  }

  let spawn: Vec2 | null = null;
  let exit: Vec2 | null = null;
  let chaser: Vec2 | null = null;
  const seats: Vec2[] = [];
  const pickups: Vec2[] = [];
  const tiles: TileKind[][] = [];

  for (let y = 0; y < rows.length; y++) {
    const line: TileKind[] = [];
    for (let x = 0; x < width; x++) {
      const ch = rows[y][x];
      const kind = CHAR_TO_TILE[ch];
      if (!kind) throw new Error(`地图字符 "${ch}" 未定义（${x},${y}）`);
      line.push(kind);
      if (ch === 'P') spawn = { x, y };
      if (ch === 'X') exit = { x, y };
      if (ch === 'E') chaser = { x, y };
      if (ch === '*') pickups.push({ x, y });
      if (ch >= '1' && ch <= '5') seats.push({ x, y });
    }
    tiles.push(line);
  }

  if (!spawn) throw new Error('地图缺少玩家出生点 P');
  if (!exit) throw new Error('地图缺少终点 X');
  if (!chaser) throw new Error('地图缺少舞剑同学出生点 E');

  const grid = new Grid(tiles);
  return { grid, meta: { spawn, exit, chaser, seats, pickups, rows: rows.slice() } };
}

export class Grid {
  readonly w: number;
  readonly h: number;
  readonly tiles: TileKind[][];

  constructor(tiles: TileKind[][]) {
    this.h = tiles.length;
    this.w = tiles[0].length;
    this.tiles = tiles;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  tileAt(x: number, y: number): TileKind {
    if (!this.inBounds(x, y)) return 'wall';
    return this.tiles[y][x];
  }

  isBlocked(x: number, y: number): boolean {
    return BLOCKING_KINDS.has(this.tileAt(x, y));
  }

  blocksSight(x: number, y: number): boolean {
    return SIGHT_BLOCKING.has(this.tileAt(x, y));
  }

  isWalkable(x: number, y: number): boolean {
    return this.inBounds(x, y) && !this.isBlocked(x, y);
  }

  isDesk(x: number, y: number): boolean {
    return this.tileAt(x, y) === 'desk';
  }

  neighbors(cell: Vec2): Vec2[] {
    const out: Vec2[] = [];
    for (const dir of DIRS) {
      const d = DIR_VEC[dir];
      const nx = cell.x + d.x;
      const ny = cell.y + d.y;
      if (this.isWalkable(nx, ny)) out.push({ x: nx, y: ny });
    }
    return out;
  }

  /** 从 from 出发的 BFS 步数场（-1 表示不可达）。用于追击者选路。 */
  distanceField(from: Vec2): Int32Array {
    const dist = new Int32Array(this.w * this.h).fill(-1);
    if (!this.isWalkable(from.x, from.y)) return dist;
    const queue: number[] = [from.y * this.w + from.x];
    dist[from.y * this.w + from.x] = 0;
    for (let head = 0; head < queue.length; head++) {
      const idx = queue[head];
      const x = idx % this.w;
      const y = (idx / this.w) | 0;
      const base = dist[idx];
      for (const dir of DIRS) {
        const d = DIR_VEC[dir];
        const nx = x + d.x;
        const ny = y + d.y;
        if (!this.isWalkable(nx, ny)) continue;
        const nIdx = ny * this.w + nx;
        if (dist[nIdx] !== -1) continue;
        dist[nIdx] = base + 1;
        queue.push(nIdx);
      }
    }
    return dist;
  }

  /** 最短路径（不含起点，含终点）。不可达返回 null。 */
  path(from: Vec2, to: Vec2): Vec2[] | null {
    if (from.x === to.x && from.y === to.y) return [];
    if (!this.isWalkable(from.x, from.y) || !this.isWalkable(to.x, to.y)) return null;
    const dist = this.distanceField(from);
    const target = to.y * this.w + to.x;
    if (dist[target] === -1) return null;
    const out: Vec2[] = [];
    let cur: Vec2 = { x: to.x, y: to.y };
    let guard = 0;
    while (!(cur.x === from.x && cur.y === from.y)) {
      out.push(cur);
      let best: Vec2 | null = null;
      let bestDist = dist[cur.y * this.w + cur.x];
      for (const dir of DIRS) {
        const d = DIR_VEC[dir];
        const nx = cur.x + d.x;
        const ny = cur.y + d.y;
        if (!this.isWalkable(nx, ny)) continue;
        const dNext = dist[ny * this.w + nx];
        if (dNext !== -1 && dNext < bestDist) {
          bestDist = dNext;
          best = { x: nx, y: ny };
        }
      }
      if (!best) return null;
      cur = best;
      if (++guard > this.w * this.h) return null;
    }
    return out.reverse();
  }

  /** 同排/同列且中间无遮挡 */
  lineOfSight(a: Vec2, b: Vec2, maxDist: number): boolean {
    if (a.x !== b.x && a.y !== b.y) return false;
    const dist = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    if (dist > maxDist) return false;
    const dx = Math.sign(b.x - a.x);
    const dy = Math.sign(b.y - a.y);
    let cur = { x: a.x + dx, y: a.y + dy };
    while (!(cur.x === b.x && cur.y === b.y)) {
      if (this.blocksSight(cur.x, cur.y)) return false;
      cur = { x: cur.x + dx, y: cur.y + dy };
    }
    return true;
  }

  /** 随机可取步格（可排除若干格子与靠近某目标的范围） */
  randomWalkable(
    rng: Rng,
    filter?: (cell: Vec2) => boolean,
    avoid?: { cell: Vec2; minDistance: number },
  ): Vec2 {
    const candidates: Vec2[] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (!this.isWalkable(x, y)) continue;
        const cell = { x, y };
        if (filter && !filter(cell)) continue;
        if (avoid && chebyshev(cell, avoid.cell) < avoid.minDistance) continue;
        candidates.push(cell);
      }
    }
    if (candidates.length === 0) {
      // 退化：只按可走性取
      for (let y = 0; y < this.h; y++) {
        for (let x = 0; x < this.w; x++) {
          if (this.isWalkable(x, y)) candidates.push({ x, y });
        }
      }
    }
    return rng.pick(candidates);
  }
}
