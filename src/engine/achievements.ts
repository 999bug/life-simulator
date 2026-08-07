import type { AchievementId, AttributeKey, Attributes, GameState } from '../types';
import { calcScore } from './state.ts';
import { npcBonds } from './npcs.ts';
import { jobStatus, jobLevel } from './jobs.ts';
import { derivePersona } from './personality.ts';

/** 成就分层：1 铜 / 2 银 / 3 金（仅展示分组与徽章，不影响判定） */
export type AchievementTier = 1 | 2 | 3;

/** 成就定义 */
export interface AchievementDef {
  id: AchievementId;
  icon: string;
  name: string;
  desc: string;
  tier: AchievementTier;
  /** 隐藏成就（解锁前在成就面板显示「？？？」；解锁条件不公开，保留探索乐趣） */
  hidden?: boolean;
}

/** 41 个跨周目成就（按铜→银→金排序，同档内按系列排列） */
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
  { id: 'vivid_persona', icon: '🎭', name: '性格鲜明', desc: '任一性格端达到 15 次', tier: 1 },
  { id: 'adventurous_persona', icon: '🏃', name: '冒险家的一生', desc: '冒险性格达到 12 次', tier: 1 },
  { id: 'redeemed_life', icon: '🌱', name: '改过自新', desc: '入狱后洗心革面，重新开始人生', tier: 1 },
  { id: 'fugitive', icon: '🏃', name: '亡命天涯', desc: '越狱成功，从此隐姓埋名', tier: 1 },
  { id: 'gang_lord', icon: '👑', name: '黑道风云', desc: '在帮派里上位，江湖留名', tier: 1 },
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
  // 隐藏成就：解锁前只显示问号（条件不公开，保留探索乐趣）
  { id: 'gaokao_top', icon: '🎓', name: '金榜题名', desc: '考入重点大学', tier: 2, hidden: true },
  { id: 'family_harmony', icon: '🏡', name: '家和万事兴', desc: '与家人关系融洽（家人关系值 80 以上）', tier: 2, hidden: true },
  { id: 'job_elite', icon: '💼', name: '职场精英', desc: '深耕一个行业十年（职业等级 5 级）', tier: 3, hidden: true },
  { id: 'asset_owner', icon: '🏦', name: '有产者', desc: '拥有投资或实业资产', tier: 1, hidden: true },
  { id: 'hexagon_persona', icon: '🧬', name: '六边形战士', desc: '六种性格端全部达到 5 次', tier: 2, hidden: true },
  { id: 'altruistic_persona', icon: '🕊️', name: '温暖的人', desc: '利他性格达到 12 次', tier: 1, hidden: true },
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
  // 隐藏成就（2026-08 新增）：金榜题名 / 家和万事兴 / 职场精英 / 有产者
  if (has('top_university')) { ids.add('gaokao_top'); }
  if (npcBonds(game).family >= 80) { ids.add('family_harmony'); }
  const job = jobStatus(game);
  if (job && job.since !== null && jobLevel(job.years) >= 5) { ids.add('job_elite'); }
  if (has('investor', 'investor_sharp', 'invest_legend', 'startup_success')) { ids.add('asset_owner'); }
  // 性格成就（2026-08 新增）：从选择历史推导性格画像判定
  const persona = derivePersona(game.history);
  const personaValues = Object.values(persona);
  if (personaValues.some(v => v >= 15)) { ids.add('vivid_persona'); }
  if (personaValues.every(v => v >= 5)) { ids.add('hexagon_persona'); }
  if (persona.adventurous >= 12) { ids.add('adventurous_persona'); }
  if (persona.altruistic >= 12) { ids.add('altruistic_persona'); }
  // 铁窗人生路线（2026-08 新增）：入狱后出狱且改过自新（终局道德与幸福达标）
  if (flags.includes('jailed') && flags.includes('released') && attributes.morality >= 60 && attributes.happiness >= 50) { ids.add('redeemed_life'); }
  // 灰色路线极端结局（2026-08 新增）：越狱成功 / 黑帮上位
  if (flags.includes('escaped')) { ids.add('fugitive'); }
  if (flags.includes('gang_boss')) { ids.add('gang_lord'); }
  return [...ids];
}

// ============ 成就加成（跨周目）============

/** 成就加成周期：每解锁 N 个成就，下一世开局全属性 +2 */
const ACH_BONUS_PER = 10;
/** 成就加成步长（全属性 +2） */
const ACH_BONUS_STEP = 2;
/** 成就加成上限（加成后单属性不超过 100，由引擎统一钳位） */
export const ACH_BONUS_MAX_STEPS = 3;

/** 当前解锁数对应的加成步数（每 10 个 +1 步，封顶 3 步 = +6） */
export function achievementBonusSteps(unlockedCount: number): number {
  return Math.min(ACH_BONUS_MAX_STEPS, Math.floor(unlockedCount / ACH_BONUS_PER));
}

/**
 * 成就加成：按已解锁成就数给下一世开局全属性加成（每 10 个 +2，封顶 +6）。
 * 加成顺序在天赋/分配之后、传承之前（「祖辈的成就照亮下一代」）。
 *
 * @param attrs 初始属性表（已含天赋/分配点）
 * @param unlockedCount 已解锁成就总数
 * @returns 加成后的属性表（不足 10 个时原样返回）
 */
export function applyAchievementBonus(attrs: Attributes, unlockedCount: number): Attributes {
  const steps = achievementBonusSteps(unlockedCount);
  if (steps <= 0) {
    return attrs;
  }
  const out = { ...attrs };
  for (const k of Object.keys(out) as AttributeKey[]) {
    out[k] = Math.min(100, out[k] + ACH_BONUS_STEP * steps);
  }
  return out;
}
