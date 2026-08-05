import { VERDICT_ROUTES } from '../engine/verdict';

interface Props {
  /** 结局分布统计（key → 达成次数），来自生涯统计存储 */
  endings: Record<string, number>;
  onClose: () => void;
}

/** 人生图鉴模态（标题页入口）：13 条结局路线收集册 */
export default function CollectionModal({ endings, onClose }: Props) {
  const done = VERDICT_ROUTES.filter(r => (endings[r.key] ?? 0) > 0).length;
  return (
    <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div className="w-[480px] max-h-[520px] overflow-y-auto rounded-2xl border border-white/10 bg-[#15152a] p-6 flex flex-col gap-3" onClick={e => e.stopPropagation()}>
        <h3 className="text-center text-[18px] tracking-[6px] text-[#c9a96e]">人生图鉴 · {done}/{VERDICT_ROUTES.length}</h3>
        <p className="text-center text-[11px] text-white/30 tracking-[1px]">每一条路线，都是一种活法</p>
        {VERDICT_ROUTES.map(r => {
          const count = endings[r.key] ?? 0;
          const got = count > 0;
          return (
            <div key={r.key} className={`flex items-center gap-3 p-3 rounded-lg border ${got ? 'border-[#c9a96e]/25 bg-[#c9a96e]/5' : 'border-white/[0.06] bg-white/[0.02]'}`}>
              <span className={`text-[18px] leading-none ${got ? '' : 'opacity-40 grayscale'}`}>{got ? r.icon : '🔒'}</span>
              <div className="flex-1">
                <div className={`text-[13px] ${got ? 'text-[#c9a96e]' : 'text-white/40'}`}>
                  {got ? r.title : '？？？'}
                </div>
                <div className="text-[11px] text-white/30 mt-0.5 leading-relaxed">
                  {got ? `已达成 ${count} 次` : r.hint}
                </div>
              </div>
              {got && <span className="text-[10px] text-[#c9a96e]/60 tracking-[1px]">已收集</span>}
            </div>
          );
        })}
        <button
          onClick={onClose}
          className="px-8 py-2.5 rounded-[30px] text-[13px] tracking-[3px] border font-sans mx-auto mt-1
            border-white/15 text-white/40 hover:border-[#c9a96e]/50 hover:text-[#c9a96e]"
        >
          关闭
        </button>
      </div>
    </div>
  );
}
