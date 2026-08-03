/**
 * Web Audio 合成音效：无外部音频资源，纯振荡器合成轻量 UI 音效。
 * 浏览器首次交互前 AudioContext 处于 suspended，ensureCtx 里自动 resume。
 */

let ctx: AudioContext | null = null;

/** 全局静音（快速模拟模式屏蔽高频交互音） */
let muted = false;

/** 设置静音状态 */
export function setMuted(value: boolean): void {
  muted = value;
}

/** 获取（或惰性创建）AudioContext；不可用时返回 null（静默降级） */
function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  return ctx;
}

/**
 * 播放一个短音。
 *
 * @param freq 频率（Hz）
 * @param duration 时长（秒）
 * @param type 波形
 * @param volume 音量（0-1）
 * @param delay 延迟（秒）
 */
function tone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.04, delay = 0): void {
  if (muted) {
    return;
  }
  const c = ensureCtx();
  if (!c) {
    return;
  }
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = c.currentTime + delay;
  // 快速起音 + 指数衰减，避免爆音
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

/** 音效集合 */
export const sfx = {
  /** 点击 / 翻页 */
  click: (): void => tone(880, 0.08, 'triangle', 0.05),
  /** 确认选择（双音上行） */
  select: (): void => {
    tone(660, 0.1, 'triangle', 0.06);
    tone(990, 0.12, 'triangle', 0.05, 0.05);
  },
  /** 打字机字符（极轻，避免烦躁） */
  type: (): void => tone(2400, 0.015, 'sine', 0.008),
  /** 事件推进（下行两音） */
  advance: (): void => {
    tone(520, 0.12, 'sine', 0.05);
    tone(392, 0.18, 'sine', 0.04, 0.1);
  },
  /** 结算（低沉下行） */
  death: (): void => {
    tone(392, 0.5, 'sine', 0.06);
    tone(294, 0.7, 'sine', 0.05, 0.3);
    tone(196, 1.0, 'sine', 0.05, 0.7);
  },
};
