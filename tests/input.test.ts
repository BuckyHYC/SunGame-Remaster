import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioBus } from '../src/core/audio';
import { Input } from '../src/core/input';
import { SaveStore } from '../src/core/save';
import { Session } from '../src/game/session';

/**
 * 回归测试：快速点一次方向键只能走一格。
 * 之前的 bug 是「按键缓冲只读不消费」，松手后 160ms 内同一次按键会被第二步复用。
 */

const listeners = new Map<string, (event: unknown) => void>();
const storage = new Map<string, string>();

function installWindow(): void {
  listeners.clear();
  vi.stubGlobal('window', {
    addEventListener: (type: string, fn: (event: unknown) => void) => listeners.set(type, fn),
    removeEventListener: (type: string) => listeners.delete(type),
    matchMedia: () => ({ matches: false }),
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });
}

function key(type: 'keydown' | 'keyup', k: string): void {
  const fn = listeners.get(type);
  if (!fn) throw new Error(`没有注册 ${type} 监听`);
  fn({ key: k, repeat: false, preventDefault: () => {} });
}

describe('输入：一次按键一步', () => {
  let clock = 0;

  beforeEach(() => {
    installWindow();
    storage.clear();
    clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
  });

  function boot() {
    const input = new Input();
    input.attach();
    const session = new Session(new SaveStore(), new AudioBus(), input);
    session.startLevel('duel', 'duel');
    return { input, session };
  }

  function run(session: Session, seconds: number, onFrame?: (i: number) => void): void {
    const dt = 1 / 60;
    const frames = Math.round(seconds / dt);
    for (let i = 0; i < frames; i++) {
      clock += dt * 1000;
      onFrame?.(i);
      session.step(dt);
    }
  }

  it('轻点一次只走一格', () => {
    const { session } = boot();
    const start = { ...session.run!.player.cell };

    key('keydown', 'ArrowRight');
    run(session, 0.06);
    key('keyup', 'ArrowRight');
    run(session, 0.94);

    expect(session.run!.player.cell.x).toBe(start.x + 1);
    expect(session.run!.player.cell.y).toBe(start.y);
    expect(session.run!.player.steps).toBe(1);
  });

  it('一直按着会持续走', () => {
    const { session } = boot();
    const start = { ...session.run!.player.cell };

    key('keydown', 'ArrowRight');
    run(session, 1.0);
    key('keyup', 'ArrowRight');

    expect(session.run!.player.steps).toBeGreaterThanOrEqual(3);
    expect(session.run!.player.cell.x).toBeGreaterThan(start.x + 2);
  });

  it('走路中途补一次按键，最多多走一格', () => {
    const { session } = boot();

    key('keydown', 'ArrowRight');
    run(session, 0.05);
    key('keyup', 'ArrowRight');
    run(session, 0.02);
    key('keydown', 'ArrowRight'); // 第一格还没走完时补按
    run(session, 0.04);
    key('keyup', 'ArrowRight');
    run(session, 0.89);

    expect(session.run!.player.steps).toBe(2);
  });
});
