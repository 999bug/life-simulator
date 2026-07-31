# 357 事件接入游戏引擎 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `script/chiled.json` 的 357 个事件通过构建时转换接入游戏引擎，替换 `src/engine/events.ts` 硬编码数据，并在对话框显示事件标题。

**Architecture:** 新增 `script/convert-events.mjs`（106 键属性映射表 + node:test 单测），把 chiled.json 转换为引擎 LifeEvent 格式的 `src/engine/events.json`；`events.ts` 改为 import JSON；`useGame.ts` 简化为线性播放（年龄由事件驱动）；`DialogBox` 增加标题展示。

**Tech Stack:** React 18 + TypeScript + Vite 5 + Tailwind；转换器为 Node ESM 脚本，测试用 Node 内置 `node:test`（不新增依赖）。

**Spec:** `docs/superpowers/specs/2026-07-31-events-integration-design.md`

## Global Constraints

- 提交信息：中文 subject + 前缀（`[NF]`/`[CU]`/`[IM]`/`[BF]`），body 用 `- ` 列表，**禁止 AI 署名尾注**
- 注释用中文；if/for 必须带大括号；不用行内注释（注释放代码上方）
- 不改动引擎算法公式（`applyElderDecay`/`calcMaxAge`/`checkDeath`/`calcScore` 不变）
- tsconfig 已开 `resolveJsonModule`，无需改配置
- 不新增任何 npm 依赖
- 每个 Task 结束 `npm run build` 必须绿（Task 1 只动 script/，用 `node --test` 验证）

---

### Task 1: 转换器 `script/convert-events.mjs`（TDD）

**Files:**
- Create: `script/convert-events.mjs`
- Test: `script/convert-events.test.mjs`
- Modify: `package.json`（加 `build:events` 脚本）
- Modify: `docs/superpowers/specs/2026-07-31-events-integration-design.md`（取反键 10→9 修正，已改未提交，随本任务提交）

**Interfaces:**
- Produces:
  - `convertEvent(raw): LifeEvent形状对象` — 单事件转换，缺字段/未映射属性/条件含取反键时抛错
  - `convertAll(rawEvents): LifeEvent形状对象[]` — 全量转换，重复 id 抛错
  - 生成物 `src/engine/events.json`（Task 2 消费）
- 引擎形状（与 `src/types/index.ts` 对应）：`{ id, stage, age, title, text, choices: [{ text, effects: string, outcomes: { attr, flags? } }], conditions? }`

