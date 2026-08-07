import { useState, useMemo } from 'react';
import type { AchievementId, ChoiceRecord, GameState } from '../types';
import { ATTR_META, calcScore } from '../engine/state';
import { GOALS, checkGoal } from '../engine/goals';
import { ACHIEVEMENTS } from '../engine/achievements';
import { EVENTS } from '../engine/events';
import ShareCardModal from './ShareCardModal';
import GrowthChart from './GrowthChart';
import AlmanacModal from './AlmanacModal';
import LifeCardModal from './LifeCardModal';
import { buildBiographyMarkdown, downloadText } from '../utils/biography';
import { track } from '../utils/analytics';
import { VERDICT_META, nextRouteToExplore, verdictKey } from '../engine/verdict';
import { jobStatus, JOB_MILESTONE_FLAGS } from '../engine/jobs';
import { npcBonds, BOND_META } from '../engine/npcs';
import { personaBonds as derivePersonaBonds, personaRelationText, PERSONAS } from '../engine/personas';
import { gaokaoResult } from '../engine/gaokao';
import { assetStatus } from '../engine/assets';
import { getTalent, saveInheritTalent, type TalentInherit } from '../engine/talents';
import { formatDate } from '../hooks/useGame';
import { checkWeeklyGoal, type WeeklyGoal } from '../engine/weekly';
import { derivePersona, personaSummary, PERSONA_META, type PersonaState, type PersonaTrait } from '../engine/personality';

interface Props {
  game: GameState;
  onRestart: () => void;
  /** 本局新解锁成就（useGame 传入，不进 GameState） */
  newAchievements: AchievementId[];
  /** 本局因条件未满足而被跳过的事件标题（去重后；展示「本可发生而未触发」） */
  skippedTitles: string[];
  /** 本局所属世代（族谱最新一代；空族谱为 null 不展示） */
  generation?: number | null;
  /** 本局洗牌种子（分享卡片展示种子码，好友可挑战同一序列） */
  seed?: number;
  /** 已收集结局路线 key（生涯统计，驱动「下一站」线索与通关成就） */
  collectedEndings?: string[];
  /** 每日挑战局（分享卡片 CTA 切换「今日战绩」文案） */
  isDaily?: boolean;
  /** 每周挑战局（展示本周目标达成） */
  isWeekly?: boolean;
  /** 本周挑战目标（每周变化；周目标达成展示用） */
  weeklyGoal?: WeeklyGoal;
  /** 累计完成局数（周目判定：第 6 周目起显示「人生重开」） */
  totalLives?: number;
  /** 人生重开（第 6 周目起）：携半身属性重新投胎 */
  onReincarnate?: () => void;
  /** 当前继承天赋（上一世传承；App 传入；世代回看不传 → 不显示继承面板） */
  inheritTalent?: TalentInherit | null;
}

interface Verdict {
  title: string;
  desc: string;
}

/** 人生际遇数据：性格专属事件的触发情况（「🎭 人生际遇」小节数据源） */
export interface EncounterData {
  /** 已触发的性格事件标题（按触发先后顺序） */
  triggered: string[];
  /** 差一点触发：该端性格已达专属事件阈值但事件未发生 */
  missed: Array<{ trait: PersonaTrait; count: number; threshold: number }>;
}

/** 死因文案：说明此生如何落幕 */
function deathText(cause: 'health' | 'lifespan' | null | undefined): { icon: string; text: string } {
  if (cause === 'health') {
    return {
      icon: '🌙',
      text: '你的身体终于支撑不住了。最后的时刻，你想起这一生走过的路——那些笑过、哭过、拼过的日子，都随着灯光一起熄灭了。',
    };
  }
  return {
    icon: '🕯️',
    text: '在睡梦中，你安静地走完了这一生。家人说，你走得很平静，嘴角还带着一点笑意。这一生，落幕得刚刚好。',
  };
}

/** 按分数兜底的 5 档基础评价 */
function scoreVerdict(score: number): Verdict {
  if (score >= 75) {
    return {
      title: '辉煌的一生',
      desc: '回望来路，满目星辰。你活出了大多数人只敢梦想的人生，每一个重要选择都踩在了对的位置上。此生无憾。',
    };
  }
  if (score >= 60) {
    return {
      title: '充实的一生',
      desc: '没有惊天动地，但每一步都走得踏实。有爱、有事做、有所期待——也许这就是最好的生活。',
    };
  }
  if (score >= 45) {
    return {
      title: '平凡的一生',
      desc: '有得有失，有笑有泪。你的人生像大多数人的一样，不够完美，但足够真实。',
    };
  }
  if (score >= 30) {
    return {
      title: '坎坷的一生',
      desc: '命运对你并不慷慨，你做过错误的选择，也承受过不该承受的苦。但这一路走来，你已经尽力了。',
    };
  }
  return {
    title: '艰难的一生',
    desc: '这一生写满了挣扎。如果真的有来世，愿你能被温柔以待。',
  };
}

