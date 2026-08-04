# 节奏档位实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增两个独立节奏维度：事件密度档（沉浸/精简，开局选定）与打字机速度档（慢/中/快，游戏内可切），让玩家按喜好控制单局时长。

**Architecture:** 引擎新增纯函数 `filterEvents`（确定性抽样：主线优先 + seed 抽模拟补足密度 + flag 闭包跨岁回溯），调用链为 `shuffleEvents(filterEvents(EVENTS, mode, seed), seed)`，过滤与洗牌共用种子保证读档确定性重建。档位字段进入 `RuntimeState`/`SaveData`（旧存档兜底 full/normal），打字速度通过新 action `SET_TYPE_SPEED` 游戏内切换（不碰事件数组，零风险）。

**Tech Stack:** TypeScript、React 18（useReducer）、Node 22 test runner（`--experimental-strip-types`）。

## Global Constraints

- 所有注释中文、日志英文（script 脚本 console 输出用中文 ✅ 符号）
- 不改 `src/engine/events.json` 生成文件与 2 位 id 原始事件内容（运行时过滤不改数据）
- 过滤与洗牌共用同一 seed；同 seed 同结果（读档确定性重建）
- 旧存档无 `paceMode`/`typeSpeed` 字段 → 兜底 `'full'` + `'normal'`
- 快速模拟（⚡）保持全量事件 + `instant` 跳过打字，不受档位影响
- 提交信息：中文 subject + 前缀（[NF]/[BF]/[CU]/[IM]），body 用 `- ` 列表，禁止 AI 署名尾注
- 类型检查命令：`npx tsc --noEmit`
- 引擎测试命令：`node --experimental-strip-types --test script/pace-mode.test.ts`（单文件）/ 全量：`node --experimental-strip-types --test script/engine-state.test.ts script/pace-mode.test.ts`

---

### Task 1: 档位类型与打字速度常量

**Files:**
- Modify: `src/types/index.ts`（文件末尾追加两个类型）
- Modify: `src/engine/state.ts`（文件末尾追加常量，头部 import 加 `TypeSpeed`）
- Create: `script/pace-mode.test.ts`

**Interfaces:**
- Produces: `PaceMode`、`TypeSpeed`（types/index.ts）；`TYPE_SPEED_RANGES: Record<TypeSpeed, [number, number]>`（state.ts）

- [ ] **Step 1: 写失败测试（创建测试文件）**

`script/pace-mode.test.ts`：

```ts
/**
 * 节奏档位测试（打字速度常量 + filterEvents 抽样引擎）。
 *
 * 运行：node --experimental-strip-types --test script/pace-mode.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { TYPE_SPEED_RANGES } from '../src/engine/state.ts';

test('TYPE_SPEED_RANGES：三档齐全且范围合法', () => {
  assert.deepStrictEqual(Object.keys(TYPE_SPEED_RANGES), ['slow', 'normal', 'fast']);
  for (const [min, max] of Object.values(TYPE_SPEED_RANGES)) {
    assert.ok(min >= 0 && min <= max, `范围非法: ${min}-${max}`);
  }
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --experimental-strip-types --test script/pace-mode.test.ts`
Expected: FAIL（`Cannot find module` 或 `TYPE_SPEED_RANGES is not defined`）

- [ ] **Step 3: 实现类型与常量**

`src/types/index.ts` 文件末尾追加：

```ts
/** 节奏档位：事件密度（沉浸全量 / 精简抽样） */
export type PaceMode = 'full' | 'lite';

/** 打字机速度档 */
export type TypeSpeed = 'slow' | 'normal' | 'fast';
```

`src/engine/state.ts` 头部 import 改为：

```ts
import type { Attributes, AttributeKey, AttributeMeta, GameState, LifeStage, StageMeta, TypeSpeed } from '../types/index.ts';
```

`src/engine/state.ts` 文件末尾追加：

```ts
/** 打字机速度档 → 每字符间隔毫秒范围 */
export const TYPE_SPEED_RANGES: Record<TypeSpeed, [number, number]> = {
  slow: [50, 70],
  normal: [25, 45],
  fast: [8, 15],
};
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --experimental-strip-types --test script/pace-mode.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/types/index.ts src/engine/state.ts script/pace-mode.test.ts
git commit -m "[NF]: 节奏档位：PaceMode/TypeSpeed 类型与打字速度范围常量"
```

