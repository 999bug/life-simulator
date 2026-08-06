import { useEffect, useState } from 'react';
import { sfx } from '../utils/sound';

/** 安装提示已展示过的标记（一次即可，不再打扰） */
const PROMPTED_KEY = 'life-sim-install-prompted';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * PWA 安装引导：支持 beforeinstallprompt 的浏览器（Android/Chrome 系）首次访问提示
 * 「添加到主屏幕」——安装后回访率显著提升，这是纯前端免费流量。
 * iOS Safari 无该事件，静默不显示；已安装（standalone 模式）也不显示。
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // 已安装（PWA 独立模式）或已提示过 → 不再展示
    if (window.matchMedia('(display-mode: standalone)').matches || localStorage.getItem(PROMPTED_KEY)) {
      return;
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(PROMPTED_KEY, '1');
    } catch {
      // 存储不可用静默降级（提示条已关闭，本会话不再展示）
      setVisible(false);
    }
  };

  const install = async () => {
    sfx.select();
    try {
      await deferred?.prompt();
    } finally {
      // 无论接受还是拒绝，一次即可
      dismiss();
    }
  };

  if (!visible || !deferred) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl
      bg-[#1a1a2e]/95 border border-[#c9a96e]/40 shadow-[0_8px_40px_rgba(0,0,0,0.5)] backdrop-blur-md">
      <span className="text-lg leading-none">📲</span>
      <div className="text-left">
        <div className="text-[12px] text-white/80 tracking-[1px]">添加到主屏幕，离线也能玩</div>
        <div className="text-[10px] text-white/40 tracking-[1px]">安装后可像 App 一样打开</div>
      </div>
      <button
        onClick={install}
        className="ml-2 px-4 py-1.5 rounded-[30px] text-[11px] tracking-[2px] font-sans font-bold
          bg-gradient-to-r from-[#c9a96e] to-[#a88b4e] text-[#1a1a2e] hover:brightness-110 transition-all"
      >
        立即安装
      </button>
      <button
        onClick={dismiss}
        className="text-[11px] text-white/30 hover:text-white/60 tracking-[2px] font-sans"
      >
        暂不
      </button>
    </div>
  );
}
