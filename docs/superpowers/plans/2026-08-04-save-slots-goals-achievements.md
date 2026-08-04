# 存档槽位 + 目标成就 + 数据债 实现计划（第二弹）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 三模块一次交付：3 槽存档 + 中途退出 + 旧存档迁移；6 预设人生目标 + 12 成就跨周目；数据债清理（adult_100 归模拟 + 0-2 岁补 3 事件）。

**Architecture:** 目标与成就判定为引擎纯函数（可单测）；存档重构为 `life-sim-saves-v2`（active + 3 slots），迁移逻辑抽纯函数；UI 层新增 GoalModal/ConfirmModal/AchievementsModal 三个轻量模态；数据改动全走 chiled.json 管线。

**Tech Stack:** TypeScript、React 18（useReducer）、Node 22 test runner（`--experimental-strip-types`）。

## Global Constraints

- 所有注释中文、日志英文（script 脚本 console 输出用中文 ✅ 符号）
- 不改 `src/engine/events.json` 生成文件（数据改动走 chiled.json + build:events）
- 引擎纯函数无副作用（localStorage 只在 useGame/utils 层）
- 旧存档（`life-sim-save-v1`）首次启动无感迁移到槽 0；旧版槽位结构 `paceMode`/`typeSpeed`/`goal` 字段兜底
- 标题页元素增多后 720px 高度不得溢出（第一弹修过，卡片区用紧凑布局）
- 提交信息：中文 subject + 前缀（[NF]/[BF]/[CU]/[IM]），body `- ` 列表，无 AI 署名
- 类型检查：`npx tsc --noEmit`；引擎测试：`node --experimental-strip-types --test script/*.test.ts`（glob 需展开文件名）
- 效果值范围 ±3~±20；事件格式 snake_case（age_range/flags_add/has_flags）

---

### Task 1: 目标与成就引擎（类型 + 纯函数 + 单测）

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/engine/goals.ts`
- Create: `src/engine/achievements.ts`
- Create: `script/goals.test.ts`

**Interfaces:**
- Produces: `GoalKey`（types）；`GOALS: GoalDef[]`、`checkGoal(goal, game): GoalResult | null`（goals.ts）；`AchievementId`、`ACHIEVEMENTS: AchievementDef[]`、`checkAchievements(input): AchievementId[]`（achievements.ts）

- [ ] **Step 1: types/index.ts 追加类型**

```ts
/** 人生目标 */
export type GoalKey = 'wealth' | 'travel' | 'academic' | 'doctor' | 'family' | 'stable';

/** 成就 id */
export type AchievementId =
  | 'first_life' | 'longevity' | 'early_death' | 'rich' | 'scholar'
  | 'career' | 'traveler' | 'doctor' | 'balanced' | 'lite_clear' | 'auto_clear' | 'three_lives';
```

`GameState` 接口加字段（`deathCause` 之后）：

```ts
  /** 人生目标（开局选定，无目标为 null） */
  goal: GoalKey | null;
```

- [ ] **Step 2: 写失败测试（script/goals.test.ts）**

```ts
/**
 * 目标达成与成就判定引擎测试。
 *
 * 运行：node --experimental-strip-types --test script/goals.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { checkGoal, GOALS } from '../src/engine/goals.ts';
import { checkAchievements, ACHIEVEMENTS } from '../src/engine/achievements.ts';
import type { GameState, GoalKey, Attributes } from '../src/types/index.ts';

/** 构造测试用游戏状态 */
function game(overrides: Partial<GameState> = {}, attrs: Partial<Attributes> = {}): GameState {
  return {
    gender: 'male', name: '小明', age: 50, stage: 'middle_age', stageIdx: 4,
    attributes: { health: 60, intelligence: 50, wealth: 40, happiness: 60, social: 40, appearance: 40, luck: 40, morality: 40, ...attrs },
    flags: [], history: [], phase: 'summary', deathCause: 'lifespan',
    goal: null, ...overrides,
  };
}

test('GOALS：6 个预设齐全且 key 唯一', () => {
  assert.strictEqual(GOALS.length, 6);
  assert.strictEqual(new Set(GOALS.map(g => g.key)).size, 6);
});

test('checkGoal：财富自由（wealth ≥ 80）', () => {
  assert.strictEqual(checkGoal('wealth', game({}, { wealth: 80 }))!.achieved, true);
  assert.strictEqual(checkGoal('wealth', game({}, { wealth: 65 }))!.achieved, false);
  // startup_success 也算达成
  assert.strictEqual(checkGoal('wealth', game({ flags: ['startup_success'] }))!.achieved, true);
});

test('checkGoal：环游世界（world_traveler flag）', () => {
  assert.strictEqual(checkGoal('travel', game({ flags: ['world_traveler'] }))!.achieved, true);
  assert.strictEqual(checkGoal('travel', game())!.achieved, false);
});

test('checkGoal：学术深耕（grad_school 或 top_university）', () => {
  assert.strictEqual(checkGoal('academic', game({ flags: ['grad_school'] }))!.achieved, true);
  assert.strictEqual(checkGoal('academic', game({ flags: ['top_university'] }))!.achieved, true);
  assert.strictEqual(checkGoal('academic', game())!.achieved, false);
});

test('checkGoal：白衣天使（doctor flag）', () => {
  assert.strictEqual(checkGoal('doctor', game({ flags: ['doctor'] }))!.achieved, true);
  assert.strictEqual(checkGoal('doctor', game())!.achieved, false);
});

test('checkGoal：家庭美满（已婚 + 有娃 + 幸福 ≥ 70）', () => {
  const base = game({ flags: ['married', 'has_child'] }, { happiness: 70 });
  assert.strictEqual(checkGoal('family', base)!.achieved, true);
  assert.strictEqual(checkGoal('family', game({ flags: ['married', 'has_child'] }, { happiness: 60 }))!.achieved, false);
  assert.strictEqual(checkGoal('family', game({ flags: ['married'] }, { happiness: 80 }))!.achieved, false);
});

test('checkGoal：安稳一生（civil_servant 或 settled_down）', () => {
  assert.strictEqual(checkGoal('stable', game({ flags: ['civil_servant'] }))!.achieved, true);
  assert.strictEqual(checkGoal('stable', game({ flags: ['settled_down'] }))!.achieved, true);
  assert.strictEqual(checkGoal('stable', game())!.achieved, false);
});

test('checkGoal：无目标返回 null；未达成含差距提示', () => {
  assert.strictEqual(checkGoal(null, game()), null);
  const r = checkGoal('wealth', game({}, { wealth: 65 }))!;
  assert.strictEqual(r.achieved, false);
  assert.match(r.detail, /65/);
});

test('ACHIEVEMENTS：12 个定义齐全', () => {
  assert.strictEqual(ACHIEVEMENTS.length, 12);
  assert.strictEqual(new Set(ACHIEVEMENTS.map(a => a.id)).size, 12);
});

test('checkAchievements：按状态判定全部满足项', () => {
  const g = game({ age: 92, flags: ['world_traveler'], attributes: { wealth: 95, intelligence: 88, health: 80, happiness: 80, social: 70, appearance: 70, luck: 70, morality: 70 } });
  const got = checkAchievements({ game: g, completedLives: 3, wasLite: true, wasAuto: false });
  for (const id of ['first_life', 'longevity', 'rich', 'scholar', 'traveler', 'balanced', 'lite_clear', 'three_lives'] as const) {
    assert.ok(got.includes(id), `应包含 ${id}`);
  }
  assert.ok(!got.includes('early_death'));
  assert.ok(!got.includes('doctor'));
  assert.ok(!got.includes('auto_clear'));
});