- [ ] **Step 1: 写失败的测试** `script/convert-events.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertEvent, convertAll } from './convert-events.mjs';

const base = {
  id: 'test_01',
  age_range: [5, 6],
  category: 'learning',
  title: '测试事件',
  text: '测试文本',
  choices: [{ text: '选项', effects: {}, flags_add: [] }],
};

test('直接映射 + 同属性求和合并', () => {
  const e = convertEvent({ ...base, choices: [{ text: 'A', effects: { learning: 5, knowledge: 3 }, flags_add: [] }] });
  assert.deepEqual(e.choices[0].outcomes.attr, { intelligence: 8 });
  assert.equal(e.choices[0].effects, '🧠+8');
});

test('取反键：pressure+8 与 happiness+3 合并为 happiness-5', () => {
  const e = convertEvent({ ...base, choices: [{ text: 'A', effects: { pressure: 8, happiness: 3 } }] });
  assert.deepEqual(e.choices[0].outcomes.attr, { happiness: -5 });
  assert.equal(e.choices[0].effects, '😊-5');
});

test('正负抵消为 0 的键被删除，展示串为空', () => {
  const e = convertEvent({ ...base, choices: [{ text: 'A', effects: { happiness: 5, pressure: 5 } }] });
  assert.deepEqual(e.choices[0].outcomes.attr, {});
  assert.equal(e.choices[0].effects, '');
});

test('展示串按八大属性固定顺序排列', () => {
  const e = convertEvent({ ...base, choices: [{ text: 'A', effects: { happiness: 5, health: 10 } }] });
  assert.equal(e.choices[0].effects, '💪+10 😊+5');
});

test('conditions：snake_case → camelCase，属性键映射', () => {
  const e = convertEvent({
    ...base,
    conditions: { has_flags: ['married'], not_flags: ['divorced'], min_attrs: { money: 55, empathy: 40 }, max_attrs: { health: 35 } },
  });
  assert.deepEqual(e.conditions, {
    hasFlags: ['married'], notFlags: ['divorced'],
    minAttrs: { wealth: 55, morality: 40 }, maxAttrs: { health: 35 },
  });
});

test('conditions 中出现取反键直接抛错', () => {
  assert.throws(() => convertEvent({ ...base, conditions: { max_attrs: { pressure: 50 } } }), /inverse attr "pressure"/);
});

test('未映射属性键直接抛错', () => {
  assert.throws(() => convertEvent({ ...base, choices: [{ text: 'A', effects: { unknown_attr: 1 } }] }), /unmapped attr "unknown_attr"/);
});

test('stage 按 age_range[0] 推导', () => {
  assert.equal(convertEvent({ ...base, age_range: [0, 1] }).stage, 'infant');
  assert.equal(convertEvent({ ...base, age_range: [7, 7] }).stage, 'childhood');
  assert.equal(convertEvent({ ...base, age_range: [13, 14] }).stage, 'teen');
  assert.equal(convertEvent({ ...base, age_range: [70, 71] }).stage, 'elder');
});

test('flags_add 非空才写入 outcomes.flags', () => {
  const withFlags = convertEvent({ ...base, choices: [{ text: 'A', effects: {}, flags_add: ['book_reader'] }] });
  assert.deepEqual(withFlags.choices[0].outcomes.flags, ['book_reader']);
  const noFlags = convertEvent({ ...base, choices: [{ text: 'A', effects: {}, flags_add: [] }] });
  assert.equal('flags' in noFlags.choices[0].outcomes, false);
});

test('缺字段抛错', () => {
  assert.throws(() => convertEvent({ ...base, title: '' }), /invalid event test_01/);
});

test('convertAll 检测重复 id', () => {
  assert.throws(() => convertAll([base, base]), /duplicate id "test_01"/);
});

test('完整事件形状（无 effects/flags 的叙事选项）', () => {
  const e = convertEvent({ ...base, id: 'birth_01', age_range: [0, 1], choices: [{ text: '……', effects: {}, flags_add: [] }] });
  assert.deepEqual(e, {
    id: 'birth_01', stage: 'infant', age: 0, title: '测试事件', text: '测试文本',
    choices: [{ text: '……', effects: '', outcomes: { attr: {} } }],
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd F:/ai/life-simulator && node --test script/convert-events.test.mjs`
Expected: FAIL，报 `Cannot find module './convert-events.mjs'`

- [ ] **Step 3: 实现转换器** `script/convert-events.mjs`

