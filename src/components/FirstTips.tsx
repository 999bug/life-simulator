import { useEffect, useRef } from 'react';

/**
 * 新手渐进提示：玩家首次遇到某系统时给一条一次性小提示（toast 式）。
 * 是否首次由 requestTip 判定并落 localStorage（life-sim-tips-seen），
 * 本组件只负责展示与 3 秒自动消失——激活哪个提示位由 GameScreen 控制。
 */

/** 提示位 → 文案（一条 20-40 字，有引导感但不啰嗦） */
export const TIP_TEXTS: Record<string, string> = {
  persona_badge: '🏷️ 性格徽章：每个选择都在塑造你的性格——一生的选择累积成「你是谁」',
  actions: '⚡ 主动行为：随时可以健身/学习/打工/犯罪……每岁每个活动可做一次',
  undo: '↩️ 后悔：选错了可以回退上一步，或回到某个岁数重新来过',
};

/** localStorage 键：已看过的提示位数组 */
const TIPS_KEY = 'life-sim-tips-seen';

/** 提示展示时长（毫秒） */
const TIP_DURATION_MS = 3000;

/**
 * 读取已看过的提示位集合；数据损坏或存储不可用时视为未看过。
 */
export function readTipSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(TIPS_KEY);
    if (!raw) {
      return new Set();
    }
    const data = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(data) ? data.filter(x => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

/**
 * 标记某提示位已看过；存储不可用时静默降级（提示本局仍显示一次）。
 */
export function markTipSeen(tipId: string): void {
  try {
    const seen = readTipSeen();
    seen.add(tipId);
    localStorage.setItem(TIPS_KEY, JSON.stringify([...seen]));
  } catch {
    // 存储不可用静默降级
  }
}

/**
 * 请求显示某提示位：首次（未看过）返回 true 并落标记，已看过返回 false。
 * 幂等——GameScreen 在条件满足时反复调用，只有第一次返回 true。
 */
export function requestTip(tipId: string): boolean {
  if (readTipSeen().has(tipId)) {
    return false;
  }
  markTipSeen(tipId);
  return true;
}

interface Props {
  /** 当前激活的提示位（null 不显示）；激活与关闭时机由 GameScreen 控制 */
  tip: string | null;
  /** 关闭提示（点击关闭或 3 秒自动到时） */
  onClose: () => void;
}

/**
 * 新手提示条：底部居中金色小胶囊，3 秒自动消失，可点击关闭。
 */
export default function FirstTips({ tip, onClose }: Props) {
  // 关闭回调引用：保持指向最新 onClose，同时不因父组件重渲染重置 3 秒计时
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // 提示激活后 3 秒自动消失；tip 切换时重置计时
  useEffect(() => {
    if (!tip) {
      return;
    }
    const timer = window.setTimeout(() => onCloseRef.current(), TIP_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [tip]);

  if (!tip) {
    return null;
  }
  const text = TIP_TEXTS[tip];
  if (!text) {
    return null;
  }
  return (
    <div
      role="status"
      onClick={onClose}
      className="absolute left-1/2 -translate-x-1/2 bottom-11 z-20 cursor-pointer max-w-[92vw]
        px-4 py-2 rounded-full border border-[#c9a96e]/60 bg-black/80 backdrop-blur-sm
        text-[#c9a96e] text-[12px] leading-snug text-center shadow-lg shadow-black/40"
    >
      {text}
    </div>
  );
}
