import { LevelDef, StarGoal } from './levels';
import { Runtime } from './types';

/** 单条三星目标是否达成（只在通关时结算） */
export function goalMet(rt: Runtime, goal: StarGoal): boolean {
  switch (goal.type) {
    case 'no-hit':
      return rt.hits === 0;
    case 'no-skill':
      return rt.skillUses === 0;
    case 'no-convert':
      return rt.convertedTotal === 0;
    case 'no-chalk':
      return rt.chalkThrown === 0;
    case 'under-time':
      return rt.time <= (goal.value ?? 0);
    default:
      return false;
  }
}

export interface StarResult {
  stars: number;
  goals: { text: string; met: boolean }[];
}

export function evaluateStars(rt: Runtime, def: LevelDef): StarResult {
  const goals = (def.stars ?? []).map((goal) => ({ text: goal.text, met: goalMet(rt, goal) }));
  return { stars: goals.filter((g) => g.met).length, goals };
}