---

### Task 2: filterEvents 引擎函数（确定性抽样）

**Files:**
- Modify: `src/engine/events.ts`（`shuffleEvents` 函数后追加）
- Modify: `script/pace-mode.test.ts`（追加测试，头部 import 调整）

**Interfaces:**
- Consumes: `PaceMode`（Task 1，types/index.ts）；`mulberry32`（events.ts 已有）
- Produces: `isMainlineEvent(id: string): boolean`；`filterEvents(events: LifeEvent[], mode: PaceMode, seed: number): LifeEvent[]`（Task 3 使用）

- [ ] **Step 1: 写失败测试（追加到 script/pace-mode.test.ts）**

头部 import 改为：

```ts
import { test } from 'node:test';
import assert from 'node:assert';
import { TYPE_SPEED_RANGES } from '../src/engine/state.ts';
import EVENTS, { filterEvents, isMainlineEvent } from '../src/engine/events.ts';
import type { LifeEvent } from '../src/types/index.ts';
```

文件末尾追加：

```ts
test('isMainlineEvent：2 位数字后缀为主线', () => {
  assert.strictEqual(isMainlineEvent('child_01'), true);
  assert.strictEqual(isMainlineEvent('child_0017'), false);
});

test('filterEvents：full 模式返回原数组', () => {
  assert.strictEqual(filterEvents(EVENTS, 'full', 123), EVENTS);
});

test('filterEvents：lite 确定性（同 seed 同结果）', () => {
  const a = filterEvents(EVENTS, 'lite', 42);
  const b = filterEvents(EVENTS, 'lite', 42);
  assert.deepStrictEqual(a, b);
});

test('filterEvents：lite 每岁密度接近目标上限（闭包允许小幅突破）', () => {
  const lite = filterEvents(EVENTS, 'lite', 7);
  const byAge = new Map<number, number>();
  for (const e of lite) {
    byAge.set(e.age, (byAge.get(e.age) ?? 0) + 1);
  }
  for (const [age, n] of byAge) {
    // 目标：0-2 全保留；3-12 岁 3 个；13+ 岁 2 个。flag 闭包补回产出者允许 +2 溢出
    const cap = age <= 2 ? Infinity : (age <= 12 ? 3 : 2) + 2;
    assert.ok(n <= cap, `${age} 岁 ${n} 个超过上限 ${cap}`);
  }
});

test('filterEvents：lite 0-2 岁事件全保留', () => {
  const lite = filterEvents(EVENTS, 'lite', 7);
  for (const e of EVENTS) {
    if (e.age <= 2) {
      assert.ok(lite.includes(e), `${e.id} 应保留`);
    }
  }
});

test('filterEvents：lite flag 闭包（消费事件的产出者在子集内）', () => {
  const lite = filterEvents(EVENTS, 'lite', 7);
  const producers = new Map<string, LifeEvent[]>();
  for (const e of EVENTS) {
    for (const c of e.choices) {
      for (const f of c.outcomes?.flags ?? []) {
        const list = producers.get(f) ?? [];
        list.push(e);
        producers.set(f, list);
      }
    }
  }
  const ids = new Set(lite.map(e => e.id));
  for (const e of lite) {
    for (const f of e.conditions?.hasFlags ?? []) {
      const ps = (producers.get(f) ?? []).filter(p => p !== e);
      assert.ok(ps.some(p => ids.has(p.id)), `${e.id} 需要的 flag ${f} 无产出者在子集内`);
    }
  }
});

test('filterEvents：lite 总量约 200（抽样正常）', () => {
  const lite = filterEvents(EVENTS, 'lite', 7);
  assert.ok(lite.length < EVENTS.length, 'lite 应少于全量');
  assert.ok(lite.length >= 100, `lite 过少: ${lite.length}`);
});

test('filterEvents：不同 seed 结果不同（重玩性）', () => {
  const a = filterEvents(EVENTS, 'lite', 1).map(e => e.id).join(',');
  const b = filterEvents(EVENTS, 'lite', 2).map(e => e.id).join(',');
  assert.notStrictEqual(a, b);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --experimental-strip-types --test script/pace-mode.test.ts`
