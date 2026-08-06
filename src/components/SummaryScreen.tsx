import { useState, useMemo } from 'react';
import type { AchievementId, GameState } from '../types';
import { ATTR_META, calcScore } from '../engine/state';
import { GOALS, checkGoal } from '../engine/goals';
import { ACHIEVEMENTS } from '../engine/achievements';
import ShareCardModal from './ShareCardModal';
import GrowthChart from './GrowthChart';
import { buildBiographyMarkdown, downloadText } from '../utils/biography';
import { track } from '../utils/analytics';
import { VERDICT_META, nextRouteToExplore, verdictKey } from '../engine/verdict';

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
}

interface Verdict {
  title: string;
  desc: string;
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

/** 里程碑 flag：命中则时间线高亮 */
const MILESTONE_FLAGS = ['went_to_college', 'grad_school', 'top_university', 'married', 'has_child', 'doctor', 'startup_success', 'civil_servant', 'world_traveler', 'athlete_pro', 'military_flag', 'skilled_worker', 'tech_career', 'retired'];

export default function SummaryScreen({ game, onRestart, newAchievements, skippedTitles, generation, seed, collectedEndings = [], isDaily = false }: Props) {
  const score = calcScore(game.attributes);
  const { title, desc } = getVerdict(game);
  const goal = checkGoal(game.goal, game);
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

  return (
    <div className="w-full h-full bg-gradient-to-b from-[#0a0a14] via-[#1a1a2e] to-[#0a0a14]
      flex flex-col items-center px-5 sm:px-10 py-8 sm:py-10 gap-4 overflow-y-auto">
      <p className="text-sm text-white/40 tracking-[4px]">
        {game.gender === 'male' ? '♂' : '♀'} {game.name} · 享年 {game.age} 岁
        {game.challenge && <span className="text-[#e8a05d] ml-2">⚔️ 挑战人生</span>}
        {game.inherited && <span className="text-[#c9a96e] ml-2">🧬 传承</span>}
      </p>
      <h2 className="text-[34px] font-extralight tracking-[10px] text-[#c9a96e] animate-[fadeInDown_0.8s_ease]">
        {title}
      </h2>
      <p className="text-sm text-white/40 text-center max-w-[400px] leading-relaxed animate-[fadeIn_1.2s_ease]">
        {desc}
      </p>

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
            <div className="text-[13px] text-[#c9a96e] mt-1">13 条人生路线已全部走过</div>
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

      {/* 综合评分 */}
      <div className="w-[80px] h-[80px] rounded-full border-2 border-[#c9a96e]
        flex items-center justify-center text-3xl text-[#c9a96e] font-extralight
        animate-[fadeIn_1.5s_ease] relative
        before:absolute before:inset-[-6px] before:rounded-full before:border before:border-[#c9a96e]/20">
        {score}
      </div>
      <p className="text-[11px] text-white/40 tracking-[3px]">综合评分</p>

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

      <button
        onClick={onRestart}
        className="px-9 py-3 border border-white/20 rounded-2xl bg-transparent
          text-sm text-white/40 tracking-[4px] font-sans
          hover:border-[#c9a96e] hover:text-[#c9a96e] hover:shadow-[0_4px_20px_rgba(201,169,110,0.3)]
          transition-all duration-300 mt-2"
      >
        回到标题
      </button>

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
    </div>
  );
}