```js
import { readFileSync, writeFileSync } from 'fs';
import { pathToFileURL } from 'url';

/**
 * 106 个 chiled.json 属性名 → 8 大引擎属性映射。
 * INVERSE 中的键为负向维度，映射后数值取反（pressure: +8 → happiness: -8）。
 */
const ATTR_MAP = {
  // intelligence 智力（37 个）
  learning: 'intelligence', knowledge: 'intelligence', intelligence: 'intelligence',
  curiosity: 'intelligence', thinking: 'intelligence', critical_thinking: 'intelligence',
  logic: 'intelligence', observation: 'intelligence', memory: 'intelligence',
  problem_solving: 'intelligence', research: 'intelligence', science: 'intelligence',
  math: 'intelligence', language: 'intelligence', technology: 'intelligence',
  engineering: 'intelligence', creativity: 'intelligence', imagination: 'intelligence',
  innovation: 'intelligence', independence: 'intelligence', self_reliance: 'intelligence',
  experience: 'intelligence', maturity: 'intelligence', adaptability: 'intelligence',
  skill: 'intelligence', talent: 'intelligence', growth: 'intelligence',
  planning: 'intelligence', strategy: 'intelligence', judgement: 'intelligence',
  caution: 'intelligence', focus: 'intelligence', ambition: 'intelligence',
  vision: 'intelligence', self_awareness: 'intelligence', efficiency: 'intelligence',
  specialization: 'intelligence',
  // morality 道德（10 个）
  empathy: 'morality', responsibility: 'morality', discipline: 'morality',
  willpower: 'morality', patience: 'morality', persistence: 'morality',
  self_control: 'morality', emotion_control: 'morality', gratitude: 'morality',
  loyalty: 'morality',
  // social 社交（9 个）
  social: 'social', friendship: 'social', relationship: 'social',
  family_relation: 'social', teacher_relation: 'social', teamwork: 'social',
  communication: 'social', leadership: 'social', trust: 'social',
  // happiness 幸福（16 个）
  happiness: 'happiness', stability: 'happiness', pride: 'happiness',
  emotion: 'happiness', entertainment: 'happiness', family_need: 'happiness',
  freedom: 'happiness', security_need: 'happiness', security: 'happiness',
  motivation: 'happiness', comfort: 'happiness', fun: 'happiness',
  balance: 'happiness', interest: 'happiness', interest_change: 'happiness',
  gaming: 'happiness',
  // health 健康（6 个）
  health: 'health', sports: 'health', safety: 'health',
  safety_awareness: 'health', mental: 'health', resilience: 'health',
  // wealth 财富（6 个）
  money: 'wealth', financial: 'wealth', saving: 'wealth',
  business: 'wealth', money_management: 'wealth', money_awareness: 'wealth',
  // appearance 魅力（10 个）
  appearance: 'appearance', confidence: 'appearance', charisma: 'appearance',
  courage: 'appearance', action: 'appearance', competition: 'appearance',
  art: 'appearance', music: 'appearance', ego: 'appearance', power: 'appearance',
  // luck 运气（3 个）
  luck: 'luck', risk: 'luck', future_opportunity: 'luck',
  // 取反键（9 个）
  dependence: 'intelligence', avoidance: 'morality', procrastination: 'morality',
  impulse: 'morality', introversion: 'social', pressure: 'happiness',
  anger: 'happiness', anxiety: 'happiness', conflict: 'happiness',
};

/** 负向维度键：映射后数值取反 */
const INVERSE = new Set([
  'dependence', 'avoidance', 'procrastination', 'impulse', 'introversion',
  'pressure', 'anger', 'anxiety', 'conflict',
]);

/** 八大属性展示顺序与图标（与 src/engine/state.ts 的 ATTR_META 一致，需手动同步） */
const ATTR_ORDER = ['health', 'intelligence', 'wealth', 'happiness', 'social', 'appearance', 'luck', 'morality'];
const ATTR_ICON = {
  health: '💪', intelligence: '🧠', wealth: '💰', happiness: '😊',
  social: '👥', appearance: '🎨', luck: '🍀', morality: '⚖️',
};

/** 阶段年龄区间（与 src/engine/state.ts 的 STAGE_META 一致，需手动同步） */
const STAGE_RANGES = [
  ['infant', 0, 2],
  ['childhood', 3, 11],
  ['teen', 12, 17],
  ['young_adult', 18, 29],
  ['adult', 30, 49],
  ['middle_age', 50, 64],
  ['elder', 65, 95],
];

/** 按年龄推导人生阶段 */
function stageForAge(age) {
  for (const [stage, lo, hi] of STAGE_RANGES) {
    if (age >= lo && age <= hi) {
      return stage;
    }
  }
  return 'elder';
}

/**
 * 转换 effects 对象为引擎 outcomes.attr：映射 + 取反 + 同属性求和合并。
 * 遇到未映射键直接抛错（fail fast，不静默丢失）。
 */
function mapEffects(effects, eventId) {
  const attr = {};
  for (const [key, value] of Object.entries(effects)) {
    const target = ATTR_MAP[key];
    if (!target) {
      throw new Error(`unmapped attr "${key}" in event ${eventId}`);
    }
    attr[target] = (attr[target] ?? 0) + (INVERSE.has(key) ? -value : value);
  }
  for (const key of Object.keys(attr)) {
    if (attr[key] === 0) {
      delete attr[key];
    }
  }
  return attr;
}

/** 生成 emoji 展示串，如 '💪+10 😊-5'；无变化时返回空串 */
function toEffectsString(attr) {
  return ATTR_ORDER
    .filter(k => attr[k] !== undefined)
    .map(k => `${ATTR_ICON[k]}${attr[k] > 0 ? '+' : ''}${attr[k]}`)
    .join(' ');
}

/** 转换 conditions：snake_case → camelCase，属性键走映射表；取反键出现在条件中直接抛错 */
function mapConditions(conditions, eventId) {
  if (!conditions) {
    return undefined;
  }
  const out = {};
  if (conditions.has_flags) {
    out.hasFlags = conditions.has_flags;
  }
  if (conditions.not_flags) {
    out.notFlags = conditions.not_flags;
  }
  for (const [srcKey, destKey] of [['min_attrs', 'minAttrs'], ['max_attrs', 'maxAttrs']]) {
    const src = conditions[srcKey];
    if (!src) {
      continue;
    }
    out[destKey] = {};
    for (const [key, value] of Object.entries(src)) {
      if (INVERSE.has(key)) {
        throw new Error(`inverse attr "${key}" in conditions of event ${eventId}`);
      }
      const target = ATTR_MAP[key];
      if (!target) {
        throw new Error(`unmapped attr "${key}" in conditions of event ${eventId}`);
      }
      out[destKey][target] = value;
    }
  }
  return out;
}

/** 校验原始事件结构，缺字段抛错 */
function validateRaw(raw) {
  const missing = [];
  if (typeof raw.id !== 'string' || !raw.id) {
    missing.push('id');
  }
  if (!Array.isArray(raw.age_range) || raw.age_range.length !== 2
      || raw.age_range.some(n => typeof n !== 'number') || raw.age_range[0] > raw.age_range[1]) {
    missing.push('age_range');
  }
  if (typeof raw.title !== 'string' || !raw.title) {
    missing.push('title');
  }
  if (typeof raw.text !== 'string' || !raw.text) {
    missing.push('text');
  }
  if (!Array.isArray(raw.choices) || raw.choices.length === 0) {
    missing.push('choices');
  }
  if (missing.length > 0) {
    throw new Error(`invalid event ${raw.id ?? '(no id)'}: ${missing.join(', ')}`);
  }
}

/** 转换单个事件为引擎 LifeEvent 形状 */
export function convertEvent(raw) {
  validateRaw(raw);
  const event = {
    id: raw.id,
    stage: stageForAge(raw.age_range[0]),
    age: raw.age_range[0],
    title: raw.title,
    text: raw.text,
    choices: raw.choices.map(c => {
      const attr = mapEffects(c.effects ?? {}, raw.id);
      const choice = { text: c.text, effects: toEffectsString(attr), outcomes: { attr } };
      if (Array.isArray(c.flags_add) && c.flags_add.length > 0) {
        choice.outcomes.flags = c.flags_add;
      }
      return choice;
    }),
  };
  const conditions = mapConditions(raw.conditions, raw.id);
  if (conditions) {
    event.conditions = conditions;
  }
  return event;
}

/** 全量转换入口，重复 id 抛错 */
export function convertAll(rawEvents) {
  const ids = new Set();
  return rawEvents.map(raw => {
    if (ids.has(raw.id)) {
      throw new Error(`duplicate id "${raw.id}"`);
    }
    ids.add(raw.id);
    return convertEvent(raw);
  });
}

function main() {
  const raw = JSON.parse(readFileSync(new URL('./chiled.json', import.meta.url), 'utf8'));
  const events = convertAll(raw);
  writeFileSync(new URL('../src/engine/events.json', import.meta.url), JSON.stringify(events, null, 2), 'utf8');
  const byStage = {};
  for (const e of events) {
    byStage[e.stage] = (byStage[e.stage] ?? 0) + 1;
  }
  console.log(`✅ 转换 ${events.length} 个事件 → src/engine/events.json`);
  console.log('stage 分布:', JSON.stringify(byStage));
}

// 作为脚本直接运行时执行；被测试 import 时不执行
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
```

