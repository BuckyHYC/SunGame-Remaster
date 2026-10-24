import { Rank } from '../game/scoring';

export interface LevelRecord {
  rank: Rank;
  score: number;
  time: number;
  /** 三星目标的最高达成数（0..3），旧档没有这个字段时按 0 处理 */
  stars: number;
  at: number;
}

export interface SaveData {
  version: 1;
  best: Record<string, LevelRecord>;
  collection: string[];
  settings: {
    sfx: boolean;
    reducedMotion: boolean;
  };
  stats: {
    plays: number;
    wins: number;
    bestEndless: number;
  };
}

const STORAGE_KEY = 'sungame.remaster.save.v1';

function emptySave(): SaveData {
  return {
    version: 1,
    best: {},
    collection: [],
    settings: { sfx: true, reducedMotion: false },
    stats: { plays: 0, wins: 0, bestEndless: 0 },
  };
}

function isRank(v: unknown): v is Rank {
  return v === 'S' || v === 'A' || v === 'B' || v === 'C' || v === 'D';
}

/** 存档：localStorage 不可用（隐私模式/被禁用）时自动退回内存，游戏照常能玩 */
export class SaveStore {
  data: SaveData;
  readonly persistent: boolean;

  constructor(private readonly key = STORAGE_KEY) {
    this.data = emptySave();
    let ok = false;
    try {
      const raw = window.localStorage.getItem(this.key);
      if (raw) this.data = this.migrate(JSON.parse(raw));
      ok = true;
    } catch {
      ok = false;
    }
    this.persistent = ok;
  }

  private migrate(raw: unknown): SaveData {
    const base = emptySave();
    if (!raw || typeof raw !== 'object') return base;
    const obj = raw as Partial<SaveData>;
    if (obj.version !== 1) return base;
    const best: Record<string, LevelRecord> = {};
    for (const [k, v] of Object.entries(obj.best ?? {})) {
      if (!v || typeof v !== 'object') continue;
      const rec = v as Partial<LevelRecord>;
      if (!isRank(rec.rank) || typeof rec.score !== 'number') continue;
      best[k] = {
        rank: rec.rank,
        score: rec.score,
        time: Number(rec.time ?? 0),
        stars: Math.max(0, Math.min(3, Number(rec.stars ?? 0))),
        at: Number(rec.at ?? 0),
      };
    }
    return {
      version: 1,
      best,
      collection: Array.isArray(obj.collection) ? obj.collection.filter((x) => typeof x === 'string') : [],
      settings: {
        sfx: obj.settings?.sfx !== false,
        reducedMotion: obj.settings?.reducedMotion === true,
      },
      stats: {
        plays: Number(obj.stats?.plays ?? 0),
        wins: Number(obj.stats?.wins ?? 0),
        bestEndless: Number(obj.stats?.bestEndless ?? 0),
      },
    };
  }

  private write(): void {
    if (!this.persistent) return;
    try {
      window.localStorage.setItem(this.key, JSON.stringify(this.data));
    } catch {
      /* 配额满或被禁用：静默降级 */
    }
  }

  bestFor(levelId: string): LevelRecord | null {
    return this.data.best[levelId] ?? null;
  }

  /** 返回是否刷新了最佳成绩（星星单独取历史最大值，即使这次分数没破纪录也会留存） */
  recordResult(
    levelId: string,
    rec: Omit<LevelRecord, 'at' | 'stars'> & { stars?: number },
  ): boolean {
    const prev = this.data.best[levelId];
    const stars = Math.max(prev?.stars ?? 0, rec.stars ?? 0);
    const isBetter =
      !prev || rec.score > prev.score || (rec.score === prev.score && rec.time < prev.time);
    if (isBetter) {
      this.data.best[levelId] = { ...rec, stars, at: Date.now() };
      this.write();
      return true;
    }
    if (prev && stars > prev.stars) {
      this.data.best[levelId] = { ...prev, stars };
      this.write();
    }
    return false;
  }

  countPlay(win: boolean): void {
    this.data.stats.plays += 1;
    if (win) this.data.stats.wins += 1;
    this.write();
  }

  recordEndless(seconds: number): boolean {
    if (seconds > this.data.stats.bestEndless) {
      this.data.stats.bestEndless = Math.floor(seconds);
      this.write();
      return true;
    }
    return false;
  }

  unlock(lineId: string): boolean {
    if (this.data.collection.includes(lineId)) return false;
    this.data.collection.push(lineId);
    this.write();
    return true;
  }

  hasLine(lineId: string): boolean {
    return this.data.collection.includes(lineId);
  }

  setSfx(on: boolean): void {
    this.data.settings.sfx = on;
    this.write();
  }

  setReducedMotion(on: boolean): void {
    this.data.settings.reducedMotion = on;
    this.write();
  }

  reset(): void {
    this.data = emptySave();
    this.write();
  }
}
