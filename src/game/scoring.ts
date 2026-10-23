export type Rank = 'S' | 'A' | 'B' | 'C' | 'D';

export interface ScoreLine {
  label: string;
  value: number;
}

export interface CampaignScoreInput {
  timeUsed: number;
  timeLimit: number;
  hits: number;
  seated: number;
  pickups: number;
  missedSkills: number;
  won: boolean;
}

export interface ScoreResult {
  score: number;
  rank: Rank;
  breakdown: ScoreLine[];
}

const RANK_THRESHOLDS: { rank: Rank; min: number }[] = [
  { rank: 'S', min: 930 },
  { rank: 'A', min: 830 },
  { rank: 'B', min: 700 },
  { rank: 'C', min: 520 },
  { rank: 'D', min: 0 },
];

export function rankForScore(score: number): Rank {
  for (const t of RANK_THRESHOLDS) {
    if (score >= t.min) return t.rank;
  }
  return 'D';
}

/** 战役关卡评分：基础分 + 速度奖励 + 目标奖励 - 受击/空放惩罚 */
export function scoreCampaign(input: CampaignScoreInput): ScoreResult {
  const remaining = Math.max(0, Math.ceil(input.timeLimit - input.timeUsed));
  const timeBonus = remaining * 3;
  const hitPenalty = input.hits * 120;
  const seatedBonus = input.seated * 60;
  const pickupBonus = input.pickups * 90;
  const missPenalty = input.missedSkills * 40;
  const winBonus = input.won ? 100 : 0;

  // 没通关就只结算进度，不给速度分，避免"失败却 900 分"的荒诞结算
  if (!input.won) {
    const progress = Math.max(0, seatedBonus + pickupBonus - hitPenalty - missPenalty);
    const breakdown: ScoreLine[] = [];
    if (seatedBonus) breakdown.push({ label: `归位 ${input.seated} 位 ×60`, value: seatedBonus });
    if (pickupBonus) breakdown.push({ label: `彩蛋 ${input.pickups} 个 ×90`, value: pickupBonus });
    if (hitPenalty) breakdown.push({ label: `被命中 ${input.hits} 次 ×−120`, value: -hitPenalty });
    if (missPenalty) breakdown.push({ label: `空放温暖了 ${input.missedSkills} 次 ×−40`, value: -missPenalty });
    if (breakdown.length === 0) breakdown.push({ label: '本关未完成', value: 0 });
    return { score: Math.min(progress, 300), rank: 'D', breakdown };
  }

  const raw = 700 + timeBonus + winBonus + seatedBonus + pickupBonus - hitPenalty - missPenalty;
  const score = Math.max(0, Math.min(1000, Math.round(raw)));

  const breakdown: ScoreLine[] = [
    { label: '基础分', value: 700 },
    { label: `剩余时间 ${remaining}s ×3`, value: timeBonus },
    { label: '目标达成', value: seatedBonus },
    { label: '彩蛋收集', value: pickupBonus },
    { label: '通关奖励', value: winBonus },
  ];
  if (hitPenalty) breakdown.push({ label: `被命中 ${input.hits} 次 ×−120`, value: -hitPenalty });
  if (missPenalty) breakdown.push({ label: `空放温暖了 ${input.missedSkills} 次 ×−40`, value: -missPenalty });

  return { score, rank: rankForScore(score), breakdown };
}

/** 无尽模式：存活时长与累计归位人数共同计分 */
export function scoreEndless(input: { seconds: number; seated: number }): ScoreResult {
  const seconds = Math.round(input.seconds);
  const timeScore = seconds * 8;
  const seatScore = input.seated * 70;
  const score = timeScore + seatScore;
  const rank: Rank =
    score >= 1400 ? 'S' : score >= 950 ? 'A' : score >= 650 ? 'B' : score >= 350 ? 'C' : 'D';
  return {
    score,
    rank,
    breakdown: [
      { label: `生存 ${seconds}s ×8`, value: timeScore },
      { label: `归位 ${input.seated} 位 ×70`, value: seatScore },
    ],
  };
}

/** 双人对战：按成功喊回座位的同学数计分（不看存活时长） */
export function scoreDuel(params: { winner: 'runner' | 'chaser'; seated: number }): ScoreResult {
  const seatScore = params.seated * 120;
  const winBonus = params.winner === 'runner' ? 300 : 0;
  const score = seatScore + winBonus;
  const rank: Rank =
    score >= 1200 ? 'S' : score >= 900 ? 'A' : score >= 600 ? 'B' : score >= 300 ? 'C' : 'D';
  const breakdown: ScoreLine[] = [{ label: `归位 ${params.seated} 位 ×120`, value: seatScore }];
  if (winBonus) breakdown.push({ label: '撑满 60 秒', value: winBonus });
  return { score, rank, breakdown };
}
