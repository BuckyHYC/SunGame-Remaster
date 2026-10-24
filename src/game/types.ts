import { Dir, Vec2 } from '../core/math';
import { Grid } from '../core/grid';
import { Rng } from '../core/rng';
import { Sfx } from '../core/audio';
import { LevelDef } from './levels';

export type GameMode = 'campaign' | 'endless' | 'duel';
export type RunStatus = 'playing' | 'won' | 'lost';
export type LoseReason = 'hit' | 'time' | 'duel-caught' | 'duel-timeout';

export interface Move {
  from: Vec2;
  to: Vec2;
  t: number;
  dur: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  gravity: number;
}

export interface PlayerState {
  cell: Vec2;
  pos: Vec2;
  facing: Dir;
  move: Move | null;
  hp: number;
  maxHp: number;
  invuln: number;
  dashLeft: number;
  dashCooldown: number;
  stepPhase: number;
  hurtFlash: number;
  idleTime: number;
  /** 冲刺制造的噪音，追击者靠它定位 */
  noise: number;
  bumpCd: number;
  /** 手里的粉笔头（投掷弹药），上限见 BALANCE.chalk.max */
  chalk: number;
  /** 被入伙同学推开后的硬直（不能起步） */
  stun: number;
  /** 投掷动作的表现计时 */
  throwFlash: number;
  /** 起步次数：输入层据此消费"按键缓冲"，保证一次按键只走一格 */
  steps: number;
}

export type ChaserStateName =
  | 'patrol'
  | 'alert'
  | 'chase'
  | 'windup'
  | 'strike'
  | 'recover'
  | 'stagger'
  | 'jump';

export interface ChaserState {
  cell: Vec2;
  pos: Vec2;
  facing: Dir;
  state: ChaserStateName;
  timer: number;
  move: Move | null;
  onDesk: boolean;
  hop: { from: Vec2; to: Vec2; t: number; dur: number } | null;
  stepPhase: number;
  chargesLeft: number;
  speedMul: number;
  staggerLeft: number;
  alertPulse: number;
  breath: number;
  lostTimer: number;
  warned: boolean;
  /** 起步次数：双人模式下 P2 的按键缓冲据此消费 */
  steps: number;
}

export type MateStateName = 'scared' | 'returning' | 'seated' | 'leaving' | 'converted';

/** 入伙同学的近身挥剑节奏 */
export interface ConvertedAttack {
  state: 'windup' | 'strike' | 'recover';
  timer: number;
}

export interface MateState {
  id: number;
  seat: Vec2;
  cell: Vec2;
  pos: Vec2;
  facing: Dir;
  state: MateStateName;
  move: Move | null;
  variant: number;
  lineId: string;
  wanderTimer: number;
  stepPhase: number;
  scareCooldown: number;
  /** 归位的时刻（rt.time），无尽模式用来淘汰最早坐下的同学 */
  seatedAt: number;
  /** 离场淡出进度：1 完全不透明，0 视为已经走出去 */
  fade: number;
  /** 被舞剑同学吓到的次数：达到关卡阈值就会入伙 */
  scareCount: number;
  /** 入伙后的挥剑状态；非入伙为 null */
  attack: ConvertedAttack | null;
  /** 被「温暖了」救回来的免疫截止时间（rt.time） */
  convertImmuneUntil: number;
}

export interface ChalkDrop {
  cell: Vec2;
  taken: boolean;
  bob: number;
}

export interface PickupState {
  cell: Vec2;
  lineId: string;
  taken: boolean;
  kind: number;
  bob: number;
}

export interface FrameCommand {
  p1: Dir | null;
  p2: Dir | null;
  skill: boolean;
  interact: boolean;
  dash: boolean;
  /** 扔粉笔头 */
  throw: boolean;
}

export interface DialogMessage {
  text: string;
  id?: string;
  /** 展示权重：1 普通，2 重要（用金色描边） */
  tone: 1 | 2;
}

export interface Runtime {
  def: LevelDef;
  grid: Grid;
  rng: Rng;
  mode: GameMode;
  night: boolean;

  spawn: Vec2;
  exit: Vec2;
  chaserHome: Vec2;
  /** 本关全部座位（无尽模式补人时用来分配空位） */
  seats: Vec2[];

  player: PlayerState;
  chaser: ChaserState;
  mates: MateState[];
  pickups: PickupState[];
  /** 地上的粉笔头 */
  chalkDrops: ChalkDrop[];

  /** 后门钥匙位置（本关不需要钥匙时为 null） */
  keyCell: Vec2 | null;
  hasKey: boolean;
  keyHintShown: boolean;

  time: number;
  timeLimit: number;
  timeLeft: number;

  warmth: number;
  seated: number;
  /** 累计归位人数（无尽模式跨波计分用） */
  seatedTotal: number;
  /** 无尽模式补人倒计时 */
  spawnTimer: number;
  /** 同学 id 递增序号 */
  mateSeq: number;
  requireSeated: number;
  exitOpen: boolean;

  hits: number;
  missedSkills: number;
  collected: number;
  skillUses: number;
  /** 被温暖了救回来的入伙同学数 */
  cured: number;
  /** 累计入伙次数（三星「无人入伙」判定用） */
  convertedTotal: number;
  /** 累计投掷粉笔头次数（三星「不扔粉笔」判定用） */
  chalkThrown: number;

  particles: Particle[];
  shake: number;
  flash: number;
  warmPulse: number;
  hitstop: number;

  status: RunStatus;
  loseReason: LoseReason | null;
  duelWinner: 'runner' | 'chaser' | null;

  /** 待消费的事件队列（音效/字幕/解锁），由会话层接走 */
  pendingSfx: Sfx[];
  pendingDialogs: DialogMessage[];
  pendingUnlocks: string[];

  /** 无尽模式波次 */
  wave: number;
  waveTimer: number;
  /** 关卡开始时用于渲染的时间 */
  clock: number;
  /** 屏幕特效：命中时的红色描边强度 */
  hurtVignette: number;
}