/** 按人生路线分档：路线 flag 优先，无路线则按分数兜底 */
function getVerdict(game: GameState): Verdict {
  const score = calcScore(game.attributes);
  const has = (...flags: string[]) => flags.some(f => game.flags.includes(f));

  if (has('startup_success')) {
    return {
      title: VERDICT_META.startup_success.title,
      desc: `从一间办公室到一方天地，你亲手把想法变成了事业。回望来时路，每次破釜沉舟都有了答案。${score >= 75 ? '这是属于你的传奇。' : '虽然起落跌宕，但你始终没有停下。'}`,
    };
  }
  if (has('world_traveler')) {
    return {
      title: VERDICT_META.world_traveler.title,
      desc: `你的脚步丈量过山川湖海，见过太多人一生未见过的风景。${score >= 75 ? '世界很大，而你从容地走完了它。' : '漂泊的日子里，你也曾在深夜想家。'}`,
    };
  }
  if (has('grad_school')) {
    return {
      title: VERDICT_META.grad_school.title,
      desc: `从考研上岸到实验室的深夜，你把求知变成了职业。论文、数据、下一次实验——你在自己的领域里越走越深。${score >= 75 ? '学术的星辰大海，你一直在场。' : '学问路上虽有清苦，但你乐在其中。'}`,
    };
  }
  if (has('top_university')) {
    return {
      title: VERDICT_META.top_university.title,
      desc: `从重点高中的题海到重点大学的实验室，你用成绩证明了自己。那些别人觉得苦的日子，是你一步步铺出来的路。${score >= 75 ? '知识为你打开了每一扇门。' : '虽然没能登顶，但你已经爬得很高了。'}`,
    };
  }
  if (has('retake')) {
    return {
      title: VERDICT_META.retake.title,
      desc: `你跌倒过一次，又把自己重新扶了起来。复读那一年教会你的，比顺风顺水的十年更多。${score >= 75 ? '逆袭的故事，你写到了结局。' : '虽然没能彻底翻身，但你从未认输。'}`,
    };
  }
  if (has('doctor')) {
    return {
      title: VERDICT_META.doctor.title,
      desc: `从医学生到主治医师，你把「健康所系，性命相托」从誓词变成了日常。那些抢救成功的深夜，是你这一生最值得的时刻。${score >= 75 ? '白衣之下，是一颗滚烫的心。' : '虽然辛苦，但你从未后悔穿上白大褂。'}`,
    };
  }
  if (has('military_flag')) {
    return {
      title: VERDICT_META.military_flag.title,
      desc: `一身制服，一生底色。你把最年轻的岁月交给了国家和人民，也把纪律和勇敢刻进了骨头里。${score >= 75 ? '铁血与柔情，你都有。' : '脱下军装，你依然是那个站得笔直的人。'}`,
    };
  }
  if (has('athlete_pro')) {
    return {
      title: VERDICT_META.athlete_pro.title,
      desc: `从操场跑到省队，你把青春交给了赛道和奖牌。伤病、汗水、掌声——这是运动员才懂的浪漫。${score >= 75 ? '赛场之上，你赢过自己。' : '虽未登顶，但你跑出了自己的节奏。'}`,
    };
  }
  if (has('artist_pro', 'artist_life')) {
    return {
      title: VERDICT_META.artist.title,
      desc: `你把热爱过成了职业。画布、琴键、舞台——你用自己的方式，给这个世界添了一笔颜色。${score >= 75 ? '艺术因你而多了一种可能。' : '作品未必轰动，但你从未停止表达。'}`,
    };
  }
  if (has('tech_career') && game.attributes.intelligence >= 60) {
    return {
      title: VERDICT_META.tech_career.title,
      desc: `从刷题到写代码，你用技术改变了生活的轨迹。一个个深夜的项目、一次次的攻坚，最终都成了你简历上的注脚。${score >= 75 ? '技术改变命运，你做到了。' : '纵然疲惫，你依然站在浪潮之上。'}`,
    };
  }
  if (has('escaped')) {
    return {
      title: VERDICT_META.escaped.title,
      desc: `那一夜你翻过高墙，从此名字变成一串通缉编号。城中村的出租屋、货车的后斗、泛黄的寻人启事——你活成了另一个人。${score >= 75 ? '在没人认识的地方，你重新活出了自己。' : '风声鹤唳的岁月里，你始终没敢停下来。'}`,
    };
  }
  if (has('gang_boss')) {
    return {
      title: VERDICT_META.gang_boss.title,
      desc: `从街边看场子的马仔，到江湖上有人叫得出你名号。你摆过平、流过血、也被人敬过酒。${score >= 75 ? '你全身而退，江湖只剩你的传说。' : '坐上那个位子的代价，只有你自己清楚。'}`,
    };
  }
  if (has('jailed')) {
    return {
      title: VERDICT_META.jailed.title,
      desc: `铁窗内的岁月，成了你人生的一道分水岭。高墙、放风场、探视日的玻璃——你在那里看清了很多事。${score >= 75 ? '走出来之后，你把日子重新过成了干净的样子。' : '有些债，你用余生慢慢偿还。'}`,
    };
  }
  if (has('went_to_college')) {
    return {
      title: VERDICT_META.went_to_college.title,
      desc: `你相信读书的力量，而它确实把你带向了更远的地方。那些挑灯夜读的夜晚没有白费。${score >= 75 ? '知识为你打开了每一扇门。' : '虽然没能登顶，但你已经爬得很高了。'}`,
    };
  }
  if (has('skilled_worker')) {
    return {
      title: VERDICT_META.skilled_worker.title,
      desc: `一门手艺，一生安身。你把重复的日子过成了专注的修行，手上的功夫就是你的底气。${score >= 75 ? '工匠精神在你身上发着光。' : '手艺傍身，日子踏实。'}`,
    };
  }
  if (has('civil_servant')) {
    return {
      title: VERDICT_META.civil_servant.title,
      desc: `没有大风大浪，却有一份细水长流的稳妥。你把日子过成了别人羡慕的安定。${score >= 75 ? '岁月静好，大概就是这副模样。' : '安稳之中，也偶尔遗憾错过了风浪。'}`,
    };
  }
  return scoreVerdict(score);
}

