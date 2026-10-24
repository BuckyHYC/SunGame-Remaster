import { AudioBus } from '../core/audio';
import { Input } from '../core/input';
import { SaveStore, LevelRecord } from '../core/save';
import { BALANCE } from '../data/balance';
import { LINE_BY_ID } from '../data/lines';
import { createRuntime, stepRuntime } from './runtime';
import { LevelData, validateAllLevels } from './validate';
import { LEVELS } from './levels';
import { FrameCommand, GameMode, Runtime } from './types';
import { Rank, ScoreLine, scoreCampaign, scoreDuel, scoreEndless } from './scoring';
import { evaluateStars } from './stars';
import { setReducedMotion } from './fx';

export type Phase =
  | 'title'
  | 'levels'
  | 'briefing'
  | 'playing'
  | 'paused'
  | 'result'
  | 'collection'
  | 'settings'
  | 'help';

export interface ResultView {
  levelId: string;
  levelName: string;
  mode: GameMode;
  won: boolean;
  score: number;
  rank: Rank;
  breakdown: ScoreLine[];
  timeUsed: number;
  hits: number;
  seated: number;
  /** 无尽模式累计归位人数 */
  seatedTotal: number;
  required: number;
  collected: number;
  newBest: boolean;
  best: LevelRecord | null;
  cause: string;
  endlessSeconds: number | null;
  duelWinner: 'runner' | 'chaser' | null;
  hpLeft: number;
  hasNext: boolean;
  /** 本局达成的星数（仅战役关通关时结算） */
  stars: number;
  starGoals: { text: string; met: boolean }[];
  /** 被温暖了救回来的入伙同学数 */
  cured: number;
  /** 本局累计入伙次数 */
  converted: number;
}

export interface DialogEvent {
  text: string;
  tone: 1 | 2;
  id?: string;
}

/** 会话层：阶段机 + 关卡流程 + 事件（音效/字幕/图鉴）落地 */
export class Session {
  phase: Phase = 'title';
  readonly levels: Map<string, LevelData>;
  run: Runtime | null = null;
  data: LevelData | null = null;
  result: ResultView | null = null;
  dialog: DialogEvent | null = null;
  dialogIndex = 0;
  unlockNotice: { text: string; at: number } | null = null;
  selectedLevelId = 'classroom-1';
  selectedMode: GameMode = 'campaign';
  reducedMotion = false;

  private settled = false;
  private dialogAt = 0;

  constructor(
    readonly save: SaveStore,
    readonly audio: AudioBus,
    readonly input: Input,
  ) {
    this.levels = validateAllLevels();
    this.reducedMotion = save.data.settings.reducedMotion;
    setReducedMotion(this.reducedMotion);
  }

  get currentLevel(): LevelData {
    const data = this.levels.get(this.selectedLevelId);
    if (!data) throw new Error(`关卡不存在：${this.selectedLevelId}`);
    return data;
  }

  get hasRun(): boolean {
    return this.run !== null && this.data !== null;
  }

  startLevel(id: string, mode: GameMode): void {
    const data = this.levels.get(id);
    if (!data) throw new Error(`关卡不存在：${id}`);
    this.selectedLevelId = id;
    this.selectedMode = mode;
    this.input.setMode(mode === 'duel' ? 'duel' : 'solo');
    this.data = data;
    this.run = createRuntime(data, mode, {
      seed: Math.floor(Math.random() * 0xffffffff),
      reducedMotion: this.reducedMotion,
    });
    this.settled = false;
    this.result = null;
    this.dialog = null;
    this.phase = 'playing';
    this.audio.play('bell');
    this.pushDialog({ text: data.def.name + ' · ' + data.def.subtitle, tone: 1 }, 2600);
  }

  restart(): void {
    if (!this.data) return;
    this.startLevel(this.data.def.id, this.selectedMode);
  }

  pause(): void {
    if (this.phase !== 'playing') return;
    this.phase = 'paused';
    this.input.takeActions();
  }

  resume(): void {
    if (this.phase !== 'paused') return;
    this.phase = 'playing';
    this.input.takeActions();
  }

  quitToTitle(): void {
    this.phase = 'title';
    this.run = null;
    this.data = null;
    this.result = null;
    this.dialog = null;
  }

  openLevels(): void {
    this.phase = 'levels';
  }

  openCollection(): void {
    this.phase = 'collection';
  }

  openSettings(): void {
    this.phase = 'settings';
  }

