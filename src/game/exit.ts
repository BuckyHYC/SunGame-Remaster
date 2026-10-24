import { say, sayLine, unlock } from './events';
import { Runtime } from './types';

/**
 * 后门开门判定：战役关需要「座位齐 && 钥匙到手」。
 * 放在单独模块里，玩家拾取钥匙和同学坐下都可以直接调，不用绕回 runtime 造成循环依赖。
 */
export function tryOpenExit(rt: Runtime): void {
  if (rt.mode !== 'campaign' || rt.exitOpen) return;
  if (rt.seated < rt.requireSeated) return;

  if (!rt.hasKey) {
    if (!rt.keyHintShown) {
      rt.keyHintShown = true;
      rt.pendingSfx.push('bump');
      sayLine(rt, 'key-locked', 2);
      unlock(rt, 'key-locked');
    }
    return;
  }

  rt.exitOpen = true;
  rt.pendingSfx.push('door');
  say(rt, '同学都回座位了，后门开了！', 2);
}
