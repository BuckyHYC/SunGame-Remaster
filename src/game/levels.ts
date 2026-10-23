export interface ChaserConfig {
  patrolStepMs: number;
  chaseStepMs: number;
  jumpChance: number;
  visionRange: number;
  hearingRange: number;
  /** 一轮挥击后能连续再挥几次（晚自习关为 2） */
  charges: number;
}

export interface DecorDef {
  type: 'clock' | 'poster' | 'trash' | 'plant' | 'ball';
  cell: [number, number];
}

export interface LevelDef {
  id: string;
  index: number;
  name: string;
  subtitle: string;
  /** ASCII 地图：见 core/grid.ts 的字符表 */
  rows: string[];
  timeLimit: number;
  /** 同学是否会在场里乱走（课间/晚自习） */
  wander: boolean;
  night: boolean;
  chaser: ChaserConfig;
  hint: string;
  briefing: string[];
  /** 彩蛋语录从第几句开始取 */
  pickupOffset: number;
  /** 纯装饰摆件（不挡路，用来给教室加细节） */
  decor?: DecorDef[];
}

export const LEVELS: LevelDef[] = [
  {
    id: 'classroom-1',
    index: 0,
    name: '自习课',
    subtitle: '第一节课 · 教室',
    rows: [
      '###BBBBBB###WWWWW####',
      '#..T................#',
      '#.D.D.D.D.D.D.D.D.D.#',
      '#...1.......2.......#',
      '#.D.D.D.D.D.D.D.D.D.#',
      '#...................#',
      '#.D.D.D.D.D.D.D.D.D.#',
      '#.......E...*.......#',
      '#.D.D.D.D.D.D.D.D.D.#',
      '#...3...............#',
      '#.D.D.D.D.D.D.D.D.D.#',
      '#....*..............#',
      '#P....SSSSSS......X.#',
      '#####################',
    ],
    timeLimit: 75,
    wander: false,
    night: false,
    chaser: {
      patrolStepMs: 215,
      chaseStepMs: 155,
      jumpChance: 0.22,
      visionRange: 7,
      hearingRange: 4.5,
      charges: 1,
    },
    hint: '把走散的同学一个个喊回座位，后门就会打开。方向键移动，E 喊人，空格「温暖了」。',
    briefing: [
      '自习课上，舞剑的同学又开始在课桌之间跳来跳去。',
      '三位同学被吓得离开了座位 —— 把他们喊回座位，后门才会开。',
      '被剑砍到会掉一点暖意，掉光就出局。',
    ],
    pickupOffset: 0,
    decor: [
      { type: 'clock', cell: [10, 0] },
      { type: 'poster', cell: [1, 0] },
      { type: 'trash', cell: [19, 11] },
      { type: 'ball', cell: [1, 1] },
    ],
  },
  {
    id: 'classroom-2',
    index: 1,
    name: '课间十分钟',
    subtitle: '第二节课 · 教室',
    rows: [
      '####BBBBB####WWWW####',
      '#........E..........#',
      '#.DD...DD...DD...DD.#',
      '#.DD...DD...DD...DD.#',
      '#...................#',
      '#..1.............2..#',
      '#.DD...DD...DD...DD.#',
      '#.DD...DD...DD...DD.#',
      '#...................#',
      '#...S...........S...#',
      '#.....3.....4.......#',
      '#..P...........X....#',
      '#...*..........*....#',
      '#####################',
    ],
    timeLimit: 90,
    wander: true,
    night: false,
    chaser: {
      patrolStepMs: 195,
      chaseStepMs: 145,
      jumpChance: 0.26,
      visionRange: 7.5,
      hearingRange: 5,
      charges: 1,
    },
    hint: '课间同学会到处乱跑，先追上他们再说；温暖了可以把附近同学一起喊回座位。',
    briefing: [
      '课间十分钟，教室里全是人。',
      '这四位同学会到处乱走，靠近后按 E 把他们喊回座位。',
      '「温暖了」这一次能覆盖更大的范围 —— 也可以用来把舞剑同学按回座位。',
    ],
    pickupOffset: 5,
    decor: [
      { type: 'poster', cell: [19, 0] },
      { type: 'plant', cell: [1, 11] },
      { type: 'trash', cell: [19, 12] },
      { type: 'ball', cell: [10, 4] },
    ],
  },
  {
    id: 'classroom-3',
    index: 2,
    name: '晚自习',
    subtitle: '第三节 · 熄灯后的教室',
    rows: [
      '####BBBBBB###WWWW####',
      '#S................S.#',
      '#S..DD.DD.DD.DD...S.#',
      '#...DD.DD.DD.DD.....#',
      '#...................#',
      '#..1.....2.....3....#',
      '#...................#',
      '#..DD.DD.DD.DD.DD...#',
      '#..DD.DD.DD.DD.DD...#',
      '#...................#',
      '#....S.......S......#',
      '#..P......E......X..#',
      '#..*..........*...*.#',
      '#####################',
    ],
    timeLimit: 85,
    wander: true,
    night: true,
    chaser: {
      patrolStepMs: 205,
      chaseStepMs: 150,
      jumpChance: 0.24,
      visionRange: 6,
      hearingRange: 6,
      charges: 2,
    },
    hint: '熄灯了，只看得见身边一圈。舞剑同学这一关会连着挥两剑。',
    briefing: [
      '晚自习熄灯，教室只剩窗外的路灯光。',
      '视野变小了 —— 但舞剑同学也看不清你，除非你在他面前跑起来。',
      '他会连着挥两剑，第一剑之后别急着回头。',
    ],
    pickupOffset: 11,
    decor: [
      { type: 'clock', cell: [3, 0] },
      { type: 'plant', cell: [19, 4] },
      { type: 'trash', cell: [1, 4] },
      { type: 'poster', cell: [10, 0] },
    ],
  },
];

