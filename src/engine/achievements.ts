import type { AchievementId, GameState } from '../types';
import { calcScore } from './state.ts';

/** 成就分层：1 铜 / 2 银 / 3 金（仅展示分组与徽章，不影响判定） */
export type AchievementTier = 1 | 2 | 3;

/** 成就定义 */
export interface AchievementDef {
  id: AchievementId;
  icon: string;
  name: string;
  desc: string;
  tier: AchievementTier;
}

/** 27 个跨周目成就（按铜→银→金排序，同档内按系列排列） */
export const ACHIEVEMENTS: AchievementDef[] = [
  // 铜档：入门与轻度目标
  { id: 'first_life', icon: '👶', name: '第一次人生', desc: '完整走完第一局人生', tier: 1 },
  { id: 'age_80', icon: '🎋', name: '耄耋之年', desc: '享年达到 80 岁', tier: 1 },
  { id: 'wealthy_60', icon: '💰', name: '衣食无忧', desc: '财富达到 60', tier: 1 },
  { id: 'bright_70', icon: '💡', name: '才思敏捷', desc: '智力达到 70', tier: 1 },
  { id: 'score_60', icon: '🎖️', name: '小有成就', desc: '综合评分达到 60', tier: 1 },
  { id: 'three_endings', icon: '📖', name: '初识百态', desc: '累计达成 3 种不同结局', tier: 1 },
  { id: 'early_death', icon: '⏳', name: '英年早逝', desc: '40 岁前走完一生', tier: 1 },
  { id: 'lite_clear', icon: '⚡', name: '精简通关', desc: '以精简模式走完一生', tier: 1 },
  { id: 'auto_clear', icon: '🤖', name: '命运旁观者', desc: '完成一局快速模拟', tier: 1 },
  // 银档：需要经营的中度目标
  { id: 'longevity', icon: '🎂', name: '长寿', desc: '享年达到 90 岁', tier: 2 },
  { id: 'rich', icon: '💎', name: '财富自由', desc: '财富达到 90', tier: 2 },
  { id: 'scholar', icon: '🧠', name: '学霸', desc: '智力达到 85', tier: 2 },
  { id: 'iron_body', icon: '💪', name: '铁打的身体', desc: '健康达到 90', tier: 2 },
  { id: 'top_score', icon: '🏆', name: '名垂青史', desc: '综合评分达到 85', tier: 2 },
  { id: 'balanced', icon: '🌟', name: '均衡发展', desc: '全属性达到 60', tier: 2 },
  { id: 'big_family', icon: '👨‍👩‍👧‍👦', name: '儿孙满堂', desc: '已婚有娃且幸福达到 80', tier: 2 },
  { id: 'career', icon: '🚀', name: '事业有成', desc: '创业成功', tier: 2 },
  { id: 'traveler', icon: '🗺️', name: '环游世界', desc: '成为行者无疆', tier: 2 },
  { id: 'doctor', icon: '⚕️', name: '白衣天使', desc: '成为医生', tier: 2 },
  { id: 'three_lives', icon: '🔁', name: '三局人生', desc: '累计完成三局人生', tier: 2 },
  { id: 'five_endings', icon: '📚', name: '阅尽千帆', desc: '累计达成 5 种不同结局', tier: 2 },
  // 连续挑战：日活钩子（每日挑战跨天连续）
  { id: 'daily_streak_3', icon: '🔥', name: '三日不辍', desc: '连续 3 天完成每日挑战', tier: 2 },
  { id: 'daily_streak_7', icon: '⚡', name: '雷打不动', desc: '连续 7 天完成每日挑战', tier: 3 },
  // 金档：高玩极限目标
  { id: 'ultra_life', icon: '🌅', name: '期颐之年', desc: '享年达到 95 岁', tier: 3 },
  { id: 'rich_king', icon: '👑', name: '富可敌国', desc: '财富达到 95', tier: 3 },
  { id: 'genius', icon: '🧠', name: '天才大脑', desc: '智力达到 95', tier: 3 },
  { id: 'score_92', icon: '🌠', name: '千古流芳', desc: '综合评分达到 92', tier: 3 },
  { id: 'ten_lives', icon: '♾️', name: '十世轮回', desc: '累计完成 10 局人生', tier: 3 },
  { id: 'ten_endings', icon: '🏛️', name: '阅尽人生', desc: '累计达成 10 种不同结局', tier: 3 },
  { id: 'challenger', icon: '⚔️', name: '破局者', desc: '以挑战开局达成 70 分以上人生', tier: 3 },
];

/** 成就判定输入 */
export interface AchievementCheckInput {
  game: GameState;
  /** 累计完成局数（含本局） */
  completedLives: number;
  /** 本局是否精简模式 */
  wasLite: boolean;
  /** 本局是否快速模拟 */
  wasAuto: boolean;
  /** 累计达成结局数（含本局） */
  endingsCount: number;
  /** 每日挑战连续天数（含本局；普通局不推进） */
  dailyStreak: number;
}

/** 判定当前状态满足的所有成就（含已解锁的，去重由调用方处理） */
export function checkAchievements(input: AchievementCheckInput): AchievementId[] {
  const { game, completedLives, wasLite, wasAuto } = input;
  const { attributes, flags, age } = game;
  const has = (...fs: string[]) => fs.some(f => flags.includes(f));
  const ids = new Set<AchievementId>();

  if (completedLives >= 1) { ids.add('first_life'); }
  if (age >= 80) { ids.add('age_80'); }
  if (age >= 90) { ids.add('longevity'); }
  if (age >= 95) { ids.add('ultra_life'); }
  if (age < 40) { ids.add('early_death'); }
  if (attributes.wealth >= 60) { ids.add('wealthy_60'); }
  if (attributes.wealth >= 90) { ids.add('rich'); }
  if (attributes.wealth >= 95) { ids.add('rich_king'); }
  if (attributes.intelligence >= 70) { ids.add('bright_70'); }
  if (attributes.intelligence >= 85) { ids.add('scholar'); }
  if (attributes.intelligence >= 95) { ids.add('genius'); }
  if (calcScore(attributes) >= 60) { ids.add('score_60'); }
  if (calcScore(attributes) >= 85) { ids.add('top_score'); }
  if (calcScore(attributes) >= 92) { ids.add('score_92'); }
  if (attributes.health >= 90) { ids.add('iron_body'); }
  if (has('startup_success')) { ids.add('career'); }
  if (has('world_traveler')) { ids.add('traveler'); }
  if (has('doctor')) { ids.add('doctor'); }
  if (Object.values(attributes).every(v => v >= 60)) { ids.add('balanced'); }
  if (wasLite) { ids.add('lite_clear'); }
  if (wasAuto) { ids.add('auto_clear'); }
  if (completedLives >= 3) { ids.add('three_lives'); }
  if (completedLives >= 10) { ids.add('ten_lives'); }
  if (has('married', 'has_child') && attributes.happiness >= 80) { ids.add('big_family'); }
  if (input.endingsCount >= 3) { ids.add('three_endings'); }
  if (input.endingsCount >= 5) { ids.add('five_endings'); }
  if (input.endingsCount >= 10) { ids.add('ten_endings'); }
  if (game.challenge && calcScore(attributes) >= 70) { ids.add('challenger'); }
  // 连续挑战（日活钩子）：连续 3/7 天完成每日挑战
  if (input.dailyStreak >= 3) { ids.add('daily_streak_3'); }
  if (input.dailyStreak >= 7) { ids.add('daily_streak_7'); }
  return [...ids];
}