test('checkAchievements：英年早逝与快速模拟', () => {
  const g = game({ age: 35 });
  const got = checkAchievements({ game: g, completedLives: 1, wasLite: false, wasAuto: true });
  assert.ok(got.includes('early_death'));
  assert.ok(got.includes('auto_clear'));
  assert.ok(!got.includes('longevity'));
});
```

- [ ] **Step 3: 运行确认失败**

Run: `node --experimental-strip-types --test script/goals.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 4: 实现 src/engine/goals.ts**

```ts
import type { GameState, GoalKey } from '../types';

/** 目标达成检查结果 */
export interface GoalResult {
  achieved: boolean;
  /** 达成描述或差距提示（未达成时含当前值/目标值） */
  detail: string;
}

/** 人生目标定义 */
export interface GoalDef {
  key: GoalKey;
  icon: string;
  name: string;
  desc: string;
}

/** 6 个预设人生目标 */
export const GOALS: GoalDef[] = [
  { key: 'wealth', icon: '💰', name: '财富自由', desc: '积累 80 以上财富，或创业成功' },
  { key: 'travel', icon: '✈️', name: '环游世界', desc: '走遍山川湖海，成为行者' },
  { key: 'academic', icon: '🎓', name: '学术深耕', desc: '考研深造，或考入顶尖学府' },
  { key: 'doctor', icon: '🏥', name: '白衣天使', desc: '学医从医，救死扶伤' },
  { key: 'family', icon: '🏠', name: '家庭美满', desc: '婚姻幸福，儿女绕膝' },
  { key: 'stable', icon: '⚖️', name: '安稳一生', desc: '体制内安定，或安稳落地' },
];

/**
 * 检查目标达成情况。
 *
 * @param goal 目标 key（null = 无目标）
 * @param game 结算时的游戏状态
 * @returns 无目标返回 null；否则返回达成与否与描述
 */
export function checkGoal(goal: GoalKey | null, game: GameState): GoalResult | null {
  if (!goal) {
    return null;
  }
  const { attributes, flags } = game;
  const has = (...fs: string[]) => fs.some(f => flags.includes(f));
  const detail = (achieved: boolean, text: string): GoalResult => ({ achieved, detail: text });

  switch (goal) {
    case 'wealth':
      return attributes.wealth >= 80 || has('startup_success')
        ? detail(true, '你实现了财务自由')
        : detail(false, `财富 ${attributes.wealth}/80`);
    case 'travel':
      return has('world_traveler')
        ? detail(true, '你的脚步丈量过世界')
        : detail(false, '尚未踏上环游世界的旅程');
    case 'academic':
      return has('grad_school', 'top_university')
        ? detail(true, '你在学术之路上深耕')
        : detail(false, '未走上学术道路');
    case 'doctor':
      return has('doctor')
        ? detail(true, '你救死扶伤，医者仁心')
        : detail(false, '未穿上白大褂');
    case 'family':
      return has('married', 'has_child') && attributes.happiness >= 70
        ? detail(true, '家庭美满，此生有爱')
        : has('married', 'has_child')
          ? detail(false, `幸福 ${attributes.happiness}/70`)
          : detail(false, '未组建家庭');
    case 'stable':
      return has('civil_servant', 'settled_down')
        ? detail(true, '岁月静好，安稳一生')
        : detail(false, '未过上安稳的日子');
  }
}
```

- [ ] **Step 5: 实现 src/engine/achievements.ts**

```ts
import type { AchievementId, GameState } from '../types';

/** 成就定义 */
export interface AchievementDef {
  id: AchievementId;
  icon: string;
  name: string;
  desc: string;
}

/** 12 个跨周目成就 */
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_life', icon: '👶', name: '第一次人生', desc: '完整走完第一局人生' },
  { id: 'longevity', icon: '🎂', name: '长寿', desc: '享年达到 90 岁' },
  { id: 'early_death', icon: '⏳', name: '英年早逝', desc: '40 岁前走完一生' },
  { id: 'rich', icon: '💎', name: '财富自由', desc: '财富达到 90' },
  { id: 'scholar', icon: '🧠', name: '学霸', desc: '智力达到 85' },
  { id: 'career', icon: '🚀', name: '事业有成', desc: '创业成功' },
  { id: 'traveler', icon: '🗺️', name: '环游世界', desc: '成为行者无疆' },
  { id: 'doctor', icon: '⚕️', name: '白衣天使', desc: '成为医生' },
  { id: 'balanced', icon: '🌟', name: '均衡发展', desc: '全属性达到 60' },
  { id: 'lite_clear', icon: '⚡', name: '精简通关', desc: '以精简模式走完一生' },
  { id: 'auto_clear', icon: '🤖', name: '命运旁观者', desc: '完成一局快速模拟' },
  { id: 'three_lives', icon: '🔁', name: '三局人生', desc: '累计完成三局人生' },
];

/** 成就判定输入 */
export interface AchievementCheckInput {
  game: GameState;
  /** 累计完成局数（含本局） */
  completedLives: number;
  /** 本局是否精简模式 */
  wasLite: boolean;
  /** 本局是否快速模拟 */
  wasAuto: boolean;
}

/** 判定当前状态满足的所有成就（含已解锁的，去重由调用方处理） */
export function checkAchievements(input: AchievementCheckInput): AchievementId[] {
  const { game, completedLives, wasLite, wasAuto } = input;
  const { attributes, flags, age } = game;
  const has = (...fs: string[]) => fs.some(f => flags.includes(f));
  const ids = new Set<AchievementId>();

  if (completedLives >= 1) { ids.add('first_life'); }
  if (age >= 90) { ids.add('longevity'); }
  if (age < 40) { ids.add('early_death'); }
  if (attributes.wealth >= 90) { ids.add('rich'); }
  if (attributes.intelligence >= 85) { ids.add('scholar'); }
  if (has('startup_success')) { ids.add('career'); }
  if (has('world_traveler')) { ids.add('traveler'); }
  if (has('doctor')) { ids.add('doctor'); }
  if (Object.values(attributes).every(v => v >= 60)) { ids.add('balanced'); }
  if (wasLite) { ids.add('lite_clear'); }
  if (wasAuto) { ids.add('auto_clear'); }
  if (completedLives >= 3) { ids.add('three_lives'); }
  return [...ids];
}
```

- [ ] **Step 6: 运行测试确认通过 + 回归**

Run: `node --experimental-strip-types --test script/goals.test.ts`
Expected: PASS

Run: `npx tsc --noEmit`
Expected: 报错仅限 GameState 构造处（Task 3 前会多处缺 goal 字段——检查报错范围：types 引入 `goal` 必填后，useGame.ts 的 createInitialState/createInitialRuntime、SummaryScreen 等构造 GameState 处报 TS2739。**这些是计划内预期，Task 3 修复**。当前验收：goals.test.ts 通过 + goals/achievements 两文件无类型错误）

- [ ] **Step 7: 提交**

