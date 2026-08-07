import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { AttributeKey, Choice, GameState, LifeEvent, TypeSpeed } from '../types';
import { STAGE_META, ATTR_META } from '../engine/state';
import { sfx, startBgm, stopBgm } from '../utils/sound';
import { track } from '../utils/analytics';
import SceneArea, { ATTR_TINT } from './SceneArea';
import StatusBar from './StatusBar';
import DialogBox from './DialogBox';
import ChoicePanel from './ChoicePanel';
import ConfirmModal from './ConfirmModal';
import KeyChoicesModal from './KeyChoicesModal';
import CharacterPanel from './CharacterPanel';
import { checkGoal, GOALS } from '../engine/goals';
import { jobStatus } from '../engine/jobs';
import { assetStatus } from '../engine/assets';
import { isRetired } from '../engine/retirement';
import { useName } from '../utils/naming';
import { undoableAges } from '../hooks/useGame';
import type { UndoEntry } from '../types';
import type { WeeklyGoal } from '../engine/weekly';
import { EVENTS } from '../engine/events';
import { derivePersona, PERSONA_META, traitForOutcome } from '../engine/personality';

/** 选项效果主属性（绝对值最大）→ 背景色调，让每个选项的选择有视觉反馈 */
function pickAttrTint(choice: Choice): string | null {
  const attr = choice.outcomes.attr ?? {};
  let best: AttributeKey | null = null;
  let bestAbs = 0;
  for (const [k, v] of Object.entries(attr) as [AttributeKey, number][]) {
    if (Math.abs(v) > bestAbs) {
      bestAbs = Math.abs(v);
      best = k;
    }
  }
  return best ? ATTR_TINT[best] : null;
}

interface Props {
  game: GameState;
  currentEvent: LifeEvent | null;
  feedback: string | null;
  autoPlay: boolean;
  typeSpeed: TypeSpeed;
  /** 本局命运事件 id 列表（第 3 周目起 1 个、第 5 周目起 2 个：效果 ×1.5，展示角标） */
  fateEventIds: string[];
  /** 每周挑战局（顶部展示本周目标） */
  isWeekly?: boolean;
  /** 本周挑战目标 */
  weeklyGoal?: WeeklyGoal;
  /** 后悔栈（回退上一步/回退到某岁；栈空时按钮隐藏） */
  undoStack: UndoEntry[];
  onUndo: () => void;
  onUndoToAge: (age: number) => void;
  onTypeSpeedChange: (s: TypeSpeed) => void;
  onChoice: (choice: Choice) => void;
  onContinue: () => void;
  onExit: () => void;
  /** 局中重开：沿用本局角色与设置换新种子重开 */
  onRestart: () => void;
}

const SPEED_OPTIONS: Array<{ value: TypeSpeed; label: string }> = [
  { value: 'slow', label: '慢' },
  { value: 'normal', label: '中' },
  { value: 'fast', label: '快' },
];

