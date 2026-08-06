import { useState } from 'react';
import { sfx } from '../utils/sound';
import { track } from '../utils/analytics';
import type { AchievementId, CustomGoal, FamilyMember, GoalKey, PaceMode, TypeSpeed } from '../types';
import type { SavesV2 } from '../engine/save';
import type { DailyHistory, DailyStore, SeedScores, StatsStore } from '../hooks/useGame';
import { formatDate } from '../hooks/useGame';
import GoalModal from './GoalModal';
import ConfirmModal from './ConfirmModal';
import AchievementsModal from './AchievementsModal';
import CollectionModal from './CollectionModal';
import FamilyModal from './FamilyModal';
import StatsModal from './StatsModal';
import SeedModal from './SeedModal';
import SummaryScreen from './SummaryScreen';
import GuideModal from './GuideModal';
import AnalyticsModal from './AnalyticsModal';
import { recapGame } from '../engine/family';
import { VERDICT_ROUTES } from '../engine/verdict';

/** 玩法说明首访标记（localStorage key；不存在则首进自动弹出） */
const GUIDE_SEEN_KEY = 'life-sim-guide-seen';

interface Props {
  onStart: (gender: 'male' | 'female', name: string, paceMode: PaceMode, typeSpeed: TypeSpeed, goal: GoalKey | CustomGoal | null, challenge: boolean, realMode: boolean, seed?: number | null) => void;
  onAutoStart: (gender: 'male' | 'female', name: string) => void;
  /** 每日挑战：随机性别/名字 + 今日固定种子开局（手动播放） */
  onDailyStart: () => void;
  saves: SavesV2;
  onContinue: (slot: number) => void;
  /** 跨周目成就存储（标题页成就总览展示） */
  achievements: { unlocked: AchievementId[]; completedLives: number };
  /** 跨周目生涯统计（标题页生涯总览展示） */
  stats: StatsStore;
  /** 每日挑战记录（入口旁展示今日最佳） */
  daily: DailyStore;
  /** 每日挑战历史（StatsModal 周视图） */
  dailyHistory: DailyHistory;
  /** 种子挑战本地比分（SeedModal 展示） */
  seedScores: SeedScores;
  /** 家族族谱（标题页族谱入口 + 开局继承提示） */
  family: FamilyMember[];
}

