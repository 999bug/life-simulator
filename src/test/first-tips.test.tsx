import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import FirstTips, { readTipSeen, markTipSeen, requestTip } from '../components/FirstTips';

const TIPS_KEY = 'life-sim-tips-seen';

describe('FirstTips localStorage 标记', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('markTipSeen 写入标记，readTipSeen 读回', () => {
    expect(readTipSeen().size).toBe(0);
    markTipSeen('persona_badge');
    expect(readTipSeen().has('persona_badge')).toBe(true);
    expect(JSON.parse(localStorage.getItem(TIPS_KEY)!)).toEqual(['persona_badge']);
  });

  it('requestTip 首次返回 true 并落标记，重复返回 false', () => {
    expect(requestTip('actions')).toBe(true);
    expect(requestTip('actions')).toBe(false);
    expect(readTipSeen().has('actions')).toBe(true);
    // 多个提示位互不影响
    expect(requestTip('undo')).toBe(true);
    expect(requestTip('undo')).toBe(false);
  });

  it('localStorage 数据损坏时视为未看过（不抛错）', () => {
    localStorage.setItem(TIPS_KEY, '{{{');
    expect(requestTip('undo')).toBe(true);
  });

  it('存储不可用（setItem 抛错）时静默降级', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage denied');
    });
    try {
      // 写失败但读为空 → 仍返回首次，且不抛错
      expect(requestTip('undo')).toBe(true);
      // 标记未落：下次请求仍视为首次
      expect(requestTip('undo')).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('FirstTips 显示逻辑', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('首次触发显示提示，已看过不再触发', () => {
    const onClose = vi.fn();
    // 首次请求 → 激活提示位 → 文案可见
    expect(requestTip('persona_badge')).toBe(true);
    const { rerender } = render(<FirstTips tip="persona_badge" onClose={onClose} />);
    expect(screen.getByText(/性格徽章/)).toBeTruthy();
    // 已看过：重复请求返回 false，GameScreen 不会再激活该提示位
    expect(requestTip('persona_badge')).toBe(false);
    rerender(<FirstTips tip={null} onClose={onClose} />);
    expect(screen.queryByText(/性格徽章/)).toBeNull();
  });

  it('三个提示位文案完整渲染', () => {
    const { rerender } = render(<FirstTips tip="actions" onClose={vi.fn()} />);
    expect(screen.getByText(/主动行为/)).toBeTruthy();
    rerender(<FirstTips tip="undo" onClose={vi.fn()} />);
    expect(screen.getByText(/后悔/)).toBeTruthy();
  });

  it('tip 为 null 或未知 id 时不渲染', () => {
    render(<FirstTips tip={null} onClose={vi.fn()} />);
    expect(screen.queryByText(/性格徽章/)).toBeNull();
    render(<FirstTips tip="unknown_tip" onClose={vi.fn()} />);
    expect(screen.queryByText(/unknown_tip/)).toBeNull();
  });

  it('已标记过时组件不自行隐藏（显示与否由 GameScreen 的 requestTip 判定）', () => {
    markTipSeen('actions');
    render(<FirstTips tip="actions" onClose={vi.fn()} />);
    expect(screen.getByText(/主动行为/)).toBeTruthy();
  });
});

describe('FirstTips 自动消失', () => {
  it('3 秒后自动调用 onClose', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<FirstTips tip="undo" onClose={onClose} />);
    expect(screen.getByText(/后悔/)).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('3 秒内点击提示条立即关闭', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const { rerender } = render(<FirstTips tip="undo" onClose={onClose} />);
    fireEvent.click(screen.getByText(/后悔/));
    expect(onClose).toHaveBeenCalledTimes(1);
    // GameScreen 关闭流程：tip 置 null → 组件不再渲染，定时器随 effect 清理
    rerender(<FirstTips tip={null} onClose={onClose} />);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('tip 切换重置计时', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const { rerender } = render(<FirstTips tip="undo" onClose={onClose} />);
    // 1.5 秒后切到另一个提示位：旧计时作废
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    rerender(<FirstTips tip="actions" onClose={onClose} />);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    // 切换重置后累计未满 3 秒 → 不关闭
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
