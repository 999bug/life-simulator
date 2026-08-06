import type { FamilyMember, GameState } from '../types';
import { calcScore, getStageForAge, STAGE_ORDER } from './state.ts';
import { VERDICT_META, verdictKey } from './verdict.ts';

/** 族谱存储 key（跨周目） */
export const FAMILY_KEY = 'life-sim-family';

/** 族谱容量上限：localStorage 5MB 共用，超出裁掉最老世代 */
export const FAMILY_MAX = 100;

/** 保留完整回顾数据（detail）的最近代数：约 60-100KB/代，15 代 ≈ 1MB 出头 */
export const FAMILY_DETAIL_MAX = 15;

/** 未触发事件标题的存储上限（结算页展示前 10 条 + 余量计数） */
export const SKIPPED_TITLES_MAX = 20;

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
 * 所有走完的一生都入谱（含快速模拟/每日挑战，带标记）；超出容量时裁掉最老世代
 * （世代号保留历史原值，不重排）。
 * 新成员携带完整回顾数据（detail，结算页回看用）；仅最近 FAMILY_DETAIL_MAX 代保留
 * detail，更老的代裁剪为摘要行（localStorage 体积控制）。
 *
 * @param family 现有族谱
 * @param game 本局终局状态
 * @param date 完成日期 YYYYMMDD
 * @param meta 局型标记（auto 快速模拟 / daily 每日挑战）与未触发事件标题
 * @returns 追加后的新族谱
 */
export function appendFamilyMember(family: FamilyMember[], game: GameState, date: string, meta?: { auto?: boolean; daily?: boolean; skippedTitles?: string[] }): FamilyMember[] {
  const member: FamilyMember = {
    name: game.name,
    gender: game.gender,
    generation: family.length + 1,
    age: game.age,
    score: calcScore(game.attributes),
    verdict: verdictKey(game),
    attrs: { ...game.attributes },
    date,
    ...(meta?.auto ? { auto: true } : {}),
    ...(meta?.daily ? { daily: true } : {}),
    detail: {
      history: game.history,
      snapshots: game.snapshots,
      flags: game.flags,
      goal: game.goal,
      deathCause: game.deathCause,
      ...(game.challenge ? { challenge: true } : {}),
      ...(game.inherited ? { inherited: true } : {}),
      skippedTitles: (meta?.skippedTitles ?? []).slice(0, SKIPPED_TITLES_MAX),
    },
  };
  const next = [...family, member].slice(-FAMILY_MAX);
  // 仅最近 FAMILY_DETAIL_MAX 代保留完整回顾数据
  return next.map((m, i) => (i < next.length - FAMILY_DETAIL_MAX && m.detail ? { ...m, detail: undefined } : m));
}

/** 跨代继承 flag 前缀（数据管线 merge-fragments 对此前缀豁免配对校验） */
export const PARENT_FLAG_PREFIX = 'parent_';

/**
 * 上一代结局路线 → 下一代开局注入的传承 flag。
 * 仅 13 条结局路线有职业语义；分数档结局（score:*）不注入。
 * 快速模拟代（随机选择的人生）不参与传承，向上取最近一代手玩局。
 *
 * @param family 现有族谱
 * @returns 传承 flag（如 parent_doctor），族谱为空或最近手玩局为分数档结局时为 null
 */
export function parentFlag(family: FamilyMember[]): string | null {
  const latest = [...family].reverse().find(m => !m.auto);
  if (!latest || !VERDICT_META[latest.verdict]) {
    return null;
  }
  return PARENT_FLAG_PREFIX + latest.verdict;
}

/**
 * 从族谱记录重建只读终局状态（生涯/族谱点击回看结算页用）。
 *
 * @param member 族谱成员
 * @returns 可渲染 SummaryScreen 的 GameState；该代无完整回顾数据（老代已裁剪）时为 null
 */
export function recapGame(member: FamilyMember): GameState | null {
  const detail = member.detail;
  if (!detail) {
    return null;
  }
  const stage = getStageForAge(member.age);
  return {
    gender: member.gender,
    name: member.name,
    age: member.age,
    stage,
    stageIdx: STAGE_ORDER.indexOf(stage),
    attributes: member.attrs,
    flags: detail.flags,
    history: detail.history,
    phase: 'summary',
    deathCause: detail.deathCause,
    goal: detail.goal,
    snapshots: detail.snapshots,
    challenge: detail.challenge,
    inherited: detail.inherited,
  };
}
