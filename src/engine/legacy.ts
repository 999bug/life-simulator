import type { AttributeKey, Attributes, FamilyMember } from '../types/index.ts';
import { ATTR_META } from './state.ts';

/** 家族底蕴生效所需的最少手玩代数（第一世无底蕴可传承） */
export const LEGACY_MIN_GENERATIONS = 2;

/** 家族底蕴统计窗口：取最近 N 代手玩局的终局属性 */
export const LEGACY_WINDOW = 5;

/** 强项门槛：均值 ≥ 此值的属性才享受加成（代代积累的强项） */
export const LEGACY_THRESHOLD = 70;

/** 每项加成幅度 */
export const LEGACY_BONUS = 2;

/** 总加成上限（克制设计：最多 3 项各 +2，避免叠加传承后数值爆炸） */
export const LEGACY_MAX_TOTAL = 6;

/** 属性键遍历顺序（与 ATTR_META 定义顺序一致，加成与展示顺序稳定） */
const ATTR_KEYS = Object.keys(ATTR_META) as AttributeKey[];

/**
 * 家族底蕴推导结果。
 */
export interface LegacyState {
  /** 手玩局代数（快速模拟/每日挑战局不计入；决定「第 N 代」展示与生效门槛） */
  generations: number;
  /** 最近 LEGACY_WINDOW 代手玩局终局属性均值（Math.round，每项 0-100） */
  attrs: Partial<Attributes>;
}

/**
 * 从族谱推导家族底蕴：只统计真实手玩局（快速模拟/每日挑战不塑造家族底蕴），
 * 取最近 LEGACY_WINDOW 代的终局属性均值作为代代积累的强项基线。
 * 手玩代数不足 LEGACY_MIN_GENERATIONS 时无加成（第一世无底蕴）。
 *
 * @param family 现有族谱
 * @returns 手玩代数与最近代的属性均值
 */
export function deriveLegacy(family: FamilyMember[]): LegacyState {
  // 只看真实手玩局（auto 快速模拟 / daily 每日挑战不参与）
  const played = family.filter(m => !m.auto && !m.daily);
  if (played.length < LEGACY_MIN_GENERATIONS) {
    return { generations: played.length, attrs: {} };
  }
  // 取最近 LEGACY_WINDOW 代（族谱容量裁剪后顺序仍是世代先后，末尾最新）
  const recent = played.slice(-LEGACY_WINDOW);
  const attrs: Partial<Attributes> = {};
  for (const key of ATTR_KEYS) {
    // 旧存档成员可能缺终局属性字段，防御性按 0 计
    const sum = recent.reduce((acc, m) => acc + (m.attrs?.[key] ?? 0), 0);
    attrs[key] = Math.round(sum / recent.length);
  }
  return { generations: played.length, attrs };
}

/**
 * 计算家族底蕴实际加成（开局应用与家族面板展示共用，保证展示与引擎一致）。
 * 仅均值 ≥ LEGACY_THRESHOLD 的属性生效，每项 +LEGACY_BONUS，
 * 总加成封顶 LEGACY_MAX_TOTAL（按属性顺序取前若干项）。
 *
 * @param legacy 家族底蕴推导结果
 * @returns 实际加成映射（如 { health: 2, intelligence: 4 }）
 */
export function legacyBonuses(legacy: LegacyState): Partial<Attributes> {
  if (legacy.generations < LEGACY_MIN_GENERATIONS) {
    return {};
  }
  const bonuses: Partial<Attributes> = {};
  let total = 0;
  for (const [key, avg] of Object.entries(legacy.attrs) as [AttributeKey, number][]) {
    if (avg >= LEGACY_THRESHOLD && total < LEGACY_MAX_TOTAL) {
      const bonus = Math.min(LEGACY_MAX_TOTAL - total, LEGACY_BONUS);
      bonuses[key] = bonus;
      total += bonus;
    }
  }
  return bonuses;
}

/**
 * 开局应用家族底蕴：把强项加成叠加到属性上（clamp 0-100）。
 * 与传承独立叠加；调用链上位于 applyInheritance 之后、applyChallenge 之前。
 *
 * @param attrs 现有属性（开局应用链当前值）
 * @param legacy 家族底蕴推导结果
 * @returns 应用加成后的新属性表（纯函数，不修改入参）
 */
export function applyLegacy(attrs: Attributes, legacy: LegacyState): Attributes {
  const bonuses = legacyBonuses(legacy);
  const out = { ...attrs };
  for (const [key, bonus] of Object.entries(bonuses) as [AttributeKey, number][]) {
    out[key] = Math.min(100, out[key] + bonus);
  }
  return out;
}
