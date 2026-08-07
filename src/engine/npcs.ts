import type { GameState } from '../types';
import { EVENTS } from './events.ts';

/** 与家人的关系值（0-100；从本局历史推导，纯函数，不占用存档字段） */
export interface NpcBonds {
  /** 家人（family 分类事件中你的取舍） */
  family: number;
  /** 伴侣（love 分类事件中你的取舍） */
  partner: number;
  /** 朋友（friend 分类事件中你的取舍） */
  friends: number;
}

/** 各关系线的统计口径：事件分类 → 关系线 */
const BOND_CATEGORY: Record<string, keyof NpcBonds> = {
  family: 'family',
  love: 'partner',
  friend: 'friends',
};

/** 单次正向选择对关系值的贡献 */
const BOND_GAIN = 5;
/** 单次负向选择对关系值的贡献 */
const BOND_LOSS = 5;
/** 关系值中性起点（无相关记录 = 不好不坏） */
const BOND_BASE = 50;

/** 关系值钳位区间 */
function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/**
 * 从本局历史推导与身边人的关系值。
 *
 * 统计口径：family/love/friend 分类事件中，「净收益为正」的选择视为善待关系
 * （+5），「净收益为负」视为冷落/伤害（-5），其余不影响。
 * 无相关记录的关系线保持中性 50。
 *
 * @param game 本局状态（历史记录完整；旧存档无 flags 字段也能统计）
 * @returns 三条关系线 0-100
 */
export function npcBonds(game: GameState): NpcBonds {
  const bonds: NpcBonds = { family: BOND_BASE, partner: BOND_BASE, friends: BOND_BASE };
  // 按事件分类统计（历史记录含 eventId，查事件表取分类与选项效果）
  for (const h of game.history) {
    const ev = EVENTS.find(e => e.id === h.eventId);
    const line = ev ? BOND_CATEGORY[ev.category] : undefined;
    if (!ev || !line) {
      continue;
    }
    const choice = ev.choices[h.choiceIndex];
    if (!choice) {
      continue;
    }
    const net = Object.values(choice.outcomes.attr ?? {}).reduce((a, b) => a + b, 0);
    bonds[line] = clamp(bonds[line] + (net > 0 ? BOND_GAIN : net < 0 ? -BOND_LOSS : 0));
  }
  return bonds;
}

/** 关系线元数据（展示用） */
export const BOND_META: Record<keyof NpcBonds, { label: string; icon: string; color: string }> = {
  family: { label: '家人', icon: '👨‍👩‍👧', color: '#e8a05d' },
  partner: { label: '伴侣', icon: '💞', color: '#e85dbe' },
  friends: { label: '朋友', icon: '🤝', color: '#5de8d4' },
};
