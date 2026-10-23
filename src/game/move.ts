import { Vec2 } from '../core/math';
import { Move } from './types';

export function startMove(from: Vec2, to: Vec2, durMs: number): Move {
  return {
    from: { x: from.x, y: from.y },
    to: { x: to.x, y: to.y },
    t: 0,
    dur: Math.max(16, durMs) / 1000,
  };
}

/** 推进移动；返回是否已抵达 */
export function advanceMove(move: Move, dt: number): boolean {
  move.t += dt / move.dur;
  if (move.t >= 1) {
    move.t = 1;
    return true;
  }
  return false;
}

/** 补间位置（单位：格） */
export function movePosition(move: Move | null, cell: Vec2): Vec2 {
  if (!move) return { x: cell.x, y: cell.y };
  const t = Math.min(1, Math.max(0, move.t));
  return {
    x: move.from.x + (move.to.x - move.from.x) * t,
    y: move.from.y + (move.to.y - move.from.y) * t,
  };
}

/** 逻辑占位：过半后视为已进入目标格（用于命中/进门判定） */
export function occupiedCell(move: Move | null, cell: Vec2): Vec2 {
  if (move && move.t >= 0.5) return move.to;
  return cell;
}