export default function GameScreen({ game, currentEvent, feedback, autoPlay, typeSpeed, fateEventIds, isWeekly = false, weeklyGoal, undoStack, onUndo, onUndoToAge, onTypeSpeedChange, onChoice, onContinue, onExit, onRestart }: Props) {
  const [showChoices, setShowChoices] = useState(false);
  const [showExit, setShowExit] = useState(false);
  // 后悔弹窗（回退上一步 / 回退到某岁）
  const [showUndo, setShowUndo] = useState(false);
  // 关键抉择回顾弹窗（本局里程碑选择）
  const [showKeyChoices, setShowKeyChoices] = useState(false);
  // 性格面板展开/收起（数值栏「🧭 性格」入口按钮切换）
  const [showPersona, setShowPersona] = useState(false);
  // 最近选择选项的主属性色调（反馈页期间叠加在场景上，继续后清除）
  const [tint, setTint] = useState<string | null>(null);
  // 职业/资产/退休摘要（状态栏一行展示；纯函数推导，无职业时为空）
  const statusCaption = useMemo(() => {
    const job = jobStatus(game);
    const assets = assetStatus(game);
    const retired = isRetired(game);
    const parts: string[] = [];
    if (job && !retired) {
      parts.push(`${job.icon} ${job.title} · 从业 ${job.years} 年`);
    }
    if (retired) {
      parts.push(`🛋️ 已退休${job ? `（前${job.title}）` : ''}`);
    }
    if (assets.length > 0) {
      parts.push(assets.map(a => `${a.icon}${a.label}`).join(' '));
    }
    return parts.length > 0 ? parts.join(' · ') : null;
  }, [game]);
  // 可回退的岁数（去重升序；「回退到 N 岁」按钮组）
  const undoAges = useMemo(() => undoableAges(undoStack), [undoStack]);
  // 称呼替换：事件文本与反馈文本中的「你」→ 玩家名字
  const eventText = currentEvent ? useName(currentEvent.text, game.name) : '';
  const feedbackText = feedback ? useName(feedback, game.name) : null;
  // 本次选择的性格端（反馈页「你的选择」徽章；从 history 最后一条反查选项，纯推导）
  const lastTraits = useMemo(() => {
    const last = game.history[game.history.length - 1];
    if (!last) {
      return [];
    }
    const ev = EVENTS.find(e => e.id === last.eventId);
    const ch = ev?.choices[last.choiceIndex];
    return ch ? traitForOutcome(ch.outcomes.attr, ch.outcomes.flags, ch.outcomes.personality) : [];
  }, [game.history]);
  // 性格画像：从选择历史推导（3 维 6 端累积；纯推导，undo/旧存档自动兼容）
  const persona = useMemo(() => derivePersona(game.history), [game.history]);
  // 人生目标（开局选定，null 无目标）：预设目标查定义表，达成判定由 checkGoal 提供
  const goalDef = useMemo(
    () => (typeof game.goal === 'string' ? GOALS.find(g => g.key === game.goal) ?? null : null),
    [game.goal],
  );
  const goalResult = useMemo(() => checkGoal(game.goal, game), [game.goal, game]);
  // 自定义目标逐项（属性键 → 目标值；预设目标为空数组）
  const goalAttrs = useMemo(
    () => (game.goal && typeof game.goal !== 'string' ? (Object.entries(game.goal.attrs) as [AttributeKey, number][]) : []),
    [game.goal],
  );

  // 选择选项：记录主属性色调（视觉反馈）
  const handleChoice = useCallback((choice: Choice) => {
    setTint(pickAttrTint(choice));
    onChoice(choice);
  }, [onChoice]);

  // 继续：清除色调，回到事件场景
  const handleContinue = useCallback(() => {
    setTint(null);
    onContinue();
  }, [onContinue]);

  const handleDialogComplete = useCallback(() => {
    if (currentEvent && currentEvent.choices.length === 1 && currentEvent.choices[0].text === '……') {
      // 纯叙事事件，不显示选择面板，直接等用户点击
    } else {
      setShowChoices(true);
    }
  }, [currentEvent]);

  // 阶段切换音（跳过首次渲染，只在实际切换阶段时播放）
  const firstStageRef = useRef(true);
  useEffect(() => {
    if (firstStageRef.current) {
      firstStageRef.current = false;
      return;
    }
    sfx.stage();
  }, [game.stage]);

  // 阶段 BGM：进入/切换阶段时换对应音阶循环，组件卸载（结算/回标题）停止
  useEffect(() => {
    // 埋点：阶段切换（首次进入也会触发一次，可接受——标记到达）
    track({ type: 'stage_reach', ts: Date.now(), stage: game.stage });
    startBgm(game.stage);
    return () => stopBgm();
  }, [game.stage]);

  // 反馈页面
  if (feedback) {
    const stageMeta = STAGE_META[game.stage];
    return (
      <div className="w-full h-full relative">
        <SceneArea stage={game.stage} age={game.age} gender={game.gender} stageLabel={stageMeta.label} category={currentEvent?.category ?? null} tint={tint} />
        <StatusBar attributes={game.attributes} age={game.age} caption={statusCaption} />
        <div
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-b from-black/92 to-black/97
            backdrop-blur-xl border-t border-white/5 cursor-pointer z-10"
          onClick={() => { sfx.advance(); handleContinue(); }}
        >
          <div className="px-7 py-5 text-center max-w-[860px] mx-auto">
            <div className="text-lg text-[#c9a96e] whitespace-pre-line leading-relaxed">{feedbackText}</div>
            {/* 本次选择的性格徽章：选择累积成画像，选完即时可见（无信号选项不显示） */}
            {lastTraits.length > 0 && (
              <div className="mt-3 flex items-center justify-center gap-1.5">
                <span className="text-[11px] text-white/40 tracking-wider">你的选择</span>
                {lastTraits.map(t => (
                  <span key={t}
                    className="text-[11px] px-1.5 py-0.5 rounded border"
                    style={{ color: PERSONA_META[t].color, borderColor: `${PERSONA_META[t].color}55`, backgroundColor: `${PERSONA_META[t].color}1a` }}>
                    {PERSONA_META[t].icon} {PERSONA_META[t].name} +1
                  </span>
                ))}
              </div>
            )}
            <div className="text-[11px] text-white/30 mt-3 animate-pulse">▼ 点击继续</div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentEvent) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black text-white/40">
        没有更多事件了……
      </div>
    );
  }

  const stageMeta = STAGE_META[game.stage];
  const isAuto = currentEvent.choices.length === 1 && currentEvent.choices[0].text === '……';

  return (
    <div className="w-full h-full relative">
      {/* 场景 */}
      <SceneArea stage={game.stage} age={game.age} gender={game.gender} stageLabel={stageMeta.label} category={currentEvent?.category ?? null} tint={tint} />

      {/* 状态栏 — 锚定场景区（h-[55%]）底缘：底部区域限高 45% 恰好互补，任何视口高度下都不重叠 */}
      <div className="absolute top-0 left-0 right-0 h-[55%] z-10 flex flex-col justify-end">
        {/* 数值栏右上角工具行：性格面板入口（展开/收起；快速模拟不显示） */}
        {!autoPlay && (
          <div className="flex justify-end px-3 pb-1.5">
            <button
              onClick={() => { sfx.select(); setShowPersona(prev => !prev); }}
              title="性格画像"
              className={`px-3 h-7 rounded-full border text-[11px] transition-all duration-200 font-sans
                ${showPersona
                  ? 'border-[#c9a96e]/60 text-[#c9a96e] bg-[#c9a96e]/10'
                  : 'border-white/15 text-white/60 bg-black/40 hover:border-[#c9a96e]/40 hover:text-[#c9a96e]'}`}
            >
              🧭 性格
            </button>
          </div>
        )}
        <StatusBar attributes={game.attributes} age={game.age} caption={statusCaption} />
      </div>

      {/* 底部区域：对话框 + 选项（限高 45%，与场景区互补） */}
      <div className="absolute bottom-0 left-0 right-0 z-10 max-h-[45%] overflow-y-auto pb-9">
        <DialogBox
          text={eventText}
          name={game.name}
          age={game.age}
          stage={stageMeta.label}
          title={currentEvent.title}
          autoAdvance={isAuto}
          instant={autoPlay}
          typeSpeed={typeSpeed}
          onComplete={handleDialogComplete}
          onAutoContinue={isAuto ? () => handleChoice(currentEvent.choices[0]) : undefined}
        />
        <ChoicePanel
          choices={currentEvent.choices}
          onSelect={handleChoice}
          visible={showChoices && !autoPlay}
          attributes={game.attributes}
          age={game.age}
          realMode={game.realMode ?? false}
        />
      </div>

      {/* 打字速度切换（游戏内实时生效） */}
      <div className="absolute right-2 bottom-1.5 z-20 flex gap-1.5">
        {SPEED_OPTIONS.map(s => (
          <button
            key={s.value}
            onClick={() => { sfx.select(); onTypeSpeedChange(s.value); }}
            title={s.label}
            className={`w-7 h-7 rounded-full text-[11px] border transition-all duration-200 font-sans
              ${typeSpeed === s.value
                ? 'border-[#c9a96e] text-[#c9a96e] bg-[#c9a96e]/10'
                : 'border-white/15 text-white/35 hover:border-[#c9a96e]/40 hover:text-[#c9a96e]'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* 命运事件角标（第 3 周目解锁：效果 ×1.5） */}
      {fateEventIds.includes(currentEvent.id) && (
        <div className="absolute top-2 left-2 z-20 px-3 py-1.5 rounded-full border border-[#e8c95d]/40 bg-[#e8c95d]/10
          text-[#e8c95d] text-[11px] tracking-[2px] animate-pulse">
          ⚡ 命运事件 · 效果 ×1.5
        </div>
      )}

      {/* 每周挑战角标（本周目标：全周可见的局内目标） */}
      {isWeekly && weeklyGoal && (
        <div className="absolute top-2 left-2 z-20 px-3 py-1.5 rounded-full border border-[#e8a05d]/40 bg-[#e8a05d]/10
          text-[#e8a05d] text-[11px] tracking-[2px]">
          🗓️ 本周：{weeklyGoal.icon} {weeklyGoal.name}
        </div>
      )}

      {/* 人生目标进度（开局选定目标时显示）：预设目标 = 达成条件简述 + 达成状态；自定义目标 = 逐项属性进度条 */}
      {game.goal && (
        <div className="absolute top-12 left-2 z-20 w-[280px] max-w-[92vw] rounded-xl border border-white/10 bg-black/50 backdrop-blur-sm px-3 py-2 flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-white/75">🎯 {goalDef ? `${goalDef.icon} ${goalDef.name}` : '自定义目标'}</span>
            {goalResult?.achieved && <span className="text-[11px] text-[#5de8a0]">✓ 已达成</span>}
          </div>
          {goalDef ? (
            <span className="text-[10px] text-white/40 leading-snug">{goalDef.desc}</span>
          ) : (
            <div className="flex flex-col gap-1">
              {goalAttrs.map(([k, v]) => {
                const cur = game.attributes[k] ?? 0;
                const meta = ATTR_META[k];
                const pct = v > 0 ? Math.min(100, Math.round((cur / v) * 100)) : 0;
                return (
                  <div key={k} className="flex items-center gap-1.5">
                    <span className="text-[10px] shrink-0" style={{ color: meta.color }}>{meta.icon}{meta.name}</span>
                    <div className="flex-1 h-[4px] bg-white/10 rounded-sm overflow-hidden">
                      <div className="h-full rounded-sm transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: meta.color }} />
                    </div>
                    <span className={`text-[10px] shrink-0 ${cur >= v ? 'text-[#c9a96e]' : 'text-white/50'}`}>{cur}/{v}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 右上角操作组：flex 自动排列（后悔/抉择/退出），杜绝按钮宽度变化导致的粘连 */}
      <div className="absolute top-2 right-2 z-20 flex items-center gap-2">
        {/* 后悔回退（快速模拟不显示）：回退上一步 / 回退到某岁（半透明深底胶囊，场景光晕下也清晰可见） */}
        {!autoPlay && undoStack.length > 0 && (
          <button
            onClick={() => { sfx.select(); setShowUndo(true); }}
            title="后悔回退"
            className="px-3 h-8 rounded-full border border-white/25 bg-black/40 text-white/80 text-[12px]
              hover:border-[#5de8a0]/80 hover:text-[#5de8a0] transition-all duration-200 font-sans"
          >
            ↩️ 后悔
          </button>
        )}

        {/* 关键抉择回顾（快速模拟不显示）：本局里程碑选择随时回看 */}
        {!autoPlay && game.history.length > 0 && (
          <button
            onClick={() => { sfx.select(); setShowKeyChoices(true); }}
            title="关键抉择"
            className="px-3 h-8 rounded-full border border-white/25 bg-black/40 text-white/80 text-[12px]
              hover:border-[#c9a96e]/80 hover:text-[#c9a96e] transition-all duration-200 font-sans"
          >
            📌 抉择
          </button>
        )}

        {/* 中途退出：回标题（存档保留在槽中）；快速模拟为临时局不提供重开 */}
        <button
          onClick={() => { sfx.select(); setShowExit(true); }}
          title="退出本局"
          className="w-9 h-9 rounded-full border border-white/25 bg-black/40 text-white/80
            hover:border-[#e85d75] hover:text-[#e85d75] transition-all duration-200 font-sans text-[14px]"
        >
          ✕
        </button>
      </div>

      {/* 性格面板（数值栏「🧭 性格」展开；画像推导自本局全部选择，含专属际遇距离提示） */}
      {showPersona && !autoPlay && (
        <div className="absolute top-14 right-2 z-20">
          <CharacterPanel persona={persona} />
        </div>
      )}

      {showUndo && (
        <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center" onClick={() => setShowUndo(false)}>
          <div className="w-[340px] max-w-[92vw] rounded-2xl border border-white/15 bg-[#10101f] shadow-2xl shadow-black/70 p-6 flex flex-col gap-4 items-center" onClick={e => e.stopPropagation()}>
            <h3 className="text-[16px] tracking-[4px] text-[#c9a96e]">后悔回退</h3>
            <p className="text-[12px] text-white/75 leading-relaxed text-center">
              回到这一步之前重新选择，之后的选择都会被撤销。最多可回退 5 步。
            </p>
            <div className="flex flex-wrap justify-center gap-2.5">
              <button
                onClick={() => { sfx.select(); setShowUndo(false); onUndo(); }}
                className="px-6 py-2 rounded-[30px] text-[12px] tracking-[2px] border font-sans
                  border-[#5de8a0]/50 text-[#5de8a0] hover:bg-[#5de8a0]/10"
              >
                ↩️ 回退上一步
              </button>
              {undoAges.map(age => (
                <button
                  key={age}
                  onClick={() => { sfx.select(); setShowUndo(false); onUndoToAge(age); }}
                  className="px-4 py-2 rounded-[30px] text-[12px] tracking-[2px] border font-sans
                    border-[#c9a96e]/40 text-[#c9a96e] hover:bg-[#c9a96e]/10"
                >
                  ⏪ 回到 {age} 岁
                </button>
              ))}
            </div>
            <button
              onClick={() => { sfx.select(); setShowUndo(false); }}
              className="px-6 py-2 rounded-[30px] text-[12px] tracking-[3px] border font-sans
                border-white/15 text-white/40 hover:border-[#c9a96e]/50 hover:text-[#c9a96e]"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {showKeyChoices && (
        <KeyChoicesModal history={game.history} onClose={() => setShowKeyChoices(false)} />
      )}

      {showExit && (
        <ConfirmModal
          title="放弃本局"
          desc="将回到标题页，本局进度会保留在存档槽中。确定放弃吗？"
          extra={autoPlay ? undefined : {
            label: '🔄 重新开始本局',
            onExtra: () => { setShowExit(false); onRestart(); },
          }}
          onConfirm={() => { setShowExit(false); onExit(); }}
          onCancel={() => setShowExit(false)}
        />
      )}
    </div>
  );
}
