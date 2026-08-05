import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import DialogBox from '../components/DialogBox';
import { sfx } from '../utils/sound';

/** 长文本：确保在断言时长内打字机不会播完（约 150 字符） */
const LONG_TEXT = '你站在人生的十字路口，面前是三条通往不同未来的路。'.repeat(5);
/** 单行短文本（点击跳过断言用） */
const SHORT_TEXT = '第一天上幼儿园，你兴奋地冲进教室。';

describe('DialogBox', () => {
  it('渲染事件标题、名字、年龄与阶段', () => {
    render(
      <DialogBox text={SHORT_TEXT} name="小明" age={3} stage="childhood" title="第一天上幼儿园" />
    );
    expect(screen.getByText('小明')).toBeTruthy();
    expect(screen.getByText('3岁')).toBeTruthy();
    expect(screen.getByText('childhood')).toBeTruthy();
    expect(screen.getByText('「第一天上幼儿园」')).toBeTruthy();
  });

  it('点击可跳过打字机并立即显示全文', () => {
    const onComplete = vi.fn();
    const { container } = render(
      <DialogBox text={SHORT_TEXT} name="小明" age={3} stage="childhood" onComplete={onComplete} />
    );
    // 初始尚未开始打字，正文为空
    expect(screen.queryByText(SHORT_TEXT)).toBeNull();
    fireEvent.click(container.firstElementChild as Element);
    expect(screen.getByText(SHORT_TEXT)).toBeTruthy();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('instant 模式立即渲染全文并触发完成回调', () => {
    const onComplete = vi.fn();
    render(
      <DialogBox text={SHORT_TEXT} name="小明" age={3} stage="childhood" instant onComplete={onComplete} />
    );
    expect(screen.getByText(SHORT_TEXT)).toBeTruthy();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('速度档切换实时生效：fast 档单位时间打字次数多于 slow 档', () => {
    vi.useFakeTimers();
    // 屏蔽真实音效，用调用次数统计打字 tick
    const typeSpy = vi.spyOn(sfx, 'type').mockImplementation(() => {});
    const { rerender } = render(
      <DialogBox text={LONG_TEXT} name="小明" age={18} stage="young_adult" typeSpeed="fast" />
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const fastCalls = typeSpy.mock.calls.length;
    typeSpy.mockClear();

    // 切到 slow 档（text 不变，打字机不重启，仅读档速度变化）
    rerender(
      <DialogBox text={LONG_TEXT} name="小明" age={18} stage="young_adult" typeSpeed="slow" />
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const slowCalls = typeSpy.mock.calls.length;

    expect(fastCalls).toBeGreaterThan(slowCalls);
    typeSpy.mockRestore();
  });

  it('autoAdvance 完成后点击触发自动推进回调', () => {
    vi.useFakeTimers();
    const onAutoContinue = vi.fn();
    const { container } = render(
      <DialogBox
        text={SHORT_TEXT}
        name="小明"
        age={3}
        stage="childhood"
        autoAdvance
        onComplete={vi.fn()}
        onAutoContinue={onAutoContinue}
      />
    );
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText('▼ 点击继续')).toBeTruthy();
    fireEvent.click(container.firstElementChild as Element);
    expect(onAutoContinue).toHaveBeenCalledTimes(1);
  });
});
