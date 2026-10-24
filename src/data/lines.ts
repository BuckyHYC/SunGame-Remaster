export interface LineDef {
  id: string;
  text: string;
  tag: 'hy' | 'chaser' | 'warm' | 'system' | 'lose';
}

/**
 * 「hy」语录：原版 npcs[] 里手写的 10 句 + dialogPool 里的 15 句，逐字保留。
 * 原版因 initializeNPCs() 覆盖，这 25 句其实从未同时上场；重制版把它们全部收进图鉴。
 */
export const HY_LINES: LineDef[] = [
  { id: 'hy-01', text: 'hy在图书馆自习呢！', tag: 'hy' },
  { id: 'hy-02', text: 'hy正在做数学题...', tag: 'hy' },
  { id: 'hy-03', text: 'hy在预习英语课的内容！', tag: 'hy' },
  { id: 'hy-04', text: 'hy说要去参加物理竞赛！', tag: 'hy' },
  { id: 'hy-05', text: 'hy刚刚解出了一道难题！', tag: 'hy' },
  { id: 'hy-06', text: 'hy的作业写得真认真！', tag: 'hy' },
  { id: 'hy-07', text: 'hy在思考一道数学难题。', tag: 'hy' },
  { id: 'hy-08', text: 'hy正在和同学讨论题目。', tag: 'hy' },
  { id: 'hy-09', text: 'hy在看课外的科普书！', tag: 'hy' },
  { id: 'hy-10', text: 'hy正在认真复习功课！', tag: 'hy' },
  { id: 'hy-11', text: 'hy正在解一道数学难题...', tag: 'hy' },
  { id: 'hy-12', text: 'hy在预习明天的课程内容！', tag: 'hy' },
  { id: 'hy-13', text: 'hy刚完成了一篇读书笔记！', tag: 'hy' },
  { id: 'hy-14', text: 'hy正在和同学讨论物理题', tag: 'hy' },
  { id: 'hy-15', text: 'hy说今天要多做几道题！', tag: 'hy' },
  { id: 'hy-16', text: 'hy在看一本有趣的科普书', tag: 'hy' },
  { id: 'hy-17', text: 'hy正在整理学习笔记', tag: 'hy' },
  { id: 'hy-18', text: 'hy说要参加下周的竞赛！', tag: 'hy' },
  { id: 'hy-19', text: 'hy今天的作业完成得很认真', tag: 'hy' },
  { id: 'hy-20', text: 'hy正在思考一个难题', tag: 'hy' },
  { id: 'hy-21', text: 'hy在图书馆找到了好书！', tag: 'hy' },
  { id: 'hy-22', text: 'hy说要提前完成作业', tag: 'hy' },
  { id: 'hy-23', text: 'hy正在准备英语演讲', tag: 'hy' },
  { id: 'hy-24', text: 'hy在研究一道竞赛题', tag: 'hy' },
  { id: 'hy-25', text: 'hy正在认真复习功课！', tag: 'hy' },
];

/**
 * 原版的系统提示/结算文案，全部保留原文，作为「梗记录」与玩法反馈。
 * 原版有两处 updateDeathAnimation 互相覆盖，中文死亡文案成了死代码，这里让它重新上场。
 */
export const STORY_LINES: LineDef[] = [
  { id: 'warm-skill', text: '温暖了！请同学们回到座位上。', tag: 'warm' },
  { id: 'chaser-jump-up', text: '舞剑的同学跳到了桌子上！', tag: 'chaser' },
  { id: 'chaser-jump-down', text: '舞剑的同学从桌子上跳了下来！', tag: 'chaser' },
  { id: 'chaser-scare', text: '舞剑的同学吓到了一位同学，他换了个位置！', tag: 'chaser' },
  { id: 'chaser-windup', text: '舞剑的同学举起了剑——快闪开！', tag: 'chaser' },
  { id: 'hit-player', text: '舞剑的同学击败了你！', tag: 'lose' },
  { id: 'lose-suck', text: 'You suck!', tag: 'lose' },
  { id: 'win-clear', text: '恭喜你成功通关！', tag: 'system' },
  { id: 'lose-time', text: '时间到！游戏失败', tag: 'lose' },
  { id: 'mate-seated', text: '同学回到座位了。', tag: 'system' },
  { id: 'skill-miss', text: '温暖了……但没有人需要座位。', tag: 'system' },
  // 以下四条是重制版新增的**系统提示**，沿用原版句式，不引入新人名/黑话
  { id: 'mate-converted', text: '舞剑的同学教会了一位同学舞剑，他也举起了剑！', tag: 'chaser' },
  { id: 'warm-cure', text: '被温暖到的同学放下了剑，跟着回座位了。', tag: 'warm' },
  { id: 'key-taken', text: '拿到后门钥匙了。', tag: 'system' },
  { id: 'key-locked', text: '座位齐了，可是没钥匙开不了后门。', tag: 'system' },
  { id: 'chalk-picked', text: '捡到了半截粉笔头。', tag: 'system' },
];

export const ALL_LINES: LineDef[] = [...HY_LINES, ...STORY_LINES];

export const LINE_BY_ID: ReadonlyMap<string, LineDef> = new Map(ALL_LINES.map((l) => [l.id, l]));

/** 事件 → 首次触发时解锁的语录 */
export const TRIGGER_LINES: Record<string, string[]> = {
  'skill-used': ['warm-skill'],
  'chaser-jumped-up': ['chaser-jump-up'],
  'chaser-jumped-down': ['chaser-jump-down'],
  'mate-scared': ['chaser-scare'],
  'chaser-windup': ['chaser-windup'],
  'player-hit': ['hit-player'],
  'player-down': ['lose-suck'],
  'level-clear': ['win-clear'],
  'time-up': ['lose-time'],
  'mate-seated': ['mate-seated'],
  'skill-miss': ['skill-miss'],
  'mate-converted': ['mate-converted'],
  'warm-cure': ['warm-cure'],
  'key-taken': ['key-taken'],
  'key-locked': ['key-locked'],
  'chalk-picked': ['chalk-picked'],
};

export function hyLineForPickup(order: number): LineDef {
  return HY_LINES[order % HY_LINES.length];
}