  openHelp(): void {
    this.phase = 'help';
  }

  openBriefing(id: string, mode: GameMode): void {
    const data = this.levels.get(id);
    if (!data) return;
    this.selectedLevelId = id;
    this.selectedMode = mode;
    this.phase = 'briefing';
  }

  backToTitle(): void {
    this.quitToTitle();
  }

  nextLevelId(): string | null {
    const order = LEVELS.map((level) => level.id);
    const idx = order.indexOf(this.selectedLevelId);
    return idx >= 0 && idx + 1 < order.length ? order[idx + 1] : null;
  }

  /** 每帧调用：处理输入、推进逻辑、消费事件 */
  step(dt: number): void {
    const now = performance.now();
    if (this.dialog && now - this.dialogAt > 3200) this.dialog = null;
    if (this.unlockNotice && now - this.unlockNotice.at > 3600) this.unlockNotice = null;

    if (this.phase !== 'playing' || !this.run) {
      return;
    }

    const actions = this.input.takeActions();
    if (actions.includes('pause')) {
      this.pause();
      return;
    }
    if (actions.includes('restart')) {
      this.restart();
      return;
    }

    const cmd: FrameCommand = {
      p1: this.input.dirFor(1, now),
      p2: this.selectedMode === 'duel' ? this.input.dirFor(2, now) : null,
      skill: actions.includes('skill'),
      interact: actions.includes('interact'),
      dash: actions.includes('dash'),
      throw: actions.includes('throw'),
    };

    const stepsBefore = this.run.player.steps;
    const chaserStepsBefore = this.run.chaser.steps;
    stepRuntime(this.run, dt, cmd);

    // 起步即消费按键缓冲：一次按键只走一格。长按由「按住状态」维持，不受影响。
    if (this.run.player.steps !== stepsBefore) this.input.consumeDir(1);
    if (this.run.chaser.steps !== chaserStepsBefore) this.input.consumeDir(2);

    this.drainEvents();

    if (this.run.status !== 'playing') {
      this.settle();
    }
  }

  private drainEvents(): void {
    const rt = this.run;
    if (!rt) return;
    const now = performance.now();

    while (rt.pendingSfx.length > 0) {
      const name = rt.pendingSfx.shift();
      if (!name) break;
      if (name === 'step') this.audio.step(now);
      else this.audio.play(name);
    }

    if (rt.pendingDialogs.length > 0) {
      const msg = rt.pendingDialogs[rt.pendingDialogs.length - 1];
      rt.pendingDialogs.length = 0;
      if (msg) this.pushDialog({ text: msg.text, tone: msg.tone }, 3000);
    }

    while (rt.pendingUnlocks.length > 0) {
      const id = rt.pendingUnlocks.shift();
      if (!id) break;
      if (this.save.unlock(id)) {
        const line = LINE_BY_ID.get(id);
        this.unlockNotice = { text: line ? line.text : '新语录已收录', at: now };
      }
    }
  }

  private pushDialog(event: DialogEvent, duration: number): void {
    this.dialog = event;
    this.dialogAt = performance.now() + duration - 3000;
    this.dialogIndex += 1;
  }

