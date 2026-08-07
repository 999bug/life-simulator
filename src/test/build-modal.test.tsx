import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// 固定抽卡候选（随机抽卡让测试不确定）：含互斥对（self_made ↔ rich_family）与继承天赋
vi.mock('../engine/talents', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../engine/talents')>();
  return {
    ...mod,
    drawTalents: () => ['robust', 'clever', 'welloff', 'zen', 'self_made', 'rich_family', 'genius', 'iron_body', 'karp', 'heavenly'],
  };
});

import BuildModal from '../components/BuildModal';
import { TALENT_PICK_LIMIT } from '../engine/talents';

describe('BuildModal', () => {
  it('渲染 10 个天赋候选（含继承天赋置顶带 🧬）', () => {
    render(<BuildModal inheritTalent={{ talentId: 'genius', date: '20260806' }} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('天才大脑')).toBeTruthy();
    expect(screen.getAllByText('🧬').length).toBeGreaterThanOrEqual(1);
  });

  it('点选天赋进入已选状态，重复点击取消选择', () => {
    render(<BuildModal inheritTalent={null} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const button = screen.getByText('健壮体魄').closest('button')!;
    fireEvent.click(button);
    expect(screen.getByText(/已选 1\/3/)).toBeTruthy();
    fireEvent.click(button);
    expect(screen.getByText(/已选 0\/3/)).toBeTruthy();
  });

  it('属性点分配：+/- 调整与剩余点显示', () => {
    render(<BuildModal inheritTalent={null} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getAllByText(/剩余 12 点/).length).toBeGreaterThanOrEqual(1);
    const plusButtons = screen.getAllByText('+');
    fireEvent.click(plusButtons[0]);
    fireEvent.click(plusButtons[0]);
    expect(screen.getAllByText(/剩余 10 点/).length).toBeGreaterThanOrEqual(1);
    const minusButtons = screen.getAllByText('−');
    fireEvent.click(minusButtons[0]);
    expect(screen.getAllByText(/剩余 11 点/).length).toBeGreaterThanOrEqual(1);
  });

  it('确认回调携带所选天赋与分配结果', () => {
    const onConfirm = vi.fn();
    render(<BuildModal inheritTalent={null} onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('健壮体魄').closest('button')!);
    fireEvent.click(screen.getAllByText('+')[0]);
    fireEvent.click(screen.getByText(/确定 · 开启人生/));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const [talents, alloc] = onConfirm.mock.calls[0] as [string[], Record<string, number>];
    expect(talents).toContain('robust');
    expect(Object.values(alloc).some(v => v > 0)).toBe(true);
  });

  it('互斥天赋被置灰（选中一方后另一方禁用）', () => {
    render(<BuildModal inheritTalent={null} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const selfMadeBtn = screen.getByText('白手起家').closest('button')!;
    const richBtn = screen.getByText('富豪世家').closest('button')!;
    fireEvent.click(selfMadeBtn);
    expect(richBtn.disabled).toBe(true);
    // 取消选择后恢复可用
    fireEvent.click(selfMadeBtn);
    expect(richBtn.disabled).toBe(false);
  });

  it('跳过构筑触发 onCancel', () => {
    const onCancel = vi.fn();
    render(<BuildModal inheritTalent={null} onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('跳过构筑'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('选择达到上限后其余天赋禁用', () => {
    render(<BuildModal inheritTalent={null} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    ['健壮体魄', '聪慧过人', '家底殷实'].forEach(name => {
      fireEvent.click(screen.getByText(name).closest('button')!);
    });
    expect(screen.getByText(/已选 3\/3/)).toBeTruthy();
    // 未选按钮应禁用（候选里实际存在的天赋）
    const others = ['佛系人生', '钢铁之躯', '锦鲤附体'].map(name => screen.getByText(name).closest('button')!);
    others.forEach(btn => expect(btn.disabled).toBe(true));
    expect(TALENT_PICK_LIMIT).toBe(3);
  });
});
