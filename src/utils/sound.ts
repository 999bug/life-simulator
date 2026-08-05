/**
 * Web Audio 合成音效：无外部音频资源，纯振荡器合成轻量 UI 音效。
 * 浏览器首次交互前 AudioContext 处于 suspended，ensureCtx 里自动 resume。
 */
import type { LifeStage } from '../types';

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
  /** 成就解锁（三音上行琶音） */
  achievement: (): void => {
    tone(523, 0.12, 'triangle', 0.05);
    tone(659, 0.12, 'triangle', 0.05, 0.08);
    tone(784, 0.2, 'triangle', 0.05, 0.16);
  },
  /** 阶段切换（低音下滑过渡） */
  stage: (): void => {
    tone(220, 0.35, 'sine', 0.05);
    tone(165, 0.4, 'sine', 0.04, 0.12);
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

// ============ 阶段 BGM ============

/** 阶段 BGM 模式：五声音阶慢速琶音循环，情绪随人生阶段沉淀 */
interface BgmPattern {
  /** 音阶（Hz，顺序循环） */
  notes: number[];
  /** 音符间隔（秒） */
  interval: number;
  /** 单音时长（秒） */
  duration: number;
  /** 波形 */
  type: OscillatorType;
  /** 音量（轻，明显低于交互音效） */
  volume: number;
}

/** 各阶段 BGM：婴儿八音盒 → 童年明亮 → 少年流动 → 青年上行 → 壮年稳重 → 中老年缓 → 晚年宁静 */
const BGM_PATTERNS: Record<LifeStage, BgmPattern> = {
  infant: { notes: [523, 659, 784, 1047], interval: 2.4, duration: 1.8, type: 'sine', volume: 0.018 },
  childhood: { notes: [392, 440, 523, 587, 659], interval: 1.8, duration: 1.5, type: 'triangle', volume: 0.016 },
  teen: { notes: [330, 392, 440, 523, 587], interval: 1.5, duration: 1.3, type: 'triangle', volume: 0.016 },
  young_adult: { notes: [294, 349, 392, 440, 523], interval: 1.4, duration: 1.4, type: 'triangle', volume: 0.016 },
  adult: { notes: [262, 330, 392, 440], interval: 2.0, duration: 1.8, type: 'sine', volume: 0.016 },
  middle_age: { notes: [220, 262, 330, 392], interval: 2.4, duration: 2.0, type: 'sine', volume: 0.015 },
  elder: { notes: [196, 247, 294, 330], interval: 3.0, duration: 2.4, type: 'sine', volume: 0.014 },
};

let bgmTimer: ReturnType<typeof setTimeout> | null = null;
let bgmStage: LifeStage | null = null;
let bgmNoteIdx = 0;

/** 慢起音长音（BGM 专用包络，与短音效的快起音区分，听感柔和） */
function pad(freq: number, duration: number, type: OscillatorType, volume: number): void {
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
  const t = c.currentTime;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.25);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t);
  osc.stop(t + duration + 0.1);
}

/** 启动指定阶段的 BGM 循环；同阶段重复调用为空操作，切换阶段先停旧循环 */
export function startBgm(stage: LifeStage): void {
  if (bgmStage === stage && bgmTimer !== null) {
    return;
  }
  stopBgm();
  bgmStage = stage;
  bgmNoteIdx = 0;
  const pattern = BGM_PATTERNS[stage];
  const tick = () => {
    pad(pattern.notes[bgmNoteIdx % pattern.notes.length], pattern.duration, pattern.type, pattern.volume);
    bgmNoteIdx++;
    bgmTimer = setTimeout(tick, pattern.interval * 1000);
  };
  tick();
}

/** 停止 BGM（离开游戏/结算/回标题时调用） */
export function stopBgm(): void {
  if (bgmTimer !== null) {
    clearTimeout(bgmTimer);
    bgmTimer = null;
  }
  bgmStage = null;
}