- [ ] **Step 4: 运行测试确认全部通过**

Run: `cd F:/ai/life-simulator && node --test script/convert-events.test.mjs`
Expected: 12 个测试全部 PASS

- [ ] **Step 5: 跑真实转换 + 抽样核对**

Run: `cd F:/ai/life-simulator && node script/convert-events.mjs`
Expected 输出: `✅ 转换 357 个事件 → src/engine/events.json`，stage 分布 `{"infant":2,"childhood":274,"teen":34,"young_adult":18,"adult":12,"middle_age":7,"elder":10}`（childhood 含 3-11 岁全部事件，模拟数据的 12 岁 27 个事件归入 teen）

抽样核对（与源数据对比，含取反合并与条件映射）：

Run: `cd F:/ai/life-simulator && node -e "
const out = JSON.parse(require('fs').readFileSync('src/engine/events.json', 'utf8'));
console.log('总数:', out.length);
console.log('birth_01:', JSON.stringify(out[0]));
const mid05 = out.find(e => e.id === 'mid_05');
console.log('mid_05 第3选项(pressure+10 应并入 happiness):', JSON.stringify(mid05.choices[2].outcomes.attr), '|', mid05.choices[2].effects);
const elder04 = out.find(e => e.id === 'elder_04');
console.log('elder_04 条件(money→wealth):', JSON.stringify(elder04.conditions));
"`

