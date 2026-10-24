import { Dir } from './math';

export type Action =
  | 'skill'
  | 'interact'
  | 'dash'
  | 'throw'
  | 'pause'
  | 'confirm'
  | 'cancel'
  | 'restart';

interface KeyMap {
  dir: Dir;
  player: 1 | 2;
}

const KEY_TABLE: Record<string, KeyMap> = {
  arrowup: { dir: 'up', player: 1 },
  arrowdown: { dir: 'down', player: 1 },
  arrowleft: { dir: 'left', player: 1 },
  arrowright: { dir: 'right', player: 1 },
  w: { dir: 'up', player: 2 },
  s: { dir: 'down', player: 2 },
  a: { dir: 'left', player: 2 },
  d: { dir: 'right', player: 2 },
};

const ACTION_TABLE: Record<string, Action> = {
  ' ': 'skill',
  spacebar: 'skill',
  e: 'interact',
  q: 'throw',
  shift: 'dash',
  escape: 'pause',
  p: 'pause',
  r: 'restart',
  enter: 'confirm',
  backspace: 'cancel',
};

const BUFFER_MS = 160;

export type ControlMode = 'solo' | 'duel';

/**
 * 键盘输入层：方向键 + WASD 双通道，带"松开后仍有 160ms 缓冲"的输入宽容度。
 * solo 模式下两套方向键都归 P1；duel 模式下方向键归 P1，WASD 归 P2。
 */
export class Input {
  private readonly held = new Map<string, number>();
  private readonly pressOrder = new Map<string, number>();
  private buffer: { player: 1 | 2; dir: Dir; at: number }[] = [];
  private actions: { action: Action; at: number }[] = [];
  private seq = 0;
  private mode: ControlMode = 'solo';
  private bound = false;
  private virtualHeld: Dir[] = [];

  setMode(mode: ControlMode): void {
    this.mode = mode;
    this.clear();
  }

  attach(): void {
    if (this.bound) return;
    this.bound = true;
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clear);
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.clear);
    this.bound = false;
  }

  private normalize(e: KeyboardEvent): string {
    const key = e.key.toLowerCase();
    if (key === ' ' || key === 'spacebar') return ' ';
    return key;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const code = this.normalize(e);
    const map = KEY_TABLE[code];
    const action = ACTION_TABLE[code];
    if (map) {
      e.preventDefault();
      const player = this.mode === 'solo' ? 1 : map.player;
      const id = `${player}:${map.dir}`;
      if (!this.held.has(id)) {
        this.held.set(id, performance.now());
        this.pressOrder.set(id, ++this.seq);
        this.buffer = this.buffer.filter((b) => b.player !== player || b.dir !== map.dir);
        this.buffer.push({ player, dir: map.dir, at: performance.now() });
      }
    }
    if (action) {
      if (e.repeat) return;
      if (code !== 'r' && code !== 'enter' && code !== 'backspace') e.preventDefault();
      this.actions.push({ action, at: performance.now() });
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const code = this.normalize(e);
    const map = KEY_TABLE[code];
    if (!map) return;
    const player = this.mode === 'solo' ? 1 : map.player;
    this.held.delete(`${player}:${map.dir}`);
  };

  clear = (): void => {
    this.held.clear();
    this.pressOrder.clear();
    this.buffer = [];
    this.virtualHeld = [];
  };

  /** 虚拟摇杆（触屏）：按住持续移动 */
  setVirtual(dir: Dir, down: boolean): void {
    if (down) {
      if (!this.virtualHeld.includes(dir)) this.virtualHeld.push(dir);
      this.buffer.push({ player: 1, dir, at: performance.now() });
    } else {
      this.virtualHeld = this.virtualHeld.filter((d) => d !== dir);
    }
  }

  /** 虚拟按键（触屏）：喊人 / 温暖了 */
  tap(action: Action): void {
    this.actions.push({ action, at: performance.now() });
  }

  /** 该玩家当前生效方向；松开后 160ms 内的输入仍算有效 */
  dirFor(player: 1 | 2, now: number): Dir | null {
    if (player === 1 && this.virtualHeld.length > 0) {
      return this.virtualHeld[this.virtualHeld.length - 1];
    }
    let best: { dir: Dir; order: number } | null = null;
    for (const [id, order] of this.pressOrder) {
      if (!this.held.has(id)) continue;
      const [owner, dir] = id.split(':');
      if (Number(owner) !== player) continue;
      if (!best || order > best.order) best = { dir: dir as Dir, order };
    }
    if (best) return best.dir;
    for (let i = this.buffer.length - 1; i >= 0; i--) {
      const b = this.buffer[i];
      if (b.player === player && now - b.at <= BUFFER_MS) return b.dir;
    }
    return null;
  }

  consumeDir(player: 1 | 2): void {
    this.buffer = this.buffer.filter((b) => b.player !== player);
  }

  takeActions(): Action[] {
    const out = this.actions.map((a) => a.action);
    this.actions = [];
    return out;
  }
}
