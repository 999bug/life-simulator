/** 八大属性 */
export type AttributeKey =
  | 'health'
  | 'intelligence'
  | 'wealth'
  | 'happiness'
  | 'social'
  | 'appearance'
  | 'luck'
  | 'morality';

/** 人生阶段 */
export type LifeStage =
  | 'infant'
  | 'childhood'
  | 'teen'
  | 'young_adult'
  | 'adult'
  | 'middle_age'
  | 'elder';

/** 游戏阶段 */
export type GamePhase = 'title' | 'playing' | 'summary';

/** 属性表 */
export type Attributes = Record<AttributeKey, number>;

/** 选择记录 */
export interface ChoiceRecord {
  age: number;
  stage: LifeStage;
  eventId: string;
  choiceIndex: number;
  text: string;
}

/** 选项定义 */
export interface Choice {
  text: string;
  effects: string;
  outcomes: ChoiceOutcome;
}

/** 选择结果 */
export interface ChoiceOutcome {
  attr: Partial<Attributes>;
  nextAge?: number;
  flags?: string[];
  final?: boolean;
  /** 指定下一个事件 ID（分支） */
  nextEvent?: string;
}

/** 事件触发条件 */
export interface EventCondition {
  /** 必须拥有的标记 */
  hasFlags?: string[];
  /** 必须没有的标记 */
  notFlags?: string[];
  /** 属性最低要求 */
  minAttrs?: Partial<Attributes>;
  /** 属性最高限制 */
  maxAttrs?: Partial<Attributes>;
}

/** 事件定义 */
export interface LifeEvent {
  id: string;
  stage: LifeStage;
  age: number;
  text: string;
  choices: Choice[];
  /** 触发条件（不满足则跳过） */
  conditions?: EventCondition;
}

/** 游戏状态 */
export interface GameState {
  gender: 'male' | 'female';
  name: string;
  age: number;
  stage: LifeStage;
  stageIdx: number;
  attributes: Attributes;
  flags: string[];
  history: ChoiceRecord[];
  phase: GamePhase;
}

/** 属性元数据 */
export interface AttributeMeta {
  name: string;
  icon: string;
  color: string;
}

/** 阶段元数据 */
export interface StageMeta {
  label: string;
  range: [number, number];
}