Expected:
- 总数 357
- `birth_01` = `{"id":"birth_01","stage":"infant","age":0,"title":"出生","text":"...","choices":[{"text":"……","effects":"","outcomes":{"attr":{}}}]}`
- `mid_05` 第 3 选项 attr = `{"happiness":-18,"health":-3}`（源数据 happiness-8 + pressure+10 取反合并），effects = `💪-3 😊-18`
- `elder_04` 条件 = `{"minAttrs":{"wealth":55,"health":30}}`

- [ ] **Step 6: package.json 加脚本**

`package.json` 的 `scripts` 中增加一行：

```json
"build:events": "node script/convert-events.mjs"
```

验证： `cd F:/ai/life-simulator && npm run build:events` 输出与 Step 5 相同。

- [ ] **Step 7: Commit**

```bash
cd F:/ai/life-simulator
git add script/convert-events.mjs script/convert-events.test.mjs package.json src/engine/events.json docs/superpowers/specs/2026-07-31-events-integration-design.md
git commit -m "[NF]: 事件转换器 convert-events.mjs + node:test 单测

- 106 键属性映射表（含 9 个取反键），未映射键/重复 id/缺字段 fail fast
- 生成 src/engine/events.json（357 事件）
- package.json 新增 build:events 脚本
- 修正 spec 取反键数量 10→9"
```

---

### Task 2: 引擎切换（types + events.ts + useGame 线性化）

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/engine/events.ts`（整体重写）
- Modify: `src/hooks/useGame.ts`

**Interfaces:**
- Consumes: Task 1 生成的 `src/engine/events.json`（357 个 LifeEvent 形状对象）
- Produces:
  - `LifeEvent.title?: string`（Task 3 的 DialogBox 消费）
  - `ChoiceOutcome = { attr: Partial<Attributes>; flags?: string[] }`（删除 nextAge/nextEvent/final）
  - `findNextEvent(game: GameState, fromIndex: number): LifeEvent | null` — 线性扫描第一个 `checkConditions` 通过的事件

**重要行为说明（有意修正）：** 旧实现中 `MAKE_CHOICE` 已把 `currentEvent` 设为下一事件，而 `CONTINUE` 又从 `eventIndex+1` 再扫描一次，导致每做一次选择实际跳过一个事件。新模型下 `MAKE_CHOICE` 预载下一事件、`CONTINUE` 只清反馈，每个事件恰好播放一次。

- [ ] **Step 1: 类型变更** `src/types/index.ts`

`ChoiceOutcome` 改为：

```ts
/** 选择结果 */
export interface ChoiceOutcome {
  attr: Partial<Attributes>;
  flags?: string[];
}
```

`LifeEvent` 改为：

```ts
/** 事件定义 */
export interface LifeEvent {
  id: string;
  stage: LifeStage;
  age: number;
  /** 事件标题（如「第一次养宠物」） */
  title?: string;
  text: string;
  choices: Choice[];
  /** 触发条件（不满足则跳过） */
  conditions?: EventCondition;
}
```

其余类型不变。

- [ ] **Step 2: 重写** `src/engine/events.ts`（整个文件替换为）

```ts
import type { LifeEvent } from '../types';
import eventsJson from './events.json';

