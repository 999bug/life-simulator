import type { AttributeKey, Attributes } from '../types';
import { mulberry32 } from './events.ts';

/** 天赋稀有度：黑/蓝/紫/橙（对应人生重开模拟器的四级抽卡） */
export type TalentRarity = 'common' | 'uncommon' | 'rare' | 'epic';

/** 天赋稀有度元数据（展示用：颜色 + 掉落权重） */
export const RARITY_META: Record<TalentRarity, { label: string; color: string; weight: number }> = {
  common: { label: '黑', color: '#8a8a9a', weight: 5 },
  uncommon: { label: '蓝', color: '#5d9ce8', weight: 3 },
  rare: { label: '紫', color: '#b57edc', weight: 1.5 },
  epic: { label: '橙', color: '#e8a05d', weight: 0.6 },
};

/** 天赋定义 */
export interface TalentDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  rarity: TalentRarity;
  /** 开局属性加成（与初始属性叠加，上限 100 由引擎统一钳位） */
  attrs?: Partial<Attributes>;
  /** 属性点分配额度增减（部分天赋自带/克扣出身点数） */
  bonusPoints?: number;
  /** 互斥天赋 id（选中其一后另一不可选） */
  excludes?: string[];
}

/**
 * 天赋表（20 个，4 级稀有度）。
 * 效果限定为「属性 + 分配点数」，不给 flag——开局 flag 会被结局判定消费，
 * 破坏结局分布与平衡审计（教训：结局 flag 必须由事件链产出）。
 */
export const TALENTS: TalentDef[] = [
  // 黑（常见）：单属性小幅
  { id: 'robust', name: '健壮体魄', icon: '💪', desc: '出生体质优于常人，健康 +6', rarity: 'common', attrs: { health: 6 } },
  { id: 'clever', name: '聪慧过人', icon: '🧠', desc: '从小就机灵，智力 +6', rarity: 'common', attrs: { intelligence: 6 } },
  { id: 'welloff', name: '家底殷实', icon: '🏦', desc: '父母攒了些钱，财富 +6', rarity: 'common', attrs: { wealth: 6 } },
  { id: 'cheerful', name: '乐天知命', icon: '😊', desc: '再难的事也能笑出来，幸福 +6', rarity: 'common', attrs: { happiness: 6 } },
  { id: 'socialite', name: '左右逢源', icon: '👥', desc: '天生会聊天，社交 +6', rarity: 'common', attrs: { social: 6 } },
  { id: 'goodlooks', name: '天生丽质', icon: '✨', desc: '打小就招人喜欢，魅力 +6', rarity: 'common', attrs: { appearance: 6 } },
  { id: 'lucky', name: '幸运儿', icon: '🍀', desc: '丢硬币永远是正面，运气 +6', rarity: 'common', attrs: { luck: 6 } },
  { id: 'kind', name: '心善', icon: '🕊️', desc: '见不得别人受苦，道德 +6', rarity: 'common', attrs: { morality: 6 } },
  // 蓝（少见）：属性组合
  { id: 'scholarly', name: '书香门第', icon: '📚', desc: '家里书比玩具多，智力 +8、幸福 -2', rarity: 'uncommon', attrs: { intelligence: 8, happiness: -2 } },
  { id: 'business_sense', name: '商业头脑', icon: '📈', desc: '压岁钱都会投资，财富 +8、社交 +2', rarity: 'uncommon', attrs: { wealth: 8, social: 2 } },
  { id: 'workaholic', name: '天生劳碌', icon: '⏰', desc: '闲下来浑身难受，财富 +4、幸福 -3', rarity: 'uncommon', attrs: { wealth: 4, happiness: -3 }, excludes: ['zen'] },
  { id: 'zen', name: '佛系人生', icon: '🧘', desc: '万物随缘，幸福 +6、财富 -3', rarity: 'uncommon', attrs: { happiness: 6, wealth: -3 }, excludes: ['workaholic', 'perfectionist'] },
  { id: 'perfectionist', name: '完美主义', icon: '🎯', desc: '眼里容不得沙子，魅力 +5、幸福 -2', rarity: 'uncommon', attrs: { appearance: 5, happiness: -2 }, excludes: ['zen'] },
  { id: 'versatile', name: '多才多艺', icon: '🎨', desc: '样样会一点，智力 +3、社交 +3、魅力 +3', rarity: 'uncommon', attrs: { intelligence: 3, social: 3, appearance: 3 } },
  // 紫（稀有）：单属性大幅
  { id: 'iron_body', name: '钢铁之躯', icon: '🛡️', desc: '打针不哭、跑步不喘，健康 +12', rarity: 'rare', attrs: { health: 12 } },
  { id: 'genius', name: '天才大脑', icon: '⚡', desc: '过目不忘，智力 +12', rarity: 'rare', attrs: { intelligence: 12 } },
  { id: 'rich_family', name: '富豪世家', icon: '👑', desc: '含着金汤匙出生，财富 +12', rarity: 'rare', attrs: { wealth: 12 }, excludes: ['self_made'] },
  { id: 'energetic', name: '精力充沛', icon: '🔥', desc: '永远电量满格，健康 +8、运气 +2', rarity: 'rare', attrs: { health: 8, luck: 2 } },
  { id: 'karp', name: '锦鲤附体', icon: '🐟', desc: '大事小情总有好运兜底，运气 +8、幸福 +2', rarity: 'rare', attrs: { luck: 8, happiness: 2 }, excludes: ['destiny_child'] },
  // 橙（传说）：全属性/组合大幅
  { id: 'destiny_child', name: '命运之子', icon: '🌠', desc: '天生被眷顾，运气 +10、幸福 +5', rarity: 'epic', attrs: { luck: 10, happiness: 5 }, excludes: ['karp'] },
  { id: 'self_made', name: '白手起家', icon: '🏔️', desc: '出生贫寒但韧性十足，财富 +10、智力 +3、幸福 -5、分配点数 -2', rarity: 'epic', attrs: { wealth: 10, intelligence: 3, happiness: -5 }, bonusPoints: -2, excludes: ['rich_family'] },
  { id: 'heavenly', name: '天降大任', icon: '🌌', desc: '苦其心志劳其筋骨，全属性 +4、分配点数 -2', rarity: 'epic', attrs: { health: 4, intelligence: 4, wealth: 4, happiness: 4, social: 4, appearance: 4, luck: 4, morality: 4 }, bonusPoints: -2 },
];

