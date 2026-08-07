import { ACTIVITIES, type Activity } from '../engine/activities';
import { ATTR_META } from '../engine/state';
import type { AttributeKey } from '../types';
import { sfx } from '../utils/sound';

interface Props {
  open: boolean;
  onClose: () => void;
  onAction: (activityId: string) => void;
  age: number;
  flags: string[];
  /** 本岁已做过的活动 id 列表（每岁每个活动限 1 次，重复的置灰「已做过」） */
  actionsDone: string[];
}

/** 活动分组（BitLife 式经营面板：按人生领域分组展示） */
const ACTIVITY_GROUPS: Array<{ id: string; icon: string; title: string; activities: string[] }> = [
  { id: 'body', icon: '🏋️', title: '身体', activities: ['fitness', 'health', 'walk_dog'] },
  { id: 'growth', icon: '📚', title: '成长', activities: ['study', 'skill_practice'] },
  { id: 'finance', icon: '💰', title: '财务', activities: ['work', 'invest', 'job_hunt'] },
  { id: 'love', icon: '❤️', title: '情感', activities: ['social', 'blind_date', 'date_night'] },
  { id: 'family', icon: '👨‍👩‍👧', title: '家庭', activities: ['parenting', 'family_call'] },
  { id: 'mind', icon: '🧘', title: '内心', activities: ['leisure', 'meditate'] },
  { id: 'gray', icon: '⚖️', title: '灰色地带', activities: ['crime'] },
];

/** 活动主提升属性（效果标签展示；与各活动结果池的主属性一致） */
const ACTIVITY_TAGS: Record<string, AttributeKey> = {
  fitness: 'health', study: 'intelligence', work: 'wealth', social: 'social',
  health: 'health', leisure: 'happiness', walk_dog: 'happiness', crime: 'wealth',
  invest: 'wealth', blind_date: 'social', date_night: 'happiness', parenting: 'happiness',
  family_call: 'social', job_hunt: 'wealth', skill_practice: 'intelligence', meditate: 'happiness',
};

/**
 * 主动行动模态（局内「⚡ 行动」入口，BitLife 式经营面板）。
 * 活动按人生领域分组展示（身体/成长/财务/情感/家庭/内心/灰色地带），每个活动标注主提升属性；
 * 每岁每个活动限 1 次（已做过的置灰「已做过」——行动不推进年龄，防止无限刷同一种）；
 * 可用性在组件内判定：年龄达标 + requires 任一 flag 存在 + requiresNot 任一 flag 不存在 + 本岁未做过，
 * 否则置灰并注明原因（requiresNot 命中显示「当前状态不可做」，如已婚相亲/在职求职）；
 * 犯罪活动标注「高风险」。选择后由引擎 MAKE_ACTION 执行，结果走反馈页展示。
 */
export default function ActionModal({ open, onClose, onAction, age, flags, actionsDone }: Props) {
  if (!open) {
    return null;
  }
  // 活动不可用原因（null = 可用；组件内计算，不依赖引擎判定函数）：
  // 判定顺序 已做过 > 年龄未达 > requiresNot 任一 flag 存在 > requires 任一 flag 不存在
  const blockReason = (a: Activity): string | null => {
    if (actionsDone.includes(a.id)) {
      return '已做过';
    }
    if (age < a.minAge) {
      return `${a.minAge} 岁解锁`;
    }
    if (a.requiresNot && a.requiresNot.some(f => flags.includes(f))) {
      return '当前状态不可做';
    }
    if (a.requires && a.requires.length > 0 && !a.requires.some(f => flags.includes(f))) {
      return '条件不满足';
    }
    return null;
  };
  return (
    <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center" onClick={onClose}>
      <div
        className="w-[480px] max-w-[92vw] max-h-[min(520px,86vh)] overflow-y-auto rounded-2xl border border-white/15 bg-[#10101f] shadow-2xl shadow-black/70 p-6 flex flex-col gap-3"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-center text-[17px] tracking-[5px] text-[#c9a96e]">⚡ 主动行动</h3>
        <p className="text-center text-[10px] text-white/50 tracking-[2px]">每岁每个活动可做一次 · 不推进年龄</p>
        {ACTIVITY_GROUPS.map(group => {
          const activities = group.activities
            .map(id => ACTIVITIES.find(a => a.id === id))
            .filter((a): a is Activity => a !== undefined);
          return (
            <div key={group.id} className="flex flex-col gap-1.5">
              {/* 分组标题（BitLife 式领域分组） */}
              <div className="flex items-center gap-1.5 mt-1 first:mt-0">
                <span className="text-[11px]">{group.icon}</span>
                <span className="text-[11px] tracking-[3px] text-[#c9a96e]/80">{group.title}</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>
              {activities.map(a => {
                const reason = blockReason(a);
                const available = reason === null;
                const tag = ACTIVITY_TAGS[a.id];
                const tagMeta = tag ? ATTR_META[tag] : null;
                return (
                  <button
                    key={a.id}
                    disabled={!available}
                    onClick={() => { sfx.select(); onAction(a.id); onClose(); }}
                    className={`w-full px-4 py-2.5 rounded-xl border text-left transition-all duration-200 font-sans
                      ${available
                        ? 'border-white/10 bg-white/[0.03] hover:border-[#c9a96e]/50 hover:bg-[#c9a96e]/5'
                        : 'border-white/5 bg-black/20 opacity-45 cursor-not-allowed'}`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <span className="text-[15px] shrink-0">{a.icon}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] text-white/85 leading-snug">
                          {a.name}
                          {a.id === 'crime' && <span className="ml-1.5 text-[10px] text-[#e85d75] align-middle">高风险</span>}
                        </span>
                        <span className="block text-[11px] text-white/40 leading-snug">{a.desc}</span>
                      </span>
                      {/* 主提升属性标签（BitLife 式效果提示） */}
                      {tagMeta && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap shrink-0"
                          style={{ color: tagMeta.color, borderColor: `${tagMeta.color}44`, backgroundColor: `${tagMeta.color}12` }}>
                          {tagMeta.icon} {tagMeta.name}
                        </span>
                      )}
                      {!available && (
                        <span className="text-[10px] text-white/35 shrink-0">{reason}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
        <button
          onClick={() => { sfx.select(); onClose(); }}
          className="px-8 py-2.5 rounded-[30px] text-[13px] tracking-[3px] border font-sans mx-auto
            border-white/15 text-white/40 hover:border-[#c9a96e]/50 hover:text-[#c9a96e]"
        >
          关闭
        </button>
      </div>
    </div>
  );
}
