import type { FamilyMember, GameState } from '../types';
import { calcScore } from './state.ts';
import { VERDICT_META, verdictKey } from './verdict.ts';

/** 族谱存储 key（跨周目） */
export const FAMILY_KEY = 'life-sim-family';

/** 族谱容量上限：localStorage 5MB 共用，超出裁掉最老世代 */
export const FAMILY_MAX = 100;

/**
 * 读取族谱；数据损坏或存储不可用时返回空族谱。
 * 内容校验：每条成员必须有合法的世代/享年/评分/结局字段。
 */
export function loadFamily(): FamilyMember[] {
  try {
    const raw = localStorage.getItem(FAMILY_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        return data.filter(m =>
          m && typeof m.name === 'string' && typeof m.generation === 'number'
          && typeof m.age === 'number' && typeof m.score === 'number' && typeof m.verdict === 'string',
        );
      }
    }
  } catch {
    // 忽略损坏数据
  }
  return [];
}

/** 持久化族谱；存储不可用时静默降级 */
export function saveFamily(family: FamilyMember[]): void {
  try {
    localStorage.setItem(FAMILY_KEY, JSON.stringify(family));
  } catch {
    // 存储不可用静默降级
  }
}

/**
 * 结算时把本局角色追加到族谱末尾，世代 = 族谱长度 + 1（线性家族）。
 * 超出容量时裁掉最老世代（世代号保留历史原值，不重排）。
 *
 * @param family 现有族谱
 * @param game 本局终局状态
 * @param date 完成日期 YYYYMMDD
 * @returns 追加后的新族谱
 */
export function appendFamilyMember(family: FamilyMember[], game: GameState, date: string): FamilyMember[] {
  const member: FamilyMember = {
    name: game.name,
    gender: game.gender,
    generation: family.length + 1,
    age: game.age,
    score: calcScore(game.attributes),
    verdict: verdictKey(game),
    attrs: { ...game.attributes },
    date,
  };
  return [...family, member].slice(-FAMILY_MAX);
}

/** 跨代继承 flag 前缀（数据管线 merge-fragments 对此前缀豁免配对校验） */
export const PARENT_FLAG_PREFIX = 'parent_';

/**
 * 上一代结局路线 → 下一代开局注入的传承 flag。
 * 仅 13 条结局路线有职业语义；分数档结局（score:*）不注入。
 *
 * @param family 现有族谱
 * @returns 传承 flag（如 parent_doctor），族谱为空或分数档结局时为 null
 */
export function parentFlag(family: FamilyMember[]): string | null {
  const latest = family[family.length - 1];
  if (!latest || !VERDICT_META[latest.verdict]) {
    return null;
  }
  return PARENT_FLAG_PREFIX + latest.verdict;
}