  private settle(): void {
    const rt = this.run;
    const data = this.data;
    if (this.settled || !rt || !data) return;
    this.settled = true;

    const won = rt.status === 'won';
    const timeUsed = Math.min(rt.time, data.def.timeLimit);
    let score: number;
    let rank: Rank;
    let breakdown: ScoreLine[];

    if (this.selectedMode === 'endless') {
      const res = scoreEndless({ seconds: rt.time, seated: rt.seatedTotal });
      score = res.score;
      rank = res.rank;
      breakdown = res.breakdown;
      this.save.recordEndless(rt.time);
    } else if (this.selectedMode === 'duel') {
      const res = scoreDuel({ winner: rt.duelWinner ?? 'chaser', seated: rt.seatedTotal });
      score = res.score;
      rank = res.rank;
      breakdown = res.breakdown;
    } else {
      const res = scoreCampaign({
        timeUsed,
        timeLimit: data.def.timeLimit,
        hits: rt.hits,
        seated: rt.seated,
        pickups: rt.collected,
        missedSkills: rt.missedSkills,
        won,
      });
      score = res.score;
      rank = res.rank;
      breakdown = res.breakdown;
    }

    const recordable = this.selectedMode === 'campaign' && won;
    const starResult = recordable
      ? evaluateStars(rt, data.def)
      : {
          stars: 0,
          goals: (data.def.stars ?? []).map((goal) => ({ text: goal.text, met: false })),
        };
    const newBest = recordable
      ? this.save.recordResult(data.def.id, {
          rank,
          score,
          time: Number(timeUsed.toFixed(1)),
          stars: starResult.stars,
        })
      : false;
    this.save.countPlay(won);

    this.result = {
      levelId: data.def.id,
      levelName: data.def.name,
      mode: this.selectedMode,
      won,
      score,
      rank: won ? rank : 'D',
      breakdown,
      timeUsed,
      hits: rt.hits,
      seated: rt.seated,
      seatedTotal: rt.seatedTotal,
      required: Number.isFinite(rt.requireSeated) ? rt.requireSeated : 0,
      collected: rt.collected,
      newBest,
      best: this.save.bestFor(data.def.id),
      cause: this.causeText(rt, won),
      endlessSeconds: this.selectedMode === 'endless' ? rt.time : null,
      duelWinner: rt.duelWinner,
      hpLeft: rt.player.hp,
      hasNext: this.selectedMode === 'campaign' && won && this.nextLevelId() !== null,
      stars: starResult.stars,
      starGoals: starResult.goals,
      cured: rt.cured,
      converted: rt.convertedTotal,
    };
    this.phase = 'result';
  }

  private causeText(rt: Runtime, won: boolean): string {
    if (this.selectedMode === 'duel') {
      return rt.duelWinner === 'runner' ? '孙巨撑满了 60 秒' : '舞剑同学砍空了孙巨的暖意';
    }
    if (this.selectedMode === 'endless') {
      return `坚持了 ${rt.time.toFixed(1)} 秒`;
    }
    if (won) return '恭喜你成功通关！';
    if (rt.loseReason === 'time') return '时间到！游戏失败';
    return '舞剑的同学击败了你！';
  }

  setSfx(on: boolean): void {
    this.save.setSfx(on);
    this.audio.enabled = on;
  }

  setReducedMotion(on: boolean): void {
    this.save.setReducedMotion(on);
    this.reducedMotion = on;
    setReducedMotion(on);
  }

  resetSave(): void {
    this.save.reset();
    this.setSfx(true);
    setReducedMotion(false);
    this.reducedMotion = false;
  }

  /** HUD 需要的派生数据 */
  hudState(): {
    levelName: string;
    levelIndex: number;
    hp: number;
    maxHp: number;
    warmth: number;
    maxWarmth: number;
    timeText: string;
    timeRatio: number;
    timeLow: boolean;
    seated: number;
    seatedTotal: number;
    score: number;
    required: number;
    exitOpen: boolean;
    mode: GameMode;
    /** 粉笔头：本关没有粉笔头时为 false */
    hasChalk: boolean;
    chalkAmmo: number;
    /** 钥匙：'none' 本关不需要，'held' 已拿到，'missing' 还没拿 */
    keyState: 'none' | 'held' | 'missing';
    converted: number;
  } | null {
    const rt = this.run;
    if (!rt) return null;
    const finite = Number.isFinite(rt.timeLimit);
    const ratio = finite ? Math.max(0, Math.min(1, rt.timeLeft / rt.timeLimit)) : 1;
    const timeText =
      this.selectedMode === 'endless'
        ? `${rt.time.toFixed(1)}s`
        : `${Math.max(0, Math.ceil(rt.timeLeft))}s`;
    return {
      levelName: rt.def.name,
      levelIndex: rt.def.index,
      hp: rt.player.hp,
      maxHp: rt.player.maxHp,
      warmth: rt.warmth,
      maxWarmth: BALANCE.skill.maxWarmth,
      timeText,
      timeRatio: ratio,
      timeLow: finite && rt.timeLeft <= 15,
      seated: rt.seated,
      seatedTotal: rt.seatedTotal,
      score: scoreEndless({ seconds: rt.time, seated: rt.seatedTotal }).score,
      required: Number.isFinite(rt.requireSeated) ? rt.requireSeated : 0,
      exitOpen: rt.exitOpen,
      mode: this.selectedMode,
      hasChalk: rt.chalkDrops.length > 0,
      chalkAmmo: rt.player.chalk,
      keyState: rt.keyCell ? (rt.hasKey ? 'held' : 'missing') : 'none',
      converted: rt.mates.filter((m) => m.state === 'converted').length,
    };
  }
}