```bash
git add src/types/index.ts src/engine/goals.ts src/engine/achievements.ts script/goals.test.ts
git commit -m "[NF]: 目标与成就引擎：6 预设目标判定 + 12 成就跨周目判定纯函数"
```

---

### Task 2: 存档 v2（结构 + 迁移 + useGame 存取重构）

**Files:**
- Create: `src/engine/save.ts`
- Create: `script/save.test.ts`
- Modify: `src/hooks/useGame.ts`（存档存取部分）

**Interfaces:**
- Consumes: `SaveData`（含 `goal` 字段——Task 1 的 GameState.goal 会随 SaveData.game 自动携带，SaveData 本身无需加字段）
- Produces: `SavesV2`、`SLOT_COUNT = 3`、`emptySaves()`、`migrateLegacySave(raw: string): SavesV2`（save.ts）；useGame 导出 `startGame(gender, name, paceMode, typeSpeed, goal)`、`continueGame(slot: number)`、`saves`、`activeSlot`

- [ ] **Step 1: 写失败测试（script/save.test.ts）**

```ts
/**
 * 存档 v2 迁移与结构测试。
 *
 * 运行：node --experimental-strip-types --test script/save.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { emptySaves, migrateLegacySave, SLOT_COUNT } from '../src/engine/save.ts';

test('SLOT_COUNT 为 3', () => {
  assert.strictEqual(SLOT_COUNT, 3);
});

test('emptySaves：3 空槽 + active 0', () => {
  const s = emptySaves();
  assert.strictEqual(s.active, 0);
  assert.strictEqual(s.slots.length, 3);
  assert.deepStrictEqual(s.slots, [null, null, null]);
});

test('migrateLegacySave：v1 存档迁入槽 0', () => {
  const v1 = JSON.stringify({
    game: { gender: 'male', name: '小明', age: 30, stage: 'adult', stageIdx: 4, attributes: { health: 60, intelligence: 50, wealth: 40, happiness: 60, social: 40, appearance: 40, luck: 40, morality: 40 }, flags: [], history: [], phase: 'playing', deathCause: null, goal: null },
    currentEventId: 'adult_13', feedback: null, eventIndex: 12, shuffleSeed: 123456,
    paceMode: 'lite', typeSpeed: 'fast',
  });
  const s = migrateLegacySave(v1);
  assert.strictEqual(s.active, 0);
  assert.strictEqual(s.slots[0]?.game.name, '小明');
  assert.strictEqual(s.slots[0]?.shuffleSeed, 123456);
  assert.strictEqual(s.slots[0]?.paceMode, 'lite');
  assert.strictEqual(s.slots[1], null);
  assert.strictEqual(s.slots[2], null);
});

test('migrateLegacySave：非法 JSON 抛错', () => {
  assert.throws(() => migrateLegacySave('not-json'), /JSON|parse/i);
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --experimental-strip-types --test script/save.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 src/engine/save.ts**

```ts
import type { GameState } from '../types';

/** 单槽存档数据（与旧版 SaveData 结构一致） */
export interface SaveData {
  game: GameState;
  currentEventId: string | null;
  feedback: string | null;
  eventIndex: number;
  shuffleSeed: number;
  paceMode?: 'full' | 'lite';
  typeSpeed?: 'slow' | 'normal' | 'fast';
}

/** v2 存档：active 槽 + 3 槽位 */
export interface SavesV2 {
  active: number;
  slots: (SaveData | null)[];
}

/** 存档槽位数 */
export const SLOT_COUNT = 3;

/** 空存档结构 */
export function emptySaves(): SavesV2 {
  return { active: 0, slots: [null, null, null] };
}

/**
 * 旧版单槽存档（life-sim-save-v1）迁移到 v2 结构。
 *
 * @param raw v1 存档 JSON 字符串
 * @returns 迁入槽 0 的 v2 结构
 * @throws 非法 JSON 时抛出
 */
export function migrateLegacySave(raw: string): SavesV2 {
  const data = JSON.parse(raw) as SaveData;
  return { active: 0, slots: [data, null, null] };
}
```

- [ ] **Step 4: 运行确认通过**

Run: `node --experimental-strip-types --test script/save.test.ts`
Expected: PASS

- [ ] **Step 5: useGame.ts 存档存取重构**

`SAVE_KEY` 常量改为：

```ts
/** 存档 v2 key（3 槽位 + active） */
const SAVE_KEY_V2 = 'life-sim-saves-v2';
/** 旧版单槽存档 key（首次启动迁移到 v2 后删除） */
const LEGACY_SAVE_KEY = 'life-sim-save-v1';
```

删除旧 `SaveData`/`loadSave`/`saveState`，替换为：

```ts
import { emptySaves, migrateLegacySave, SLOT_COUNT, type SavesV2 } from '../engine/save';

/** 读取 v2 存档；不存在则尝试迁移旧版；都没有返回空结构 */
function loadSaves(): SavesV2 {
  try {
    const raw = localStorage.getItem(SAVE_KEY_V2);
    if (raw) {
      const data = JSON.parse(raw) as SavesV2;
      if (data && Array.isArray(data.slots) && data.slots.length === SLOT_COUNT && typeof data.active === 'number') {
        return data;
      }
    }
    // 旧版单槽存档迁移
    const legacy = localStorage.getItem(LEGACY_SAVE_KEY);
    if (legacy) {
      const migrated = migrateLegacySave(legacy);
      localStorage.removeItem(LEGACY_SAVE_KEY);
      saveSaves(migrated);
      return migrated;
    }
  } catch {
    // 存储不可用时静默降级为空结构
  }
  return emptySaves();
}

/** 持久化 v2 存档 */
function saveSaves(saves: SavesV2): void {
  try {
    localStorage.setItem(SAVE_KEY_V2, JSON.stringify(saves));
  } catch {
    // 存储不可用（隐私模式/满额）时静默降级为不保存
  }
}
```

`Action` 联合类型更新（`CONTINUE_GAME` 加槽位参数，新增水合 action）：

```ts
type Action =
  | { type: 'START_GAME'; gender: 'male' | 'female'; name: string; paceMode: PaceMode; typeSpeed: TypeSpeed }
  | { type: 'START_AUTO_GAME'; gender: 'male' | 'female'; name: string }
  | { type: 'MAKE_CHOICE'; choice: Choice; eventId: string }
  | { type: 'CONTINUE' }
  | { type: 'SET_TYPE_SPEED'; typeSpeed: TypeSpeed }
  | { type: 'RESET' }
  | { type: 'CONTINUE_GAME'; slot: number }
  | { type: 'HYDRATE_SAVES'; saves: SavesV2 };
```

`RuntimeState` 加字段：`saves: SavesV2;`

`saveState(rt)` 改为把当前局写入 active 槽：

```ts
/** 持久化当前状态到 active 槽；标题页状态（新游戏未开始）时不写不删 */
function saveState(rt: RuntimeState): void {
  if (!rt.game || rt.game.phase === 'title') {
    return;
  }
  const saves = { ...rt.saves, slots: [...rt.saves.slots] };
  saves.slots[saves.active] = {
    game: rt.game,
    currentEventId: rt.currentEvent?.id ?? null,
    feedback: rt.feedback,
    eventIndex: rt.eventIndex,
    shuffleSeed: rt.shuffleSeed,
    paceMode: rt.paceMode,
    typeSpeed: rt.typeSpeed,
  };
  saveSaves(saves);
}
```

`createInitialRuntime` 加 `saves: emptySaves(),`；`useGame` 内 `const [rt, dispatch] = useReducer(reducer, null, createInitialRuntime);` 之后加 `const savesRef = useRef<SavesV2 | null>(null);`——**注意**：loadSaves 有副作用（迁移写 localStorage），且 title 页挂载时就要知道槽位。在 `createInitialRuntime` 里调用 loadSaves 不可行（它不是 hook 上下文，且 createInitialRuntime 是 reducer 初始函数）。方案：reducer 的初始函数只建空 saves，`useEffect` 挂载后一次性 `loadSaves()` 并 dispatch 一个 `HYDRATE_SAVES` action：

```ts
// Action 联合类型加：
| { type: 'HYDRATE_SAVES'; saves: SavesV2 }

