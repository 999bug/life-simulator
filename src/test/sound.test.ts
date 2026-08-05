import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** 全部音效调用（用于遍历断言静默降级） */
const ALL_SFX = ['click', 'select', 'achievement', 'stage', 'type', 'advance', 'death'] as const;

/** 假 AudioContext：记录实例创建与关键调用（实例方法均为 spy） */
class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state = 'running';
  currentTime = 0;
  destination = {};
  resume = vi.fn(() => { this.state = 'running'; });
  createOscillator = vi.fn(() => ({
    type: '',
    frequency: { value: 0 },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }));
  createGain = vi.fn(() => ({
    gain: {
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  }));

  constructor() {
    FakeAudioContext.instances.push(this);
  }
}

/**
 * 重新加载 sound 模块（每次清空模块级 AudioContext 缓存，保证用例间隔离）。
 *
 * @returns 重新加载后的模块
 */
async function loadSound() {
  vi.resetModules();
  return await import('../utils/sound');
}

describe('sound 工具', () => {
  beforeEach(() => {
    FakeAudioContext.instances.length = 0;
    vi.stubGlobal('AudioContext', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('无 AudioContext 环境（jsdom 默认）调用全部音效静默降级不抛错', async () => {
    const { sfx } = await loadSound();
    for (const name of ALL_SFX) {
      expect(() => sfx[name]()).not.toThrow();
    }
  });

  it('有 AudioContext 时正常合成：创建振荡器并接线', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const { sfx } = await loadSound();
    sfx.click();
    expect(FakeAudioContext.instances).toHaveLength(1);
    const ctx = FakeAudioContext.instances[0];
    expect(ctx.resume).not.toHaveBeenCalled();
    // click = 1 个振荡器 + 1 个增益节点
    expect(ctx.createOscillator).toHaveBeenCalledTimes(1);
    expect(ctx.createGain).toHaveBeenCalledTimes(1);
  });

  it('AudioContext suspended 时自动 resume', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const { sfx } = await loadSound();
    // 首次调用创建实例
    sfx.click();
    FakeAudioContext.instances[0].state = 'suspended';
    // 再次调用触发 resume
    sfx.click();
    expect(FakeAudioContext.instances[0].resume).toHaveBeenCalledTimes(1);
  });

  it('静音状态下不再创建振荡器', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const { sfx, setMuted } = await loadSound();
    setMuted(true);
    sfx.click();
    expect(FakeAudioContext.instances).toHaveLength(0);
    setMuted(false);
  });
});
