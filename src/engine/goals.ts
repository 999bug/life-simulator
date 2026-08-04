import type { GameState, GoalKey } from '../types';

/** 目标达成检查结果 */
export interface GoalResult {
  achieved: boolean;
  /** 达成描述或差距提示（未达成时含当前值/目标值） */
  detail: string;
}

/** 人生目标定义 */
export interface GoalDef {
  key: GoalKey;
  icon: string;
  name: string;
  desc: string;
}

/** 6 个预设人生目标 */
export const GOALS: GoalDef[] = [
  { key: 'wealth', icon: '💰', name: '财富自由', desc: '积累 80 以上财富，或创业成功' },
  { key: 'travel', icon: '✈️', name: '环游世界', desc: '走遍山川湖海，成为行者' },
  { key: 'academic', icon: '🎓', name: '学术深耕', desc: '考研深造，或考入顶尖学府' },
  { key: 'doctor', icon: '🏥', name: '白衣天使', desc: '学医从医，救死扶伤' },
  { key: 'family', icon: '🏠', name: '家庭美满', desc: '婚姻幸福，儿女绕膝' },
  { key: 'stable', icon: '⚖️', name: '安稳一生', desc: '体制内安定，或安稳落地' },
];

/**
 * 检查目标达成情况。
 *
 * @param goal 目标 key（null = 无目标）
 * @param game 结算时的游戏状态
 * @returns 无目标返回 null；否则返回达成与否与描述
 */
export function checkGoal(goal: GoalKey | null, game: GameState): GoalResult | null {
  if (!goal) {
    return null;
  }
  const { attributes, flags } = game;
  const has = (...fs: string[]) => fs.some(f => flags.includes(f));
  const detail = (achieved: boolean, text: string): GoalResult => ({ achieved, detail: text });

  switch (goal) {
    case 'wealth':
      return attributes.wealth >= 80 || has('startup_success')
        ? detail(true, '你实现了财务自由')
        : detail(false, `财富 ${attributes.wealth}/80`);
    case 'travel':
      return has('world_traveler')
        ? detail(true, '你的脚步丈量过世界')
        : detail(false, '尚未踏上环游世界的旅程');
    case 'academic':
      return has('grad_school', 'top_university')
        ? detail(true, '你在学术之路上深耕')
        : detail(false, '未走上学术道路');
    case 'doctor':
      return has('doctor')
        ? detail(true, '你救死扶伤，医者仁心')
        : detail(false, '未穿上白大褂');
    case 'family': {
      const hasFamily = flags.includes('married') && flags.includes('has_child');
      return hasFamily && attributes.happiness >= 70
        ? detail(true, '家庭美满，此生有爱')
        : hasFamily
          ? detail(false, `幸福 ${attributes.happiness}/70`)
          : detail(false, '未组建家庭');
    }
    case 'stable':
      return has('civil_servant', 'settled_down')
        ? detail(true, '岁月静好，安稳一生')
        : detail(false, '未过上安稳的日子');
  }
}
