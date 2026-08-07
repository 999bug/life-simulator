import type { GameState } from '../types';

/** 资产条目（从本局 flag 与属性推导，纯函数，不占用存档字段） */
export interface AssetItem {
  icon: string;
  label: string;
}

/**
 * 从本局状态推导资产组合。
 * 投资链 flag 递进（investor → investor_sharp → invest_legend，由事件链产出），
 * 创业/实业 flag 单独成项；财富高位时补充存款描述。
 *
 * @param game 本局状态
 * @returns 资产条目数组（可为空）
 */
export function assetStatus(game: GameState): AssetItem[] {
  const { flags, attributes } = game;
  const items: AssetItem[] = [];
  if (flags.includes('invest_legend')) {
    items.push({ icon: '📈', label: '传奇投资组合' });
  } else if (flags.includes('investor_sharp')) {
    items.push({ icon: '📈', label: '成熟的股票投资' });
  } else if (flags.includes('investor')) {
    items.push({ icon: '📊', label: '初具规模的投资' });
  }
  if (flags.includes('startup_success')) {
    items.push({ icon: '🏢', label: '自有公司' });
  }
  if (attributes.wealth >= 80) {
    items.push({ icon: '🏦', label: '丰厚存款' });
  } else if (attributes.wealth >= 50) {
    items.push({ icon: '🏦', label: '小有积蓄' });
  }
  return items;
}
