import { ACTIVITIES, type Activity } from '../engine/activities';
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

/**
 * 主动行动模态（局内「⚡ 行动」入口）。
 * 列出本岁可主动发起的活动（健身/学习/打工/社交/体检/休闲/遛宠物/犯罪），
 * 每岁每个活动限 1 次（已做过的置灰「已做过」——行动不推进年龄，防止无限刷同一种）；
 * 可用性在组件内判定：年龄达标 + requires 任一 flag 存在 + 本岁未做过，否则置灰并注明原因；
 * 犯罪活动标注「高风险」。选择后由引擎 MAKE_ACTION 执行，结果走反馈页展示。
 */
export default function ActionModal({ open, onClose, onAction, age, flags, actionsDone }: Props) {
  if (!open) {
    return null;
  }
  // 可用性判定（组件内计算，不依赖引擎判定函数）：年龄达标 + requires 任一 flag 存在 + 本岁未做过
  const isAvailable = (a: Activity): boolean => {
    if (age < a.minAge) {
      return false;
    }
    if (actionsDone.includes(a.id)) {
      return false;
    }
    if (a.requires && a.requires.length > 0 && !a.requires.some(f => flags.includes(f))) {
      return false;
    }
    return true;
  };
  return (
    <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center" onClick={onClose}>
      <div
        className="w-[480px] max-w-[92vw] max-h-[min(520px,86vh)] overflow-y-auto rounded-2xl border border-white/15 bg-[#10101f] shadow-2xl shadow-black/70 p-6 flex flex-col gap-2.5"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-center text-[17px] tracking-[5px] text-[#c9a96e]">⚡ 主动行动</h3>
        <p className="text-center text-[10px] text-white/50 tracking-[2px]">每岁每个活动可做一次 · 不推进年龄</p>
        {ACTIVITIES.map(a => {
          const available = isAvailable(a);
          const done = actionsDone.includes(a.id);
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
                {!available && (
                  <span className="text-[10px] text-white/35 shrink-0">
                    {done ? '已做过' : age < a.minAge ? `${a.minAge} 岁解锁` : '需要先养一只宠物'}
                  </span>
                )}
              </span>
            </button>
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
