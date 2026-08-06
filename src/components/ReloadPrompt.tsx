import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * PWA 更新提示条：新版本就绪时右下角弹出，玩家自行选择刷新时机
 * （autoUpdate 会在游戏进行中无感刷新导致丢局，故用 prompt 模式）。
 * offlineReady 仅首次可离线时短暂提示。
 */
export default function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!needRefresh && !offlineReady) {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex items-center gap-3 px-5 py-3 rounded-2xl
      bg-[#1a1a2e]/95 border border-[#c9a96e]/40 shadow-[0_8px_30px_rgba(0,0,0,0.5)] font-sans">
      <span className="text-[12px] tracking-[2px] text-white/70">
        {needRefresh ? '✨ 新版本已就绪' : '📶 已可离线游玩'}
      </span>
      {needRefresh && (
        <button
          onClick={() => updateServiceWorker(true)}
          className="text-[12px] tracking-[2px] text-[#c9a96e] hover:text-[#e8c95d] transition-colors"
        >
          刷新体验
        </button>
      )}
      <button
        onClick={close}
        className="text-[12px] text-white/30 hover:text-white/60 transition-colors"
        aria-label="关闭"
      >
        ✕
      </button>
    </div>
  );
}