// reducer 加分支：
case 'HYDRATE_SAVES':
  return { ...state, saves: action.saves };

// useGame 内：
const [rt, dispatch] = useReducer(reducer, null, createInitialRuntime);
// 挂载时一次性读取/迁移存档（迁移有 localStorage 写入副作用，只跑一次）
useEffect(() => {
  dispatch({ type: 'HYDRATE_SAVES', saves: loadSaves() });
}, []);
```

`CONTINUE_GAME` 改带槽位参数（恢复后 active 指向该槽）：

```ts
case 'CONTINUE_GAME': {
  const { slot } = action;
  const saved = state.saves.slots[slot];
  if (!saved) {
    return state;
  }
  const paceMode = saved.paceMode ?? 'full';
  const typeSpeed = saved.typeSpeed ?? 'normal';
  const shuffleSeed = typeof saved.shuffleSeed === 'number' ? saved.shuffleSeed : 0;
  const shuffledEvents = shuffleEvents(filterEvents(EVENTS, paceMode, shuffleSeed), shuffleSeed);
  const currentEvent = saved.currentEventId
    ? shuffledEvents.find(e => e.id === saved.currentEventId) ?? null
    : null;
  const saves = { ...state.saves, active: slot, slots: [...state.saves.slots] };
  return {
    ...state,
    game: { ...saved.game, deathCause: saved.game.deathCause ?? null },
    currentEvent,
    feedback: saved.feedback,
    eventIndex: saved.eventIndex,
    shuffleSeed,
    shuffledEvents,
    autoPlay: false,
    paceMode,
    typeSpeed,
    saves,
  };
}
```

`useGame` 回调改为：

```ts
const continueGame = useCallback((slot: number) => {
  dispatch({ type: 'CONTINUE_GAME', slot });
}, []);
```

`hasSave` 改为 `saves.slots.some(s => s !== null)`（HYDRATE 后为 true；渲染时使用 `rt.saves` 而非挂载缓存）：

```ts
// 标题页是否有可继续的存档（HYDRATE_SAVES 后生效）
const hasSave = rt.saves.slots.some(s => s !== null);
```

返回 `saves: rt.saves` 与 `activeSlot: rt.saves.active`。

- [ ] **Step 6: 验证**

Run: `npx tsc --noEmit`
Expected: 报错仅限 TitleScreen/App 的 `continueGame` 签名与 GameState 缺 goal 构造处（计划内，Task 3/4 修复）

Run: `node --experimental-strip-types --test script/save.test.ts script/goals.test.ts`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add src/engine/save.ts script/save.test.ts src/hooks/useGame.ts
git commit -m "[NF]: 存档 v2：3 槽位 + active + 旧版单槽自动迁移"
```

---

### Task 3: 人生目标选择（GoalModal + START_GAME 带 goal）

**Files:**
- Create: `src/components/GoalModal.tsx`
- Modify: `src/hooks/useGame.ts`（START_GAME 加 goal、createInitialState 补 goal 字段——见 state.ts）
- Modify: `src/engine/state.ts`（createInitialState 的 GameState 构造补 `goal: null`）
- Modify: `src/components/TitleScreen.tsx`（开始人生 → GoalModal）

**Interfaces:**
- Consumes: `GOALS`（Task 1）；`startGame` 新签名
- Produces: `GoalModal({ onSelect: (goal: GoalKey | null) => void; onCancel: () => void })`

- [ ] **Step 1: state.ts 补 goal 字段**

`createInitialState` 返回的 GameState 对象加 `goal: null,`。

- [ ] **Step 2: useGame START_GAME 带 goal**

Action 改：

```ts
| { type: 'START_GAME'; gender: 'male' | 'female'; name: string; paceMode: PaceMode; typeSpeed: TypeSpeed; goal: GoalKey | null }
```

START_GAME 分支（`const game = createInitialState(...)` 后）加 `game.goal = action.goal;`。

`useGame` 回调：

```ts
const startGame = useCallback((gender: 'male' | 'female', name: string, paceMode: PaceMode, typeSpeed: TypeSpeed, goal: GoalKey | null) => {
  dispatch({ type: 'START_GAME', gender, name, paceMode, typeSpeed, goal });
}, []);
```

import 加 `GoalKey`。

- [ ] **Step 3: 创建 GoalModal.tsx**

```tsx
import { useState } from 'react';
import type { GoalKey } from '../types';
import { GOALS } from '../engine/goals';
import { sfx } from '../utils/sound';

interface Props {
  onSelect: (goal: GoalKey | null) => void;
  onCancel: () => void;
}

/** 目标选择模态：开局选择人生目标（无目标亦可） */
export default function GoalModal({ onSelect, onCancel }: Props) {
  const [selected, setSelected] = useState<GoalKey | null>(null);

  return (
    <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={onCancel}>
      <div className="w-[560px] max-h-[520px] overflow-y-auto rounded-2xl border border-white/10 bg-[#15152a] p-6
        flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-center text-[18px] tracking-[6px] text-[#c9a96e]">选择你的人生目标</h3>
        <p className="text-center text-[11px] text-white/40 tracking-[2px]">目标影响结算评价，也可以无目的地活一次</p>
        <div className="grid grid-cols-2 gap-3">
          {GOALS.map(g => (
            <button
              key={g.key}
              onClick={() => { sfx.select(); setSelected(g.key); }}
              className={`p-3.5 rounded-xl border text-left transition-all duration-200 font-sans
                ${selected === g.key
                  ? 'border-[#c9a96e] bg-[#c9a96e]/10 shadow-[0_0_16px_rgba(201,169,110,0.2)]'
                  : 'border-white/10 bg-white/[0.03] hover:border-[#c9a96e]/40'}`}
            >
              <div className="text-[15px] text-white/85">{g.icon} {g.name}</div>
              <div className="text-[11px] text-white/40 mt-1 leading-relaxed">{g.desc}</div>
            </button>
          ))}
        </div>
        <div className="flex gap-3 justify-center mt-1">
          <button
            onClick={() => { sfx.select(); onSelect(null); }}
            className="px-6 py-2.5 rounded-[30px] text-[13px] tracking-[3px] border font-sans
              border-white/15 text-white/40 hover:border-[#c9a96e]/50 hover:text-[#c9a96e]"
          >
            无目标，随心而活
          </button>
          <button
            onClick={() => { if (selected) { sfx.select(); onSelect(selected); } }}
            disabled={!selected}
            className={`px-8 py-2.5 rounded-[30px] text-[13px] tracking-[3px] border font-sans
              ${selected
                ? 'bg-gradient-to-r from-[#c9a96e] to-[#a88b4e] text-[#1a1a2e] font-bold border-transparent'
                : 'bg-white/[0.06] text-white/30 border-white/[0.08] cursor-not-allowed'}`}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: TitleScreen 集成**

`TitleScreen` 内部加状态：`const [showGoal, setShowGoal] = useState(false);`。`handleStart` 改为：

```tsx
const handleStart = () => {
  if (!gender) return;
  sfx.select();
  setShowGoal(true);  // 先选目标，确认后再开局
};