/**
 * 结局判定依据（与 getVerdict 判定顺序一致，纯展示透明化）。
 * 路线 flag 优先（tech_career 需智力 ≥ 60 才构成路线结局，不足走分数档），
 * 无路线命中时按分数档输出。
 *
 * @param game 终局状态
 * @param score 综合评分（calcScore 输出）
 * @returns 判定依据文案（如「命中「医者仁心的一生」路线」/「综合评分 66 分 · 充实的一生」）
 */
export function verdictBasis(game: GameState, score: number): string {
  const has = (...flags: string[]) => flags.some(f => game.flags.includes(f));
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
    ['went_to_college', ['went_to_college']],
    ['skilled_worker', ['skilled_worker']],
    ['civil_servant', ['civil_servant']],
  ];
  for (const [key, flags] of order) {
    if (!has(...flags)) {
      continue;
    }
    // tech_career 需智力 ≥ 60 才构成路线结局（与 getVerdict 一致；不足走分数档）
    if (key === 'tech_career' && game.attributes.intelligence < 60) {
      continue;
    }
    return `命中「${VERDICT_META[key].title}」路线`;
  }
  return `综合评分 ${score} 分 · ${scoreVerdict(score).title}`;
}

/**
 * 人生际遇数据：性格专属事件（pers_ 前缀，条件为 minPersonality）的触发与错失。
 * 已触发：history 中 pers_ 开头的事件，逐条输出标题；
 * 未触发但该端次数 ≥ 专属事件阈值（同端多事件取最低值）且事件从未发生 → 提示差一点。
 * 弱画像（无触发且无达标端）返回空数据，展示层不渲染整节。
 *
 * @param persona 性格画像（derivePersona 输出）
 * @param history 选择记录
 * @returns 际遇数据（triggered 事件标题 + missed 差一点触发的端）
 */
export function personalityEncounters(persona: PersonaState, history: ChoiceRecord[]): EncounterData {
  const triggered: string[] = [];
  const triggeredIds = new Set<string>();
  for (const h of history) {
    if (!h.eventId.startsWith('pers_') || triggeredIds.has(h.eventId)) {
      continue;
    }
    triggeredIds.add(h.eventId);
    const ev = EVENTS.find(e => e.id === h.eventId);
    if (ev?.title) {
      triggered.push(ev.title);
    }
  }
  // 性格专属事件：按端取 minPersonality 最低值作为该端触发阈值
  const thresholds = new Map<PersonaTrait, number>();
  for (const e of EVENTS) {
    if (!e.id.startsWith('pers_') || !e.conditions?.minPersonality) {
      continue;
    }
    for (const [t, v] of Object.entries(e.conditions.minPersonality) as [PersonaTrait, number][]) {
      thresholds.set(t, Math.min(thresholds.get(t) ?? Infinity, v));
    }
  }
  const missed: EncounterData['missed'] = [];
  for (const [t, threshold] of thresholds) {
    if (persona[t] < threshold) {
      continue;
    }
    // 该端专属事件已触发过则不再提示（错过感只留给真正没发生的那一端）
    const eventTriggered = EVENTS.some(e =>
      e.id.startsWith('pers_')
      && e.conditions?.minPersonality
      && t in e.conditions.minPersonality
      && triggeredIds.has(e.id));
    if (!eventTriggered) {
      missed.push({ trait: t, count: persona[t], threshold });
    }
  }
  return { triggered, missed };
}

/** 里程碑 flag：命中则时间线高亮（含职业 flag——职业入行即里程碑）；关键抉择回顾共用 */
export const MILESTONE_FLAGS = ['went_to_college', 'grad_school', 'top_university', 'married', 'has_child', 'doctor', 'startup_success', 'civil_servant', 'world_traveler', 'athlete_pro', 'military_flag', 'skilled_worker', 'tech_career', 'retired', ...JOB_MILESTONE_FLAGS];

/** 性格维度展示对（条形图左端 → 右端，与 PERSONA_META 维度一致） */
const PERSONA_DIMENSIONS: Array<[PersonaTrait, PersonaTrait]> = [
  ['rational', 'emotional'],
  ['adventurous', 'cautious'],
  ['selfish', 'altruistic'],
];

/** 性格注脚：Top1 端的一句话人生注脚（结局描述下展示，弱画像不显示） */
const PERSONA_NOTES: Record<PersonaTrait, string> = {
  rational: '你习惯先把每一步算清楚——幸运的是，人生没有辜负你的计算。',
  emotional: '你的心总是先于理智抵达——那些热泪与冲动，正是你活过的证据。',
  adventurous: '你是个敢赌的人——回头看，那些险路都成了风景。',
  cautious: '你走得稳，一生少了很多风雨，也错过了不少彩虹。',
  selfish: '你始终清醒地爱着自己——这一生，你少受了许多委屈。',
  altruistic: '你把手里的光分给了很多人——最后，光也照亮了你自己的路。',
};

