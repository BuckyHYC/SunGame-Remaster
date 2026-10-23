import { describe, expect, it } from 'vitest';
import { scoreCampaign, scoreDuel, scoreEndless, rankForScore } from '../src/game/scoring';

describe('战役评分', () => {
  it('又快又稳的通关是 S', () => {
    const res = scoreCampaign({
      timeUsed: 25,
      timeLimit: 75,
      hits: 0,
      seated: 3,
      pickups: 2,
      missedSkills: 0,
      won: true,
    });
    expect(res.score).toBe(1000);
    expect(res.rank).toBe('S');
    expect(res.breakdown.some((b) => b.label.includes('通关奖励'))).toBe(true);
  });

  it('磨蹭 + 挨打会掉到 B/C', () => {
    const res = scoreCampaign({
      timeUsed: 70,
      timeLimit: 75,
      hits: 2,
      seated: 3,
      pickups: 0,
      missedSkills: 2,
      won: true,
    });
    expect(res.score).toBeLessThan(700);
    expect(['B', 'C']).toContain(res.rank);
  });

  it('未通关只结算进度，且不给速度分', () => {
    const res = scoreCampaign({
      timeUsed: 74,
      timeLimit: 75,
      hits: 1,
      seated: 2,
      pickups: 1,
      missedSkills: 1,
      won: false,
    });
    expect(res.rank).toBe('D');
    expect(res.score).toBeLessThanOrEqual(300);
    expect(res.breakdown.some((b) => b.label.includes('剩余时间'))).toBe(false);
  });

  it('分数下限为 0', () => {
    const res = scoreCampaign({
      timeUsed: 75,
      timeLimit: 75,
      hits: 9,
      seated: 0,
      pickups: 0,
      missedSkills: 9,
      won: true,
    });
    expect(res.score).toBe(0);
  });

  it('评级阈值单调', () => {
    expect(rankForScore(1000)).toBe('S');
    expect(rankForScore(930)).toBe('S');
    expect(rankForScore(850)).toBe('A');
    expect(rankForScore(750)).toBe('B');
    expect(rankForScore(600)).toBe('C');
    expect(rankForScore(10)).toBe('D');
  });
});

describe('无尽与双人评分', () => {
  it('无尽按秒数给分与评级', () => {
    expect(scoreEndless(160).rank).toBe('S');
    expect(scoreEndless(110).rank).toBe('A');
    expect(scoreEndless(80).rank).toBe('B');
    expect(scoreEndless(50).rank).toBe('C');
    expect(scoreEndless(10).rank).toBe('D');
    expect(scoreEndless(100).score).toBe(1000);
  });

  it('双人：跑掉的一方分更高，越快越高', () => {
    const fast = scoreDuel({ winner: 'runner', time: 40, hpLeft: 3 });
    const slow = scoreDuel({ winner: 'runner', time: 59, hpLeft: 1 });
    expect(fast.score).toBeGreaterThan(slow.score);
    expect(scoreDuel({ winner: 'chaser', time: 20, hpLeft: 0 }).score).toBeGreaterThan(600);
  });
});
