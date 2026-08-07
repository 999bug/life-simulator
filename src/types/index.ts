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

/** 每岁属性快照（成长曲线用；旧存档无此字段） */
export interface AttrSnapshot {
  age: number;
  attrs: Attributes;
}

/** 选择记录 */
export interface ChoiceRecord {
  age: number;
  stage: LifeStage;
  eventId: string;
  choiceIndex: number;
  text: string;
  /** 该选择产出的 flag（生涯年表里程碑标记用；旧存档无此字段） */
  flags?: string[];
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
  flags?: string[];
  /** 手工性格标注（内容层文案重写时标注；traitForOutcome 优先采用，值须在 PERSONA_META 白名单内） */
  personality?: string[];
}

/** 性格端（personality.ts 重新导出；6 端 = 3 维对立） */
export type PersonaTrait = 'rational' | 'emotional' | 'adventurous' | 'cautious' | 'selfish' | 'altruistic';

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
  /** 性格最低要求（键为性格端，值为累计次数；从 history 纯推导，旧存档自动兼容） */
  minPersonality?: Partial<Record<PersonaTrait, number>>;
}

/** 事件分类（数据层 category，驱动分类场景背景） */
export type EventCategory = 'family' | 'career' | 'health' | 'friend' | 'education' | 'personality' | 'technology' | 'love' | 'finance' | 'hobby' | 'sports';

/** 事件定义 */
export interface LifeEvent {
  id: string;
  stage: LifeStage;
  age: number;
  /** 事件标题（如「第一次养宠物」） */
  title?: string;
  text: string;
  /** 事件分类（驱动分类场景背景） */
  category: EventCategory;
  choices: Choice[];
  /** 触发条件（不满足则跳过） */
  conditions?: EventCondition;
}

/**
 * 死因。
 * health 与 lifespan 为旧版两档（旧存档兼容），
 * accident / illness / overwork 为细分死因（意外死亡事件产出致命 flag 后由引擎判定）。
 */
export type DeathCause = 'health' | 'lifespan' | 'accident' | 'illness' | 'overwork';

/** 人生目标 */
export type GoalKey = 'wealth' | 'travel' | 'academic' | 'doctor' | 'family' | 'stable';

/** 自定义目标：指定若干属性目标值，逐项达成即达成（空 attrs 视为达成） */
export interface CustomGoal {
  attrs: Partial<Attributes>;
}

/** 成就 id */
export type AchievementId =
  | 'first_life' | 'longevity' | 'early_death' | 'rich' | 'scholar'
  | 'career' | 'traveler' | 'doctor' | 'balanced' | 'lite_clear' | 'auto_clear' | 'three_lives'
  | 'top_score' | 'genius' | 'iron_body' | 'rich_king' | 'big_family' | 'ultra_life' | 'five_endings' | 'ten_lives'
  | 'challenger'
  | 'age_80' | 'wealthy_60' | 'bright_70' | 'score_60' | 'score_92' | 'three_endings' | 'ten_endings'
  | 'daily_streak_3' | 'daily_streak_7'
  | 'gaokao_top' | 'family_harmony' | 'job_elite' | 'asset_owner'
  | 'vivid_persona' | 'hexagon_persona' | 'adventurous_persona' | 'altruistic_persona'
  | 'redeemed_life' | 'fugitive' | 'gang_lord'
  | 'varied_deaths';

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
  /** 死因：健康归零 / 寿终正寝（存活时为空） */
  deathCause: DeathCause | null;
  /** 人生目标（开局选定：预设 key 或自定义属性目标；无目标为 null） */
  goal: GoalKey | CustomGoal | null;
  /** 每岁属性快照（结算页成长曲线用；旧存档无此字段，从读档岁起重建） */
  snapshots?: AttrSnapshot[];
  /** 挑战开局（第 2 周目解锁：开局属性整体下调 10 点；旧存档无此字段） */
  challenge?: boolean;
  /** 真实模式（第 2 周目解锁：选项只显示属性倾向箭头，隐藏精确数值；旧存档无此字段） */
  realMode?: boolean;
  /** 属性传承（第 5 周目起：上一世最高 2 项属性各 +8；旧存档无此字段） */
  inherited?: boolean;
  /** 人生重开（第 6 周目起：结算页可携半身属性重新投胎；旧存档无此字段） */
  reincarnated?: boolean;
  /** 本局天赋（开局构筑抽取，结算页可设为传承；旧存档无此字段 = 无天赋） */
  talents?: string[];
  /** 开局属性点分配（开局构筑 12 点 + 天赋点数；局中重开保留出生配置；旧存档无此字段） */
  allocated?: Partial<Attributes>;
  /** 成就加成（每解锁 10 成就开局全属性 +2；旧存档无此字段） */
  allocBonus?: boolean;
  /** 本岁已做过的主动活动 id 列表（每岁每个活动限 1 次；行动不推年龄，随岁刷新；旧存档无此字段 = 未做过） */
  actionsDone?: string[];
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

/** 节奏档位：事件密度（沉浸全量 / 精简抽样） */
export type PaceMode = 'full' | 'lite';

/** 家族成员：一局正常人生（非快速模拟/每日挑战）结算后写入族谱 */
export interface FamilyMember {
  name: string;
  gender: 'male' | 'female';
  /** 世代（1 起，线性追加：每一局正常人生是上一代的子女） */
  generation: number;
  /** 享年 */
  age: number;
  /** 综合评分 */
  score: number;
  /** 结局路线 key（verdictKey，展示时查 VERDICT_META） */
  verdict: string;
  /** 终局属性（家族传承叙事展示用） */
  attrs: Attributes;
  /** 完成日期 YYYYMMDD */
  date: string;
  /** 快速模拟局（随机选择的人生：入谱留痕但不参与传承，旧记录无此字段视为手玩局） */
  auto?: boolean;
  /** 每日挑战局（手玩但固定种子，仅展示标记用） */
  daily?: boolean;
  /** 完整回顾数据（结算页回看用；仅最近若干代保留，老代裁剪以控 localStorage 体积） */
  detail?: LifeDetail;
}

/** 一生的完整回顾数据：重建只读结算页所需的全部字段 */
export interface LifeDetail {
  /** 人生大事记（每次选择的记录） */
  history: ChoiceRecord[];
  /** 每岁属性快照（成长曲线；旧存档局可能缺失） */
  snapshots?: AttrSnapshot[];
  /** 终局 flag 集合（结局判定重放） */
  flags: string[];
  /** 人生目标（达成度展示） */
  goal: GoalKey | CustomGoal | null;
  /** 死因（临终叙事） */
  deathCause: DeathCause | null;
  /** 挑战开局标记 */
  challenge?: boolean;
  /** 传承加成标记 */
  inherited?: boolean;
  /** 本可发生而未触发的事件标题（去重后截断存储） */
  skippedTitles: string[];
}

/** 打字机速度档 */
export type TypeSpeed = 'slow' | 'normal' | 'fast';

/** 后悔栈条目：一次选择前的完整状态快照（GameState 不可变，引用直接复用） */
export interface UndoEntry {
  game: GameState;
  /** 选择前的事件位置（恢复后 currentEvent = shuffledEvents[eventIndex]） */
  eventIndex: number;
  /** 选择前的反馈文本（事件页选择前恒为 null） */
  feedback: string | null;
  /** 选择前已跳过事件数（恢复时截断 skippedEvents） */
  skippedCount: number;
  /** 选择前的伴侣互动进度（回退后互动可重新触发） */
  companionNextAge: number;
  /** 选择前的事件 id（伴侣互动不在事件数组中，需按 id 重建） */
  currentEventId: string | null;
}
