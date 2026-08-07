import { CHANGELOG, LATEST_VERSION } from '../data/changelog';

interface Props {
  onClose: () => void;
}

/**
 * 更新日志模态（全量查看）：版本列表（最新在上），每条含日期/标题/要点。
 * 首页侧边栏只显示最新几条，点「查看全部」打开本模态。
 */
export default function ChangelogModal({ onClose }: Props) {
  return (
    <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div className="w-[520px] max-w-[92vw] max-h-[min(560px,86vh)] overflow-y-auto rounded-2xl border border-white/10 bg-[#15152a] p-6 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <div className="text-center">
          <h3 className="text-[17px] tracking-[5px] text-[#c9a96e]">🕓 更新日志</h3>
          <p className="text-[10px] text-white/30 tracking-[2px] mt-1">当前版本 v{LATEST_VERSION} · 每次更新都在这里</p>
        </div>
        {CHANGELOG.map(entry => (
          <div key={entry.version} className="border-b border-white/[0.06] pb-3.5 last:border-0">
            <div className="flex items-baseline gap-2.5">
              <span className="text-[14px] font-semibold text-[#c9a96e] tracking-[1px]">v{entry.version}</span>
              <span className="text-[11px] text-[#e8c95d]/70">{entry.title}</span>
              <span className="text-[10px] text-white/25 ml-auto">{entry.date}</span>
            </div>
            <ul className="mt-2 flex flex-col gap-1.5">
              {entry.items.map(item => (
                <li key={item} className="text-[12px] text-white/55 leading-relaxed list-none">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <button
          onClick={onClose}
          className="px-8 py-2.5 rounded-[30px] text-[13px] tracking-[3px] border font-sans mx-auto
            border-white/15 text-white/40 hover:border-[#c9a96e]/50 hover:text-[#c9a96e]"
        >
          关闭
        </button>
      </div>
    </div>
  );
}
