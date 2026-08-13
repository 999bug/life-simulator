import type { GameState } from '../types';
import { calcScore } from './state.ts';

/** 结局路线图鉴条目 */
export interface VerdictRoute {
  key: string;
  icon: string;
  title: string;
  /** 图鉴中的路线提示（未收集时展示） */
  hint: string;
  /** 达成线索（已收集后展示，玩家视角中文描述，不露 flag 名） */
  clue: string;
}

/**
 * 16 条人生路线图鉴（按结局判定优先级排序）。
 * title 与 SummaryScreen 结局页标题共用此表，避免两处文案漂移。
 */
export const VERDICT_ROUTES: VerdictRoute[] = [
  {
    key: 'startup_success', icon: '🚀', title: '创业者的传奇', hint: '创业路上坚持到底',
    clue: '从一间办公室到一方天地，创业需要破釜沉舟。敢押上全部身家，才有资格站上风口',
  },
  {
    key: 'world_traveler', icon: '🗺️', title: '行者无疆的一生', hint: '选择远行与旅居',
    clue: '背上行囊说走就走，选择远行与旅居。世界这么大，敢走出去的人才能看遍它',
  },
  {
    key: 'grad_school', icon: '🎓', title: '学术深耕的一生', hint: '考研上岸，继续深造',
    clue: '本科不是终点，考研上岸继续深造。学术之路很长，读研只是第一步',
  },
  {
    key: 'top_university', icon: '🏫', title: '学霸的一生', hint: '考入重点大学',
    clue: '寒窗十二载，只为一战。高考考入重点大学，知识的大门为坚持的人敞开',
  },
  {
    key: 'retake', icon: '🔄', title: '东山再起的一生', hint: '高考失利后选择复读',
    clue: '高考失利不是结局，选择复读再战一年。跌倒了爬起来，才能东山再起',
  },
  {
    key: 'doctor', icon: '⚕️', title: '医者仁心的一生', hint: '从医学生走到主治医师',
    clue: '从医学生到主治医师，白衣之路需要坚持。学医很苦，但救死扶伤的初心很甜',
  },
  {
    key: 'military_flag', icon: '🎖️', title: '铁血人生', hint: '响应号召参军入伍',
    clue: '响应号召参军入伍，把青春融进军营。铁血铸就的人生，配得上那枚勋章',
  },
  {
    key: 'athlete_pro', icon: '🏅', title: '赛场传奇', hint: '走上职业运动员之路',
    clue: '天赋只是入场券，职业运动员的路上，日复一日的训练才是通行证',
  },
  {
    key: 'artist', icon: '🎨', title: '艺术人生', hint: '把艺术热爱变成职业',
    clue: '把热爱变成职业，让画笔与琴键陪自己走完一生。艺术的路，热爱是最长的路标',
  },
  {
    key: 'tech_career', icon: '💻', title: '技术精英的一生', hint: '投身科技行业',
    clue: '投身科技行业，用代码撬动世界。技术精英的每一次晋升，都来自一次次攻坚',
  },
  // 灰色路线极端结局：比「铁窗人生」更显眼（越狱成功比坐牢更「高成就」），故排在 jailed 之前
  {
    key: 'escaped', icon: '🏃', title: '亡命天涯', hint: '越狱成功，从此隐姓埋名',
    clue: '铁窗困不住不甘的灵魂，越狱成功，从此隐姓埋名。这条路没有回头，踏上便是天涯',
  },
  {
    key: 'gang_boss', icon: '👑', title: '黑道风云', hint: '江湖上留下你的名号',
    clue: '在灰色地带一路向上，让江湖记住你的名号。这条路危险，却也另有一番天地',
  },
  {
    key: 'jailed', icon: '🔒', title: '铁窗人生', hint: '灰色生意东窗事发，高墙内度过人生',
    clue: '灰色生意东窗事发，高墙之内度过人生。一步踏错，换来的便是漫长的铁窗生涯',
  },
  {
    key: 'went_to_college', icon: '📚', title: '知识改变命运的一生', hint: '考上大学',
    clue: '高考金榜题名，考上大学改变命运。读书，是人生最稳的杠杆',
  },
  {
    key: 'skilled_worker', icon: '🔧', title: '匠心人生', hint: '学一门手艺安身',
    clue: '学一门手艺安身立命，把一件事做到极致。匠心所在，平凡也能成就不凡',
  },
  {
    key: 'civil_servant', icon: '🏛️', title: '安稳一生', hint: '考入体制内工作',
    clue: '书山题海换一张入场券，考入体制内，从此过安稳一生。铁饭碗，端的是安心',
  },
];

/** 路线 key → 图鉴条目（SummaryScreen 结局标题查表用） */
export const VERDICT_META: Record<string, VerdictRoute> = Object.fromEntries(
  VERDICT_ROUTES.map(r => [r.key, r]),
);

/**
 * 结算页「下一站」：从当前结局之后循环找第一条未收集路线（收集欲驱动重玩）。
 * 当前结局刚结算必然已收集，起点跳过自身；分数档结局（key 不在图鉴表）从第一条开始；
 * 全部收集返回 null（通关文案由调用方展示）。
 *
 * @param currentKey 本局结局 key（verdictKey 输出）
 * @param collected 已收集路线 key 集合
 * @returns 下一条未收集路线；全收集返回 null
 */
export function nextRouteToExplore(currentKey: string, collected: ReadonlySet<string>): VerdictRoute | null {
  if (VERDICT_ROUTES.every(r => collected.has(r.key))) {
    return null;
  }
  const idx = VERDICT_ROUTES.findIndex(r => r.key === currentKey);
  // 起点：当前之后一条（跳过自己）；分数档从第一条开始
  const start = idx < 0 ? 0 : (idx + 1) % VERDICT_ROUTES.length;
  // 步数：路线结局查 len-1 条（不含自己）；分数档查全 16 条
  const steps = idx < 0 ? VERDICT_ROUTES.length : VERDICT_ROUTES.length - 1;
  for (let i = 0; i < steps; i++) {
    const r = VERDICT_ROUTES[(start + i) % VERDICT_ROUTES.length];
    if (!collected.has(r.key)) {
      return r;
    }
  }
  return null;
}

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
    ['escaped', ['escaped']],
    ['gang_boss', ['gang_boss']],
    ['jailed', ['jailed']],
    ['civil_servant', ['civil_servant']],
    ['skilled_worker', ['skilled_worker']],
    ['went_to_college', ['went_to_college']],
  ];
  for (const [key, fs] of order) {
    if (has(...fs)) {
      return key;
    }
  }
  const score = calcScore(attributes);
  return score >= 75 ? 'score:75+' : score >= 60 ? 'score:60+' : score >= 45 ? 'score:45+' : score >= 30 ? 'score:30+' : 'score:low';
}