/**
 * 全部人生事件（357 个）。
 * 由 script/convert-events.mjs 从 script/chiled.json 生成，数据请勿手改；
 * 修改事件请编辑 script/chiled.json 后运行 npm run build:events。
 *
 * 播放机制：
 * - 线性按数组顺序推进，conditions 不满足的事件跳过
 * - 年龄由事件自身 age 驱动（同一岁的多个事件连续触发）
 */
const EVENTS = eventsJson as unknown as LifeEvent[];

export default EVENTS;
```

- [ ] **Step 3: 改造** `src/hooks/useGame.ts`

3a. import 块删除 `STAGE_META`（不再使用），其余不变：

```ts
import {
  createInitialState,
  applyOutcomes,
  applyElderDecay,
  getStageForAge,
  checkDeath,
  calcMaxAge,
  ensureInt,
  STAGE_ORDER,
} from '../engine/state';
```

3b. `START_GAME` 分支替换为：

```ts
    case 'START_GAME': {
      const game = createInitialState(action.gender, action.name);
      const first = EVENTS.find(e => checkConditions(e, game)) ?? null;
      if (first) {
        game.age = first.age;
        game.stage = getStageForAge(first.age);
        game.stageIdx = STAGE_ORDER.indexOf(game.stage);
      }
      return { game, currentEvent: first, feedback: null, eventIndex: first ? EVENTS.indexOf(first) : 0 };
    }
```

3c. `MAKE_CHOICE` 分支替换为（反馈文本构建逻辑原样保留）：

```ts
    case 'MAKE_CHOICE': {
      const { choice, eventId } = action;
      const out = choice.outcomes;

      // 更新属性
      let attrs = applyOutcomes(state.game.attributes, out);

      // 更新标记
      const flags = [...state.game.flags];
      if (out.flags) {
        out.flags.forEach(f => { if (!flags.includes(f)) flags.push(f); });
      }

      // 基于更新后的属性/标记，线性扫描下一个满足条件的事件
      const next = findNextEvent({ ...state.game, attributes: attrs, flags }, state.eventIndex);

      // 年龄由下一个事件驱动；没有下一个事件说明全部播完
      const age = next ? next.age : state.game.age;
      const stage = getStageForAge(age);

      // 老年衰减
      if (age >= 65) {
        attrs = applyElderDecay(attrs);
      }

      // 整数保护
      attrs = ensureInt(attrs);

      // 死亡判断（动态寿命）
      const maxAge = calcMaxAge(attrs);
      const isDead = next !== null && checkDeath(age, attrs.health, maxAge);
      const gameOver = isDead || next === null;

      // 记录历史
      const history = [...state.game.history, {
        age: state.game.age,
        stage: state.game.stage,
        eventId,
        choiceIndex: state.currentEvent?.choices.indexOf(choice) ?? 0,
        text: choice.text,
      }];

      const game: GameState = {
        ...state.game,
        age: isDead ? Math.min(age, maxAge) : age,
        stage,
        stageIdx: STAGE_ORDER.indexOf(stage),
        attributes: attrs,
        flags,
        history,
        phase: gameOver ? 'summary' : 'playing',
      };

      // 构建反馈文本
      let fb = `你选择了「${choice.text}」`;
      const attrChanges: Partial<Attributes> = out.attr ?? {};
      const changedKeys = (Object.keys(attrChanges) as AttributeKey[]).filter(k => attrChanges[k] !== 0);
      if (changedKeys.length > 0) {
        fb += '\n\n' + changedKeys.map(k => {
          const v = attrChanges[k]!;
          return `${v > 0 ? '+' : ''}${v}`;
        }).join('  ');
      }

      return {
        game,
        currentEvent: gameOver ? null : next,
        feedback: fb,
        eventIndex: next ? EVENTS.indexOf(next) : state.eventIndex,
      };
    }
