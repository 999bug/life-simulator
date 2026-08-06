import type { GameState } from '../types';
import { calcScore } from './state.ts';

/** 结局路线图鉴条目 */
export interface VerdictRoute {
  key: string;
  icon: string;
  title: string;
  /** 图鉴中的路线提示（未收集时展示） */
  hint: string;
}

/**
 * 13 条人生路线图鉴（按结局判定优先级排序）。
 * title 与 SummaryScreen 结局页标题共用此表，避免两处文案漂移。
 */
export const VERDICT_ROUTES: VerdictRoute[] = [
  { key: 'startup_success', icon: '🚀', title: '创业者的传奇', hint: '创业路上坚持到底' },
  { key: 'world_traveler', icon: '🗺️', title: '行者无疆的一生', hint: '选择远行与旅居' },
  { key: 'grad_school', icon: '🎓', title: '学术深耕的一生', hint: '考研上岸，继续深造' },
  { key: 'top_university', icon: '🏫', title: '学霸的一生', hint: '考入重点大学' },
  { key: 'retake', icon: '🔄', title: '东山再起的一生', hint: '高考失利后选择复读' },
  { key: 'doctor', icon: '⚕️', title: '医者仁心的一生', hint: '从医学生走到主治医师' },
  { key: 'military_flag', icon: '🎖️', title: '铁血人生', hint: '响应号召参军入伍' },
  { key: 'athlete_pro', icon: '🏅', title: '赛场传奇', hint: '走上职业运动员之路' },
  { key: 'artist', icon: '🎨', title: '艺术人生', hint: '把艺术热爱变成职业' },
  { key: 'tech_career', icon: '💻', title: '技术精英的一生', hint: '投身科技行业' },
  { key: 'went_to_college', icon: '📚', title: '知识改变命运的一生', hint: '考上大学' },
  { key: 'skilled_worker', icon: '🔧', title: '匠心人生', hint: '学一门手艺安身' },
  { key: 'civil_servant', icon: '🏛️', title: '安稳一生', hint: '考入体制内工作' },
];

/** 路线 key → 图鉴条目（SummaryScreen 结局标题查表用） */
export const VERDICT_META: Record<string, VerdictRoute> = Object.fromEntries(
  VERDICT_ROUTES.map(r => [r.key, r]),
);

/** 分数档结局 key → 标题（与 SummaryScreen.scoreVerdict 分档一致；族谱/生涯统计展示用） */
export const SCORE_VERDICT_TITLES: Record<string, string> = {
  'score:75+': '辉煌的一生',
  'score:60+': '充实的一生',
  'score:45+': '平凡的一生',
  'score:30+': '坎坷的一生',
  'score:low': '艰难的一生',
};

/** 结局 key → 展示标题：路线查图鉴表，分数档查分档表 */
export function verdictTitle(key: string): string {
  return VERDICT_META[key]?.title ?? SCORE_VERDICT_TITLES[key] ?? '平凡的一生';
}

/**
 * 结局判定 key：路线 flag 优先，无则按分数档。
 * 与 SummaryScreen.getVerdict 的判定顺序一致（仅取 key，不含文案）。
 */
export function verdictKey(game: GameState): string {
  const { flags, attributes } = game;
  const has = (...fs: string[]) => fs.some(f => flags.includes(f));
  const order: Array<[string, string[]]> = [
    ['startup_success', ['startup_success']],
    ['world_traveler', ['world_traveler']],
    ['grad_school', ['grad_school']],
    ['top_university', ['top_university']],
    ['retake', ['retake']],
    ['doctor', ['doctor']],
    ['military_flag', ['military_flag']],
    ['athlete_pro', ['athlete_pro']],
    ['artist', ['artist_pro', 'artist_life']],
    ['tech_career', ['tech_career']],
    ['went_to_college', ['went_to_college']],
    ['skilled_worker', ['skilled_worker']],
    ['civil_servant', ['civil_servant']],
  ];
  for (const [key, fs] of order) {
    if (has(...fs)) {
      return key;
    }
  }
  const score = calcScore(attributes);
  return score >= 75 ? 'score:75+' : score >= 60 ? 'score:60+' : score >= 45 ? 'score:45+' : score >= 30 ? 'score:30+' : 'score:low';
}