export default function TitleScreen({ onStart, onAutoStart, onDailyStart, saves, onContinue, achievements, stats, daily, dailyHistory, seedScores, family }: Props) {
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [name, setName] = useState('');
  const [paceMode, setPaceMode] = useState<PaceMode>('full');
  const [typeSpeed, setTypeSpeed] = useState<TypeSpeed>('normal');
  const [showGoal, setShowGoal] = useState(false);
  const [confirmCover, setConfirmCover] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showCollection, setShowCollection] = useState(false);
  const [showFamily, setShowFamily] = useState(false);
  const [showStats, setShowStats] = useState(false);
  /** 回看中的族谱世代（点「每一世」/族谱行打开只读结算页） */
  const [recap, setRecap] = useState<FamilyMember | null>(null);
  /** 玩法说明：首次进入自动弹出（localStorage 无标记时） */
  const [showGuide, setShowGuide] = useState(() => {
    try {
      return !localStorage.getItem(GUIDE_SEEN_KEY);
    } catch {
      return false;
    }
  });
  const closeGuide = () => {
    setShowGuide(false);
    try {
      localStorage.setItem(GUIDE_SEEN_KEY, '1');
    } catch {
      // 存储不可用时忽略（下次进入仍会弹出）
    }
  };
  /** 种子挑战：锁定的好友种子码（null = 随机种子） */
  const [seed, setSeed] = useState<number | null>(null);
  const [showSeed, setShowSeed] = useState(false);
  /** 数据面板（📊 数据入口弹出） */
  const [showAnalytics, setShowAnalytics] = useState(false);
  /** 挑战开局（第 2 周目解锁）：属性整体下调 10 点 */
  const [challenge, setChallenge] = useState(false);
  /** 真实模式（第 2 周目解锁）：选项只显示属性倾向箭头，隐藏精确数值 */
  const [realMode, setRealMode] = useState(false);
  /** 当前是第几周目（累计完成局数 + 1） */
  const round = stats.totalLives + 1;
  /** 今日是否已有每日挑战记录（跨天不展示昨日最佳） */
  const hasTodayBest = daily.date === formatDate(new Date()) && (daily.bestScore > 0 || daily.bestAge > 0);
  /** 图鉴收集进度（标题页入口实时可见，驱动收集欲） */
  const collectionDone = VERDICT_ROUTES.filter(r => (stats.endings[r.key] ?? 0) > 0).length;

  const handleStart = () => {
    if (!gender) return;
    sfx.select();
    if (saves.slots[saves.active]) {
      // 选中槽已有存档 → 确认覆盖
      setConfirmCover(true);
      return;
    }
    // 埋点：自定义目标模态打开
    track({ type: 'feature_use', ts: Date.now(), feature: 'goal' });
    setShowGoal(true);
  };

  const handleCoverConfirm = () => {
    setConfirmCover(false);
    // 埋点：自定义目标模态打开（覆盖确认后进入）
    track({ type: 'feature_use', ts: Date.now(), feature: 'goal' });
    setShowGoal(true);
  };

  const handleGoalSelect = (goal: GoalKey | CustomGoal | null) => {
    if (!gender) return;
    setShowGoal(false);
    const finalName = name.trim() || (gender === 'male' ? '小明' : '小美');
    onStart(gender, finalName, paceMode, typeSpeed, goal, challenge, realMode, seed);
  };

  return (
    // 背景透明：径向渐变由 App 外层全屏铺设，任何窗口尺寸下都无舞台矩形边界
    // 双层结构：不动层（光晕/粒子）+ 滚动层（内容 my-auto 居中——不溢出时居中，溢出时从顶部可滚动，杜绝 justify-center 对称裁切）
    <div className="w-full h-full relative overflow-hidden">

      {/* 光晕动画 */}
      <div className="absolute w-[700px] h-[700px] bg-[radial-gradient(circle,rgba(201,169,110,0.06)_0%,transparent_60%)]
        top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />

      {/* 粒子 */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${1.5 + Math.random() * 2.5}px`,
              height: `${1.5 + Math.random() * 2.5}px`,
              left: `${Math.random() * 100}%`,
              bottom: `-${Math.random() * 10}px`,
              background: `rgba(201,169,110,${0.1 + Math.random() * 0.25})`,
              animation: `float ${8 + Math.random() * 12}s linear ${Math.random() * 8}s infinite`,
            }}
          />
        ))}
      </div>

      {/* 滚动层：my-auto 替代 justify-center（flex 居中溢出时会裁掉顶部且不可滚动） */}
      <div className="h-full overflow-y-auto flex flex-col">
      <div className="m-auto flex flex-col items-center gap-4 py-3">

      {/* 标题 */}
      <h1 className="text-[36px] sm:text-[52px] font-extralight tracking-[10px] sm:tracking-[14px] text-[#c9a96e]
        [text-shadow:0_0_50px_rgba(201,169,110,0.3)] z-10 animate-[fadeInDown_1.4s_ease]">
        人生模拟器
      </h1>
      <p className="text-sm text-white/40 tracking-[8px] z-10 animate-[fadeInUp_1.4s_ease]">
        L I F E  ·  S I M U L A T O R
      </p>

      {/* 名字输入 */}
      <div className="z-10 flex flex-col items-center gap-2 animate-[fadeIn_1.8s_ease]">
        <label className="text-xs text-white/40 tracking-[3px]">你的名字</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleStart(); }}
          placeholder="输入名字或留空"
          maxLength={8}
          className="w-[200px] px-4 py-2.5 bg-white/5 border border-white/15 rounded-lg
            text-white text-center text-base tracking-[3px] outline-none
            focus:border-[#c9a96e] focus:shadow-[0_0_20px_rgba(201,169,110,0.3)]
            transition-all duration-300 font-sans"
        />
      </div>

      {/* 性别选择 */}
      <div className="flex gap-5 z-10 animate-[fadeIn_2s_ease]">
        <button
          onClick={() => { setGender('male'); if (!name) setName('小明'); }}
          className={`w-[120px] h-[130px] border rounded-2xl flex flex-col items-center justify-center gap-2.5
            text-base tracking-[2px] transition-all duration-300
            ${gender === 'male'
              ? 'border-[#4a90d9] shadow-[0_0_35px_rgba(74,144,217,0.35)] bg-[#4a90d9]/10 text-[#4a90d9]'
              : 'border-white/10 bg-white/[0.03] text-white/40 hover:border-[#4a90d9] hover:shadow-[0_12px_30px_rgba(74,144,217,0.2)] hover:text-[#4a90d9] hover:-translate-y-1.5'
            }`}
        >
          <span className="text-[40px] transition-transform duration-300 group-hover:scale-110">👦</span>
          <span>男 生</span>
        </button>
        <button
          onClick={() => { setGender('female'); if (!name) setName('小美'); }}
          className={`w-[120px] h-[130px] border rounded-2xl flex flex-col items-center justify-center gap-2.5
            text-base tracking-[2px] transition-all duration-300
            ${gender === 'female'
              ? 'border-[#d96b8a] shadow-[0_0_35px_rgba(217,107,138,0.35)] bg-[#d96b8a]/10 text-[#d96b8a]'
              : 'border-white/10 bg-white/[0.03] text-white/40 hover:border-[#d96b8a] hover:shadow-[0_12px_30px_rgba(217,107,138,0.2)] hover:text-[#d96b8a] hover:-translate-y-1.5'
            }`}
        >
          <span className="text-[40px] transition-transform duration-300 group-hover:scale-110">👧</span>
          <span>女 生</span>
        </button>
      </div>

      {/* 存档槽位（3 卡片，点击继续） */}
      {saves.slots.some(s => s !== null) && (
        <div className="z-10 flex gap-2.5 animate-[fadeIn_1.7s_ease]">
          {saves.slots.map((s, i) => (
            <button
              key={i}
              onClick={() => { if (s) { sfx.select(); onContinue(i); } }}
              disabled={!s}
              className={`w-[110px] py-1.5 rounded-xl border text-center transition-all duration-200 font-sans
                ${s
                  ? 'border-white/15 bg-white/[0.03] hover:border-[#c9a96e] hover:shadow-[0_0_14px_rgba(201,169,110,0.2)] cursor-pointer'
                  : 'border-white/[0.06] bg-transparent text-white/20'}`}
            >
              {s ? (
                <>
                  <div className="text-[13px] text-[#c9a96e]">{s.game.name}</div>
                  <div className="text-[10px] text-white/40 mt-0.5">{s.game.age} 岁 · {s.game.phase === 'summary' ? '已走完' : s.game.stage === 'infant' ? '婴儿期' : s.game.stage === 'childhood' ? '童年' : s.game.stage === 'teen' ? '少年' : s.game.stage === 'young_adult' ? '青年' : s.game.stage === 'adult' ? '成年' : s.game.stage === 'middle_age' ? '中年' : '老年'}</div>
                </>
              ) : (
                <div className="text-[11px] text-white/25 tracking-[2px]">空槽位</div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* 节奏选择：密度档（开局选定） */}
      <div className="z-10 flex flex-col items-center gap-2 animate-[fadeIn_1.9s_ease]">
        <label className="text-xs text-white/40 tracking-[3px]">节奏</label>
        <div className="flex gap-3">
          <button
            onClick={() => { sfx.select(); setPaceMode('full'); }}
            className={`w-[132px] py-2 rounded-[30px] text-[13px] tracking-[3px] border transition-all duration-300 font-sans
              ${paceMode === 'full'
                ? 'border-[#c9a96e] text-[#c9a96e] bg-[#c9a96e]/10 shadow-[0_0_18px_rgba(201,169,110,0.2)]'
                : 'border-white/15 text-white/40 bg-white/[0.03] hover:border-[#c9a96e]/50 hover:text-[#c9a96e]'}`}
          >
            沉浸人生
          </button>
          <button
            onClick={() => { sfx.select(); setPaceMode('lite'); }}
            className={`w-[132px] py-2 rounded-[30px] text-[13px] tracking-[3px] border transition-all duration-300 font-sans
              ${paceMode === 'lite'
                ? 'border-[#c9a96e] text-[#c9a96e] bg-[#c9a96e]/10 shadow-[0_0_18px_rgba(201,169,110,0.2)]'
                : 'border-white/15 text-white/40 bg-white/[0.03] hover:border-[#c9a96e]/50 hover:text-[#c9a96e]'}`}
          >
            精简人生
          </button>
        </div>
        <p className="text-[10px] text-white/30 tracking-[2px]">
          {paceMode === 'lite' ? '每岁约 1-2 个选择 · 一局约 15 分钟' : '全部事件 · 一局 1.5-3 小时'}
        </p>
      </div>

      {/* 打字速度（游戏内也可切换） */}
      <div className="z-10 flex items-center gap-3 animate-[fadeIn_2s_ease]">
        <label className="text-xs text-white/40 tracking-[3px]">打字</label>
        <div className="flex gap-2">
          {([['slow', '慢'], ['normal', '中'], ['fast', '快']] as Array<[TypeSpeed, string]>).map(([v, label]) => (
            <button
              key={v}
              onClick={() => { sfx.select(); setTypeSpeed(v); }}
              className={`w-8 h-8 rounded-full text-[12px] border transition-all duration-200 font-sans
                ${typeSpeed === v
                  ? 'border-[#c9a96e] text-[#c9a96e] bg-[#c9a96e]/10'
                  : 'border-white/15 text-white/35 hover:border-[#c9a96e]/40 hover:text-[#c9a96e]'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 周目解锁：挑战开局 + 真实模式（第 2 周目）+ 命运事件（第 3 周目） */}
      {round >= 2 && (
        <div className="z-10 flex items-center gap-3 animate-[fadeIn_2.1s_ease]">
          <button
            onClick={() => { sfx.select(); setChallenge(v => !v); }}
            className={`px-4 py-1.5 rounded-full text-[11px] tracking-[2px] border transition-all duration-200 font-sans
              ${challenge
                ? 'border-[#e8a05d] text-[#e8a05d] bg-[#e8a05d]/10 shadow-[0_0_14px_rgba(232,160,93,0.2)]'
                : 'border-white/15 text-white/35 bg-white/[0.03] hover:border-[#e8a05d]/50 hover:text-[#e8a05d]'}`}
          >
            ⚔️ 挑战开局{challenge ? '：属性 -10' : ''}
          </button>
          <button
            onClick={() => { sfx.select(); setRealMode(v => !v); }}
            className={`px-4 py-1.5 rounded-full text-[11px] tracking-[2px] border transition-all duration-200 font-sans
              ${realMode
                ? 'border-[#b57edc] text-[#b57edc] bg-[#b57edc]/10 shadow-[0_0_14px_rgba(181,126,220,0.2)]'
                : 'border-white/15 text-white/35 bg-white/[0.03] hover:border-[#b57edc]/50 hover:text-[#b57edc]'}`}
          >
            🎭 真实模式{realMode ? '：隐藏数值' : ''}
          </button>
          {round >= 3 && (
            <span className="text-[10px] text-white/30 tracking-[2px]">
              ⚡ 命运事件已解锁（随机事件效果 ×1.5）
            </span>
          )}
        </div>
      )}

      {/* 开始按钮 */}
      <button
        onClick={handleStart}
        disabled={!gender}
        className={`px-14 py-3.5 rounded-[30px] text-[17px] tracking-[6px] z-10 transition-all duration-400 border font-sans
          ${gender
            ? 'bg-gradient-to-r from-[#c9a96e] to-[#a88b4e] text-[#1a1a2e] font-bold border-transparent shadow-[0_8px_32px_rgba(201,169,110,0.3)] hover:scale-105 cursor-pointer'
            : 'bg-white/[0.06] text-white/30 border-white/[0.08] cursor-not-allowed'
          }`}
      >
        开 始 人 生
      </button>

      {/* 快捷入口：快速模拟（随机性别与名字自动走完一生）+ 每日挑战 + 生涯/成就总览；flex-wrap 适配窄屏换行 */}
      <div className="z-10 flex items-center justify-center flex-wrap gap-x-4 gap-y-2 max-w-full px-4">
        <button
          onClick={() => {
            sfx.select();
            // 埋点：快速模拟入口
            track({ type: 'feature_use', ts: Date.now(), feature: 'quick_sim' });
            const gender = Math.random() < 0.5 ? 'male' : 'female';
            onAutoStart(gender, gender === 'male' ? '小明' : '小美');
          }}
          className="px-10 py-2 rounded-[30px] text-[13px] tracking-[4px] transition-all duration-300 border font-sans
            border-white/15 text-white/35 bg-transparent
            hover:border-[#c9a96e]/50 hover:text-[#c9a96e] hover:bg-[#c9a96e]/5 cursor-pointer"
        >
          ⚡ 快速模拟
        </button>

        {/* 每日挑战：今日固定种子开局（同日同序列），结算记录今日最佳 */}
        <button
          onClick={() => {
            sfx.select();
            // 埋点：每日挑战入口
            track({ type: 'feature_use', ts: Date.now(), feature: 'daily' });
            onDailyStart();
          }}
          className="px-10 py-2 rounded-[30px] text-[13px] tracking-[4px] transition-all duration-300 border font-sans
            border-white/15 text-white/35 bg-transparent
            hover:border-[#e8c95d]/50 hover:text-[#e8c95d] hover:bg-[#e8c95d]/5 cursor-pointer"
        >
          📅 每日挑战
        </button>

        {hasTodayBest && (
          <span className="text-[10px] text-white/30 tracking-[1px] whitespace-nowrap">
            今日最佳 评分 {daily.bestScore} / 享年 {daily.bestAge}
          </span>
        )}

        {/* 生涯入口 */}
        <button
          onClick={() => {
            sfx.select();
            // 埋点：生涯入口
            track({ type: 'feature_use', ts: Date.now(), feature: 'stats' });
            setShowStats(true);
          }}
          className="text-[12px] text-white/30 tracking-[3px] hover:text-[#c9a96e] transition-colors duration-200 font-sans"
        >
          📊 生涯
        </button>

        {/* 成就入口 */}
        <button
          onClick={() => {
            sfx.select();
            // 埋点：成就入口
            track({ type: 'feature_use', ts: Date.now(), feature: 'achievements' });
            setShowAchievements(true);
          }}
          className="text-[12px] text-white/30 tracking-[3px] hover:text-[#c9a96e] transition-colors duration-200 font-sans"
        >
          🏆 成就
        </button>

        {/* 图鉴入口：13 条结局路线收集 */}
        <button
          onClick={() => {
            sfx.select();
            // 埋点：图鉴入口
            track({ type: 'feature_use', ts: Date.now(), feature: 'collection' });
            setShowCollection(true);
          }}
          className="text-[12px] text-white/30 tracking-[3px] hover:text-[#c9a96e] transition-colors duration-200 font-sans"
        >
          📖 图鉴
          <span className="ml-1 text-[10px] text-[#c9a96e]/70">{collectionDone}/13</span>
        </button>

        {/* 家族入口：族谱跨世代收藏 */}
        <button
          onClick={() => {
            sfx.select();
            // 埋点：家族入口
            track({ type: 'feature_use', ts: Date.now(), feature: 'family' });
            setShowFamily(true);
          }}
          className="text-[12px] text-white/30 tracking-[3px] hover:text-[#c9a96e] transition-colors duration-200 font-sans"
        >
          🌳 家族
        </button>

        {/* 玩法说明入口（首次进入会自动弹出一次） */}
        <button
          onClick={() => {
            sfx.select();
            // 埋点：玩法入口
            track({ type: 'feature_use', ts: Date.now(), feature: 'guide' });
            setShowGuide(true);
          }}
          className="text-[12px] text-white/30 tracking-[3px] hover:text-[#c9a96e] transition-colors duration-200 font-sans"
        >
          ❓ 玩法
        </button>

        {/* 种子挑战入口：输入好友的种子码玩同一事件序列 */}
        <button
          onClick={() => {
            sfx.select();
            // 埋点：种子挑战入口
            track({ type: 'feature_use', ts: Date.now(), feature: 'seed' });
            setShowSeed(true);
          }}
          className={`text-[12px] tracking-[3px] transition-colors duration-200 font-sans
            ${seed != null ? 'text-[#c9a96e]' : 'text-white/30 hover:text-[#c9a96e]'}`}
        >
          {seed != null ? `🔑 ${seed}` : '🔑 种子'}
        </button>

        {/* 数据面板入口：埋点数据看板与导出（按计划刻意不埋点自身——与其余快捷入口不同） */}
        <button
          onClick={() => {
            sfx.select();
            setShowAnalytics(true);
          }}
          className="text-[12px] text-white/30 tracking-[3px] hover:text-[#c9a96e] transition-colors duration-200 font-sans"
        >
          📊 数据
        </button>
      </div>

      </div>
      </div>

      {/* 目标选择模态（开始人生后弹出，确认目标后开局）；模态放滚动层外，防未来包含块变化导致错位 */}
      {showGoal && (
        <GoalModal onSelect={handleGoalSelect} onCancel={() => setShowGoal(false)} latestMember={family[family.length - 1]} />
      )}

      {/* 覆盖确认（选中槽已有存档时弹出） */}
      {confirmCover && (
        <ConfirmModal
          title="覆盖存档"
          desc={`槽位 ${saves.active + 1} 已有存档（${saves.slots[saves.active]?.game.name}，${saves.slots[saves.active]?.game.age} 岁）。开始新人生将覆盖它，确定吗？`}
          onConfirm={handleCoverConfirm}
          onCancel={() => setConfirmCover(false)}
        />
      )}

      {/* 成就总览模态（🏆 入口弹出） */}
      {showAchievements && (
        <AchievementsModal unlocked={achievements.unlocked} onClose={() => setShowAchievements(false)} />
      )}

      {/* 人生图鉴模态（📖 入口弹出） */}
      {showCollection && (
        <CollectionModal endings={stats.endings} onClose={() => setShowCollection(false)} />
      )}

      {/* 家族族谱模态（🌳 入口弹出）；有回顾数据的代可点击回看结算页 */}
      {showFamily && (
        <FamilyModal family={family} onRecap={setRecap} onClose={() => setShowFamily(false)} />
      )}

      {/* 生涯统计模态（📊 入口弹出，含「每一世」回看列表） */}
      {showStats && (
        <StatsModal stats={stats} family={family} dailyHistory={dailyHistory} onRecap={setRecap} onClose={() => setShowStats(false)} />
      )}

      {/* 世代结算回看：复用 SummaryScreen 只读渲染（z-60 盖在统计/族谱模态之上） */}
      {recap?.detail && (
        <div className="absolute inset-0 z-[60]">
          <SummaryScreen
            game={recapGame(recap)!}
            onRestart={() => setRecap(null)}
            newAchievements={[]}
            skippedTitles={recap.detail.skippedTitles}
            generation={recap.generation}
          />
        </div>
      )}

      {/* 种子挑战输入模态（🔑 入口弹出） */}
      {showSeed && (
        <SeedModal
          onConfirm={s => { setSeed(s); setShowSeed(false); }}
          onCancel={() => setShowSeed(false)}
          scores={seedScores}
        />
      )}

      {/* 玩法说明模态（❓ 入口 / 首次进入自动弹出） */}
      {showGuide && (
        <GuideModal onClose={closeGuide} />
      )}

      {/* 数据面板模态（📊 数据入口弹出） */}
      {showAnalytics && (
        <AnalyticsModal onClose={() => setShowAnalytics(false)} />
      )}
    </div>
  );
}