export default function SummaryScreen({ game, onRestart, newAchievements, skippedTitles, generation, seed, collectedEndings = [], isDaily = false, isWeekly = false, weeklyGoal, totalLives = 0, onReincarnate, inheritTalent = null }: Props) {
  const score = calcScore(game.attributes);
  const { title, desc } = getVerdict(game);
  const goal = checkGoal(game.goal, game);
  // 本局推导信息：职业 / 家人关系 / 高考结果 / 资产 / 性格画像 / 具体人物好感（纯函数，旧存档兼容）
  const job = jobStatus(game);
  const bonds = npcBonds(game);
  // 具体人物好感度（6 位人生关键人物；只展示有互动记录的人物）
  const personaBondMap = useMemo(() => derivePersonaBonds(game.history), [game.history]);
  const activePersonas = useMemo(() => {
    const seen = new Set(game.history.map(h => h.eventId));
    return PERSONAS.filter(def => def.events.some(id => seen.has(id)));
  }, [game.history]);
  const gaokao = gaokaoResult(game);
  const assets = assetStatus(game);
  const persona = derivePersona(game.history);
  // 性格注脚数据：Top1 端 + 总分（总分 < 2 视为画像未成形，不展示）
  const personaTotal = Object.values(persona).reduce((s, n) => s + n, 0);
  const personaTop = (Object.keys(PERSONA_META) as PersonaTrait[])
    .filter(t => persona[t] > 0)
    .sort((a, b) => persona[b] - persona[a])[0];
  // 人生际遇：性格专属事件的触发与错失（纯推导，弱画像返回空数据）
  const encounters = personalityEncounters(persona, game.history);
  // 判定依据：结局判定透明化（路线 flag 或分数档，与 getVerdict 顺序一致）
  const basisText = verdictBasis(game, score);
  // 「下一站」：本局结算后（当前结局已计入收集）提示下一条未走过的路线；全收集显示通关文案
  const nextRoute = useMemo(
    () => nextRouteToExplore(verdictKey(game), new Set(collectedEndings)),
    [game, collectedEndings],
  );
  const allCollected = collectedEndings.length > 0 && nextRoute === null;
  // 完整时间线：全部选择 + 里程碑标记（旧存档无 flags 字段 → 无标记，正常显示）
  const milestoneHistory = game.history.map(h => ({
    ...h,
    isMilestone: (h.flags ?? []).some(f => MILESTONE_FLAGS.includes(f)),
  }));
  // 分享卡片模态开关
  const [showShare, setShowShare] = useState(false);
  // 人生年鉴模态开关
  const [showAlmanac, setShowAlmanac] = useState(false);
  // 人生名片模态开关
  const [showLifeCard, setShowLifeCard] = useState(false);
  // 天赋继承：当前继承（App 传入）+ 本局选择（直接写 localStorage）
  const [inherit, setInherit] = useState<TalentInherit | null>(inheritTalent);
  const setInheritTalent = (talentId: string) => {
    track({ type: 'feature_use', ts: Date.now(), feature: 'talent_inherit' });
    saveInheritTalent(talentId, formatDate(new Date()));
    setInherit({ talentId, date: formatDate(new Date()) });
  };

  return (
    <div className="w-full h-full bg-gradient-to-b from-[#0a0a14] via-[#1a1a2e] to-[#0a0a14]
      flex flex-col items-center px-5 sm:px-10 py-8 sm:py-10 gap-4 overflow-y-auto">
      <p className="text-sm text-white/40 tracking-[4px]">
        {game.gender === 'male' ? '♂' : '♀'} {game.name} · 享年 {game.age} 岁
        {game.challenge && <span className="text-[#e8a05d] ml-2">⚔️ 挑战人生</span>}
        {game.inherited && <span className="text-[#c9a96e] ml-2">🧬 传承</span>}
        {game.reincarnated && <span className="text-[#8fb8e8] ml-2">🔄 轮回</span>}
        {game.allocBonus && <span className="text-[#b57edc] ml-2">🏅 成就加成</span>}
      </p>

      {/* 职业 · 学业 · 天赋 · 资产（推导信息行） */}
      {(job || gaokao || (game.talents && game.talents.length > 0)) && (
        <div className="flex flex-wrap items-center justify-center gap-2 max-w-[640px] animate-[fadeIn_1.3s_ease]">
          {job && (
            <span className="px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-[11px] text-white/55">
              {job.icon} {job.title} · 从业 {job.years} 年
            </span>
          )}
          {gaokao && (
            <span className="px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-[11px] text-white/55">
              {gaokao.icon} {gaokao.label}
            </span>
          )}
          {(game.talents ?? []).map(id => {
            const t = getTalent(id);
            return t ? (
              <span key={id} className="px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-[11px] text-white/55">
                {t.icon} {t.name}
              </span>
            ) : null;
          })}
        </div>
      )}
      <h2 className="text-[34px] font-extralight tracking-[10px] text-[#c9a96e] animate-[fadeInDown_0.8s_ease]">
        {title}
      </h2>
      <p className="text-sm text-white/40 text-center max-w-[400px] leading-relaxed animate-[fadeIn_1.2s_ease]">
        {desc}
      </p>
      {/* 判定依据：结局判定透明化（路线 flag 命中或分数档，低调不抢戏） */}
      <p className="text-[10px] text-white/35 tracking-wide text-center animate-[fadeIn_1.3s_ease]">
        判定依据：{basisText}
      </p>
      {/* 性格注脚：Top1 端的一句话（弱画像不显示，低调不抢戏） */}
      {personaTotal >= 2 && personaTop && (
        <p className="text-[12px] text-white/50 italic text-center animate-[fadeIn_1.3s_ease]">
          {PERSONA_NOTES[personaTop]}
        </p>
      )}

      {/* 下一站：还没走的人生（留存钩子——收集欲驱动重玩；全收集显示通关成就） */}
      {nextRoute && (
        <div className="flex items-start gap-3 max-w-[560px] px-5 py-3.5 bg-[#c9a96e]/5 border border-[#c9a96e]/20 rounded-xl
          animate-[fadeIn_1.5s_ease]">
          <span className="text-lg leading-none mt-0.5">🧭</span>
          <div>
            <div className="text-[11px] text-white/40 tracking-[2px]">下一站 · 还没走的人生</div>
            <div className="text-[13px] text-[#c9a96e] mt-1">
              {nextRoute.icon} {nextRoute.title}
              <span className="text-[11px] text-white/50 ml-2">—— {nextRoute.hint}</span>
            </div>
          </div>
        </div>
      )}
      {allCollected && (
        <div className="flex items-start gap-3 max-w-[560px] px-5 py-3.5 bg-[#c9a96e]/5 border border-[#c9a96e]/20 rounded-xl
          animate-[fadeIn_1.5s_ease]">
          <span className="text-lg leading-none mt-0.5">🏆</span>
          <div>
            <div className="text-[11px] text-white/40 tracking-[2px]">人生图鉴 · 全收集</div>
            <div className="text-[13px] text-[#c9a96e] mt-1">16 条人生路线已全部走过</div>
          </div>
        </div>
      )}

      {/* 死因与临终叙事 */}
      <div className="flex items-start gap-3 max-w-[560px] px-5 py-3.5 bg-white/[0.03] border border-white/[0.06] rounded-xl
        animate-[fadeIn_1.4s_ease]">
        <span className="text-lg leading-none mt-0.5">{deathText(game.deathCause).icon}</span>
        <p className="text-xs text-white/50 leading-relaxed">{deathText(game.deathCause).text}</p>
      </div>

      {/* 人生目标达成度（开局选了目标才展示） */}
      {goal && (
        <div className={`flex items-start gap-3 max-w-[560px] px-5 py-3.5 rounded-xl border
          animate-[fadeIn_1.4s_ease]
          ${goal.achieved ? 'bg-[#c9a96e]/5 border-[#c9a96e]/30' : 'bg-white/[0.03] border-white/[0.06]'}`}>
          <span className="text-lg leading-none mt-0.5">{goal.achieved ? '✅' : '🎯'}</span>
          <div>
            <div className={`text-[13px] ${goal.achieved ? 'text-[#c9a96e]' : 'text-white/60'}`}>
              {typeof game.goal === 'string'
                ? GOALS.find(g => g.key === game.goal)?.name ?? '人生目标'
                : '🎯 自定义目标'}
              <span className="ml-2 text-[11px] tracking-[2px] text-white/35">
                {goal.achieved ? '已达成' : '未达成'}
              </span>
            </div>
            {/* 自定义目标：detail 为「属性名 实际值/目标值」逐项展示 */}
            <div className="text-[11px] text-white/40 mt-0.5 leading-relaxed">{goal.detail}</div>
          </div>
        </div>
      )}

      {/* 每周挑战：本周目标达成展示（周目标终局判定，同周复玩可刷新最佳） */}
      {isWeekly && weeklyGoal && (
        <div className={`flex items-start gap-3 max-w-[560px] px-5 py-3.5 rounded-xl border animate-[fadeIn_1.4s_ease]
          ${checkWeeklyGoal(weeklyGoal, game) ? 'bg-[#5de8a0]/5 border-[#5de8a0]/30' : 'bg-white/[0.03] border-white/[0.06]'}`}>
          <span className="text-lg leading-none mt-0.5">{checkWeeklyGoal(weeklyGoal, game) ? '✅' : weeklyGoal.icon}</span>
          <div>
            <div className="text-[11px] text-white/40 tracking-[2px]">🗓️ 本周挑战</div>
            <div className={`text-[13px] mt-1 ${checkWeeklyGoal(weeklyGoal, game) ? 'text-[#5de8a0]' : 'text-white/70'}`}>
              {weeklyGoal.name}
              <span className={`ml-2 text-[11px] tracking-[2px] ${checkWeeklyGoal(weeklyGoal, game) ? 'text-[#5de8a0]/60' : 'text-white/35'}`}>
                {checkWeeklyGoal(weeklyGoal, game) ? '已通关 ✓' : weeklyGoal.desc}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 综合评分 */}
      <div className="w-[80px] h-[80px] rounded-full border-2 border-[#c9a96e]
        flex items-center justify-center text-3xl text-[#c9a96e] font-extralight
        animate-[fadeIn_1.5s_ease] relative
        before:absolute before:inset-[-6px] before:rounded-full before:border before:border-[#c9a96e]/20">
        {score}
      </div>
      <p className="text-[11px] text-white/40 tracking-[3px]">综合评分</p>

      {/* 资产（本局拥有的资产组合） */}
      {assets.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2 max-w-[640px] animate-[fadeIn_1.4s_ease]">
          {assets.map(a => (
            <span key={a.label} className="px-3 py-1.5 rounded-full border border-[#e8c95d]/20 bg-[#e8c95d]/5 text-[11px] text-[#e8c95d]/80">
              {a.icon} {a.label}
            </span>
          ))}
        </div>
      )}

      {/* 与身边人的关系（推导自本局在家庭/爱情/友谊事件中的取舍） */}
      <div className="w-full max-w-[720px] animate-[fadeInUp_1.1s_ease]">
        <h3 className="text-[13px] tracking-[4px] text-[#c9a96e] mb-2.5 font-normal">🤝 与身边人</h3>
        <div className="flex flex-col gap-2">
          {(Object.keys(bonds) as Array<keyof typeof bonds>).map(k => {
            const meta = BOND_META[k];
            const v = bonds[k];
            return (
              <div key={k} className="flex items-center gap-2.5 text-[11px]">
                <span className="w-[64px] text-white/40 shrink-0">{meta.icon} {meta.label}</span>
                <div className="flex-1 h-[6px] bg-white/8 rounded-sm overflow-hidden">
                  <div
                    className="h-full rounded-sm transition-all duration-700"
                    style={{ width: `${v}%`, backgroundColor: meta.color }}
                  />
                </div>
                <span className={`w-[26px] text-right shrink-0 font-semibold ${v >= 80 ? 'text-[#5de8a0]' : v <= 30 ? 'text-[#e85d75]' : 'text-white/50'}`}>
                  {v}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 人生过客（具体人物：好感度推导自本局该人物出场事件中的取舍；无互动记录不展示） */}
      {activePersonas.length > 0 && (
        <div className="w-full max-w-[720px] animate-[fadeInUp_1.15s_ease]">
          <h3 className="text-[13px] tracking-[4px] text-[#c9a96e] mb-2.5 font-normal">🧑‍🤝‍🧑 人生过客</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {activePersonas.map(def => {
              const v = personaBondMap[def.id];
              return (
                <div key={def.id} className="flex items-center gap-2.5 rounded-md bg-white/5 px-2.5 py-2 text-[11px]"
                  title={`${def.role} · 好感 ${v}`}>
                  <span className="text-[15px] shrink-0" style={{ filter: 'drop-shadow(0 0 6px rgba(0,0,0,0.4))' }}>{def.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="text-white/85 truncate">{def.name}</span>
                      <span className={`font-semibold shrink-0 ${v >= 80 ? 'text-[#5de8a0]' : v >= 60 ? 'text-white/90' : v >= 40 ? 'text-[#e8d25d]' : 'text-[#e87d75]'}`}>
                        {v}
                      </span>
                    </div>
                    <div className="text-white/40 truncate">{personaRelationText(v)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 性格画像（推导自本局全部选择：3 维 6 端累积；弱画像只显示概括句） */}
      <div className="w-full max-w-[720px] animate-[fadeInUp_1.2s_ease]">
        <h3 className="text-[13px] tracking-[4px] text-[#c9a96e] mb-1 font-normal">🧭 性格画像</h3>
        <p className="text-[11px] text-white/45 mb-2.5">{personaSummary(persona)}</p>
        <div className="flex flex-col gap-2">
          {PERSONA_DIMENSIONS.map(([a, b]) => {
            const av = persona[a];
            const bv = persona[b];
            const aPct = av + bv > 0 ? (av / (av + bv)) * 100 : 0;
            return (
              <div key={a} className="flex items-center gap-2.5 text-[11px]"
                title={`${PERSONA_META[a].name} ${av} 次 · ${PERSONA_META[b].name} ${bv} 次`}>
                <span className="w-[64px] text-right shrink-0"
                  style={{ color: av > 0 ? PERSONA_META[a].color : 'rgba(255,255,255,0.25)' }}>
                  {PERSONA_META[a].icon} {PERSONA_META[a].name}
                </span>
                <div className="flex-1 h-[6px] bg-white/8 rounded-sm overflow-hidden relative">
                  {/* 中线（两端对半分界） */}
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/15" />
                  {av > 0 && (
                    <div className="absolute left-0 top-0 bottom-0 transition-all duration-700"
                      style={{ width: `${aPct}%`, backgroundColor: PERSONA_META[a].color }} />
                  )}
                  {bv > 0 && (
                    <div className="absolute right-0 top-0 bottom-0 transition-all duration-700"
                      style={{ width: `${100 - aPct}%`, backgroundColor: PERSONA_META[b].color }} />
                  )}
                </div>
                <span className="w-[64px] shrink-0"
                  style={{ color: bv > 0 ? PERSONA_META[b].color : 'rgba(255,255,255,0.25)' }}>
                  {PERSONA_META[b].name} {PERSONA_META[b].icon}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 人生际遇：性格专属事件的触发与错失（弱画像无内容不显示整节） */}
      {(encounters.triggered.length > 0 || encounters.missed.length > 0) && (
        <div className="w-full max-w-[720px] animate-[fadeInUp_1.25s_ease]">
          <h3 className="text-[13px] tracking-[4px] text-[#c9a96e] mb-2.5 font-normal">🎭 人生际遇</h3>
          <div className="flex flex-col gap-1.5">
            {encounters.triggered.map(title => (
              <p key={title} className="text-[11px] text-white/50 leading-relaxed">
                ⚡ 你遇到了「{title}」——你的性格，让这次际遇成真
              </p>
            ))}
            {encounters.missed.map(({ trait, count, threshold }) => (
              <p key={trait} className="text-[11px] text-white/35 leading-relaxed">
                ✨ 若{PERSONA_META[trait].name}再鲜明一些（当前 {count}/{threshold}），人生或许会有不同的际遇
              </p>
            ))}
          </div>
        </div>
      )}

      {/* 天赋继承（本局选了天赋才出现；设定后下一世抽卡该天赋置顶） */}
      {inheritTalent !== null && (game.talents ?? []).length > 0 && (
        <div className="w-full max-w-[720px] animate-[fadeIn_1.5s_ease]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[13px] tracking-[4px] text-[#c9a96e] font-normal">🧬 天赋传承</h3>
            <span className="text-[10px] text-white/30 tracking-[1px]">
              下一世抽卡时置顶出现
              {inherit && <span className="text-[#e8c95d] ml-1">当前：{getTalent(inherit.talentId)?.icon} {getTalent(inherit.talentId)?.name}</span>}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(game.talents ?? []).map(id => {
              const t = getTalent(id);
              if (!t) {
                return null;
              }
              const current = inherit?.talentId === id;
              return (
                <button
                  key={id}
                  onClick={() => setInheritTalent(id)}
                  className={`px-3.5 py-2 rounded-lg border text-[12px] transition-all duration-200 font-sans
                    ${current
                      ? 'border-[#e8c95d]/60 bg-[#e8c95d]/10 text-[#e8c95d]'
                      : 'border-white/10 bg-white/[0.03] text-white/55 hover:border-[#e8c95d]/40 hover:text-[#e8c95d]'}`}
                >
                  {t.icon} {t.name}{current ? ' ✓' : ''}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 属性展示 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-[720px] animate-[fadeInUp_1s_ease]">
        {Object.entries(game.attributes).map(([k, v]) => {
          const meta = ATTR_META[k as keyof typeof game.attributes];
          return (
            <div key={k} className="text-center p-3.5 bg-[#1a1a2e] rounded-lg border border-white/[0.04]
              hover:border-white/15 hover:-translate-y-0.5 transition-all duration-300">
              <div className="text-2xl font-light" style={{ color: meta.color }}>{v}</div>
              <div className="text-[10px] text-white/40 mt-1">{meta.icon} {meta.name}</div>
            </div>
          );
        })}
      </div>

      {/* 成长曲线：8 维属性随年龄的轨迹（旧存档无快照 → 组件内降级提示） */}
      <div className="w-full max-w-[720px] animate-[fadeInUp_1.15s_ease]">
        <h3 className="text-[13px] tracking-[4px] text-[#c9a96e] mb-2.5 font-normal">📈 成长曲线</h3>
        <GrowthChart snapshots={game.snapshots ?? []} />
      </div>

      {/* 人生大事记 */}
      <div className="w-full max-w-[720px] animate-[fadeInUp_1.3s_ease]">
        <h3 className="text-[13px] tracking-[4px] text-[#c9a96e] mb-2.5 font-normal">📖 人生大事记</h3>
        {milestoneHistory.map((h, i) => (
          <div key={i} className="flex gap-3 py-1.5 text-xs border-b border-white/[0.02]">
            <span className="text-[#c9a96e] min-w-[32px]">{h.age}岁</span>
            <span className="text-white/40">{h.isMilestone ? '⭐ ' : ''}{h.text}</span>
          </div>
        ))}
      </div>

      {/* 新解锁成就（附分享入口：成就瞬间是分享欲峰值） */}
      {newAchievements.length > 0 && (
        <div className="w-full max-w-[720px] animate-[fadeIn_1.6s_ease]">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-[13px] tracking-[4px] text-[#c9a96e] font-normal">🏆 新解锁成就</h3>
            <button
              onClick={() => setShowShare(true)}
              className="text-[11px] tracking-[2px] text-white/40 hover:text-[#c9a96e] transition-colors font-sans"
            >
              🎴 分享这一刻 ›
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {newAchievements.map(id => {
              const a = ACHIEVEMENTS.find(x => x.id === id)!;
              return (
                <div key={id} className="px-3.5 py-2 rounded-lg bg-[#c9a96e]/10 border border-[#c9a96e]/30 text-[12px] text-[#c9a96e]">
                  {a.icon} {a.name}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 本可发生而未触发的事件（条件未满足被跳过） */}
      {skippedTitles.length > 0 && (
        <div className="w-full max-w-[720px] animate-[fadeIn_1.5s_ease]">
          <h3 className="text-[13px] tracking-[4px] text-[#c9a96e] mb-2.5 font-normal">👻 本可发生而未触发</h3>
          <p className="text-[11px] text-white/35 mb-2">这一生有 {skippedTitles.length} 个事件因条件未满足而未曾发生：</p>
          <div className="flex flex-wrap gap-2">
            {skippedTitles.slice(0, 10).map(t => (
              <span key={t} className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[11px] text-white/40">
                {t}
              </span>
            ))}
            {skippedTitles.length > 10 && (
              <span className="px-3 py-1.5 text-[11px] text-white/25">等 {skippedTitles.length - 10} 个……</span>
            )}
          </div>
        </div>
      )}

      <button
        onClick={() => {
          // 埋点：分享卡片打开
          track({ type: 'feature_use', ts: Date.now(), feature: 'share_card' });
          setShowShare(true);
        }}
        className="px-9 py-3 border border-[#c9a96e]/50 rounded-2xl bg-transparent
          text-sm text-[#c9a96e] tracking-[4px] font-sans
          hover:bg-[#c9a96e]/10 hover:shadow-[0_4px_20px_rgba(201,169,110,0.3)]
          transition-all duration-300 mt-2"
      >
        🎴 生成分享卡片
      </button>

      <button
        onClick={() => {
          // 埋点：传记导出
          track({ type: 'feature_use', ts: Date.now(), feature: 'biography' });
          downloadText(`${game.name}-人生传记.md`, buildBiographyMarkdown(game, title, score));
        }}
        className="px-9 py-3 border border-white/20 rounded-2xl bg-transparent
          text-sm text-white/50 tracking-[4px] font-sans
          hover:border-[#c9a96e] hover:text-[#c9a96e] hover:shadow-[0_4px_20px_rgba(201,169,110,0.3)]
          transition-all duration-300 mt-2"
      >
        📜 导出人生传记
      </button>

      {/* 人生名片：一张可下载的视觉简历卡（收藏/简历向，与传播向分享卡差异化） */}
      <button
        onClick={() => {
          // 埋点：人生名片打开
          track({ type: 'feature_use', ts: Date.now(), feature: 'life_card' });
          setShowLifeCard(true);
        }}
        className="px-9 py-3 border border-white/20 rounded-2xl bg-transparent
          text-sm text-white/50 tracking-[4px] font-sans
          hover:border-[#c9a96e] hover:text-[#c9a96e] hover:shadow-[0_4px_20px_rgba(201,169,110,0.3)]
          transition-all duration-300 mt-2"
      >
        🎫 人生名片
      </button>

      {/* 人生年鉴：一页纸的终局报告（成长曲线 + 职业资产 + 家人 + 大事记），可导出 markdown */}
      <button
        onClick={() => {
          // 埋点：年鉴打开
          track({ type: 'feature_use', ts: Date.now(), feature: 'almanac' });
          setShowAlmanac(true);
        }}
        className="px-9 py-3 border border-white/20 rounded-2xl bg-transparent
          text-sm text-white/50 tracking-[4px] font-sans
          hover:border-[#c9a96e] hover:text-[#c9a96e] hover:shadow-[0_4px_20px_rgba(201,169,110,0.3)]
          transition-all duration-300 mt-2"
      >
        📖 人生年鉴
      </button>

      <button
        onClick={onRestart}
        className="px-9 py-3 border border-white/20 rounded-2xl bg-transparent
          text-sm text-white/40 tracking-[4px] font-sans
          hover:border-[#c9a96e] hover:text-[#c9a96e] hover:shadow-[0_4px_20px_rgba(201,169,110,0.3)]
          transition-all duration-300 mt-2"
      >
        回到标题
      </button>

      {/* 人生重开（第 6 周目起）：携半身属性重新投胎——同一角色的另一种活法 */}
      {totalLives >= 5 && !game.reincarnated && onReincarnate && (
        <button
          onClick={onReincarnate}
          className="px-9 py-3 border rounded-2xl bg-transparent
            text-sm text-[#8fb8e8]/70 tracking-[4px] font-sans
            border-[#8fb8e8]/25
            hover:border-[#8fb8e8] hover:text-[#8fb8e8] hover:shadow-[0_4px_20px_rgba(143,184,232,0.3)]
            transition-all duration-300 mt-2"
        >
          🔄 人生重开
        </button>
      )}

      {showShare && (
        <ShareCardModal
          game={game}
          verdictTitle={title}
          endingKey={verdictKey(game)}
          collectionDone={collectedEndings.filter(k => VERDICT_META[k]).length}
          isDaily={isDaily}
          generation={generation}
          seed={seed}
          onClose={() => setShowShare(false)}
        />
      )}

      {showAlmanac && (
        <AlmanacModal
          game={game}
          verdictTitle={title}
          verdictDesc={desc}
          job={job}
          bonds={bonds}
          gaokao={gaokao}
          assets={assets}
          onClose={() => setShowAlmanac(false)}
        />
      )}

      {showLifeCard && (
        <LifeCardModal
          game={game}
          score={score}
          verdictTitle={title}
          seed={seed}
          generation={generation}
          onClose={() => setShowLifeCard(false)}
        />
      )}
    </div>
  );
}