Expected: FAIL（`filterEvents is not a function`）

- [ ] **Step 3: 实现 filterEvents**

`src/engine/events.ts` 的 `shuffleEvents` 函数后追加：

```ts
/** 主线事件：2 位数字后缀 id（如 child_01），模拟事件为 4 位（如 child_0017） */
export function isMainlineEvent(id: string): boolean {
  return /_\d{2}$/.test(id);
}

/**
 * 精简模式每岁目标密度：0-2 岁全保留；3-12 岁 3 个；13 岁以上 2 个。
 */
function liteTarget(age: number): number {
  if (age <= 2) {
    return Infinity;
  }
  if (age <= 12) {
    return 3;
  }
  return 2;
}

/**
 * 从数组中按种子抽取 k 个（保持原顺序），k <= 0 或空数组返回空。
 */
function pickShuffled<T>(arr: T[], k: number, rng: () => number): T[] {
  const n = Math.min(k, arr.length);
  if (n <= 0) {
    return [];
  }
  const idx = new Set<number>();
  while (idx.size < n) {
    idx.add(Math.floor(rng() * arr.length));
  }
  return [...idx].sort((a, b) => a - b).map(i => arr[i]);
}

/**
 * 按档位过滤事件（纯函数，确定性）。
 * full 返回原数组；lite 每岁主线优先 + seed 抽模拟补足目标密度，
 * 再跨岁迭代补齐 flag 闭包（消费事件的产出者必须在子集内）。
 *
 * @param events 全量事件数组
 * @param mode 节奏档位
 * @param seed 抽样种子（与 shuffleEvents 共用，保证读档可重建）
 * @returns 过滤后的新数组
 */
export function filterEvents(events: LifeEvent[], mode: PaceMode, seed: number): LifeEvent[] {
  if (mode === 'full') {
    return events;
  }
  const rng = mulberry32(seed);
  const byAge = new Map<number, LifeEvent[]>();
  for (const e of events) {
    const list = byAge.get(e.age) ?? [];
    list.push(e);
    byAge.set(e.age, list);
  }

  // 1. 每岁：主线优先 + 模拟事件按种子抽样补足目标密度
  const selected = new Set<LifeEvent>();
  for (const age of [...byAge.keys()].sort((a, b) => a - b)) {
    const group = byAge.get(age)!;
    const target = liteTarget(age);
    const mainline = group.filter(e => isMainlineEvent(e.id));
    const sims = group.filter(e => !isMainlineEvent(e.id));
    const keptMain = mainline.length <= target ? mainline : pickShuffled(mainline, target, rng);
    const keptSim = pickShuffled(sims, target - keptMain.length, rng);
    for (const e of [...keptMain, ...keptSim]) {
      selected.add(e);
    }
  }

  // 2. flag 闭包：消费事件的产出者必须也在子集内（跨岁回溯，产出者列表按岁升序）
  const producers = new Map<string, LifeEvent[]>();
  for (const e of events) {
    const flags = e.choices.flatMap(c => c.outcomes?.flags ?? []);
    for (const f of flags) {
      const list = producers.get(f) ?? [];
      list.push(e);
      producers.set(f, list);
    }
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of [...selected]) {
      for (const f of e.conditions?.hasFlags ?? []) {
        const candidates = (producers.get(f) ?? []).filter(p => p !== e);
        if (candidates.length > 0 && !candidates.some(p => selected.has(p))) {
          selected.add(candidates[0]);
          changed = true;
        }
      }
    }
  }

  return events.filter(e => selected.has(e));
}
```

`src/engine/events.ts` 头部 import 改为：

```ts
import type { LifeEvent, PaceMode } from '../types';
```

- [ ] **Step 4: 运行测试确认通过（含既有引擎测试回归）**

Run: `node --experimental-strip-types --test script/pace-mode.test.ts`
Expected: PASS（11 个测试）

Run: `node --experimental-strip-types --test script/engine-state.test.ts`
Expected: PASS（18 个测试，确认没破坏 state 引擎）

- [ ] **Step 5: 提交**