const handleGoalSelect = (goal: GoalKey | null) => {
  setShowGoal(false);
  const finalName = name.trim() || (gender === 'male' ? '小明' : '小美');
  onStart(gender, finalName, paceMode, typeSpeed, goal);
};
```

组件末尾（快速模拟按钮之后）渲染模态：

```tsx
      {showGoal && (
        <GoalModal onSelect={handleGoalSelect} onCancel={() => setShowGoal(false)} />
      )}
```

`Props.onStart` 签名改 5 参。App.tsx 透传 `onStart={startGame}` 无需改动（签名同步）。

- [ ] **Step 5: 验证**

Run: `npx tsc --noEmit`
Expected: **有 1 处预期报错**——App.tsx `onContinue={continueGame}` 处：TitleScreen 的 `onContinue` prop 仍是 `() => void`，而 useGame 的 `continueGame` 已是 `(slot: number) => void`。这是计划内中间态，Task 4 改 TitleScreen props 后消除。确认没有其他报错即可。

Run: `node --experimental-strip-types --test script/goals.test.ts script/save.test.ts`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/engine/state.ts src/hooks/useGame.ts src/components/GoalModal.tsx src/components/TitleScreen.tsx
git commit -m "[NF]: 人生目标：开局模态选择 + goal 入状态与存档"
```

---

### Task 4: 存档卡片区 + 覆盖确认

**Files:**
- Modify: `src/components/TitleScreen.tsx`
- Create: `src/components/ConfirmModal.tsx`
- Modify: `src/App.tsx`（`onContinue` 传参调整）

**Interfaces:**
- Consumes: `saves`/`activeSlot`/`continueGame(slot)`（Task 2）；`startGame` 5 参（Task 3）
- Produces: `ConfirmModal({ title: string; desc: string; onConfirm: () => void; onCancel: () => void })`

- [ ] **Step 1: 创建 ConfirmModal.tsx**

```tsx
import { sfx } from '../utils/sound';

interface Props {
  title: string;
  desc: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 轻量确认模态（覆盖存档/中途退出共用） */
export default function ConfirmModal({ title, desc, onConfirm, onCancel }: Props) {
  return (
    <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={onCancel}>
      <div className="w-[360px] rounded-2xl border border-white/10 bg-[#15152a] p-6 flex flex-col gap-4
        items-center" onClick={e => e.stopPropagation()}>
        <h3 className="text-[16px] tracking-[4px] text-[#c9a96e]">{title}</h3>
        <p className="text-[12px] text-white/50 leading-relaxed text-center">{desc}</p>
        <div className="flex gap-3 mt-1">
          <button
            onClick={() => { sfx.select(); onCancel(); }}
            className="px-6 py-2 rounded-[30px] text-[12px] tracking-[3px] border font-sans
              border-white/15 text-white/40 hover:border-[#c9a96e]/50 hover:text-[#c9a96e]"
          >
            取消
          </button>
          <button
            onClick={() => { sfx.select(); onConfirm(); }}
            className="px-6 py-2 rounded-[30px] text-[12px] tracking-[3px] border font-sans
              border-[#e85d75]/60 text-[#e85d75] bg-[#e85d75]/10 hover:bg-[#e85d75]/20"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TitleScreen 存档卡片区**

Props 改为：

```tsx
interface Props {
  onStart: (gender: 'male' | 'female', name: string, paceMode: PaceMode, typeSpeed: TypeSpeed, goal: GoalKey | null) => void;
  onAutoStart: (gender: 'male' | 'female', name: string) => void;
  saves: SavesV2;
  onContinue: (slot: number) => void;
}
```

删除「继续人生」旧按钮，替换为存档卡片区（插在节奏选择之前）：

```tsx
      {/* 存档槽位（3 卡片，点击继续） */}
      {saves.slots.some(s => s !== null) && (
        <div className="z-10 flex gap-2.5 animate-[fadeIn_1.7s_ease]">
          {saves.slots.map((s, i) => (
            <button
              key={i}
              onClick={() => { if (s) { sfx.select(); onContinue(i); } }}
              disabled={!s}
              className={`w-[110px] py-2.5 rounded-xl border text-center transition-all duration-200 font-sans
                ${s
                  ? 'border-white/15 bg-white/[0.03] hover:border-[#c9a96e] hover:shadow-[0_0_14px_rgba(201,169,110,0.2)] cursor-pointer'
                  : 'border-white/[0.06] bg-transparent text-white/20'}`}
            >
              {s ? (
                <>
                  <div className="text-[13px] text-[#c9a96e]">{s.game.name}</div>
                  <div className="text-[10px] text-white/40 mt-0.5">{s.game.age} 岁 · {s.game.phase === 'summary' ? '已走完' : s.game.stage === 'infant' ? '婴儿期' : s.game.stage === 'childhood' ? '童年' : s.game.stage === 'teen' ? '少年' : s.game.stage === 'young_adult' ? '青年' : s.game.stage === 'adult' ? '成年' : s.game.stage === 'middle_age' ? '中年' : '老年'}</div>
                </>
              ) : (
                <div className="text-[11px] text-white/25 tracking-[2px]">空槽位</div>
              )}
            </button>
          ))}
        </div>
      )}
```

（阶段中文映射：仅卡片一处使用，直接用内联三元（如上代码）；如实现时发现需要复用再抽常量，不要提前抽象。）

`handleStart` 增加覆盖确认：

```tsx
const [confirmCover, setConfirmCover] = useState(false);

const handleStart = () => {
  if (!gender) return;
  sfx.select();
  if (saves.slots[saves.active]) {
    // 选中槽已有存档 → 确认覆盖
    setConfirmCover(true);
    return;
  }
  setShowGoal(true);
};

const handleCoverConfirm = () => {
  setConfirmCover(false);
  setShowGoal(true);
};
```

组件末尾渲染：

```tsx
      {confirmCover && (
        <ConfirmModal
          title="覆盖存档"
          desc={`槽位 ${saves.active + 1} 已有存档（${saves.slots[saves.active]?.game.name}，${saves.slots[saves.active]?.game.age} 岁）。开始新人生将覆盖它，确定吗？`}
          onConfirm={handleCoverConfirm}
          onCancel={() => setConfirmCover(false)}
        />
      )}
