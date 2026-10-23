import { TILE, Grid, TileKind } from '../core/grid';
import { PALETTE } from '../data/palette';
import { Vec2 } from '../core/math';
import { DecorDef } from '../game/levels';
import { fill, jitter, shadow } from './art';

/**
 * 静态层：地板、墙、黑板、窗、储物柜、课桌、讲台、椅子。
 * 画一次缓存到离屏 canvas，每帧只 drawImage。
 */
export function drawStaticLayer(
  ctx: CanvasRenderingContext2D,
  grid: Grid,
  seats: Vec2[],
  pickups: Vec2[],
  exit: Vec2,
  decor: DecorDef[] = [],
): void {
  const isSeat = (x: number, y: number) => seats.some((s) => s.x === x && s.y === y);
  const isPickup = (x: number, y: number) => pickups.some((p) => p.x === x && p.y === y);
  const isExit = (x: number, y: number) => exit.x === x && exit.y === y;

  // 1) 地板（家具下面也要先铺地板，否则会露出底色）
  for (let y = 0; y < grid.h; y++) {
    for (let x = 0; x < grid.w; x++) {
      const kind = grid.tileAt(x, y);
      if (kind !== 'wall' && kind !== 'blackboard' && kind !== 'window') {
        drawFloorCell(ctx, x * TILE, y * TILE, x, y);
      }
    }
  }

  // 2) 墙上的环境遮蔽影：让墙立起来
  for (let y = 0; y < grid.h; y++) {
    for (let x = 0; x < grid.w; x++) {
      const kind = grid.tileAt(x, y);
      if (kind === 'wall' || kind === 'blackboard' || kind === 'window') continue;
      drawWallOcclusion(ctx, grid, x, y);
    }
  }

  // 3) 墙与墙面装饰
  for (let y = 0; y < grid.h; y++) {
    for (let x = 0; x < grid.w; x++) {
      const kind = grid.tileAt(x, y);
      if (kind === 'wall' || kind === 'blackboard' || kind === 'window') {
        drawWallCell(ctx, grid, x * TILE, y * TILE, x, y);
      }
    }
  }
  drawBlackboardRuns(ctx, grid);
  drawWindowRuns(ctx, grid);

  // 4) 家具
  for (let y = 0; y < grid.h; y++) {
    for (let x = 0; x < grid.w; x++) {
      const kind = grid.tileAt(x, y);
      const px = x * TILE;
      const py = y * TILE;
      if (kind === 'desk') drawDeskCell(ctx, px, py, x, y, isSeat(x, y));
      if (kind === 'shelf') drawLockerCell(ctx, px, py, x, y);
      if (kind === 'teacher') drawTeacherDesk(ctx, px, py);
      if (isSeat(x, y)) drawChair(ctx, px, py);
      if (isPickup(x, y)) drawPickupPad(ctx, px, py);
      if (isExit(x, y)) drawExitFrame(ctx, px, py);
    }
  }

  drawDecor(ctx, decor);

  // 5) 房间外圈压暗，收住画面
  const W = grid.w * TILE;
  const H = grid.h * TILE;
  ctx.save();
  const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(28,18,8,0.18)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* 地板                                                                */
/* ------------------------------------------------------------------ */

function drawFloorCell(ctx: CanvasRenderingContext2D, px: number, py: number, x: number, y: number): void {
  const n = jitter(x * 7 + y * 13, 3);
  fill(ctx, n > 0.5 ? PALETTE.floorA : PALETTE.floorB, px, py, TILE, TILE);

  // 横向木地板：每 12px 一条板缝，奇偶行错位
  const stagger = ((y % 2) * 12 + (x * 5) % 12) % 24;
  for (let i = 0; i < 2; i++) {
    const ly = py + ((stagger + i * 12) % 24);
    fill(ctx, 'rgba(120, 86, 48, 0.22)', px, ly, TILE, 1);
    fill(ctx, 'rgba(242, 218, 178, 0.14)', px, ly + 1, TILE, 1);
  }
  // 竖向板头接缝（每三格一条，避免看起来像瓷砖）
  if ((x * 7 + y * 5) % 3 === 0) {
    const seamX = px + ((x * 13 + y * 7) % 20) + 2;
    fill(ctx, 'rgba(120, 86, 48, 0.14)', seamX, py, 1, TILE);
  }

  // 木纹
  if (n > 0.78) fill(ctx, 'rgba(140, 100, 58, 0.22)', px + 4, py + 7 + Math.floor(n * 8), 7, 1);
  if (n < 0.16) fill(ctx, 'rgba(140, 100, 58, 0.18)', px + 12, py + 4, 5, 1);
  if (n > 0.55 && n < 0.62) fill(ctx, 'rgba(255, 240, 210, 0.1)', px + 8, py + 15, 9, 1);
}

function drawWallOcclusion(ctx: CanvasRenderingContext2D, grid: Grid, x: number, y: number): void {
  const px = x * TILE;
  const py = y * TILE;
  const isWall = (tx: number, ty: number) => {
    const kind = grid.tileAt(tx, ty);
    return kind === 'wall' || kind === 'blackboard' || kind === 'window';
  };
  if (isWall(x, y - 1)) {
    const g = ctx.createLinearGradient(0, py, 0, py + 8);
    g.addColorStop(0, 'rgba(40, 26, 12, 0.34)');
    g.addColorStop(1, 'rgba(40, 26, 12, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(px, py, TILE, 8);
  }
  if (isWall(x, y + 1)) {
    const g = ctx.createLinearGradient(0, py + TILE, 0, py + TILE - 7);
    g.addColorStop(0, 'rgba(40, 26, 12, 0.3)');
    g.addColorStop(1, 'rgba(40, 26, 12, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(px, py + TILE - 7, TILE, 7);
  }
  if (isWall(x - 1, y)) {
    const g = ctx.createLinearGradient(px, 0, px + 7, 0);
    g.addColorStop(0, 'rgba(40, 26, 12, 0.28)');
    g.addColorStop(1, 'rgba(40, 26, 12, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(px, py, 7, TILE);
  }
  if (isWall(x + 1, y)) {
    const g = ctx.createLinearGradient(px + TILE, 0, px + TILE - 7, 0);
    g.addColorStop(0, 'rgba(40, 26, 12, 0.28)');
    g.addColorStop(1, 'rgba(40, 26, 12, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(px + TILE - 7, py, 7, TILE);
  }
}

/* ------------------------------------------------------------------ */
/* 墙                                                                  */
/* ------------------------------------------------------------------ */

function drawWallCell(
  ctx: CanvasRenderingContext2D,
  grid: Grid,
  px: number,
  py: number,
  x: number,
  y: number,
): void {
  const n = jitter(x * 3 + y * 11, 5);
  fill(ctx, PALETTE.wall, px, py, TILE, TILE);
  // 石膏纹理
  if (n > 0.7) fill(ctx, 'rgba(255, 250, 235, 0.28)', px + 5, py + 6, 6, 1);
  if (n < 0.2) fill(ctx, 'rgba(160, 146, 120, 0.22)', px + 9, py + 13, 7, 1);
  fill(ctx, 'rgba(255, 252, 240, 0.35)', px, py, TILE, 1);

  const indoor = (tx: number, ty: number): boolean => {
    if (!grid.inBounds(tx, ty)) return false;
    const kind = grid.tileAt(tx, ty);
    return kind !== 'wall' && kind !== 'blackboard' && kind !== 'window';
  };

  // 踢脚线只画在朝向室内的一侧
  const base = (bx: number, by: number, bw: number, bh: number) => {
    fill(ctx, PALETTE.wallDark, bx, by, bw, bh);
    fill(ctx, PALETTE.wallTrim, bx + (bw < bh ? bw - 2 : 0), by + (bw < bh ? 0 : bh - 2), bw < bh ? 2 : bw, 2);
  };
  if (indoor(x, y + 1)) base(px, py + TILE - 6, TILE, 6);
  else if (indoor(x, y - 1)) base(px, py, TILE, 6);
  else if (indoor(x + 1, y)) base(px + TILE - 6, py, 6, TILE);
  else if (indoor(x - 1, y)) base(px, py, 6, TILE);
  else base(px, py + TILE - 6, TILE, 6);

  // 竖向墙缝（每 4 格一条）
  if ((x + y * 3) % 4 === 0) fill(ctx, 'rgba(150, 134, 108, 0.22)', px, py, 1, TILE - 4);
}

/** 连续黑板：横跨整段黑板格，而不是一格一块 */
function drawBlackboardRuns(ctx: CanvasRenderingContext2D, grid: Grid): void {
  for (let y = 0; y < grid.h; y++) {
    let x = 0;
    while (x < grid.w) {
      if (grid.tileAt(x, y) !== 'blackboard') {
        x++;
        continue;
      }
      let end = x;
      while (end + 1 < grid.w && grid.tileAt(end + 1, y) === 'blackboard') end++;
      const left = x * TILE;
      const width = (end - x + 1) * TILE;
      const top = y * TILE;
      // 木框
      fill(ctx, '#8a5f34', left + 1, top + 4, width - 2, TILE - 9);
      fill(ctx, '#5f3f1f', left + 1, top + TILE - 6, width - 2, 3);
      fill(ctx, '#a97a45', left + 1, top + 4, width - 2, 2);
      // 板面
      fill(ctx, PALETTE.blackboard, left + 3, top + 6, width - 6, TILE - 14);
      fill(ctx, 'rgba(255,255,255,0.03)', left + 3, top + 6, width - 6, 5);
      // 粉笔字迹：一段一段的短横线 + 竖线，像没擦干净的字
      const marks = Math.max(3, Math.floor(width / 26));
      for (let i = 0; i < marks; i++) {
        const mx = left + 8 + i * ((width - 16) / marks);
        const my = top + 9 + Math.round(jitter(i + y, i) * 6);
        const w = 5 + Math.round(jitter(i * 3 + 1, i) * 9);
        fill(ctx, PALETTE.chalk, mx, my, w, 1);
        if (i % 3 === 0) fill(ctx, PALETTE.chalkFaint, mx + 2, my + 3, Math.max(3, w - 4), 1);
        if (i % 4 === 1) fill(ctx, PALETTE.chalk, mx + 3, my, 1, 4);
      }
      // 粉笔槽 + 黑板擦
      fill(ctx, '#c9b48d', left + 2, top + TILE - 7, width - 4, 2);
      fill(ctx, '#4a4f5a', left + width - 26, top + TILE - 9, 10, 4);
      fill(ctx, '#d8d3c4', left + width - 25, top + TILE - 8, 8, 1);
      fill(ctx, '#f2f5ef', left + 12, top + TILE - 9, 4, 1);
      x = end + 1;
    }
  }
}

/** 连续窗户：两格一扇，带窗台与光斑 */
function drawWindowRuns(ctx: CanvasRenderingContext2D, grid: Grid): void {
  for (let y = 0; y < grid.h; y++) {
    let x = 0;
    while (x < grid.w) {
      if (grid.tileAt(x, y) !== 'window') {
        x++;
        continue;
      }
      let end = x;
      while (end + 1 < grid.w && grid.tileAt(end + 1, y) === 'window') end++;
      const left = x * TILE;
      const width = (end - x + 1) * TILE;
      const top = y * TILE;
      // 窗框与玻璃
      fill(ctx, '#a98a5c', left + 1, top + 3, width - 2, TILE - 8);
      fill(ctx, PALETTE.window, left + 3, top + 5, width - 6, TILE - 13);
      const sky = ctx.createLinearGradient(0, top + 5, 0, top + TILE - 8);
      sky.addColorStop(0, '#bfe4f5');
      sky.addColorStop(1, '#8cc4e6');
      ctx.fillStyle = sky;
      ctx.fillRect(left + 3, top + 5, width - 6, TILE - 13);
      // 云和树
      fill(ctx, '#ffffff', left + 6, top + 7, 8, 2);
      fill(ctx, '#3f7a4f', left + width - 14, top + 11, 8, 3);
      // 竖框（每格一根）
      for (let cx = x; cx <= end; cx++) {
        fill(ctx, '#a98a5c', cx * TILE, top + 5, 2, TILE - 13);
      }
      fill(ctx, '#8a6a3d', left, top + TILE - 10, width, 2);
      fill(ctx, '#cbb894', left, top + TILE - 8, width, 2);
      x = end + 1;
    }
  }
}

/* ------------------------------------------------------------------ */
/* 家具                                                                */
/* ------------------------------------------------------------------ */

function drawDeskCell(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  x: number,
  y: number,
  hasSeat: boolean,
): void {
  const n = jitter(x * 3 + y * 5, 7);
  shadow(ctx, px + 12, py + TILE - 2, 11, 2.5, 0.24);

  // 椅子：紧贴桌后，一点椅背露出来
  fill(ctx, '#7a5228', px + 6, py + 16, 12, 2);
  fill(ctx, '#a97440', px + 7, py + 16, 10, 1);
  fill(ctx, '#6f4b26', px + 7, py + 18, 1, 4);
  fill(ctx, '#6f4b26', px + 16, py + 18, 1, 4);
  fill(ctx, '#8a6134', px + 6, py + 21, 13, 1);

  // 桌腿
  fill(ctx, '#6a6f7a', px + 4, py + 14, 2, 7);
  fill(ctx, '#6a6f7a', px + 18, py + 14, 2, 7);
  fill(ctx, '#4c5058', px + 3, py + 20, 4, 1);
  fill(ctx, '#4c5058', px + 17, py + 20, 4, 1);

  // 桌体：桌沿（前立面）+ 桌面 + 高光
  fill(ctx, '#a8743f', px + 2, py + 10, 20, 4);
  fill(ctx, '#8d5f33', px + 2, py + 13, 20, 1);
  fill(ctx, PALETTE.deskTop, px + 2, py + 5, 20, 6);
  fill(ctx, '#ecc287', px + 3, py + 5, 18, 1);
  fill(ctx, 'rgba(255, 246, 220, 0.35)', px + 4, py + 6, 16, 1);
  fill(ctx, 'rgba(126, 84, 40, 0.35)', px + 2, py + 5, 1, 9);
  fill(ctx, 'rgba(126, 84, 40, 0.28)', px + 21, py + 5, 1, 9);

  // 桌面物品
  if (hasSeat) {
    fill(ctx, '#f6eed6', px + 5, py + 7, 8, 4);
    fill(ctx, '#cfc4a8', px + 6, py + 8, 6, 1);
    fill(ctx, '#cfc4a8', px + 6, py + 10, 4, 1);
    fill(ctx, '#e2b25c', px + 14, py + 7, 3, 1);
  } else if (n > 0.66) {
    fill(ctx, n > 0.82 ? PALETTE.bookA : PALETTE.bookB, px + 12, py + 6, 7, 4);
    fill(ctx, '#ffffff', px + 13, py + 7, 5, 1);
    fill(ctx, '#d9d2c0', px + 13, py + 9, 4, 1);
  } else if (n < 0.22) {
    fill(ctx, '#efe6cc', px + 5, py + 7, 9, 3);
    fill(ctx, '#b9ad8f', px + 6, py + 8, 7, 1);
    fill(ctx, '#b9ad8f', px + 6, py + 9, 5, 1);
  } else if (n < 0.45) {
    fill(ctx, '#4c6b8a', px + 6, py + 7, 7, 2);
    fill(ctx, '#2f4a63', px + 6, py + 9, 7, 1);
    fill(ctx, '#e8b74a', px + 13, py + 6, 4, 1);
  } else {
    fill(ctx, 'rgba(190, 150, 90, 0.45)', px + 13, py + 8, 5, 1);
  }
}

function drawChair(ctx: CanvasRenderingContext2D, px: number, py: number): void {
  // 空座位：椅背在北侧，椅子朝南
  shadow(ctx, px + TILE / 2, py + TILE - 4, 8, 2, 0.2);
  fill(ctx, '#6f4b26', px + 5, py + 9, 14, 3);
  fill(ctx, '#96693a', px + 6, py + 9, 12, 1);
  fill(ctx, '#8a6134', px + 6, py + 12, 2, 6);
  fill(ctx, '#8a6134', px + 16, py + 12, 2, 6);
  fill(ctx, '#a97440', px + 5, py + 15, 14, 2);
  fill(ctx, '#c08a52', px + 6, py + 15, 12, 1);
  fill(ctx, '#6f4b26', px + 5, py + 17, 14, 1);
}

function drawLockerCell(ctx: CanvasRenderingContext2D, px: number, py: number, x: number, y: number): void {
  shadow(ctx, px + 12, py + TILE - 1, 10, 2, 0.22);
  fill(ctx, PALETTE.shelfDark, px + 1, py + 1, TILE - 2, TILE - 3);
  fill(ctx, PALETTE.shelf, px + 2, py + 2, TILE - 4, TILE - 5);
  fill(ctx, '#a06a34', px + 3, py + 3, TILE - 6, TILE - 7);
  fill(ctx, 'rgba(255, 236, 200, 0.18)', px + 3, py + 3, TILE - 6, 2);
  fill(ctx, PALETTE.shelfDark, px + TILE / 2, py + 2, 1, TILE - 5);
  fill(ctx, 'rgba(70, 44, 20, 0.5)', px + 2, py + 11, TILE - 4, 1);
  fill(ctx, '#e6c88a', px + 5, py + 8, 1, 3);
  fill(ctx, '#e6c88a', px + 18, py + 8, 1, 3);
  // 柜门上的彩色编号贴
  const label = (x + y) % 4;
  const colors = [PALETTE.bookA, PALETTE.bookB, PALETTE.bookC, PALETTE.bookD];
  fill(ctx, colors[label], px + 4, py + 4, 4, 3);
  fill(ctx, 'rgba(255,255,255,0.6)', px + 5, py + 5, 2, 1);
}

function drawTeacherDesk(ctx: CanvasRenderingContext2D, px: number, py: number): void {
  shadow(ctx, px + 12, py + TILE - 1, 12, 3, 0.26);
  fill(ctx, '#5d3f22', px + 1, py + 13, 22, 9);
  fill(ctx, PALETTE.teacher, px + 1, py + 8, 22, 9);
  fill(ctx, PALETTE.teacherTop, px + 2, py + 6, 20, 4);
  fill(ctx, '#c79a63', px + 2, py + 6, 20, 1);
  fill(ctx, 'rgba(90, 60, 30, 0.4)', px + 1, py + 15, 22, 1);
  // 粉笔盒、教鞭、保温杯
  fill(ctx, '#e8e2d0', px + 14, py + 7, 6, 3);
  fill(ctx, '#b9b3a0', px + 15, py + 8, 4, 1);
  fill(ctx, '#cbb083', px + 3, py + 8, 9, 1);
  fill(ctx, '#4a8f7a', px + 5, py + 9, 3, 3);
  fill(ctx, '#7fc0ad', px + 5, py + 9, 3, 1);
}

function drawPickupPad(ctx: CanvasRenderingContext2D, px: number, py: number): void {
  ctx.save();
  ctx.globalAlpha = 0.45;
  fill(ctx, '#ffe9a8', px + 8, py + 17, 8, 2);
  ctx.restore();
}

function drawExitFrame(ctx: CanvasRenderingContext2D, px: number, py: number): void {
  // 后门：门框 + 地垫
  fill(ctx, '#5a4226', px + 1, py + 1, TILE - 2, TILE - 2);
  fill(ctx, '#8a6a3d', px + 2, py + 2, TILE - 4, TILE - 4);
  fill(ctx, '#6f5330', px + 3, py + 3, TILE - 6, TILE - 6);
  fill(ctx, '#b28f5b', px + 4, py + 4, TILE - 8, 1);
  fill(ctx, '#b28f5b', px + 4, py + 4, 1, TILE - 8);
  fill(ctx, '#3c4a41', px + 5, py + 14, 14, 6);
  fill(ctx, '#51645a', px + 6, py + 15, 12, 4);
  fill(ctx, '#2b352f', px + 5, py + 14, 14, 1);
  fill(ctx, '#2b352f', px + 5, py + 19, 14, 1);
}

/* ------------------------------------------------------------------ */
/* 装饰摆件                                                            */
/* ------------------------------------------------------------------ */

export function drawDecor(ctx: CanvasRenderingContext2D, decor: DecorDef[]): void {
  for (const item of decor) {
    const px = item.cell[0] * TILE;
    const py = item.cell[1] * TILE;
    switch (item.type) {
      case 'clock': {
        const cx = px + TILE / 2;
        const cy = py + TILE / 2;
        ctx.fillStyle = '#f4efe2';
        ctx.beginPath();
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#3a3a3a';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        fill(ctx, '#2b2b2b', cx - 0.5, cy - 4, 1, 4);
        fill(ctx, '#2b2b2b', cx, cy - 0.5, 3, 1);
        fill(ctx, '#c0392b', cx - 0.5, cy, 1, 3);
        break;
      }
      case 'poster':
        fill(ctx, '#f2e8cf', px + 5, py + 4, 14, 15);
        fill(ctx, '#d9c9a3', px + 5, py + 4, 14, 1);
        fill(ctx, '#c0392b', px + 8, py + 7, 8, 2);
        fill(ctx, '#5a7f9c', px + 8, py + 11, 6, 1);
        fill(ctx, '#5a7f9c', px + 8, py + 13, 8, 1);
        fill(ctx, '#7aa05b', px + 8, py + 15, 5, 1);
        break;
      case 'trash':
        shadow(ctx, px + 12, py + 21, 6, 2, 0.22);
        fill(ctx, '#5d6672', px + 7, py + 9, 10, 11);
        fill(ctx, '#78828f', px + 7, py + 9, 10, 2);
        fill(ctx, '#454d57', px + 6, py + 7, 12, 2);
        fill(ctx, '#9aa3ad', px + 9, py + 12, 1, 6);
        fill(ctx, '#9aa3ad', px + 13, py + 12, 1, 6);
        break;
      case 'plant':
        shadow(ctx, px + 12, py + 21, 6, 2, 0.2);
        fill(ctx, '#8b5a2b', px + 8, py + 15, 8, 6);
        fill(ctx, '#a97440', px + 8, py + 15, 8, 1);
        fill(ctx, '#3f7a4f', px + 6, py + 7, 5, 5);
        fill(ctx, '#4f9a63', px + 12, py + 5, 6, 6);
        fill(ctx, '#3f7a4f', px + 9, py + 9, 5, 4);
        fill(ctx, '#67b87c', px + 7, py + 8, 2, 2);
        break;
      default:
        shadow(ctx, px + 12, py + 19, 5, 2, 0.2);
        ctx.fillStyle = '#d9823b';
        ctx.beginPath();
        ctx.arc(px + 12, py + 15, 5, 0, Math.PI * 2);
        ctx.fill();
        fill(ctx, '#8a4a1c', px + 7, py + 14, 10, 1);
        fill(ctx, '#8a4a1c', px + 11, py + 10, 1, 10);
        break;
    }
  }
}

export type { TileKind };
