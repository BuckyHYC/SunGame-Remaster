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

export type StarGoalType = 'no-hit' | 'no-skill' | 'no-convert' | 'no-chalk' | 'under-time';

/** 每关 3 条可选挑战：通关时逐条判定，计入存档 */
export interface StarGoal {
  type: StarGoalType;
  text: string;
  /** under-time 的秒数上限 */
  value?: number;
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
  /** 章节号（关卡选择分组用） */
  chapter?: number;
  /** 后门是否要先拿到钥匙（地图必须有 K） */
  needKey?: boolean;
  /** 同学被吓到几次后入伙（缺省 0 = 本关不启用入伙） */
  convertAfterScares?: number;
  /** 场上同时入伙的人数上限 */
  convertMax?: number;
  /** 三条三星目标 */
  stars?: StarGoal[];
}

/** 每关都有的三条挑战模板，避免两张表各写一遍 */
function stars(noExtraType: StarGoalType, noExtraText: string, under: number): StarGoal[] {
  return [
    { type: 'no-hit', text: '一次都没被剑砍到' },
    { type: noExtraType, text: noExtraText },
    { type: 'under-time', text: `${under} 秒内通关`, value: under },
  ];
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
    chapter: 1,
    pickupOffset: 0,
    stars: stars('no-skill', '一次都没用「温暖了」', 60),
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
    chapter: 1,
    pickupOffset: 5,
    stars: stars('no-skill', '一次都没用「温暖了」', 75),
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
    chapter: 1,
    pickupOffset: 11,
    stars: stars('no-skill', '一次都没用「温暖了」', 70),
    decor: [
      { type: 'clock', cell: [3, 0] },
      { type: 'plant', cell: [19, 4] },
      { type: 'trash', cell: [1, 4] },
      { type: 'poster', cell: [10, 0] },
    ],
  },
  {
    id: 'classroom-4',
    index: 3,
    name: '舞剑课',
    subtitle: '第二节课 · 课桌都搬到了墙边',
    rows: [
      '###BBBBBB##WWWWWW####',
      '#S.................S#',
      '#...................#',
      '#..DD..DD..DD..DD...#',
      '#...1.........2.....#',
      '#...................#',
      '#.....E.............#',
      '#...*...........*...#',
      '#..DD..DD..DD..DD...#',
      '#...3.........4.....#',
      '#...................#',
      '#..DD..DD..DD..DD...#',
      '#P.....SSSS........X#',
      '#####################',
    ],
    timeLimit: 80,
    wander: false,
    night: false,
    chaser: {
      patrolStepMs: 205,
      chaseStepMs: 150,
      jumpChance: 0.24,
      visionRange: 7,
      hearingRange: 5,
      charges: 1,
    },
    hint: '同学被吓到第二次就会跟着学舞剑 —— 抢先把他喊回座位。',
    briefing: [
      '教室中间空出一大片，正好够舞剑同学转身。',
      '同学第一次被吓只是换个位置；第二次被吓到，他就学会舞剑了。',
      '入伙的同学会追着你挥剑，但只会把你推开 —— 用「温暖了」才能把他劝回来。',
    ],
    chapter: 2,
    convertAfterScares: 2,
    convertMax: 1,
    pickupOffset: 17,
    stars: stars('no-convert', '没有人被教会舞剑', 65),
    decor: [
      { type: 'clock', cell: [10, 0] },
      { type: 'poster', cell: [2, 0] },
      { type: 'trash', cell: [2, 12] },
      { type: 'plant', cell: [17, 12] },
    ],
  },
  {
    id: 'corridor-1',
    index: 4,
    name: '走廊值日',
    subtitle: '第二节课 · 走廊与储物柜',
    rows: [
      '#####WWWWWW#WWWW#####',
      '#K..................#',
      '#.S.S.S.S.S.S.S.S.S.#',
      '#...................#',
      '#.....SSSSSSSS......#',
      '#...................#',
      '#.1.....2.....3.....#',
      '#...................#',
      '#..SSSSSSSSSSSSSS...#',
      '#........E..........#',
      '#...*...........*...#',
      '#.c.................#',
      '#P.................X#',
      '#####################',
    ],
    timeLimit: 95,
    wander: false,
    night: false,
    chaser: {
      patrolStepMs: 195,
      chaseStepMs: 140,
      jumpChance: 0.1,
      visionRange: 9,
      hearingRange: 6,
      charges: 1,
    },
    hint: '后门锁着：先在走廊另一头拿到钥匙，再把三位同学喊回座位。',
    briefing: [
      '走廊很长，储物柜把视线切成一段一段。',
      '这次后门是锁的 —— 钥匙放在走廊另一头的窗边。',
      '座位齐了、钥匙也到手，后门才会开。',
    ],
    chapter: 2,
    needKey: true,
    convertAfterScares: 2,
    convertMax: 1,
    pickupOffset: 19,
    stars: stars('no-skill', '一次都没用「温暖了」', 75),
    decor: [
      { type: 'clock', cell: [11, 0] },
      { type: 'poster', cell: [2, 0] },
      { type: 'trash', cell: [3, 3] },
      { type: 'plant', cell: [10, 5] },
    ],
  },
  {
    id: 'classroom-5',
    index: 5,
    name: '月考',
    subtitle: '第三节课 · 单人单桌',
    rows: [
      '####BBBBBB#WWWWWW####',
      '#T..................#',
      '#.D.D.D.D.D.D.D.D.D.#',
      '#.D.D.D.D.D.D.D.D.D.#',
      '#...................#',
      '#.D.1.D.D.2.D.D.3.D.#',
      '#.D.D.D.D.D.D.D.D.D.#',
      '#........E..........#',
      '#.D.D.D.D.D.D.D.D.D.#',
      '#.D.4.D.D.5.D.D.D.D.#',
      '#...................#',
      '#..*...........*....#',
      '#P..c....c....c....X#',
      '#####################',
    ],
    timeLimit: 100,
    wander: true,
    night: false,
    chaser: {
      patrolStepMs: 200,
      chaseStepMs: 148,
      jumpChance: 0.3,
      visionRange: 6,
      hearingRange: 5,
      charges: 1,
    },
    hint: '单人单桌，过道窄得只能一个人走；满地粉笔头，按 Q 扔出去打断他。',
    briefing: [
      '月考的桌子摆成单人单桌，过道只够一个人侧身过。',
      '地上散着粉笔头：踩上去捡起来，按 Q 朝面对的方向扔出去。',
      '粉笔头能让舞剑同学硬直一下，也能把入伙的同学敲醒。',
    ],
    chapter: 3,
    convertAfterScares: 2,
    convertMax: 2,
    pickupOffset: 21,
    stars: stars('no-chalk', '一颗粉笔头都没扔', 80),
    decor: [
      { type: 'clock', cell: [10, 0] },
      { type: 'poster', cell: [2, 0] },
      { type: 'trash', cell: [5, 4] },
      { type: 'plant', cell: [17, 10] },
    ],
  },
  {
    id: 'night-1',
    index: 6,
    name: '熄灯之后',
    subtitle: '第三节课 · 熄灯后的教室',
    rows: [
      '###BBBBBB###WWWWW####',
      '#K....T.......T.....#',
      '#.DD...DD...DD...DD.#',
      '#.DD...DD...DD...DD.#',
      '#..c................#',
      '#..1.....2.....3....#',
      '#.......*...E.......#',
      '#.DD...DD...DD...DD.#',
      '#.DD...DD...DD...DD.#',
      '#..4.....5..........#',
      '#.................c.#',
      '#..*...........*....#',
      '#P....SSSSSS......X.#',
      '#####################',
    ],
    timeLimit: 105,
    wander: true,
    night: true,
    chaser: {
      patrolStepMs: 210,
      chaseStepMs: 155,
      jumpChance: 0.26,
      visionRange: 6,
      hearingRange: 6,
      charges: 2,
    },
    hint: '熄灯、钥匙、入伙、粉笔头全在这一关：先救近的，再去拿钥匙。',
    briefing: [
      '灯又灭了，这次教室里还多了几个学会舞剑的同学。',
      '后门钥匙在左上角，别忘了去拿。',
      '粉笔头只有两截 —— 留到他举剑的时候再扔。',
    ],
    chapter: 3,
    needKey: true,
    convertAfterScares: 2,
    convertMax: 2,
    pickupOffset: 23,
    stars: stars('no-convert', '没有人被教会舞剑', 80),
    decor: [
      { type: 'clock', cell: [10, 0] },
      { type: 'poster', cell: [2, 0] },
      { type: 'trash', cell: [5, 10] },
      { type: 'plant', cell: [17, 4] },
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
