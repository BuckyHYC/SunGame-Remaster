import { ALL_LINES, TRIGGER_LINES } from '../data/lines';
import { Runtime } from './types';

const LINE_TEXT: ReadonlyMap<string, string> = new Map(ALL_LINES.map((l) => [l.id, l.text]));

/** 推一条字幕（相邻重复不重复排队） */
export function say(rt: Runtime, text: string, tone: 1 | 2 = 1, id?: string): void {
  const last = rt.pendingDialogs[rt.pendingDialogs.length - 1];
  if (last && last.text === text) return;
  rt.pendingDialogs.push(id ? { text, tone, id } : { text, tone });
}

/** 按语录 id 播字幕（原文来自 lines.ts） */
export function sayLine(rt: Runtime, lineId: string, tone: 1 | 2 = 1): void {
  const text = LINE_TEXT.get(lineId);
  if (text) say(rt, text, tone, lineId);
}

/** 事件触发 → 解锁图鉴语录 */
export function unlock(rt: Runtime, trigger: string): string[] {
  const ids = TRIGGER_LINES[trigger];
  if (!ids) return [];
  const added: string[] = [];
  for (const id of ids) {
    if (!rt.pendingUnlocks.includes(id)) {
      rt.pendingUnlocks.push(id);
      added.push(id);
    }
  }
  return added;
}