```

3d. `CONTINUE` 分支替换为：

```ts
    case 'CONTINUE': {
      // MAKE_CHOICE 已预载下一个事件，这里只清反馈
      return { ...state, feedback: null };
    }
```

3e. 事件查找区：删除 `findFirstEvent` 整个函数；`findNextEvent` 替换为：

```ts
/** 从 fromIndex 之后线性扫描第一个满足条件的事件 */
function findNextEvent(game: GameState, fromIndex: number): LifeEvent | null {
  for (let i = fromIndex + 1; i < EVENTS.length; i++) {
    if (checkConditions(EVENTS[i], game)) {
      return EVENTS[i];
    }
  }
  return null;
}
```

3f. `checkConditions`、`createInitialRuntime`、`useGame` hook 导出部分**原样保留不动**。

- [ ] **Step 4: 构建验证**

Run: `cd F:/ai/life-simulator && npm run build`
Expected: tsc + vite build 通过，无类型错误（若报 `eventsJson as LifeEvent[]` 转换重叠不足，确认写的是 `as unknown as LifeEvent[]`）

- [ ] **Step 5: Commit**

```bash
cd F:/ai/life-simulator
git add src/types/index.ts src/engine/events.ts src/hooks/useGame.ts
git commit -m "[NF]: 357 事件接入引擎，线性播放改造

