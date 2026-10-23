import './ui/styles.css';
import { AudioBus } from './core/audio';
import { Input } from './core/input';
import { Loop } from './core/loop';
import { SaveStore } from './core/save';
import { Session } from './game/session';
import { GameMode } from './game/types';
import { Renderer } from './render/renderer';
import { UI, UIHandlers } from './ui/screens';
import { setReducedMotion } from './game/fx';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const audio = new AudioBus();
const input = new Input();
const save = new SaveStore();
const session = new Session(save, audio, input);
const renderer = new Renderer(canvas);

audio.enabled = save.data.settings.sfx;
setReducedMotion(save.data.settings.reducedMotion);

const handlers: UIHandlers = {
  campaign: () => {
    session.openLevels();
    ui.refresh(session);
  },
  duel: () => {
    session.openBriefing('duel', 'duel');
    ui.refresh(session);
  },
  endless: () => {
    session.openBriefing('endless', 'endless');
    ui.refresh(session);
  },
  selectLevel: (id) => {
    session.openBriefing(id, 'campaign');
    ui.refresh(session);
  },
  begin: () => {
    audio.unlock();
    session.startLevel(session.selectedLevelId, session.selectedMode);
    ui.refresh(session);
  },
  resume: () => {
    session.resume();
    ui.refresh(session);
  },
  restart: () => {
    session.restart();
    ui.refresh(session);
  },
  quit: () => {
    session.quitToTitle();
    ui.refresh(session);
  },
  collection: () => {
    session.openCollection();
    ui.refresh(session);
  },
  settings: () => {
    session.openSettings();
    ui.refresh(session);
  },
  help: () => {
    session.openHelp();
    ui.refresh(session);
  },
  back: () => {
    session.backToTitle();
    ui.refresh(session);
  },
  nextLevel: () => {
    const next = session.nextLevelId();
    if (next) {
      session.startLevel(next, 'campaign');
      ui.refresh(session);
    }
  },
  toggleSfx: (on) => {
    session.setSfx(on);
    ui.refresh(session);
  },
  toggleMotion: (on) => {
    session.setReducedMotion(on);
    ui.refresh(session);
  },
  resetSave: () => {
    if (window.confirm('清除本机存档（最佳成绩 / 语录 / 设置）？')) {
      session.resetSave();
      audio.enabled = true;
      ui.refresh(session);
    }
  },
  click: () => {
    audio.unlock();
    audio.play('click');
  },
  touchDir: (dir, down) => input.setVirtual(dir, down),
  touchAction: (action) => input.tap(action),
};

const ui = new UI(handlers, save);

input.attach();

// 缩放：像素画只做整数倍放大；屏幕太小时按比例缩小以免溢出
function resize(): void {
  const availW = Math.min(window.innerWidth - 32, 1100);
  const availH = window.innerHeight - 210;
  const raw = Math.min(availW / 504, availH / 336);
  const scale = raw >= 1.5 ? Math.max(1, Math.min(4, Math.floor(raw))) : Math.max(0.45, Math.round(raw * 50) / 50);
  document.documentElement.style.setProperty('--scale', String(scale));
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
resize();

// 触屏设备才显示虚拟按键
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('is-touch');

// 首次交互解锁 WebAudio
const unlock = (): void => {
  audio.unlock();
  window.removeEventListener('pointerdown', unlock);
  window.removeEventListener('keydown', unlock);
};
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

// 切到后台自动暂停，避免时间偷偷流逝
document.addEventListener('visibilitychange', () => {
  if (document.hidden && session.phase === 'playing') {
    session.pause();
    ui.refresh(session);
  }
});

const loop = new Loop(
  (dt) => {
    session.step(dt);
  },
  () => {
    const data = session.data;
    if (data && session.run && (session.phase === 'playing' || session.phase === 'paused' || session.phase === 'result')) {
      renderer.drawRuntime(session.run, data);
    } else {
      const preview = session.phase === 'briefing' ? session.currentLevel : session.levels.get('classroom-1');
      if (preview) renderer.drawShowcase(preview, performance.now() / 1000);
    }
    ui.update(session);
  },
);

// 深链：?level=classroom-2&mode=campaign&auto=1 —— 方便分享某一关，也方便截图验收
{
  const params = new URLSearchParams(window.location.search);
  const levelId = params.get('level');
  if (levelId && session.levels.has(levelId)) {
    const modeParam = params.get('mode');
    const mode: GameMode = modeParam === 'endless' ? 'endless' : modeParam === 'duel' ? 'duel' : 'campaign';
    session.openBriefing(levelId, mode);
    if (params.get('auto') === '1') session.startLevel(levelId, mode);
    ui.refresh(session);
  }
}

// 开发期调试钩子：无头截图与手感调参用，生产构建不包含
if (import.meta.env.DEV) {
  (window as unknown as { __sungame?: unknown }).__sungame = { session, save, ui, renderer, loop, audio, input };
}

loop.start();