```

- [ ] **Step 3: App.tsx 调整**

`<TitleScreen ... onContinue={continueGame} saves={saves} activeSlot={activeSlot} />`——saves/activeSlot 从 useGame 返回（Task 2 已加）。若 activeSlot 仅 TitleScreen 内部用（高亮选中），可不传；卡片高亮逻辑：点卡片直接 continue（无需高亮中间态）。**决定：不传 activeSlot，卡片只显示内容；「开始人生」覆盖的是 `saves.active`**——但用户点「开始人生」时并不知道覆盖哪个槽。改进：卡片点击 = 继续；「开始人生」永远写入 `saves.active`（默认 0）——不符合「覆盖选中槽」。修正方案：卡片旁加一个小「选择」逻辑——简化：**点卡片 = 继续该槽；点卡片时同时把 active 设为该槽**（CONTINUE_GAME 已设 active）。「开始人生」用 `saves.active`。初始 active=0。这样「选中槽」= 最近继续过的槽或默认 0，覆盖确认的 desc 显示槽号。可接受（无显式选中 UI，行为可预期）。

- [ ] **Step 4: 验证**

Run: `npx tsc --noEmit` → 零报错
Run: `node --experimental-strip-types --test script/goals.test.ts script/save.test.ts` → PASS

- [ ] **Step 5: 提交**

```bash
git add src/components/TitleScreen.tsx src/components/ConfirmModal.tsx src/App.tsx
git commit -m "[NF]: 存档卡片区：3 槽位展示 + 点击继续 + 开始新局覆盖确认"
```

---

### Task 5: 中途退出 + RESET 语义变更

**Files:**
- Modify: `src/hooks/useGame.ts`（RESET 不再清档；新增 EXIT_TO_TITLE 不需要——RESET 语义复用）
- Modify: `src/components/GameScreen.tsx`（右上角 ✕ 退出按钮 + 确认）
- Modify: `src/components/SummaryScreen.tsx`（重新开始文案微调：改为「回到标题」）

**Interfaces:**
- Consumes: `ConfirmModal`（Task 4）；`reset`（useGame）
- Produces: 无新接口

- [ ] **Step 1: useGame RESET 语义变更**

删除 RESET 分支里的 `localStorage.removeItem(SAVE_KEY)`（SAVE_KEY 已不存在，Task 2 删除）与 `removeItem(LEGACY_SAVE_KEY)`——RESET 只回标题，存档保留在槽中：

```ts
case 'RESET':
  return createInitialRuntime();  // 存档保留在槽中（槽位保留结局状态，开新局覆盖）
```

注意 `createInitialRuntime` 返回空 saves——RESET 后 `saves` 会变成空结构，丢失槽位显示！**必须保留 saves**：

```ts
case 'RESET': {
  const rt = createInitialRuntime();
  return { ...rt, saves: state.saves };  // 保留槽位（含各局结局状态）
}
```

- [ ] **Step 2: GameScreen 中途退出按钮**

GameScreen 根 div 加（速度按钮组旁，右上角）：

```tsx
      {/* 中途退出：回标题（存档保留在槽中） */}
      <button
        onClick={() => setShowExit(true)}
        title="退出本局"
        className="absolute top-2 right-2 z-20 w-8 h-8 rounded-full border border-white/15 text-white/40
          hover:border-[#e85d75] hover:text-[#e85d75] transition-all duration-200 font-sans text-[13px]"
      >
        ✕
      </button>
```

GameScreen 内部状态：`const [showExit, setShowExit] = useState(false);`，组件末尾渲染：

```tsx
      {showExit && (
        <ConfirmModal
          title="放弃本局"
          desc="将回到标题页，本局进度会保留在存档槽中。确定放弃吗？"
          onConfirm={() => { setShowExit(false); onExit(); }}
          onCancel={() => setShowExit(false)}
        />
      )}
```

GameScreen props 加 `onExit: () => void`；App.tsx 传 `onExit={reset}`。

- [ ] **Step 3: SummaryScreen 文案**

「重新开始」按钮文案改为「回到标题」（语义：回标题保留存档，开新局覆盖）。

- [ ] **Step 4: 验证**

Run: `npx tsc --noEmit` → 零报错

- [ ] **Step 5: 提交**

```bash
git add src/hooks/useGame.ts src/components/GameScreen.tsx src/components/SummaryScreen.tsx src/App.tsx
git commit -m "[NF]: 中途退出按钮 + RESET 保留槽位存档"
```

---

### Task 6: 成就系统集成

**Files:**
- Modify: `src/hooks/useGame.ts`（成就存储 + 结算判定）
- Modify: `src/components/SummaryScreen.tsx`（新解锁提示 + 成就面板）
- Create: `src/components/AchievementsModal.tsx`
- Modify: `src/components/TitleScreen.tsx`（🏆 入口）

**Interfaces:**
- Consumes: `checkAchievements`、`ACHIEVEMENTS`（Task 1）；`wasLite`/`wasAuto` 可用 `rt.paceMode`/`rt.autoPlay`
- Produces: `achievements: { unlocked: AchievementId[]; completedLives: number }`（useGame 返回）；`newAchievements: AchievementId[]`

- [ ] **Step 1: useGame 成就存储与判定**

常量与工具（useGame.ts 顶部）：

```ts
/** 成就存储 key（跨周目） */
const ACHIEVEMENTS_KEY = 'life-sim-achievements';

/** 成就存储结构 */
interface AchievementStore {
  unlocked: AchievementId[];
  completedLives: number;
}

function loadAchievements(): AchievementStore {
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_KEY);
    if (raw) {
      const data = JSON.parse(raw) as AchievementStore;
      if (data && Array.isArray(data.unlocked) && typeof data.completedLives === 'number') {
        return data;
      }
    }
  } catch {
    // 忽略损坏数据
  }
  return { unlocked: [], completedLives: 0 };
}

function saveAchievements(store: AchievementStore): void {
  try {
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(store));
  } catch {
    // 存储不可用静默降级
  }
}
```

RuntimeState 加：`achievements: AchievementStore;`、`newAchievements: AchievementId[];`

新增 action：

```ts
| { type: 'UNLOCK_ACHIEVEMENTS'; newIds: AchievementId[] }
```

reducer：

```ts
case 'UNLOCK_ACHIEVEMENTS': {
  const store = { ...state.achievements, unlocked: [...new Set([...state.achievements.unlocked, ...action.newIds])] };
  return { ...state, achievements: store, newAchievements: action.newIds };
}
```

结算判定 effect（useGame 内，phase 变 summary 时执行一次）：

```ts
// 进入结算页：判定并解锁新成就（幂等：已解锁的不重复记录）
useEffect(() => {
  if (rt.game.phase !== 'summary' || rt.saves.active === undefined) {
    return;
  }
  const ids = checkAchievements({
    game: rt.game,
    completedLives: rt.achievements.completedLives + 1,
    wasLite: rt.paceMode === 'lite',
    wasAuto: rt.autoPlay,
  });
  const fresh = ids.filter(id => !rt.achievements.unlocked.includes(id));
  if (fresh.length > 0) {
    const store = {
      unlocked: [...new Set([...rt.achievements.unlocked, ...fresh])],
      completedLives: rt.achievements.completedLives + 1,
    };
    saveAchievements(store);
    dispatch({ type: 'UNLOCK_ACHIEVEMENTS', newIds: fresh });
    // 同步保存到成就存储（UNLOCK_ACHIEVEMENTS 不写 localStorage，这里已写）
  } else {
    // 无新成就也更新局数
    const store = { ...rt.achievements, completedLives: rt.achievements.completedLives + 1 };
    saveAchievements(store);
    dispatch({ type: 'UNLOCK_ACHIEVEMENTS', newIds: [] });
  }
  // eslint 不需要；依赖 rt 但用 guard 防重复
}, [rt.game.phase === 'summary']);
```

**注意**：该 effect 依赖 `rt.game.phase === 'summary'`（布尔）——进入 summary 时触发一次，summary 内状态变化不重跑（不会重复计数）。完成局数计数：`completedLives` 只在 summary 入口 +1。**边界**：读档恢复到 summary 存档 → effect 也触发（+1）→ 重复计数！修复：`rt.saves.active` 变化检测或标记「本局已结算」：在 `MAKE_CHOICE` 进入 summary 时计数（而不是 effect）——更精确。改为：MAKE_CHOICE 分支中 `gameOver` 时（phase 变 summary）执行成就判定。MAKE_CHOICE 是纯 reducer——不能写 localStorage。折中：reducer 只算 `fresh`（判定），useEffect 写存储——用 `rt.newAchievements` 为空数组 + 一个 `counted` 标记。**简化方案**：reducer 里当 gameOver 时计算 `newAchievements`（判定纯函数）存入 rt；useEffect 监听 `rt.newAchievements !== null` 且未处理 → 合并存储 + 清标记。用一个 `achievementPending` 标志避免重复计数：

```ts
// RuntimeState 加：achievementPending: boolean（进入结算但未写入存储）
// MAKE_CHOICE 分支 gameOver 时：
const newIds = checkAchievements({ game, completedLives: state.achievements.completedLives + 1, wasLite: state.paceMode === 'lite', wasAuto: state.autoPlay })
  .filter(id => !state.achievements.unlocked.includes(id));