export const ENDLESS_LEVEL: LevelDef = {
  ...LEVELS[0],
  id: 'endless',
  index: 3,
  name: '无尽的教室',
  subtitle: '无尽模式',
  timeLimit: 9999,
  wander: true,
  // 无尽模式多摆两把椅子（5 个座位），后期才装得下更多没座位的同学
  rows: [
    '###BBBBBB###WWWWW####',
    '#..T................#',
    '#.D.D.D.D.D.D.D.D.D.#',
    '#...1.......2.......#',
    '#.D.D.D.D.D.D.D.D.D.#',
    '#...............4...#',
    '#.D.D.D.D.D.D.D.D.D.#',
    '#.......E...*.......#',
    '#.D.D.D.D.D.D.D.D.D.#',
    '#...3...............#',
    '#.D.D.D.D.D.D.D.D.D.#',
    '#....*.......5......#',
    '#P....SSSSSS......X.#',
    '#####################',
  ],
  hint: '教室永远走不出去，只能一直躲。坐满之后会有人起身离开，腾出椅子给新来的同学。',
  briefing: [
    '后门被锁死了。',
    '活得越久分数越高，每 15 秒他会更快一点。',
    '椅子坐满以后，最早坐下的同学会起身从后门离开。',
  ],
};

export const DUEL_LEVEL: LevelDef = {
  ...LEVELS[1],
  id: 'duel',
  index: 4,
  name: '走廊追逐',
  subtitle: '双人同屏',
  timeLimit: 60,
  wander: false,
  hint: '后门锁上了 —— 孙巨按 E 把同学喊回座位拿分，撑满 60 秒算赢；舞剑同学砍空他三点暖意就算赢。',
  briefing: [
    'P1（方向键）控制孙巨，P2（WASD）控制舞剑的同学。',
    '孙巨按 E 把相邻的同学喊回座位，每喊回一位 120 分；撑满 60 秒再加 300 分。',
    '舞剑同学砍空孙巨的三点暖意就赢。孙巨有两次「温暖了」（空格）。',
    '同学会陆续从后门进来，不用担心没人可喊。',
  ],
};

export function getLevel(id: string): LevelDef {
  if (id === ENDLESS_LEVEL.id) return ENDLESS_LEVEL;
  if (id === DUEL_LEVEL.id) return DUEL_LEVEL;
  const found = LEVELS.find((l) => l.id === id);
  if (!found) throw new Error(`未知关卡 ${id}`);
  return found;
}
