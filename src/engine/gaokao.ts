import type { GameState } from '../types';

/** 高考结果（从本局学业 flag 推导，纯函数，不占用存档字段） */
export interface GaokaoResult {
  icon: string;
  label: string;
}

/**
 * 从本局状态推导高考结果。
 * 现有事件链已完整覆盖升学判定（17 岁出分 → 18 岁复读 → 19 岁录取，
 * 见 teen_29/teen_30/young_02/young_03/young_04 等），本函数只做结果回顾：
 * 按学业 flag 优先级取最高档。
 *
 * @param game 本局状态
 * @returns 高考结果；无学业相关 flag 时返回 null（未走升学路径）
 */
export function gaokaoResult(game: GameState): GaokaoResult | null {
  const { flags } = game;
  if (flags.includes('top_university')) {
    return { icon: '🎓', label: '考入重点大学' };
  }
  if (flags.includes('grad_school')) {
    return { icon: '🎓', label: '本科后继续深造' };
  }
  if (flags.includes('went_to_college')) {
    return { icon: '🏫', label: '考上大学' };
  }
  if (flags.includes('retake')) {
    return { icon: '📖', label: '复读后上岸' };
  }
  if (flags.includes('skilled_worker')) {
    return { icon: '🔧', label: '职校毕业' };
  }
  return null;
}