/** 天赋表索引（id → 定义） */
const TALENT_BY_ID = new Map(TALENTS.map(t => [t.id, t]));

/** 开局天赋抽卡候选数 */
export const TALENT_DRAFT_COUNT = 10;
/** 开局可选天赋上限 */
export const TALENT_PICK_LIMIT = 3;

/** 开局属性点基数（12 点自由分配） */
export const BASE_ALLOC_POINTS = 12;

/** 按 id 查天赋定义；未知 id 返回 undefined */
export function getTalent(id: string): TalentDef | undefined {
  return TALENT_BY_ID.get(id);
}

/** 天赋属性点额度：基数 + 天赋加成/克扣 */
export function allocPoints(talents: string[]): number {
  const bonus = talents.reduce((sum, id) => sum + (getTalent(id)?.bonusPoints ?? 0), 0);
  return BASE_ALLOC_POINTS + bonus;
}

/**
 * 按稀有度权重抽 k 个天赋候选（不重复）。
 * 继承天赋（inheritId）必定在候选中（置顶由调用方处理）。
 * 抽卡用随机数（开局构筑是玩家交互，无需确定性还原）。
 *
 * @param count 候选数量
 * @param inheritId 继承天赋 id（可无）
 * @returns 天赋 id 数组（含继承天赋）
 */