```bash
git add src/engine/events.ts script/pace-mode.test.ts
git commit -m "[NF]: 节奏档位：filterEvents 确定性抽样引擎（主线优先 + flag 闭包）"
```

---

### Task 3: useGame 接入档位（状态/存档/action）

**Files:**
- Modify: `src/hooks/useGame.ts`

**Interfaces:**
- Consumes: `filterEvents`、`EVENTS`（Task 2）；`PaceMode`、`TypeSpeed`（Task 1）
- Produces: `startGame(gender, name, paceMode, typeSpeed)`；`setTypeSpeed(typeSpeed)`；`typeSpeed`（App/TitleScreen/GameScreen 使用）

- [ ] **Step 1: 改 import 与 Action 类型**

`src/hooks/useGame.ts` 头部 import 改为：

```ts
import type { AttributeKey, Attributes, Choice, DeathCause, GameState, LifeEvent, PaceMode, TypeSpeed } from '../types';
import EVENTS, { filterEvents, shuffleEvents } from '../engine/events';
```

Action 联合类型改为：

```ts
type Action =
  | { type: 'START_GAME'; gender: 'male' | 'female'; name: string; paceMode: PaceMode; typeSpeed: TypeSpeed }
  | { type: 'START_AUTO_GAME'; gender: 'male' | 'female'; name: string }
  | { type: 'MAKE_CHOICE'; choice: Choice; eventId: string }
  | { type: 'CONTINUE' }
  | { type: 'SET_TYPE_SPEED'; typeSpeed: TypeSpeed }
  | { type: 'RESET' }
  | { type: 'CONTINUE_GAME' };
```

- [ ] **Step 2: 改 RuntimeState 与 SaveData**

```ts
interface RuntimeState {
  game: GameState;
  currentEvent: LifeEvent | null;
  feedback: string | null;
  eventIndex: number;
  /** 本局事件顺序（同岁组内按种子洗牌，重开一局顺序不同） */
  shuffledEvents: LifeEvent[];
  /** 洗牌种子（存档恢复时还原顺序） */
  shuffleSeed: number;
  /** 快速模拟模式：自动随机选择快速走完一生 */
  autoPlay: boolean;
  /** 本局密度档位（开局选定，中途不可切） */
  paceMode: PaceMode;
  /** 打字机速度档（游戏内可随时切换） */
  typeSpeed: TypeSpeed;
}
```

`SaveData` 接口加两个可选字段（旧存档无 → 兜底）：

```ts
interface SaveData {
  game: GameState;
  currentEventId: string | null;
  feedback: string | null;
  eventIndex: number;
  shuffleSeed: number;
  paceMode?: PaceMode;
  typeSpeed?: TypeSpeed;
}
```

- [ ] **Step 3: 改 saveState 与 createInitialRuntime**

`saveState` 的 data 对象加：

```ts
  const data: SaveData = {
    game: rt.game,
    currentEventId: rt.currentEvent?.id ?? null,
    feedback: rt.feedback,
    eventIndex: rt.eventIndex,
    shuffleSeed: rt.shuffleSeed,
    paceMode: rt.paceMode,
    typeSpeed: rt.typeSpeed,
  };
```

`createInitialRuntime` 返回对象加：

```ts
    shuffleSeed: 0,
    autoPlay: false,
    paceMode: 'full',
    typeSpeed: 'normal',
  };
```

- [ ] **Step 4: 改 reducer 各分支**

`START_GAME` 分支（`shuffleEvents(EVENTS, shuffleSeed)` 改为先过滤再洗牌，返回值加两字段）：

