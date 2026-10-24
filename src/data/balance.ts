/**
 * 全部平衡数值集中在此，改一个数就能调手感。
 * 设计律：玩家比追击者快，但走位有代价；技能必须有成本。
 */
export const BALANCE = {
  player: {
    hp: 3,
    stepMs: 110,
    dashStepMs: 45,
    dashCells: 3,
    dashCooldownMs: 1400,
    invulnMs: 950,
    knockbackMs: 120,
  },
  chaser: {
    patrolStepMs: 215,
    chaseStepMs: 155,
    alertMs: 320,
    windupMs: 430,
    strikeMs: 130,
    recoverMs: 400,
    jumpMs: 380,
    jumpChance: 0.22,
    staggerMs: 2500,
    /** 同排同列的可视距离 */
    visionRange: 7,
    /** 冲刺声会暴露位置 */
    hearingRange: 4.5,
    /** 贴脸直接进入警戒 */
    proximityAlert: 3,
    speedRampPerWave: 0.06,
  },
  skill: {
    maxWarmth: 100,
    cost: 35,
    startWarmth: 55,
    regenPerSec: 3,
    radius: 2.6,
  },
  mate: {
    stepMs: 150,
    scareDistance: 1.6,
    respawnMinDistance: 3,
  },
  /** 入伙的同学：会挥剑，但只把你推开 —— 暖意仍然只由舞剑同学消耗 */
  converted: {
    stepMs: 185,
    windupMs: 560,
    strikeMs: 130,
    recoverMs: 420,
    /** 被推开后的硬直（不能起步） */
    shoveStunMs: 350,
    /** 超出这个距离就站在原地练剑 */
    leash: 9,
    /** 被「温暖了」救回来后的免疫时长 */
    cureImmuneMs: 6000,
  },
  chalk: {
    max: 2,
    range: 3,
    /** 打中舞剑同学造成的硬直（比「温暖了」的 2.5s 短，且不送他回座位） */
    staggerMs: 800,
  },
  /** 关卡时限之外的通用参数 */
  endless: {
    waveSeconds: 15,
    maxSpeedMultiplier: 1.75,
    baseSeconds: 60,
    /** 补人间隔（秒）：开局 → 越到后面越短，到 refillMinSeconds 为止 */
    refillSeconds: 6,
    refillMinSeconds: 1.8,
    /** 场上"没找到座位"的同学上限：3 起步，每累计归位 4 位 +1，最多到座位数 */
    unseatedBase: 3,
    unseatedPerSeat: 4,
  },
  duel: {
    surviveSeconds: 60,
    skillUses: 2,
    /** 双人模式固定节奏补人：不变快也不变多 */
    spawnSeconds: 5,
    unseatedCap: 3,
  },
  fx: {
    maxParticles: 240,
    shakeDecay: 6,
  },
} as const;

export const TILE_LIMITS = {
  maxParticles: 240,
} as const;