export function drawTalents(count: number, inheritId?: string): string[] {
  const pool = TALENTS.filter(t => t.id !== inheritId);
  const rng = mulberry32(Math.floor(Math.random() * 2 ** 31));
  // 按稀有度权重抽取（带放回），去重直到凑满
  const total = pool.reduce((s, t) => s + RARITY_META[t.rarity].weight, 0);
  const picked = new Set<string>();
  const result: string[] = [];
  if (inheritId) {
    result.push(inheritId);
  }
  while (result.length < count && picked.size < pool.length) {
    let r = rng() * total;
    for (const t of pool) {
      r -= RARITY_META[t.rarity].weight;
      if (r <= 0) {
        if (!picked.has(t.id)) {
          picked.add(t.id);
          result.push(t.id);
        }
        break;
      }
    }
  }
  return result;
}

/**
 * 应用天赋属性效果：按天赋 attrs 逐项加到初始属性上。
 * 纯函数，返回新属性（不修改原对象）。
 *
 * @param attrs 初始属性表
 * @param talents 天赋 id 数组
 * @returns 加成后的属性表
 */
export function applyTalents(attrs: Attributes, talents: string[]): Attributes {
  const out = { ...attrs };
  for (const id of talents) {
    const t = getTalent(id);
    if (!t?.attrs) {
      continue;
    }
    for (const [k, v] of Object.entries(t.attrs) as [AttributeKey, number][]) {
      out[k] = Math.max(0, Math.min(100, out[k] + v));
    }
  }
  return out;
}

/**
 * 应用属性点分配：把分配结果加到属性表上（上限 100）。
 * 纯函数，返回新属性。
 *
 * @param attrs 初始属性表
 * @param alloc 分配结果（各属性加点）
 * @returns 分配后的属性表
 */
export function applyAllocation(attrs: Attributes, alloc: Partial<Attributes>): Attributes {
  const out = { ...attrs };
  for (const [k, v] of Object.entries(alloc) as [AttributeKey, number][]) {
    out[k] = Math.max(0, Math.min(100, out[k] + v));
  }
  return out;
}

/**
 * 校验所选天赋组合是否合法：无重复、数量不超限、无互斥冲突。
 *
 * @param ids 已选天赋 id 数组
 * @param candidate 待加入的天赋 id（可空：只校验已选集合）
 * @returns 合法返回 null，否则返回冲突说明
 */
export function talentConflict(ids: string[], candidate?: string): string | null {
  if (candidate) {
    if (ids.includes(candidate)) {
      return '已选择';
    }
    if (ids.length >= TALENT_PICK_LIMIT) {
      return `最多选择 ${TALENT_PICK_LIMIT} 个天赋`;
    }
    const def = getTalent(candidate);
    if (def?.excludes?.some(x => ids.includes(x))) {
      const conflict = def.excludes.find(x => ids.includes(x));
      return `与「${getTalent(conflict!)?.name}」互斥`;
    }
    return null;
  }
  // 校验已选集合内部的互斥（理论上不出现，防御性检查）
  for (const id of ids) {
    const def = getTalent(id);
    if (def?.excludes?.some(x => ids.includes(x))) {
      return '天赋组合存在互斥';
    }
  }
  return null;
}

// ============ 天赋继承（跨周目，localStorage）============

/** 天赋继承存储 key */
const INHERIT_KEY = 'life-sim-talent-inherit';

/** 天赋继承记录：上一世选择传承的天赋 id（开局抽卡时置顶出现） */
export interface TalentInherit {
  talentId: string;
  /** 设置日期 YYYYMMDD（展示用） */
  date: string;
}

/** 读取继承天赋；数据损坏或存储不可用时返回 null */
export function loadInheritTalent(): TalentInherit | null {
  try {
    const raw = localStorage.getItem(INHERIT_KEY);
    if (raw) {
      const data = JSON.parse(raw) as TalentInherit;
      if (data && typeof data.talentId === 'string' && getTalent(data.talentId)) {
        return { talentId: data.talentId, date: typeof data.date === 'string' ? data.date : '' };
      }
    }
  } catch {
    // 忽略损坏数据
  }
  return null;
}

/** 设置继承天赋（覆盖旧继承）；存储不可用时静默降级 */
export function saveInheritTalent(talentId: string, date: string): void {
  try {
    localStorage.setItem(INHERIT_KEY, JSON.stringify({ talentId, date }));
  } catch {
    // 存储不可用静默降级
  }
}