```ts
    case 'START_GAME':
    case 'START_AUTO_GAME': {
      const game = createInitialState(action.gender, action.name);
      // 新一局：随机种子洗牌，同岁组顺序每局不同（重玩性）
      const shuffleSeed = Math.floor(Math.random() * 2 ** 31);
      // 快速模拟固定全量事件；手动模式按所选密度档过滤
      const paceMode = action.type === 'START_AUTO_GAME' ? 'full' : action.paceMode;
      const shuffledEvents = shuffleEvents(filterEvents(EVENTS, paceMode, shuffleSeed), shuffleSeed);
      const first = shuffledEvents.find(e => checkConditions(e, game)) ?? null;
      if (first) {
        game.age = first.age;
        game.stage = getStageForAge(first.age);
        game.stageIdx = STAGE_ORDER.indexOf(game.stage);
      }
      return {
        game,
        currentEvent: first,
        feedback: null,
        eventIndex: first ? shuffledEvents.indexOf(first) : 0,
        shuffledEvents,
        shuffleSeed,
        autoPlay: action.type === 'START_AUTO_GAME',
        paceMode,
        typeSpeed: action.type === 'START_AUTO_GAME' ? 'normal' : action.typeSpeed,
      };
    }
```

`SET_TYPE_SPEED` 新分支（插在 `CONTINUE` 之后）：

```ts
    case 'SET_TYPE_SPEED': {
      return { ...state, typeSpeed: action.typeSpeed };
    }
```

`CONTINUE_GAME` 分支：存档兜底 + 按档位重建数组：

```ts
    case 'CONTINUE_GAME': {
      // 从存档恢复：标题页 → 存档中的游戏现场
      const saved = loadSave();
      if (!saved) {
        return state;
      }
      // 旧版存档无档位字段，显式兜底兼容
      const paceMode = saved.paceMode ?? 'full';
      const typeSpeed = saved.typeSpeed ?? 'normal';
      // 按存档种子还原本局事件顺序（旧版存档无种子则用默认顺序）
      const shuffleSeed = typeof saved.shuffleSeed === 'number' ? saved.shuffleSeed : 0;
      const shuffledEvents = shuffleEvents(filterEvents(EVENTS, paceMode, shuffleSeed), shuffleSeed);
      const currentEvent = saved.currentEventId
        ? shuffledEvents.find(e => e.id === saved.currentEventId) ?? null
        : null;
      return {
        // 旧版存档无 deathCause 字段，显式兜底兼容；恢复为手动模式
        game: { ...saved.game, deathCause: saved.game.deathCause ?? null },
        currentEvent,
        feedback: saved.feedback,
        eventIndex: saved.eventIndex,
        shuffleSeed,
        shuffledEvents,
        autoPlay: false,
        paceMode,
        typeSpeed,
      };
    }
```

- [ ] **Step 5: 改 useGame 回调与返回值**

```ts
  const startGame = useCallback((gender: 'male' | 'female', name: string, paceMode: PaceMode, typeSpeed: TypeSpeed) => {
    dispatch({ type: 'START_GAME', gender, name, paceMode, typeSpeed });
  }, []);

  const setTypeSpeed = useCallback((typeSpeed: TypeSpeed) => {
    dispatch({ type: 'SET_TYPE_SPEED', typeSpeed });
  }, []);
```

返回值加：

```ts
  return {
    game: rt.game,
    currentEvent: rt.currentEvent,
    feedback: rt.feedback,
    hasSave,
    autoPlay: rt.autoPlay,
    typeSpeed: rt.typeSpeed,
    startGame,
    startAutoGame,
    makeChoice,
    continue: continue_,
    continueGame,
    reset,
    setTypeSpeed,
  };
```

- [ ] **Step 6: 类型检查（当前 App.tsx 调用处会报错，Task 5 修复）**

Run: `npx tsc --noEmit`
Expected: 报错仅限 `App.tsx` / `TitleScreen.tsx` 的 `startGame` 签名不匹配（useGame 内部无错）

- [ ] **Step 7: 提交**

```bash
git add src/hooks/useGame.ts
git commit -m "[NF]: 节奏档位：useGame 接入档位状态/存档/SET_TYPE_SPEED action"
```

---

### Task 4: DialogBox 打字速度 + 点击跳过

**Files:**
- Modify: `src/components/DialogBox.tsx`

**Interfaces:**
- Consumes: `TypeSpeed`（Task 1）；`TYPE_SPEED_RANGES`（Task 1）
- Produces: props 新增 `typeSpeed?: TypeSpeed`（GameScreen 传入）

- [ ] **Step 1: 改 Props 与 import**