// 返回值加：achievementPending: true, pendingNewIds: newIds, pendingLives: state.achievements.completedLives + 1

// useGame effect：
useEffect(() => {
  if (!rt.achievementPending) return;
  const store = {
    unlocked: [...new Set([...rt.achievements.unlocked, ...rt.pendingNewIds])],
    completedLives: rt.pendingLives,
  };
  saveAchievements(store);
  dispatch({ type: 'ACHIEVEMENTS_PERSISTED' });
}, [rt.achievementPending]);
```

这个设计把副作用控制在 effect 一次。**落地要点（按此实现，采用 pending 标志方案，弃用前面的 effect 版）**：

1. RuntimeState 加：`achievementPending: boolean; pendingNewIds: AchievementId[]; pendingLives: number;`
2. `MAKE_CHOICE` 分支的 `gameOver` 为 true 时，在返回对象里设置：

```ts
      const newIds = checkAchievements({
        game,
        completedLives: state.achievements.completedLives + 1,
        wasLite: state.paceMode === 'lite',
        wasAuto: state.autoPlay,
      }).filter(id => !state.achievements.unlocked.includes(id));
      // 返回值加：
      achievementPending: true,
      pendingNewIds: newIds,
      pendingLives: state.achievements.completedLives + 1,
```

3. Action 加 `{ type: 'ACHIEVEMENTS_PERSISTED' }`；reducer 分支：

```ts
    case 'ACHIEVEMENTS_PERSISTED': {
      return { ...state, achievementPending: false, pendingNewIds: [], pendingLives: 0 };
    }
```

4. useGame 内 effect（写存储 + 清标志）：

```ts
  // 结算成就持久化（pending 标志只由 MAKE_CHOICE 的 gameOver 置位，读档恢复到 summary 不会触发）
  useEffect(() => {
    if (!rt.achievementPending) {
      return;
    }
    saveAchievements({
      unlocked: [...new Set([...rt.achievements.unlocked, ...rt.pendingNewIds])],
      completedLives: rt.pendingLives,
    });
    dispatch({ type: 'ACHIEVEMENTS_PERSISTED' });
  }, [rt.achievementPending]);
```

5. `UNLOCK_ACHIEVEMENTS` action 不再需要——新解锁列表直接存 `pendingNewIds`，`newAchievements` 从 `rt.pendingNewIds` 暴露给 SummaryScreen。`createInitialRuntime` 初始：`achievements: { unlocked: [], completedLives: 0 }, achievementPending: false, pendingNewIds: [], pendingLives: 0`；`ACHIEVEMENTS_KEY`/`loadAchievements`/`saveAchievements`/`AchievementStore` 按上文实现。

**计数语义**：只统计「MAKE_CHOICE 推进到结算」的局；快速模拟同样走 MAKE_CHOICE → 计数 ✓（auto_clear 依赖 wasAuto）；读档恢复到 summary 不经过 MAKE_CHOICE → 不重复计数 ✓；HYDRATE_SAVES 时把 achievements 一并从 localStorage 载入（`rt.achievements` 初始从 `loadAchievements()` 读，在 HYDRATE effect 里合并）。

- [ ] **Step 2: SummaryScreen 成就展示**

Props 改为 `{ game, onRestart, newAchievements }`（`newAchievements: AchievementId[]` 由 App 从 useGame 的返回值传入，**不进 GameState**）。结算页时间线之后加：

```tsx
      {/* 新解锁成就 */}
      {newAchievements.length > 0 && (
        <div className="w-full max-w-[580px] animate-[fadeIn_1.6s_ease]">
          <h3 className="text-[13px] tracking-[4px] text-[#c9a96e] mb-2.5 font-normal">🏆 新解锁成就</h3>
          <div className="flex flex-wrap gap-2">
            {newAchievements.map(id => {
              const a = ACHIEVEMENTS.find(x => x.id === id)!;
              return (
                <div key={id} className="px-3.5 py-2 rounded-lg bg-[#c9a96e]/10 border border-[#c9a96e]/30 text-[12px] text-[#c9a96e]">
                  {a.icon} {a.name}
                </div>
              );
            })}
          </div>
        </div>
      )}
```

import：`import { ACHIEVEMENTS } from '../engine/achievements';`、`import type { AchievementId } from '../types';`。

- [ ] **Step 3: 创建 AchievementsModal.tsx**

```tsx
import { ACHIEVEMENTS } from '../engine/achievements';
import type { AchievementId } from '../types';

interface Props {
  unlocked: AchievementId[];
  onClose: () => void;
}