- events.ts 改为 import events.json（构建时转换产物）
- LifeEvent 增加 title 可选字段；ChoiceOutcome 删除 nextAge/nextEvent/final
- useGame 线性推进：年龄由事件驱动，CONTINUE 只清反馈（修复每选择一次跳过一事件的旧缺陷）
- 删除 findFirstEvent 与 findNextEvent 的阶段推进/年龄窗口逻辑"
```

---

### Task 3: DialogBox 显示事件标题

**Files:**
- Modify: `src/components/DialogBox.tsx`
- Modify: `src/components/GameScreen.tsx`

**Interfaces:**
- Consumes: Task 2 的 `LifeEvent.title?: string`
- Produces: `DialogBox` Props 增加 `title?: string`

- [ ] **Step 1: DialogBox 增加 title prop**

`src/components/DialogBox.tsx`：

Props 接口改为：

```ts
interface Props {
  text: string;
  name: string;
  age: number;
  stage: string;
  title?: string;
  onComplete?: () => void;
  onAutoContinue?: () => void;
  autoAdvance?: boolean;
}
```

函数签名改为：

```ts
export default function DialogBox({ text, name, age, stage, title, onComplete, onAutoContinue, autoAdvance }: Props) {
```

元信息行（第 71-75 行区域）改为：

```tsx
        <div className="flex gap-5 mb-2 text-[10px] text-white/40 tracking-wider">
          <span className="text-[#c9a96e] font-semibold">{name}</span>
          <span>{age}岁</span>
          <span>{stage}</span>
          {title && <span className="text-white/60">「{title}」</span>}
        </div>
```

- [ ] **Step 2: GameScreen 传入 title**

`src/components/GameScreen.tsx` 第 72-80 行的 `<DialogBox>` 调用增加一行 prop：

```tsx
        <DialogBox
          text={currentEvent.text}
          name={game.name}
          age={game.age}
          stage={stageMeta.label}
          title={currentEvent.title}
          autoAdvance={isAuto}
          onComplete={handleDialogComplete}
          onAutoContinue={isAuto ? () => onChoice(currentEvent.choices[0]) : undefined}
        />
```

- [ ] **Step 3: 构建验证**

Run: `cd F:/ai/life-simulator && npm run build`
Expected: 通过

- [ ] **Step 4: Commit**

```bash
cd F:/ai/life-simulator
git add src/components/DialogBox.tsx src/components/GameScreen.tsx
git commit -m "[NF]: DialogBox 显示事件标题

- DialogBox Props 增加 title，元信息行追加「标题」展示
- GameScreen 传入 currentEvent.title"
```

---

### Task 4: 端到端验证（Playwright）

**Files:** 无代码改动（发现问题则回到对应 Task 修复）

- [ ] **Step 1: 启动 dev server**

Run: `cd F:/ai/life-simulator && npm run dev`（run_in_background）
Expected: Vite 监听 `http://localhost:5173`

- [ ] **Step 2: 开局验证标题与年龄**

Playwright 操作序列：
1. `browser_navigate` → `http://localhost:5173`
2. 点击「男 生」按钮 → 点击「开 始 人 生」
3. `browser_wait_for` time: 6（等打字机放完 birth_01 文本）
4. `browser_snapshot` 确认：元信息行含 `0岁`、标题 `「出生」`、出现 `▼ 点击继续`
5. 点击对话框 → 反馈页（`你选择了「……」`）→ 点击继续
6. 到 birth_02：确认元信息行 `1岁`、标题 `「第一次说话」`

- [ ] **Step 3: 选择验证属性映射**

1. 继续推进到 `「第一天上幼儿园」`（3 岁，3 个选项；中途 birth_02 的 effects 已让 幸福 70→75、社交 20→22、智力 30→33）
2. 确认选项 1 效果串为 `😊+5 👥+8 🎨+8`（源数据 social+8/happiness+5/confidence+8 → confidence 映射 appearance）
3. 点击选项 1 → 反馈页显示 `+8  +5  +8`（顺序为 out.attr 插入序 social/happiness/appearance）
4. `browser_snapshot` 确认 StatusBar 数值：幸福 75→80、社交 22→30、魅力 50→58

- [ ] **Step 4: 自动播放到结算页**

打字机每个事件约 2-5 秒，全程 357 事件约需 15-25 分钟，因此**分块执行**：`browser_run_code_unsafe` 执行下面的自动点击循环（点「▼ 点击继续」或第一个选项按钮，每块 400 次迭代）；若返回未到结算页，重复执行同一调用，直到出现「重新开始」（预计 3-5 块）：

```js
async (page) => {
  for (let i = 0; i < 400; i++) {
    const state = await page.evaluate(() => {
      const text = document.body.innerText;
      if (text.includes('重新开始')) return 'summary';
      const cont = [...document.querySelectorAll('div')].find(
        d => d.textContent.trim() === '▼ 点击继续'
      );
      if (cont) { cont.click(); return 'continue'; }
      const choice = document.querySelector('button.group');
      if (choice) { choice.click(); return 'choice'; }
      return 'typing';
    });
    if (state === 'summary') return `到达结算页`;
    await page.waitForTimeout(250);
  }
  return '本块 400 次迭代结束，未到结算页';
}
```

Expected: 某一块返回 `到达结算页`；`browser_snapshot` 确认显示 `享年 X 岁` 与某种「一生」标题（如「充实的一生」）。

- [ ] **Step 5: 收尾**

1. 停止 dev server（TaskStop）
2. Run: `cd F:/ai/life-simulator && codegraph sync`（CLAUDE.md 要求代码变更后同步索引）
3. `git status` 确认工作区干净（验证过程不产生新改动；如有修复则按对应前缀单独提交）

---

## Self-Review 结论

- **Spec 覆盖**：转换器（T1）、映射表（T1 Step 3）、类型变更（T2 S1）、events.ts 重写（T2 S2）、useGame 简化（T2 S3）、DialogBox 标题（T3）、验证三项（T1 S5 抽样 / 各 Task build / T4 E2E）——全部有对应任务
- **类型一致性**：`convertEvent` 产出的 `choices[].outcomes.{attr,flags}` 与 Task 2 的 `ChoiceOutcome` 一致；`title` 从 LifeEvent（T2）到 DialogBox（T3）链路一致
- **已知取舍**：`STAGE_RANGES`/`ATTR_ICON` 在转换器与 `src/engine/state.ts` 各存一份（脚本无法 import TS），代码注释已标注「需手动同步」
