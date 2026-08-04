import type { AchievementId, GameState } from '../types';
import { calcScore } from './state.ts';

/** 成就定义 */
export interface AchievementDef {
  id: AchievementId;
  icon: string;
  name: string;
  desc: string;
}

/** 20 个跨周目成就 */
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_life', icon: '👶', name: '第一次人生', desc: '完整走完第一局人生' },
  { id: 'longevity', icon: '🎂', name: '长寿', desc: '享年达到 90 岁' },
  { id: 'early_death', icon: '⏳', name: '英年早逝', desc: '40 岁前走完一生' },
  { id: 'rich', icon: '💎', name: '财富自由', desc: '财富达到 90' },
  { id: 'scholar', icon: '🧠', name: '学霸', desc: '智力达到 85' },
  { id: 'career', icon: '🚀', name: '事业有成', desc: '创业成功' },
  { id: 'traveler', icon: '🗺️', name: '环游世界', desc: '成为行者无疆' },
  { id: 'doctor', icon: '⚕️', name: '白衣天使', desc: '成为医生' },
  { id: 'balanced', icon: '🌟', name: '均衡发展', desc: '全属性达到 60' },
  { id: 'lite_clear', icon: '⚡', name: '精简通关', desc: '以精简模式走完一生' },
  { id: 'auto_clear', icon: '🤖', name: '命运旁观者', desc: '完成一局快速模拟' },
  { id: 'three_lives', icon: '🔁', name: '三局人生', desc: '累计完成三局人生' },
  { id: 'top_score', icon: '🏆', name: '名垂青史', desc: '综合评分达到 85' },
  { id: 'genius', icon: '🧠', name: '天才大脑', desc: '智力达到 95' },
  { id: 'iron_body', icon: '💪', name: '铁打的身体', desc: '健康达到 90' },
  { id: 'rich_king', icon: '👑', name: '富可敌国', desc: '财富达到 95' },
  { id: 'big_family', icon: '👨‍👩‍👧‍👦', name: '儿孙满堂', desc: '已婚有娃且幸福达到 80' },
  { id: 'ultra_life', icon: '🌅', name: '期颐之年', desc: '享年达到 95 岁' },
  { id: 'five_endings', icon: '📚', name: '阅尽千帆', desc: '累计达成 5 种不同结局' },
  { id: 'ten_lives', icon: '♾️', name: '十世轮回', desc: '累计完成 10 局人生' },
  { id: 'challenger', icon: '⚔️', name: '破局者', desc: '以挑战开局达成 70 分以上人生' },
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
}

/** 判定当前状态满足的所有成就（含已解锁的，去重由调用方处理） */
export function checkAchievements(input: AchievementCheckInput): AchievementId[] {
  const { game, completedLives, wasLite, wasAuto } = input;
  const { attributes, flags, age } = game;
  const has = (...fs: string[]) => fs.some(f => flags.includes(f));
  const ids = new Set<AchievementId>();

  if (completedLives >= 1) { ids.add('first_life'); }
  if (age >= 90) { ids.add('longevity'); }
  if (age < 40) { ids.add('early_death'); }
  if (attributes.wealth >= 90) { ids.add('rich'); }
  if (attributes.intelligence >= 85) { ids.add('scholar'); }
  if (has('startup_success')) { ids.add('career'); }
  if (has('world_traveler')) { ids.add('traveler'); }
  if (has('doctor')) { ids.add('doctor'); }
  if (Object.values(attributes).every(v => v >= 60)) { ids.add('balanced'); }
  if (wasLite) { ids.add('lite_clear'); }
  if (wasAuto) { ids.add('auto_clear'); }
  if (completedLives >= 3) { ids.add('three_lives'); }
  if (calcScore(attributes) >= 85) { ids.add('top_score'); }
  if (attributes.intelligence >= 95) { ids.add('genius'); }
  if (attributes.health >= 90) { ids.add('iron_body'); }
  if (attributes.wealth >= 95) { ids.add('rich_king'); }
  if (has('married', 'has_child') && attributes.happiness >= 80) { ids.add('big_family'); }
  if (age >= 95) { ids.add('ultra_life'); }
  if (input.endingsCount >= 5) { ids.add('five_endings'); }
  if (completedLives >= 10) { ids.add('ten_lives'); }
  if (game.challenge && calcScore(attributes) >= 70) { ids.add('challenger'); }
  return [...ids];
}
