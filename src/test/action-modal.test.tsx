import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import ActionModal from '../components/ActionModal';

/** 27 个活动名（与引擎活动表 src/engine/activities.ts 一致：原 16 个 + 加班/请假/申请升职/就医检查/塑形/美容/找老朋友/拜访贵人/联系初恋/发动态/送礼物） */
const ACTIVITY_NAMES = [
  '健身', '学习', '打工', '社交', '体检', '休闲', '遛宠物', '犯罪',
  '投资理财', '相亲', '约会夜', '育儿陪伴', '问候家人', '投简历', '练手艺', '冥想静心',
  '加班', '请假', '申请升职', '就医检查', '塑形', '美容', '找老朋友', '拜访贵人', '联系初恋', '发动态', '送礼物',
];

describe('ActionModal', () => {
  it('活动列表渲染：27 个活动名称全部出现', () => {
    render(<ActionModal open onClose={vi.fn()} onAction={vi.fn()} age={30} flags={[]} actionsDone={[]} knownPersonas={[]} />);
    ACTIVITY_NAMES.forEach(name => {
      expect(screen.getByText(name)).toBeTruthy();
    });
  });

  it('年龄不足置灰：未达 minAge 的活动显示解锁岁数且不可点', () => {
    render(<ActionModal open onClose={vi.fn()} onAction={vi.fn()} age={10} flags={[]} actionsDone={[]} knownPersonas={[]} />);
    // 打工 16+：显示「16 岁解锁」且置灰（投简历同为 16 岁起，限定打工按钮内断言）
    expect(within(screen.getByRole('button', { name: /打工/ })).getByText('16 岁解锁')).toBeTruthy();
    expect((screen.getByRole('button', { name: /打工/ }) as HTMLButtonElement).disabled).toBe(true);
    // 犯罪 14+ 同样置灰（发动态同为 14 岁起，限定犯罪按钮内断言）
    expect(within(screen.getByRole('button', { name: /犯罪/ })).getByText('14 岁解锁')).toBeTruthy();
    expect((screen.getByRole('button', { name: /犯罪/ }) as HTMLButtonElement).disabled).toBe(true);
    // 健身 6+ 已达龄：可用
    expect((screen.getByRole('button', { name: /健身/ }) as HTMLButtonElement).disabled).toBe(false);
    // 塑形 10+ 已达龄：可用
    expect((screen.getByRole('button', { name: /塑形/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('requires 不满足置灰：无宠物 flag 时遛宠物不可点', () => {
    render(<ActionModal open onClose={vi.fn()} onAction={vi.fn()} age={30} flags={[]} actionsDone={[]} knownPersonas={[]} />);
    // 约会夜（需已婚）/育儿陪伴（需有娃）/练手艺（需兴趣 flag）/加班（需职业 flag）同样显示该文案，限定遛宠物按钮内断言
    expect(within(screen.getByRole('button', { name: /遛宠物/ })).getByText('条件不满足')).toBeTruthy();
    expect((screen.getByRole('button', { name: /遛宠物/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('requires 任一满足即可用：有猫也能遛宠物', () => {
    render(<ActionModal open onClose={vi.fn()} onAction={vi.fn()} age={30} flags={['has_cat']} actionsDone={[]} knownPersonas={[]} />);
    expect(within(screen.getByRole('button', { name: /遛宠物/ })).queryByText('条件不满足')).toBeNull();
    expect((screen.getByRole('button', { name: /遛宠物/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('requiresNot 命中置灰：已婚时相亲不可点，显示「当前状态不可做」', () => {
    render(<ActionModal open onClose={vi.fn()} onAction={vi.fn()} age={30} flags={['married']} actionsDone={[]} knownPersonas={[]} />);
    expect(screen.getByText('当前状态不可做')).toBeTruthy();
    expect((screen.getByRole('button', { name: /相亲/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('requiresNot 未命中可用：无 married flag 时相亲可点', () => {
    render(<ActionModal open onClose={vi.fn()} onAction={vi.fn()} age={30} flags={[]} actionsDone={[]} knownPersonas={[]} />);
    expect(screen.queryByText('当前状态不可做')).toBeNull();
    expect((screen.getByRole('button', { name: /相亲/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('requiresPersona 未认识置灰：knownPersonas 为空时找老朋友显示「还没认识TA」', () => {
    render(<ActionModal open onClose={vi.fn()} onAction={vi.fn()} age={30} flags={[]} actionsDone={[]} knownPersonas={[]} />);
    // 拜访贵人/联系初恋/送礼物同样显示该文案，限定找老朋友按钮内断言
    expect(within(screen.getByRole('button', { name: /找老朋友/ })).getByText('还没认识TA')).toBeTruthy();
    expect((screen.getByRole('button', { name: /找老朋友/ }) as HTMLButtonElement).disabled).toBe(true);
    // 送礼物需任一人物出场，同样置灰
    expect(within(screen.getByRole('button', { name: /送礼物/ })).getByText('还没认识TA')).toBeTruthy();
    expect((screen.getByRole('button', { name: /送礼物/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('requiresPersona 任一人物出场即可用：认识挚友后可找老朋友', () => {
    render(<ActionModal open onClose={vi.fn()} onAction={vi.fn()} age={30} flags={[]} actionsDone={[]} knownPersonas={['p_best']} />);
    expect(within(screen.getByRole('button', { name: /找老朋友/ })).queryByText('还没认识TA')).toBeNull();
    expect((screen.getByRole('button', { name: /找老朋友/ }) as HTMLButtonElement).disabled).toBe(false);
    // 拜访贵人需要另一位人物（p_mentor），仍未认识置灰
    expect(within(screen.getByRole('button', { name: /拜访贵人/ })).getByText('还没认识TA')).toBeTruthy();
    expect((screen.getByRole('button', { name: /拜访贵人/ }) as HTMLButtonElement).disabled).toBe(true);
    // 送礼物任意人物出场即可：认识挚友后可用
    expect(within(screen.getByRole('button', { name: /送礼物/ })).queryByText('还没认识TA')).toBeNull();
    expect((screen.getByRole('button', { name: /送礼物/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('已做过的活动置灰「已做过」，未做过的仍可用', () => {
    render(<ActionModal open onClose={vi.fn()} onAction={vi.fn()} age={30} flags={[]} actionsDone={['fitness']} knownPersonas={[]} />);
    // 已做过健身：置灰 + 「已做过」标注
    expect((screen.getByRole('button', { name: /健身/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('已做过')).toBeTruthy();
    // 未做过的打工仍可用
    expect((screen.getByRole('button', { name: /打工/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('点击可用活动：触发 onAction（携带活动 id）并关闭', () => {
    const onAction = vi.fn();
    const onClose = vi.fn();
    render(<ActionModal open onClose={onClose} onAction={onAction} age={30} flags={[]} actionsDone={[]} knownPersonas={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /健身/ }));
    expect(onAction).toHaveBeenCalledWith('fitness');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('犯罪活动带「高风险」角标', () => {
    render(<ActionModal open onClose={vi.fn()} onAction={vi.fn()} age={30} flags={[]} actionsDone={[]} knownPersonas={[]} />);
    expect(screen.getByText('高风险')).toBeTruthy();
  });
});

describe('ActionModal BitLife 面板', () => {
  it('分组标题渲染：身体/成长/财务/情感/家庭/内心/网络/灰色地带', () => {
    render(<ActionModal open onClose={vi.fn()} onAction={vi.fn()} age={30} flags={[]} actionsDone={[]} knownPersonas={[]} />);
    for (const g of ['身体', '成长', '财务', '情感', '家庭', '内心', '网络', '灰色地带']) {
      expect(screen.getByText(g)).toBeTruthy();
    }
  });

  it('效果标签渲染：健身带健康标签、学习带智力标签、加班带财富标签', () => {
    render(<ActionModal open onClose={vi.fn()} onAction={vi.fn()} age={30} flags={[]} actionsDone={[]} knownPersonas={[]} />);
    // 多个活动共用标签（健身/体检都标健康），限定健身按钮内断言
    expect(within(screen.getByRole('button', { name: /健身/ })).getByText('💪 健康')).toBeTruthy();
    expect(within(screen.getByRole('button', { name: /学习/ })).getByText('🧠 智力')).toBeTruthy();
    expect(within(screen.getByRole('button', { name: /加班/ })).getByText('💰 财富')).toBeTruthy();
  });
});