/** 成就总览模态（标题页入口） */
export default function AchievementsModal({ unlocked, onClose }: Props) {
  const done = unlocked.length;
  return (
    <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div className="w-[480px] max-h-[520px] overflow-y-auto rounded-2xl border border-white/10 bg-[#15152a] p-6 flex flex-col gap-3.5" onClick={e => e.stopPropagation()}>
        <h3 className="text-center text-[18px] tracking-[6px] text-[#c9a96e]">成就 · {done}/{ACHIEVEMENTS.length}</h3>
        {ACHIEVEMENTS.map(a => {
          const got = unlocked.includes(a.id);
          return (
            <div key={a.id} className={`flex items-start gap-3 p-3 rounded-lg border ${got ? 'border-[#c9a96e]/25 bg-[#c9a96e]/5' : 'border-white/[0.06] bg-white/[0.02] opacity-50'}`}>
              <span className="text-[16px] leading-none mt-0.5">{got ? a.icon : '🔒'}</span>
              <div>
                <div className={`text-[13px] ${got ? 'text-[#c9a96e]' : 'text-white/50'}`}>{a.name}</div>
                <div className="text-[11px] text-white/35 mt-0.5 leading-relaxed">{a.desc}</div>
              </div>
            </div>
          );
        })}
        <button
          onClick={onClose}
          className="px-8 py-2.5 rounded-[30px] text-[13px] tracking-[3px] border font-sans mx-auto
            border-white/15 text-white/40 hover:border-[#c9a96e]/50 hover:text-[#c9a96e]"
        >
          关闭
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: TitleScreen 成就入口**

「⚡ 快速模拟」按钮下方加：

```tsx
      {/* 成就入口 */}
      <button
        onClick={() => { sfx.select(); setShowAchievements(true); }}
        className="text-[12px] text-white/30 tracking-[3px] hover:text-[#c9a96e] transition-colors duration-200 font-sans"
      >
        🏆 成就
      </button>
```

内部状态 `const [showAchievements, setShowAchievements] = useState(false);`，渲染：

```tsx
      {showAchievements && (
        <AchievementsModal unlocked={achievements.unlocked} onClose={() => setShowAchievements(false)} />
      )}
```

Props 加 `achievements: { unlocked: AchievementId[]; completedLives: number }`（App 传 `achievements`）。

- [ ] **Step 5: App.tsx 接线**

useGame 解构加 `achievements`、`newAchievements`；SummaryScreen 传 `newAchievements={newAchievements}`；TitleScreen 传 `achievements={achievements}`。

- [ ] **Step 6: 验证**

Run: `npx tsc --noEmit` → 零报错
Run: `node --experimental-strip-types --test script/goals.test.ts script/save.test.ts` → PASS

- [ ] **Step 7: 提交**

```bash
git add src/hooks/useGame.ts src/components/SummaryScreen.tsx src/components/AchievementsModal.tsx src/components/TitleScreen.tsx src/App.tsx
git commit -m "[NF]: 成就系统：结算解锁 + 面板展示 + 标题页入口"
```

---

### Task 7: 数据债（adult_100 归类 + 0-2 岁补事件）

**Files:**
- Modify: `script/chiled.json`（adult_100 → adult_0100；新增 infant_0001/0002/0003）
- Regenerate: `src/engine/events.json`（npm run build:events）
- Run: `node script/clamp-effects.mjs`（若新增事件效果值超范围）

**Interfaces:**
- Consumes: 现有管线（convert-events.mjs）
- Produces: 更新后的 events.json

- [ ] **Step 1: chiled.json 改 id**

`adult_100` 条目的 `"id": "adult_100"` 改为 `"id": "adult_0100"`（归为 4 位模拟事件，与不在 keep-list 的事实一致）。

- [ ] **Step 2: chiled.json 新增 3 个 0-2 岁模拟事件**

在数组末尾（或 adult 事件附近）追加（snake_case 格式，效果值 ±3~±20）：

```json
{
  "id": "infant_0001",
  "age_range": [1, 2],
  "category": "family",
  "title": "第一次叫妈妈",
  "text": "你躺在摇篮里，妈妈的脸凑过来，一遍遍教你发音。终于，一个含混却清晰的音节从你嘴里蹦出来。妈妈愣住了，眼眶一下子红了，把你紧紧搂进怀里。整个家都因为这个字热闹了起来。",
  "choices": [
    { "text": "扯着嗓子又喊了几声，妈妈笑得眼泪都出来了", "effects": { "happiness": 10, "social": 6 } },
    { "text": "喊完就转过头玩手指，好像什么都没发生过", "effects": { "happiness": 5, "intelligence": 3 } }
  ],
  "conditions": {}
},
{
  "id": "infant_0002",
  "age_range": [2, 3],
  "category": "health",
  "title": "蹒跚学步",
  "text": "你扶着沙发站起来，小短腿颤颤巍巍。爸爸蹲在不远处张开双臂，鼓励你迈出第一步。你松开手，摇摇晃晃地走了两步，摔了个屁股蹲。全家人的心都提到了嗓子眼，然后一起笑出声来。",
  "choices": [
    { "text": "爬起来拍拍手，继续朝爸爸走去，一次比一次稳", "effects": { "health": 10, "happiness": 8 } },
    { "text": "摔疼了，坐在地上哇哇大哭，要妈妈抱", "effects": { "happiness": -4, "appearance": 2 } }
  ],
  "conditions": {}
},
{
  "id": "infant_0003",
  "age_range": [2, 3],
  "category": "personality",
  "title": "第一次发脾气",
  "text": "晚饭前你非要吃饼干，妈妈说不可以。你小脸涨得通红，把积木推得满地都是，哭得惊天动地。奶奶想哄，妈妈拦住了：「规矩得从小立。」你哭累了，抽抽搭搭地坐下来，终于接受了这顿饭前没有饼干的事实。",
  "choices": [
    { "text": "抽噎着把积木捡起来，轻轻放回盒子里", "effects": { "morality": 8, "happiness": 3 } },
    { "text": "趁大人不注意，偷偷伸手去够饼干盒", "effects": { "luck": -5, "morality": -6 } }
  ],
  "conditions": {}
}
```

- [ ] **Step 3: 重新生成与钳位**

Run: `node script/clamp-effects.mjs`（钳位新模拟事件效果值）
Run: `npm run build:events`（重新生成 events.json）
Run: `node --test "script/*.test.mjs"` → 19 个数据工具测试全过（含密度校验——0-2 岁密度 0:1 / 1:2 / 2:2 均在 1-3 范围内）

- [ ] **Step 4: 引擎测试回归**

Run: `node --experimental-strip-types --test script/engine-state.test.ts script/pace-mode.test.ts script/goals.test.ts script/save.test.ts`
Expected: 全过（注意：新增事件后 lite 密度测试的「0-2 岁全保留」仍成立；总量下限 ≥150 仍成立——若数据变化导致测试挂，**先跑测试再决定**，勿盲改测试）

- [ ] **Step 5: 提交**

```bash
git add script/chiled.json src/engine/events.json
git commit -m "[NF]: 数据补强：adult_100 归为模拟事件 + 0-2 岁新增 3 事件"
```

---

### Task 8: 端到端验证

**Files:**
- 无代码改动（验证任务）

- [ ] **Step 1: 全部测试**

Run: `node --test "script/*.test.mjs"`（数据工具）
Run: `node --experimental-strip-types --test script/engine-state.test.ts script/pace-mode.test.ts script/goals.test.ts script/save.test.ts`（引擎）
Expected: 全过

- [ ] **Step 2: 生产构建**

Run: `npm run build`
Expected: 构建成功

- [ ] **Step 3: 浏览器端到端（dev server + playwright）**

1. 标题页：3 槽卡片区（首次启动全空）、🏆 成就入口
2. 旧存档迁移：预置 `life-sim-save-v1` → 刷新 → 槽 0 显示旧局（名字/年龄），v1 key 被删
3. 开始人生 → GoalModal 选择目标 → 进入游戏；存档含 goal 字段
4. 中途退出：✕ → 确认 → 回标题；槽位卡片显示本局进度
5. 覆盖确认：已有存档槽点开始人生 → 弹确认 → 确定后进目标模态
6. 结算页：目标达成度（达成 ✅ / 未达成差距）+ 新解锁成就 + 成就面板
7. 标题页成就入口：已解锁/未解锁展示、进度计数
8. 720px 视口标题页不溢出（卡片区 + 成就入口 + 原 9 元素）
9. 快速模拟正常（结算计数 +1，auto_clear 成就解锁）
10. 多周目：完成第 2 局 → 三局人生成就进度（completedLives=2 未解锁；第 3 局解锁）

- [ ] **Step 4: 收尾检查**

```bash
git status
git log --oneline -12
```