```tsx
import { useState, useEffect, useRef, type ReactNode } from 'react';
import { sfx } from '../utils/sound';
import { TYPE_SPEED_RANGES } from '../engine/state';
import type { TypeSpeed } from '../types';

interface Props {
  text: string;
  name: string;
  age: number;
  stage: string;
  title?: string;
  onComplete?: () => void;
  onAutoContinue?: () => void;
  autoAdvance?: boolean;
  /** 立即显示全文（快速模拟模式跳过打字机） */
  instant?: boolean;
  /** 打字机速度档（默认 normal） */
  typeSpeed?: TypeSpeed;
}

export default function DialogBox({ text, name, age, stage, title, onComplete, onAutoContinue, autoAdvance, instant, typeSpeed = 'normal' }: Props) {
```

- [ ] **Step 2: 打字速度按档位计算 + 点击跳过**

`instant` 分支前的状态区加 units ref：

```tsx
  const [segments, setSegments] = useState<ReactNode[]>([]);
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  /** 完整字符单元（点击跳过打字时立即渲染用） */
  const unitsRef = useRef<Array<{ type: 'char'; value: string } | { type: 'br' }>>([]);
```

`useEffect` 内 `const allUnits = ...` 构建后加：

```ts
    unitsRef.current = allUnits;
```

打字延迟（`timerRef.current = setTimeout(type, 25 + Math.random() * 20);` 处）改为：

```ts
        const [min, max] = TYPE_SPEED_RANGES[typeSpeed];
        timerRef.current = setTimeout(type, min + Math.random() * (max - min));
```

`handleClick` 改为（打字中点击 → 立即显示全文）：

```tsx
  const handleClick = () => {
    if (!done) {
      // 跳过打字：立即显示全文并触发完成
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      setSegments(unitsRef.current.map((u, i) => u.type === 'br' ? <br key={`br-${i}`} /> : u.value));
      setDone(true);
      onComplete?.();
      return;
    }
    if (autoAdvance && onAutoContinue) {
      onAutoContinue();
    }
  };
```

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: 报错仅限 `GameScreen.tsx` 尚未传 `typeSpeed`（可选 prop，实际应为无报错；若 GameScreen 未改则无编译错误）

- [ ] **Step 4: 提交**

```bash
git add src/components/DialogBox.tsx
git commit -m "[NF]: 节奏档位：DialogBox 打字速度档位 + 点击跳过打字"
```

---

### Task 5: TitleScreen 节奏选择 + App 接线

**Files:**
- Modify: `src/components/TitleScreen.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `startGame(gender, name, paceMode, typeSpeed)`（Task 3）；`PaceMode`、`TypeSpeed`（Task 1）
- Produces: 标题页选择档位后传入 `onStart`

- [ ] **Step 1: 改 Props 与内部状态**

`TitleScreen.tsx` 头部：

```tsx
import { useState } from 'react';
import { sfx } from '../utils/sound';
import type { PaceMode, TypeSpeed } from '../types';

interface Props {
  onStart: (gender: 'male' | 'female', name: string, paceMode: PaceMode, typeSpeed: TypeSpeed) => void;
  onAutoStart: (gender: 'male' | 'female', name: string) => void;
  hasSave: boolean;
  onContinue: () => void;
}

