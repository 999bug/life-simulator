import type { GameState } from '../types';

/** 职业状态（从本局 flag 与历史推导，纯函数，不占用存档字段） */
export interface JobStatus {
  /** 职业 key（与 flag 同名映射） */
  id: string;
  title: string;
  icon: string;
  /** 入行年龄（旧存档历史无 flag 记录时为 null，等级按未知从业年数兜底 1） */
  since: number | null;
  /** 从业年限 */
  years: number;
}

/** flag → 职业映射表（按优先级排序，命中第一个即当前职业） */
const JOB_FLAG_MAP: ReadonlyArray<{ flag: string; id: string; title: string; icon: string }> = [
  { flag: 'doctor', id: 'doctor', title: '医生', icon: '⚕️' },
  { flag: 'startup_success', id: 'founder', title: '创业者', icon: '🚀' },
  { flag: 'civil_servant', id: 'civil', title: '体制内', icon: '🏛️' },
  { flag: 'tech_career', id: 'engineer', title: '程序员', icon: '💻' },
  { flag: 'grad_school', id: 'researcher', title: '科研工作者', icon: '🔬' },
  { flag: 'research_path', id: 'researcher', title: '科研工作者', icon: '🔬' },
  { flag: 'artist_pro', id: 'artist', title: '艺术家', icon: '🎨' },
  { flag: 'artist_life', id: 'artist', title: '艺术家', icon: '🎨' },
  { flag: 'athlete_pro', id: 'athlete', title: '运动员', icon: '🏅' },
  { flag: 'sports_career', id: 'athlete', title: '运动员', icon: '🏅' },
  { flag: 'military_flag', id: 'military', title: '军人', icon: '🎖️' },
  { flag: 'skilled_worker', id: 'worker', title: '技术工人', icon: '🔧' },
];

/** 职业晋升周期：每 3 年一级（对应中国式人生「每 3 年涨薪、5 年升职」的简化） */
const JOB_LEVEL_YEARS = 3;

/** 当前职业等级（从业年限每 3 年 +1，保底 1 级） */
export function jobLevel(years: number): number {
  return Math.floor(years / JOB_LEVEL_YEARS) + 1;
}

/**
 * 从本局状态推导当前职业。
 * 职业由事件链产出的 flag 决定（职业 flag 有产出者，见 stats.mjs 配对校验）；
 * 入行年龄取历史中首次产出该 flag 的选择记录（旧存档历史无 flags 字段时为 null）。
 *
 * @param game 本局状态
 * @returns 职业状态；无职业 flag 时返回 null
 */
export function jobStatus(game: GameState): JobStatus | null {
  const hit = JOB_FLAG_MAP.find(j => game.flags.includes(j.flag));
  if (!hit) {
    return null;
  }
  // 入行年龄：历史中首次产出该 flag 的选择；旧存档无 flags 字段 → null
  let since: number | null = null;
  for (const h of game.history) {
    if (h.flags?.includes(hit.flag)) {
      since = h.age;
      break;
    }
  }
  if (since === null) {
    // 兜底：从全局 flag 追溯最早出现年龄（历史无记录时）
    for (const h of game.history) {
      if (h.age < game.age && h.text) {
        // 无法精确判定，取最早有记录的选择年龄作为近似
        since = h.age;
        break;
      }
    }
  }
  const years = since === null ? 0 : Math.max(0, game.age - since);
  return { id: hit.id, title: hit.title, icon: hit.icon, since, years };
}

/** 职业里程碑 flag（结算页时间线高亮；与 MILESTONE_FLAGS 合并使用） */
export const JOB_MILESTONE_FLAGS = JOB_FLAG_MAP.map(j => j.flag);
