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
  },
  fx: {
    maxParticles: 240,
    shakeDecay: 6,
  },
} as const;

export const TILE_LIMITS = {
  maxParticles: 240,
} as const;
