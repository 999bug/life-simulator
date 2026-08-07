import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ActionModal from '../components/ActionModal';

/** 8 个活动名（与引擎活动表 src/engine/activities.ts 一致） */
const ACTIVITY_NAMES = ['健身', '学习', '打工', '社交', '体检', '休闲', '遛宠物', '犯罪'];

describe('ActionModal', () => {
  it('活动列表渲染：8 个活动名称全部出现', () => {
    render(<ActionModal open onClose={vi.fn()} onAction={vi.fn()} age={30} flags={[]} actionsDone={[]} />);
    ACTIVITY_NAMES.forEach(name => {
      expect(screen.getByText(name)).toBeTruthy();
    });
  });

  it('年龄不足置灰：未达 minAge 的活动显示解锁岁数且不可点', () => {
    render(<ActionModal open onClose={vi.fn()} onAction={vi.fn()} age={10} flags={[]} actionsDone={[]} />);
    // 打工 16+：显示「16 岁解锁」且置灰
    expect(screen.getByText('16 岁解锁')).toBeTruthy();
    expect((screen.getByRole('button', { name: /打工/ }) as HTMLButtonElement).disabled).toBe(true);
    // 犯罪 14+ 同样置灰
    expect(screen.getByText('14 岁解锁')).toBeTruthy();
    expect((screen.getByRole('button', { name: /犯罪/ }) as HTMLButtonElement).disabled).toBe(true);
    // 健身 6+ 已达龄：可用
    expect((screen.getByRole('button', { name: /健身/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('requires 不满足置灰：无宠物 flag 时遛宠物不可点', () => {
    render(<ActionModal open onClose={vi.fn()} onAction={vi.fn()} age={30} flags={[]} actionsDone={[]} />);
    expect(screen.getByText('需要先养一只宠物')).toBeTruthy();
    expect((screen.getByRole('button', { name: /遛宠物/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('requires 任一满足即可用：有猫也能遛宠物', () => {
    render(<ActionModal open onClose={vi.fn()} onAction={vi.fn()} age={30} flags={['has_cat']} actionsDone={[]} />);
    expect(screen.queryByText('需要先养一只宠物')).toBeNull();
    expect((screen.getByRole('button', { name: /遛宠物/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('已做过的活动置灰「已做过」，未做过的仍可用', () => {
    render(<ActionModal open onClose={vi.fn()} onAction={vi.fn()} age={30} flags={[]} actionsDone={['fitness']} />);
    // 已做过健身：置灰 + 「已做过」标注
    expect((screen.getByRole('button', { name: /健身/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('已做过')).toBeTruthy();
    // 未做过的打工仍可用
    expect((screen.getByRole('button', { name: /打工/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('点击可用活动：触发 onAction（携带活动 id）并关闭', () => {
    const onAction = vi.fn();
    const onClose = vi.fn();
    render(<ActionModal open onClose={onClose} onAction={onAction} age={30} flags={[]} actionsDone={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /健身/ }));
    expect(onAction).toHaveBeenCalledWith('fitness');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('犯罪活动带「高风险」角标', () => {
    render(<ActionModal open onClose={vi.fn()} onAction={vi.fn()} age={30} flags={[]} actionsDone={[]} />);
    expect(screen.getByText('高风险')).toBeTruthy();
  });
});