export default function TitleScreen({ onStart, onAutoStart, hasSave, onContinue }: Props) {
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [name, setName] = useState('');
  const [paceMode, setPaceMode] = useState<PaceMode>('full');
  const [typeSpeed, setTypeSpeed] = useState<TypeSpeed>('normal');
```

`handleStart` 改为：

```tsx
  const handleStart = () => {
    if (!gender) return;
    sfx.select();
    const finalName = name.trim() || (gender === 'male' ? '小明' : '小美');
    onStart(gender, finalName, paceMode, typeSpeed);
  };
```

- [ ] **Step 2: 加节奏选择 UI（「开始人生」按钮上方）**

在「开始按钮」之前插入：

```tsx
      {/* 节奏选择：密度档（开局选定） */}
      <div className="z-10 flex flex-col items-center gap-2 animate-[fadeIn_1.9s_ease]">
        <label className="text-xs text-white/40 tracking-[3px]">节奏</label>
        <div className="flex gap-3">
          <button
            onClick={() => { sfx.select(); setPaceMode('full'); }}
            className={`w-[132px] py-2 rounded-[30px] text-[13px] tracking-[3px] border transition-all duration-300 font-sans
              ${paceMode === 'full'
                ? 'border-[#c9a96e] text-[#c9a96e] bg-[#c9a96e]/10 shadow-[0_0_18px_rgba(201,169,110,0.2)]'
                : 'border-white/15 text-white/40 bg-white/[0.03] hover:border-[#c9a96e]/50 hover:text-[#c9a96e]'}`}
          >
            沉浸人生
          </button>
          <button
            onClick={() => { sfx.select(); setPaceMode('lite'); }}
            className={`w-[132px] py-2 rounded-[30px] text-[13px] tracking-[3px] border transition-all duration-300 font-sans
              ${paceMode === 'lite'
                ? 'border-[#c9a96e] text-[#c9a96e] bg-[#c9a96e]/10 shadow-[0_0_18px_rgba(201,169,110,0.2)]'
                : 'border-white/15 text-white/40 bg-white/[0.03] hover:border-[#c9a96e]/50 hover:text-[#c9a96e]'}`}
          >
            精简人生
          </button>
        </div>
        <p className="text-[10px] text-white/30 tracking-[2px]">
          {paceMode === 'lite' ? '每岁约 2-3 个选择 · 一局约 1 小时' : '全部事件 · 一局 1.5-3 小时'}
        </p>
      </div>

      {/* 打字速度（游戏内也可切换） */}
      <div className="z-10 flex items-center gap-3 animate-[fadeIn_2s_ease]">
        <label className="text-xs text-white/40 tracking-[3px]">打字</label>
        <div className="flex gap-2">
          {([['slow', '慢'], ['normal', '中'], ['fast', '快']] as Array<[TypeSpeed, string]>).map(([v, label]) => (
            <button
              key={v}
              onClick={() => { sfx.select(); setTypeSpeed(v); }}
              className={`w-8 h-8 rounded-full text-[12px] border transition-all duration-200 font-sans
                ${typeSpeed === v
                  ? 'border-[#c9a96e] text-[#c9a96e] bg-[#c9a96e]/10'
                  : 'border-white/15 text-white/35 hover:border-[#c9a96e]/40 hover:text-[#c9a96e]'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
```

- [ ] **Step 3: App.tsx 接线**

`src/App.tsx` 第 27 行已是 `onStart={startGame}`（透传，无需包装）；Task 3 已把 `startGame` 签名扩展为 4 参，编译通过即说明接线正确。**无需改动 App.tsx**。

- [ ] **Step 4: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无报错

- [ ] **Step 5: 提交**

```bash
git add src/components/TitleScreen.tsx src/App.tsx
git commit -m "[NF]: 节奏档位：标题页节奏/打字速度选择 UI"
```

---

### Task 6: GameScreen 打字速度切换

**Files:**
- Modify: `src/components/GameScreen.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `typeSpeed`、`setTypeSpeed`（Task 3）；`TypeSpeed`（Task 1）
- Produces: GameScreen 新增 props `typeSpeed`、`onTypeSpeedChange`

- [ ] **Step 1: 改 Props 并接 DialogBox**

`GameScreen.tsx` 头部：

```tsx
import { useState, useCallback } from 'react';
import type { Choice, GameState, LifeEvent, TypeSpeed } from '../types';
import { STAGE_META } from '../engine/state';
import { sfx } from '../utils/sound';
import SceneArea from './SceneArea';
import StatusBar from './StatusBar';
import DialogBox from './DialogBox';
import ChoicePanel from './ChoicePanel';

interface Props {
  game: GameState;
  currentEvent: LifeEvent | null;
  feedback: string | null;
  autoPlay: boolean;
  typeSpeed: TypeSpeed;
  onTypeSpeedChange: (s: TypeSpeed) => void;
  onChoice: (choice: Choice) => void;
  onContinue: () => void;
}

const SPEED_OPTIONS: Array<{ value: TypeSpeed; label: string }> = [
  { value: 'slow', label: '慢' },
  { value: 'normal', label: '中' },
  { value: 'fast', label: '快' },
];

export default function GameScreen({ game, currentEvent, feedback, autoPlay, typeSpeed, onTypeSpeedChange, onChoice, onContinue }: Props) {
```

主分支（非 feedback、有 currentEvent）底部区域改为：

```tsx
      {/* 底部区域：对话框 + 选项（限高 45%，不遮挡 top-[55%] 的数值栏） */}
      <div className="absolute bottom-0 left-0 right-0 z-10 max-h-[45%] overflow-y-auto">
        <DialogBox
          text={currentEvent.text}
          name={game.name}
          age={game.age}
          stage={stageMeta.label}
          title={currentEvent.title}
          autoAdvance={isAuto}
          instant={autoPlay}
          typeSpeed={typeSpeed}
          onComplete={handleDialogComplete}
          onAutoContinue={isAuto ? () => onChoice(currentEvent.choices[0]) : undefined}
        />
        <ChoicePanel
          choices={currentEvent.choices}
          onSelect={onChoice}
          visible={showChoices && !autoPlay}
          attributes={game.attributes}
          age={game.age}
        />
      </div>

      {/* 打字速度切换（游戏内实时生效） */}
      <div className="absolute right-2 bottom-1.5 z-20 flex gap-1.5">
        {SPEED_OPTIONS.map(s => (
          <button
            key={s.value}
            onClick={() => { sfx.select(); onTypeSpeedChange(s.value); }}
            title={s.label}
            className={`w-7 h-7 rounded-full text-[11px] border transition-all duration-200 font-sans
              ${typeSpeed === s.value
                ? 'border-[#c9a96e] text-[#c9a96e] bg-[#c9a96e]/10'
                : 'border-white/15 text-white/35 hover:border-[#c9a96e]/40 hover:text-[#c9a96e]'}`}
          >
            {s.label}
          </button>
        ))}
      </div>
```

- [ ] **Step 2: App.tsx 接线**

```tsx
        {game.phase === 'playing' && (
          <GameScreen
            game={game}
            currentEvent={currentEvent}
            feedback={feedback}
            autoPlay={autoPlay}
            typeSpeed={typeSpeed}
            onTypeSpeedChange={setTypeSpeed}
            onChoice={makeChoice}
            onContinue={continue_}
          />
        )}
```

`src/App.tsx` 的 useGame 解构加 `typeSpeed, setTypeSpeed`：

```tsx
  const { game, currentEvent, feedback, hasSave, autoPlay, typeSpeed, startGame, startAutoGame, makeChoice, continue: continue_, continueGame, reset, setTypeSpeed } = useGame();
```

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无报错

- [ ] **Step 4: 提交**

```bash
git add src/components/GameScreen.tsx src/App.tsx
git commit -m "[NF]: 节奏档位：游戏内打字速度切换按钮"
```

---

### Task 7: 端到端验证

**Files:**
- 无代码改动（验证任务）

- [ ] **Step 1: 跑全部测试**

Run: `node --test "script/*.test.mjs"`（数据工具 19 个）
Expected: PASS

Run: `node --experimental-strip-types --test script/engine-state.test.ts script/pace-mode.test.ts`
Expected: PASS（18 + 11 = 29 个）

- [ ] **Step 2: 生产构建**

Run: `npm run build`
Expected: 构建成功（tsc + vite）

- [ ] **Step 3: 浏览器验证核心路径**

Run: `npm run dev`，浏览器打开 http://localhost:5173：

1. 标题页出现「沉浸人生 / 精简人生」两卡片与「打字」三档，默认沉浸 + 中
2. 选「精简人生」+「快」→ 开始人生 → 事件数与提示一致（每岁 2-3 个），打字速度明显快
3. 游戏中点击打字速度按钮切换慢/中/快，当前事件重新打字时按新速度
4. 打字中点击对话框 → 立即显示全文
5. 刷新页面 → 标题页「继续人生」→ 恢复时仍是精简模式（存档兜底验证：可临时用旧存档或无字段存档测试）
6. 结算页重新开始正常
7. ⚡快速模拟正常（全量事件、instant 跳过、无档位 UI 干扰）

- [ ] **Step 4: 收尾提交（如无代码改动则跳过）**

```bash
git status
git log --oneline -6
```

确认 6 个功能提交齐全、工作区干净。
