import type { AttrSnapshot, AttributeKey, ChoiceRecord } from '../types/index.ts';
import { EVENTS } from './events.ts';
import { ATTR_META } from './state.ts';

/** 童年定格：一条关键选择回顾（大事记） */
export interface IntroMilestone {
  age: number;
  /** 事件标题（反查事件表；缺失时回退事件 id） */
  title: string;
  /** 玩家当时的选项文本 */
  choiceText: string;
  /** 效果摘要（如「智力 +8 · 道德 -5」，取绝对值前 2 键） */
  change: string;
}

/** 童年定格：属性成长摘要（开局 → 童年末） */
export interface IntroAttrGrowth {
  key: AttributeKey;
  from: number;
  to: number;
}

/** 童年定格面板数据：0-12 岁大事记 + 属性成长（13 岁交还控制时弹出） */
export interface IntroSummary {
  milestones: IntroMilestone[];
  attrGrowth: IntroAttrGrowth[];
}

/** 童年定格展示的最大里程碑条数 */
const INTRO_MILESTONE_MAX = 4;

/** 属性成长展示的最大项数 */
const INTRO_ATTR_MAX = 3;

/** 计入属性成长的最小变化幅度（低于此值不展示，避免噪声） */
const INTRO_ATTR_MIN_DELTA = 5;

/** 终局因果链展示的最大节点数 */
const CAUSAL_CHAIN_MAX = 6;

/**
 * 从选择记录取「效果显著的关键选择」：反查事件表取标题与选项效果，
 * 按影响绝对值降序截断、再按年龄升序展示。
 */
function keyChoices(records: ChoiceRecord[], max: number): IntroMilestone[] {
  return records
    .map(h => {
      const ev = EVENTS.find(e => e.id === h.eventId);
      const choice = ev?.choices[h.choiceIndex];
      const attr = choice?.outcomes.attr ?? {};
      const total = Object.values(attr).reduce((s, v) => s + Math.abs(v), 0);
      const change = (Object.entries(attr) as [AttributeKey, number][])
        .filter(([, v]) => v !== 0)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .slice(0, 2)
        .map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${ATTR_META[k].name}`)
        .join(' · ');
      return { age: h.age, title: ev?.title ?? h.eventId, choiceText: h.text, change, total };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, max)
    .sort((a, b) => a.age - b.age)
    .map(({ total: _total, ...rest }) => rest);
}

/**
 * 童年定格面板数据：从 history/snapshots 推导 0-12 岁的关键选择与属性成长。
 *
 * 快进时事件照常执行，选择记录与属性快照完整保留，本函数纯推导、无新增存档字段，
 * 旧存档与回看自动兼容。
 *
 * @param history 选择记录（取 age < 13 的童年段）
 * @param snapshots 每岁属性快照（缺失时仅返回大事记）
 */
export function buildIntroSummary(history: ChoiceRecord[], snapshots: AttrSnapshot[] | undefined): IntroSummary {
  // 关键选择：童年段内效果最显著的几件大事
  const milestones = keyChoices(history.filter(h => h.age < 13), INTRO_MILESTONE_MAX);

  // 属性成长：开局快照（第一条）→ 童年末快照（≤12 岁最后一条），取变化最大几项
  const attrGrowth: IntroAttrGrowth[] = [];
  const first = snapshots?.[0];
  const lastChild = snapshots ? [...snapshots].reverse().find(s => s.age <= 12) : undefined;
  if (first && lastChild) {
    for (const key of Object.keys(first.attrs) as AttributeKey[]) {
      if (Math.abs(lastChild.attrs[key] - first.attrs[key]) >= INTRO_ATTR_MIN_DELTA) {
        attrGrowth.push({ key, from: first.attrs[key], to: lastChild.attrs[key] });
      }
    }
    attrGrowth.sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from));
  }

  return { milestones, attrGrowth: attrGrowth.slice(0, INTRO_ATTR_MAX) };
}

/**
 * 终局因果链：从 13 岁起的关键选择（效果显著者）按时间串起一生的走向。
 *
 * 与童年定格（buildIntroSummary）同源：影响越大的选择越值得回看——结算页「选择塑造人生」收束。
 *
 * @param history 选择记录（取 age ≥ 13 的成年段）
 */
export function buildCausalChain(history: ChoiceRecord[]): IntroMilestone[] {
  return keyChoices(history.filter(h => h.age >= 13), CAUSAL_CHAIN_MAX);
}
