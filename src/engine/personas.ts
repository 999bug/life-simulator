/**
 * 具体人物系统：6 位有名字的人生关键人物，好感度从相关事件的互动推导。
 *
 * 数据来源：chiled.json 中事件级 persona 标注（convert-events.mjs 透传进 events.json），
 * 人物出场不占事件密度。全部为纯函数、零存档字段——旧存档/undo/回看自动兼容。
 */
import type { ChoiceRecord, LifeEvent } from '../types';
import { EVENTS } from './events.ts';

/** 人物 id（6 位人生关键人物） */
export type PersonaId =
  | 'p_buddy'
  | 'p_desk'
  | 'p_crush'
  | 'p_best'
  | 'p_mentor'
  | 'p_sidekick';

/** 人物定义 */
export interface PersonaDef {
  id: PersonaId;
  /** 名字 */
  name: string;
  /** 展示图标 */
  icon: string;
  /** 主题色 */
  color: string;
  /** 一句话人设 */
  role: string;
  /** 出场事件 id 列表（这些事件在数据层标注了该人物） */
  events: string[];
}

/** 6 位人生关键人物 */
export const PERSONAS: PersonaDef[] = [
  {
    id: 'p_buddy', name: '阿凯', icon: '🤜', color: '#e8a05d',
    role: '发小，童年沙坑里认识的第一位朋友',
    events: ['child_0103', 'child_08', 'teen_08', 'primary_0186'],
  },
  {
    id: 'p_desk', name: '林晓', icon: '📓', color: '#6db5e8',
    role: '同桌，学生时代分享过最多秘密的人',
    events: ['primary_0003', 'primary_0043', 'primary_0117', 'teen_13'],
  },
  {
    id: 'p_crush', name: '苏晴', icon: '💌', color: '#e86db0',
    role: '初恋，青春里最亮的那道白月光',
    events: ['primary_0146', 'teen_03', 'teen_16', 'teen_04'],
  },
  {
    id: 'p_best', name: '大鹏', icon: '🤝', color: '#5de8d4',
    role: '挚友，一起扛过考场和人生的兄弟',
    events: ['teen_12', 'teen_17', 'teen_23', 'young_19'],
  },
  {
    id: 'p_mentor', name: '周老师', icon: '🧭', color: '#e8c95d',
    role: '贵人，职场里为你指过路的人',
    events: ['child_0042', 'teen_07', 'adult_26', 'young_62'],
  },
  {
    id: 'p_sidekick', name: '老马', icon: '🍻', color: '#b07de8',
    role: '损友，酒局饭桌上随叫随到的老伙计',
    events: ['teen_10', 'young_29', 'adult_50', 'young_0036'],
  },
];

/** 好感度表：6 位人物各 0-100（中性 50，未出场人物保持 50） */
export type PersonaBonds = Record<PersonaId, number>;

/** 好感度中性起点（无相关记录 = 不好不坏） */
const BOND_BASE = 50;
/** 单次善待选择对好感度的贡献 */
const BOND_GAIN = 5;
/** 单次冷落选择对好感度的贡献 */
const BOND_LOSS = 5;

/** 好感度钳位区间 */
function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/** 带人物标注的事件（events.json 由转换器透传 persona 字段；LifeEvent 类型未收录，此处扩展） */
interface PersonaEvent extends LifeEvent {
  /** 人物 id（该事件是关于哪位人生关键人物的） */
  persona?: string;
}

/**
 * 从本局历史推导与 6 位具体人物的好感度。
 *
 * 统计口径与 npcBonds 一致：命中某人物出场事件的选择中，「净收益为正」视为善待
 * （+5），「净收益为负」视为冷落（-5），其余不影响；未出场人物保持中性 50。
 *
 * @param history 本局选择记录（旧存档无 flags 字段也能统计）
 * @returns 6 位人物好感度 0-100
 */
export function personaBonds(history: ChoiceRecord[]): PersonaBonds {
  const bonds = Object.fromEntries(PERSONAS.map(p => [p.id, BOND_BASE])) as PersonaBonds;
  for (const h of history) {
    const ev = EVENTS.find(e => e.id === h.eventId) as PersonaEvent | undefined;
    // 非人物事件 / 未知人物 id 跳过（数据层校验已保证 persona 为合法字符串）
    if (!ev || !ev.persona || !(ev.persona in bonds)) {
      continue;
    }
    const choice = ev.choices[h.choiceIndex];
    if (!choice) {
      continue;
    }
    const net = Object.values(choice.outcomes.attr ?? {}).reduce((a, b) => a + b, 0);
    bonds[ev.persona as PersonaId] = clamp(bonds[ev.persona as PersonaId] + (net > 0 ? BOND_GAIN : net < 0 ? -BOND_LOSS : 0));
  }
  return bonds;
}

/**
 * 好感度 → 关系描述文案（通用档位）。
 *
 * @param bond 好感度 0-100
 * @returns 关系描述
 */
export function personaRelationText(bond: number): string {
  if (bond >= 80) {
    return '形影不离';
  }
  if (bond >= 60) {
    return '交心好友';
  }
  if (bond >= 40) {
    return '点头之交';
  }
  if (bond >= 25) {
    return '渐行渐远';
  }
  return '形同陌路';
}
