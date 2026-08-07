import type { GameState } from '../types';

/** 每周挑战目标定义（复用 GoalKey 语义 + 独立判定函数） */
export interface WeeklyGoal {
  key: string;
  icon: string;
  name: string;
  desc: string;
}

/**
 * 每周挑战目标池（5 个）：每周按周种子确定性地抽 1 个。
 * 判定全部为「终局时刻」可确定的属性/flag 条件。
 */
export const WEEKLY_GOALS: WeeklyGoal[] = [
  { key: 'age80', icon: '🎋', name: '长寿人生', desc: '活到 80 岁' },
  { key: 'wealth', icon: '💰', name: '家财万贯', desc: '财富达到 75，或创业成功' },
  { key: 'academic', icon: '🎓', name: '学有所成', desc: '考入重点大学或深造' },
  { key: 'doctor', icon: '🏥', name: '白衣天使', desc: '成为一名医生' },
  { key: 'family', icon: '🏠', name: '家庭美满', desc: '已婚有娃且幸福达到 70' },
];

/**
 * ISO 周号（本地时区，周一为一周之始）。
 *
 * @param d 日期
 * @returns 形如「2026-W32」的周标识（每周挑战种子与最佳记录共用）
 */
export function weekOf(d: Date): string {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // 移到本周四（周一=0 偏移）
  const dayNum = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - dayNum + 3);
  const firstThursday = new Date(date.getFullYear(), 0, 4);
  const firstDayNum = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayNum + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return `${date.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * 周标识 → 确定性种子（与每日挑战 dateToSeed 同款逐字符哈希）。
 * 同一周种子相同（每周挑战全局同一目标），跨周不同。
 */
export function weekSeed(week: string): number {
  let acc = 0;
  for (let i = 0; i < week.length; i++) {
    acc = (acc * 31 + week.charCodeAt(i)) >>> 0;
  }
  return acc;
}

/** 本周挑战目标（按周种子从目标池确定性抽取） */
export function pickWeeklyGoal(week: string): WeeklyGoal {
  return WEEKLY_GOALS[weekSeed(week) % WEEKLY_GOALS.length];
}

/**
 * 判定每周挑战目标是否达成（终局时刻调用）。
 *
 * @param goal 本周目标
 * @param game 结算时游戏状态
 * @returns 是否达成
 */
export function checkWeeklyGoal(goal: WeeklyGoal, game: GameState): boolean {
  const { attributes, flags } = game;
  const has = (...fs: string[]) => fs.some(f => flags.includes(f));
  switch (goal.key) {
    case 'age80':
      return game.age >= 80;
    case 'wealth':
      return attributes.wealth >= 75 || has('startup_success');
    case 'academic':
      return has('top_university', 'grad_school');
    case 'doctor':
      return has('doctor');
    case 'family':
      return has('married', 'has_child') && attributes.happiness >= 70;
    default:
      return false;
  }
}
