import { ALL_LINES, HY_LINES } from '../data/lines';
import { LEVELS, ENDLESS_LEVEL, DUEL_LEVEL } from '../game/levels';
import { Phase, ResultView, Session } from '../game/session';
import { Rank } from '../game/scoring';
import { SaveStore } from '../core/save';

export interface UIHandlers {
  campaign(): void;
  duel(): void;
  endless(): void;
  selectLevel(id: string): void;
  begin(): void;
  resume(): void;
  restart(): void;
  quit(): void;
  collection(): void;
  settings(): void;
  help(): void;
  back(): void;
  nextLevel(): void;
  toggleSfx(on: boolean): void;
  toggleMotion(on: boolean): void;
  resetSave(): void;
  click(): void;
  touchDir(dir: 'up' | 'down' | 'left' | 'right', down: boolean): void;
  touchAction(action: 'skill' | 'interact'): void;
}

const RANK_LABEL: Record<Rank, string> = { S: 'S', A: 'A', B: 'B', C: 'C', D: 'D' };

const TAG_LABEL: Record<string, string> = {
  hy: 'hy',
  chaser: '舞剑',
  warm: '温暖',
  system: '系统',
  lose: '失败',
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 全部 DOM 界面：HUD、字幕、标题/关卡/简报/暂停/结算/图鉴/设置/说明 */
export class UI {
  private readonly hud: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly dialog: HTMLElement;
  private readonly footer: HTMLElement;
  private readonly touch: HTMLElement;
  private readonly refs: Record<string, HTMLElement> = {};
  private hearts: HTMLElement[] = [];
  private lastPhase: Phase | null = null;
  private lastDialogKey = '';
  private lastHud = '';

  constructor(
    private readonly handlers: UIHandlers,
    private readonly save: SaveStore,
  ) {
    this.hud = document.getElementById('hud') as HTMLElement;
    this.overlay = document.getElementById('overlay') as HTMLElement;
    this.dialog = document.getElementById('dialog') as HTMLElement;
    this.footer = document.getElementById('footer') as HTMLElement;
    this.touch = document.getElementById('touch') as HTMLElement;
    this.buildHud();
    this.buildFooter();
    this.bindOverlay();
    this.bindTouch();
  }

  private buildHud(): void {
    this.hud.innerHTML = `
      <div class="hud__group">
        <span class="hud__level" data-el="level">—</span>
      </div>
      <div class="hud__group">
        <span class="hud__label">暖意</span>
        <div class="hearts" data-el="hearts"></div>
      </div>
      <div class="hud__group" title="温暖值：用一次「温暖了」要花 35">
        <span class="hud__label">温暖</span>
        <div class="meter"><i class="meter__fill" data-el="warmFill"></i><i class="meter__tick"></i></div>
        <span class="hud__value" data-el="warmText">0</span>
      </div>
      <div class="hud__spacer"></div>
      <span class="obj" data-el="obj">—</span>
      <div class="hud__group">
        <span class="hud__label">时间</span>
        <div class="meter meter--time" data-el="timeMeter"><i class="meter__fill" data-el="timeFill"></i><i class="meter__tick"></i></div>
        <span class="hud__value" data-el="timeText">—</span>
      </div>
      <div class="hud__group">
        <span class="skill-chip" data-el="skill"><kbd>空格</kbd>温暖了</span>
      </div>
    `;
    for (const el of Array.from(this.hud.querySelectorAll<HTMLElement>('[data-el]'))) {
      if (el.dataset.el) this.refs[el.dataset.el] = el;
    }
    for (let i = 0; i < 3; i++) {
      const heart = document.createElement('span');
      heart.className = 'heart';
      this.refs.hearts?.appendChild(heart);
      this.hearts.push(heart);
    }
  }

  private buildFooter(): void {
    this.footer.innerHTML = `
      <span>方向键 / WASD 移动 · <b>E</b> 喊同学回座位 · <b>空格</b> 温暖了 · <b>Shift</b> 冲刺 · <b>Esc</b> 暂停</span>
      <span>Remaster of <a href="https://github.com/BuckyHYC/SunGame" target="_blank" rel="noreferrer">孙巨的教室冒险（原版）</a></span>
    `;
  }

  private bindOverlay(): void {
    this.overlay.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (!target) return;
      const act = target.dataset.act;
      if (!act) return;
      this.handlers.click();
      switch (act) {
        case 'campaign':
          this.handlers.campaign();
          break;
        case 'duel':
          this.handlers.duel();
          break;
        case 'endless':
          this.handlers.endless();
          break;
        case 'level':
          if (target.dataset.id) this.handlers.selectLevel(target.dataset.id);
          break;
        case 'begin':
          this.handlers.begin();
          break;
        case 'resume':
          this.handlers.resume();
          break;
        case 'restart':
          this.handlers.restart();
          break;
        case 'quit':
          this.handlers.quit();
          break;
        case 'collection':
          this.handlers.collection();
          break;
        case 'settings':
          this.handlers.settings();
          break;
        case 'help':
          this.handlers.help();
          break;
        case 'back':
          this.handlers.back();
          break;
        case 'next':
          this.handlers.nextLevel();
          break;
        case 'toggleSfx':
          this.handlers.toggleSfx(target.dataset.on !== 'true');
          break;
        case 'toggleMotion':
          this.handlers.toggleMotion(target.dataset.on !== 'true');
          break;
        case 'resetSave':
          this.handlers.resetSave();
          break;
        default:
          break;
      }
    });
  }

  private bindTouch(): void {
    if (!this.touch) return;
    const dirs: Array<{ key: 'up' | 'down' | 'left' | 'right' }> = [
      { key: 'up' },
      { key: 'down' },
      { key: 'left' },
      { key: 'right' },
    ];
    for (const dir of dirs) {
      const btn = this.touch.querySelector<HTMLElement>(`[data-dir="${dir.key}"]`);
      if (!btn) continue;
      const down = (e: Event) => {
        e.preventDefault();
        this.handlers.touchDir(dir.key, true);
      };
      const up = (e: Event) => {
        e.preventDefault();
        this.handlers.touchDir(dir.key, false);
      };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('pointerleave', up);
    }
    for (const action of ['skill', 'interact'] as const) {
      const btn = this.touch.querySelector<HTMLElement>(`[data-touch="${action}"]`);
      if (!btn) continue;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.handlers.touchAction(action);
      });
    }
  }

  setTouchVisible(visible: boolean): void {
    if (!this.touch) return;
    const touchDevice =
      window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.touch.style.display = visible && touchDevice ? 'flex' : 'none';
  }

  /** 设置类操作后强制重画覆盖层 */
  refresh(session: Session): void {
    this.renderOverlay(session);
    this.lastPhase = session.phase;
    this.syncHud(session);
  }

  update(session: Session): void {
    const active = session.phase === 'playing' || session.phase === 'paused' || session.phase === 'result';
    if (this.hud.style.display !== (active ? 'flex' : 'none')) {
      this.hud.style.display = active ? 'flex' : 'none';
    }
    this.syncHud(session);
    this.syncDialog(session);
    this.syncFlash(session);
    if (session.phase !== this.lastPhase) {
      this.lastPhase = session.phase;
      this.renderOverlay(session);
    }
  }

  /** 「温暖了」/命中时的整屏闪光（比 canvas 内闪光多覆盖 HUD 区域） */
  private syncFlash(session: Session): void {
    const flash = document.getElementById('flash');
    if (!flash) return;
    const rt = session.run;
    const value = rt && session.phase !== 'result' ? Math.min(0.5, rt.warmPulse * 0.4) : 0;
    const text = value > 0.02 ? value.toFixed(2) : '0';
    if (flash.style.opacity !== text) flash.style.opacity = text;
  }

  private syncHud(session: Session): void {
    const hud = session.hudState();
    if (!hud) {
      if (this.lastHud !== 'none') {
        this.refs.level.textContent = '—';
        this.refs.obj.textContent = '选择关卡开始';
        this.refs.warmText.textContent = '—';
        this.refs.timeText.textContent = '—';
        this.refs.warmFill.style.width = '0%';
        this.refs.timeFill.style.width = '0%';
        this.refs.skill.classList.remove('is-ready');
        this.lastHud = 'none';
      }
      return;
    }

    const levelText =
      hud.mode === 'endless'
        ? `${hud.levelName}<small>无尽</small>`
        : hud.mode === 'duel'
          ? `${hud.levelName}<small>双人</small>`
          : `${hud.levelName}<small>第 ${hud.levelIndex + 1} 关</small>`;
    if (this.refs.level.innerHTML !== levelText) this.refs.level.innerHTML = levelText;

    const hp = Math.max(0, hud.hp);
    this.hearts.forEach((heart, index) => {
      heart.classList.toggle('is-lost', index >= hp);
    });

    const warmPct = Math.round((hud.warmth / hud.maxWarmth) * 100);
    this.refs.warmFill.style.width = `${warmPct}%`;
    this.refs.warmText.textContent = String(Math.floor(hud.warmth));
    this.refs.warmText.classList.toggle('is-low', hud.warmth < 35);

    this.refs.timeFill.style.width = `${Math.round(hud.timeRatio * 100)}%`;
    this.refs.timeText.textContent = hud.timeText;
    this.refs.timeText.classList.toggle('is-low', hud.timeLow);
    this.refs.timeMeter.classList.toggle('is-low', hud.timeLow);

    const skillReady = hud.warmth >= 35;
    this.refs.skill.classList.toggle('is-ready', skillReady);

    let obj: string;
    if (hud.mode === 'endless') {
      obj = `归位 ${hud.seatedTotal} 人 · ${hud.score} 分`;
    } else if (hud.mode === 'duel') {
      obj = '撑满 60 秒';
    } else if (hud.exitOpen) {
      obj = '后门已开，快跑！';
    } else {
      obj = `喊回座位 ${hud.seated}/${hud.required}`;
    }
    if (this.refs.obj.textContent !== obj) this.refs.obj.textContent = obj;
    this.refs.obj.classList.toggle('is-done', hud.mode === 'campaign' && hud.exitOpen);

    this.lastHud = levelText + obj;
  }

  private syncDialog(session: Session): void {
    const dialog = session.dialog;
    const notice = session.unlockNotice;
    const idle: Record<string, string> = {
      title: '教室里的课桌排成迷宫，舞剑的同学已经站起来了。',
      levels: '选一关开始。每关都要先把同学喊回座位。',
      briefing: session.currentLevel.def.hint,
      collection: 'hy 的语录都收在这里，教室里的彩蛋能翻出更多。',
      settings: '音效与动效都在这里调。',
      help: '方向键移动，E 喊人，空格温暖了，Shift 冲刺。',
      paused: '暂停中，按「继续」回到教室。',
      result: '这一关结束了，可以再来一次。',
    };
    const text = dialog ? dialog.text : (idle[session.phase] ?? '上课铃响了。方向键移动，E 喊同学回座位。');
    const key = `${text}|${dialog?.tone ?? 0}|${notice?.text ?? ''}`;
    if (key === this.lastDialogKey) return;
    this.lastDialogKey = key;

    const speaker = notice ? '语录收录' : dialog ? (dialog.tone === 2 ? '教室广播' : '同学') : '提示';
    const warn = /击败|失败|砍|时间到|输/.test(text);
    this.dialog.className = `dialog${dialog?.tone === 2 ? (warn ? ' is-warn' : ' is-hot') : ''}`;
    this.dialog.innerHTML = `<span class="dialog__speaker">${escapeHtml(speaker)}</span><span class="dialog__text">${escapeHtml(
      notice ? `${notice.text} —— 已收入班级语录` : text,
    )}</span>`;
  }

  private renderOverlay(session: Session): void {
    const html = this.screenFor(session);
    if (html === null) {
      this.overlay.classList.remove('is-open');
      this.overlay.innerHTML = '';
      this.setTouchVisible(session.phase === 'playing');
      return;
    }
    this.overlay.innerHTML = html;
    this.overlay.classList.add('is-open');
    this.overlay.scrollTop = 0;
    this.setTouchVisible(session.phase === 'playing');
  }

  private screenFor(session: Session): string | null {
    switch (session.phase) {
      case 'title':
        return this.titleScreen();
      case 'levels':
        return this.levelScreen();
      case 'briefing':
        return this.briefingScreen(session);
      case 'paused':
        return this.pauseScreen();
      case 'result':
        return this.resultScreen(session.result);
      case 'collection':
        return this.collectionScreen();
      case 'settings':
        return this.settingsScreen(session);
      case 'help':
        return this.helpScreen();
      default:
        return null;
    }
  }

  private titleScreen(): string {
    const best = LEVELS.map((level) => this.save.bestFor(level.id)).filter(Boolean).length;
    const collected = this.save.data.collection.length;
    const bestEndless = this.save.data.stats.bestEndless;
    return `
      <div class="title-screen">
        <div class="logo">
          <div class="logo__badge">REMASTER</div>
          <div class="logo__main">孙巨的教室冒险</div>
          <div class="logo__tagline">在课桌阵里躲开舞剑的同学，把走散的同学温暖回座位</div>
        </div>
        <div class="title-menu">
          <button class="btn btn--primary" data-act="campaign">开始游戏 · 三关</button>
          <button class="btn" data-act="duel">双人同屏 · 走廊追逐</button>
          <button class="btn" data-act="endless">无尽模式</button>
          <div class="btn-row" style="gap:8px;justify-content:center">
            <button class="btn btn--ghost btn--small" data-act="collection">班级语录 ${collected}/${ALL_LINES.length}</button>
            <button class="btn btn--ghost btn--small" data-act="help">操作说明</button>
            <button class="btn btn--ghost btn--small" data-act="settings">设置</button>
          </div>
        </div>
        <div class="title-foot">
          ${best > 0 ? `已通关 ${best} 关 · 无尽最佳 ${bestEndless}s · ` : ''}方向键/WASD 移动 · E 喊人 · 空格 温暖了
        </div>
      </div>
    `;
  }

  private levelScreen(): string {
    const cards = LEVELS.map((level, index) => {
      const best = this.save.bestFor(level.id);
      const rank = best ? RANK_LABEL[best.rank] : null;
      return `
        <button class="level-card" data-act="level" data-id="${level.id}">
          <span class="level-card__no">${String(index + 1).padStart(2, '0')}</span>
          <span>
            <span class="level-card__name">${escapeHtml(level.name)}</span><br />
            <span class="level-card__desc">${escapeHtml(level.subtitle)} · ${level.timeLimit} 秒</span>
          </span>
          <span class="level-card__rank ${rank ? '' : 'is-empty'}">${rank ?? '未通关'}</span>
        </button>
      `;
    }).join('');
    return `
      <div class="panel">
        <div class="panel__eyebrow">CAMPAIGN</div>
        <h2 class="panel__title">选择关卡</h2>
        <p class="panel__sub">目标相同：把走散的同学喊回座位，后门才会打开。</p>
        <div class="level-grid">${cards}</div>
        <div class="panel__foot">
          <button class="btn btn--ghost" data-act="back">返回标题</button>
          <button class="btn btn--ghost" data-act="settings">设置</button>
        </div>
      </div>
    `;
  }

  private briefingScreen(session: Session): string {
    const level = session.currentLevel;
    const mode = session.selectedMode;
    const eyebrow =
      mode === 'endless'
        ? 'ENDLESS'
        : mode === 'duel'
          ? 'LOCAL 2P'
          : `STAGE ${String(level.def.index + 1).padStart(2, '0')}`;
    const best = this.save.bestFor(level.def.id);
    const tagList =
      mode === 'endless'
        ? ['活得越久分越高', '每 15 秒加速', '无后门']
        : mode === 'duel'
          ? ['P1 方向键', 'P2 WASD', '60 秒']
          : [
              `时限 ${level.def.timeLimit}s`,
              `同学 ×${level.meta.seats.length}`,
              `彩蛋 ×${level.meta.pickups.length}`,
              level.def.night ? '熄灯视野' : '教室日光',
            ];
    if (mode === 'campaign' && best) tagList.push(`最佳 ${best.rank} · ${best.score}`);
    const tags = tagList.map((t, i) => `<span class="tag${i === 0 ? ' tag--amber' : ''}">${escapeHtml(t)}</span>`).join('');
    return `
      <div class="panel">
        <div class="panel__eyebrow">${eyebrow}</div>
        <h2 class="panel__title">${escapeHtml(level.def.name)}</h2>
        <p class="panel__sub">${escapeHtml(level.def.subtitle)}</p>
        <div class="panel__body">
          <ul>${level.def.briefing.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>
          <div class="hint">${escapeHtml(level.def.hint)}</div>
          <div class="goal-list">${tags}</div>
          <div class="keys">
            <span><span class="kbd">方向键</span>移动</span>
            <span><span class="kbd">E</span>喊同学回座位</span>
            <span><span class="kbd">空格</span>温暖了（35 温暖值）</span>
            <span><span class="kbd">Shift</span>冲刺</span>
            <span><span class="kbd">Esc</span>暂停</span>
          </div>
        </div>
        <div class="panel__foot">
          <button class="btn btn--primary" data-act="begin">开始</button>
          <button class="btn btn--ghost" data-act="${mode === 'campaign' ? 'campaign' : 'back'}">${mode === 'campaign' ? '换一关' : '返回标题'}</button>
        </div>
      </div>
    `;
  }

  private pauseScreen(): string {
    return `
      <div class="panel">
        <div class="panel__eyebrow">PAUSED</div>
        <h2 class="panel__title">暂停</h2>
        <p class="panel__sub">教室还在，同学还在跑。先喘口气。</p>
        <div class="panel__foot">
          <button class="btn btn--primary" data-act="resume">继续</button>
          <button class="btn" data-act="restart">重新开始</button>
          <button class="btn btn--ghost" data-act="help">操作说明</button>
          <button class="btn btn--ghost" data-act="quit">回标题</button>
        </div>
      </div>
    `;
  }

  private resultScreen(result: ResultView | null): string {
    if (!result) return '<div class="panel">没有结算数据</div>';
    const rankClass = `rank-${result.rank}`;
    const title = result.won ? '这一关过了' : '这次的结局';
    const breakdown = result.breakdown
      .map(
        (line) =>
          `<div class="breakdown__row"><span>${escapeHtml(line.label)}</span><span>${line.value > 0 ? '+' : ''}${line.value}</span></div>`,
      )
      .join('');
    const extra =
      result.mode === 'campaign'
        ? `归位 ${result.seated}/${result.required} · 彩蛋 ${result.collected} · 被命中 ${result.hits} 次`
        : result.mode === 'endless'
          ? `归位 ${result.seatedTotal} 人 · 生存 ${result.endlessSeconds?.toFixed(1) ?? '0'} 秒 · 被命中 ${result.hits} 次`
          : result.duelWinner === 'runner'
            ? '孙巨赢了'
            : '舞剑同学赢了';
    return `
      <div class="panel panel--wide">
        <div class="panel__eyebrow">RESULT</div>
        <h2 class="panel__title">${title}</h2>
        <p class="panel__sub">${escapeHtml(result.cause)}</p>
        <div class="result">
          <div class="rank-badge ${rankClass}">${result.rank}</div>
          <div class="result__meta">
            <div class="result__score">${result.score} 分</div>
            <div class="result__line">${escapeHtml(extra)}</div>
            <div class="result__line">用时 ${result.timeUsed.toFixed(1)} 秒${result.newBest ? ' · 新纪录！' : ''}${
              result.best ? ` · 最佳 ${result.best.rank} / ${result.best.score}` : ''
            }</div>
          </div>
        </div>
        <div class="breakdown">${breakdown}</div>
        <div class="panel__foot">
          <button class="btn btn--primary" data-act="restart">再来一次</button>
          ${result.hasNext ? '<button class="btn" data-act="next">下一关</button>' : ''}
          <button class="btn btn--ghost" data-act="quit">回标题</button>
          <button class="btn btn--ghost" data-act="collection">班级语录</button>
        </div>
      </div>
    `;
  }

  private collectionScreen(): string {
    const items = ALL_LINES.map((line) => {
      const unlocked = this.save.hasLine(line.id);
      return `
        <div class="line-item ${unlocked ? '' : 'is-locked'}">
          <span class="line-item__tag">${TAG_LABEL[line.tag] ?? line.tag}</span>
          <span>${unlocked ? escapeHtml(line.text) : '？？？ 还没解锁'}</span>
        </div>
      `;
    }).join('');
    const unlocked = this.save.data.collection.length;
    return `
      <div class="panel panel--wide">
        <div class="panel__eyebrow">LINES</div>
        <h2 class="panel__title">班级语录</h2>
        <p class="panel__sub">已收录 ${unlocked} / ${ALL_LINES.length} 条 · 教室里的彩蛋能翻出 hy 的话，打一场会记下系统文案。</p>
        <div class="collection">${items}</div>
        <div class="panel__foot">
          <button class="btn btn--primary" data-act="back">返回</button>
        </div>
      </div>
    `;
  }

  private settingsScreen(session: Session): string {
    const sfx = session.save.data.settings.sfx;
    const motion = session.save.data.settings.reducedMotion;
    return `
      <div class="panel">
        <div class="panel__eyebrow">SETTINGS</div>
        <h2 class="panel__title">设置</h2>
        <p class="panel__sub">存档存在浏览器本地（localStorage），换设备不跟随。</p>
        <div class="panel__body">
          <div class="goal-list" style="gap:10px">
            <button class="btn btn--small" data-act="toggleSfx" data-on="${sfx}">
              音效：${sfx ? '开' : '关'}
            </button>
            <button class="btn btn--small" data-act="toggleMotion" data-on="${motion}">
              减少动效：${motion ? '开' : '关'}
            </button>
            <button class="btn btn--small btn--ghost" data-act="resetSave">清除存档</button>
          </div>
          <div class="hint">「减少动效」会减弱震屏、粒子与闪烁，给眼睛敏感的同学。</div>
        </div>
        <div class="panel__foot">
          <button class="btn btn--primary" data-act="back">返回</button>
        </div>
      </div>
    `;
  }

  private helpScreen(): string {
    return `
      <div class="panel">
        <div class="panel__eyebrow">HOW TO PLAY</div>
        <h2 class="panel__title">操作与规则</h2>
        <p class="panel__sub">一格一格地走，别被他贴上。</p>
        <div class="panel__body">
          <div class="keys" style="flex-direction:column;gap:8px">
            <span><span class="kbd">↑ ↓ ← →</span> / <span class="kbd">W A S D</span> 移动（单人模式下两套都行）</span>
            <span><span class="kbd">E</span> 靠近走散的同学，喊他回座位</span>
            <span><span class="kbd">空格</span> 温暖了！把附近同学送回座位，并把舞剑同学按回座位 2.5 秒</span>
            <span><span class="kbd">Shift</span> 冲刺三格，冷却 1.4 秒，但会暴露位置</span>
            <span><span class="kbd">Esc / P</span> 暂停，<span class="kbd">R</span> 重开</span>
          </div>
          <div class="hint">
            舞剑同学举剑时，他面前那一格会亮红 —— 那一格不能站。被砍到掉一点暖意，三点掉光就出局。
          </div>
          <div class="hint">
            单人：方向键和 WASD 都归你。双人：P1 用方向键控制孙巨，P2 用 WASD 控制舞剑同学。
          </div>
          <div class="goal-list">
            <span class="tag">${HY_LINES.length} 条 hy 语录</span>
            <span class="tag">原版文案全保留</span>
            <span class="tag">无双人键盘冲突</span>
          </div>
        </div>
        <div class="panel__foot">
          <button class="btn btn--primary" data-act="back">返回</button>
        </div>
      </div>
    `;
  }

  static readonly levels = [...LEVELS, ENDLESS_LEVEL, DUEL_LEVEL];
}
