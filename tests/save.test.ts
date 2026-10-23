import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SaveStore } from '../src/core/save';

const memory = new Map<string, string>();

function installWindow(): void {
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    },
  });
}

beforeEach(() => {
  memory.clear();
  installWindow();
});

describe('存档', () => {
  it('新档是空的', () => {
    const save = new SaveStore();
    expect(save.data.version).toBe(1);
    expect(Object.keys(save.data.best)).toHaveLength(0);
    expect(save.data.settings.sfx).toBe(true);
    expect(save.persistent).toBe(true);
  });

  it('记录结果并区分是否刷新纪录', () => {
    const save = new SaveStore();
    expect(save.recordResult('classroom-1', { rank: 'B', score: 700, time: 50 })).toBe(true);
    expect(save.recordResult('classroom-1', { rank: 'C', score: 600, time: 40 })).toBe(false);
    expect(save.recordResult('classroom-1', { rank: 'S', score: 980, time: 30 })).toBe(true);
    expect(save.bestFor('classroom-1')?.rank).toBe('S');
  });

  it('同分时用时更短才算更好', () => {
    const save = new SaveStore();
    save.recordResult('classroom-2', { rank: 'A', score: 900, time: 50 });
    expect(save.recordResult('classroom-2', { rank: 'A', score: 900, time: 60 })).toBe(false);
    expect(save.recordResult('classroom-2', { rank: 'A', score: 900, time: 45 })).toBe(true);
  });

  it('语录解锁去重', () => {
    const save = new SaveStore();
    expect(save.unlock('hy-01')).toBe(true);
    expect(save.unlock('hy-01')).toBe(false);
    expect(save.hasLine('hy-01')).toBe(true);
    expect(save.hasLine('hy-02')).toBe(false);
  });

  it('无尽最佳只增不减', () => {
    const save = new SaveStore();
    expect(save.recordEndless(30)).toBe(true);
    expect(save.recordEndless(20)).toBe(false);
    expect(save.data.stats.bestEndless).toBe(30);
  });

  it('损坏的存档回落到空档，不抛异常', () => {
    memory.set('sungame.remaster.save.v1', '{ not json');
    const save = new SaveStore();
    expect(save.data.stats.plays).toBe(0);
  });

  it('版本不符的存档被丢弃', () => {
    memory.set('sungame.remaster.save.v1', JSON.stringify({ version: 99, stats: { plays: 7 } }));
    const save = new SaveStore();
    expect(save.data.stats.plays).toBe(0);
  });

  it('localStorage 不可用时降级为内存存档', () => {
    vi.stubGlobal('window', {
      get localStorage(): never {
        throw new Error('blocked');
      },
    });
    const save = new SaveStore();
    expect(save.persistent).toBe(false);
    expect(() => save.recordResult('classroom-1', { rank: 'S', score: 1000, time: 20 })).not.toThrow();
    expect(save.bestFor('classroom-1')?.rank).toBe('S');
  });
});
