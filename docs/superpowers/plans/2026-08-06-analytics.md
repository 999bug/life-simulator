# 本地轻量埋点 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 纯前端 localStorage 埋点：采集开局/结算/放弃/阶段/功能 5 类事件，按日聚合，标题页「📊 数据」面板可视化 + 导出 JSON。

**Architecture:** `src/utils/analytics.ts` 提供单一 `track()` 入口，同时写原始事件流（截断 300 条）与按日聚合；采集点在 useGame 的 handler 层与组件 onClick 处直埋（与现有 saveStats/saveAchievements 同模式）；AnalyticsModal 只读聚合数据渲染面板。

**Tech Stack:** React 18 + TS + Tailwind（现有栈）；vitest（src/test/）；localStorage。

**Spec:** `docs/superpowers/specs/2026-08-06-analytics-design.md`

## Global Constraints

- 纯前端零后端：只写 localStorage，不引入任何依赖
- 不记录个人信息（不存名字/设备信息）
- 日志英文、注释中文（项目 CLAUDE.md 规范）
- localStorage 读写全部 try-catch 静默降级（复用 saveStats 模式）
- 提交信息中文 + 前缀，禁止 AI 署名
- 模态复用现有规范：`max-w-[92vw]` + `max-h-[min(520px,86vh)]`

---

### Task 1: analytics 核心模块（TDD）

**Files:**
- Create: `src/utils/analytics.ts`
- Test: `src/test/analytics.test.ts`

**Interfaces:**
- Produces:
  - `type AnalyticsVariant = 'normal' | 'daily' | 'seed' | 'auto'`
  - `type FeatureKey = 'quick_sim' | 'daily' | 'seed' | 'goal' | 'achievements' | 'collection' | 'family' | 'stats' | 'guide' | 'data' | 'share_card' | 'biography'`
  - `type AnalyticsEvent = { type: 'game_start'; ts: number; variant: AnalyticsVariant; pace: 'full' | 'lite'; challenge: boolean } | { type: 'game_finish'; ts: number; score: number; age: number; endingKey: string } | { type: 'game_abandon'; ts: number; age: number } | { type: 'stage_reach'; ts: number; stage: LifeStage } | { type: 'feature_use'; ts: number; feature: FeatureKey }`
  - `type DailyAgg = { starts: number; finishes: number; abandons: number; ageSum: number; endings: Record<string, number>; variants: Record<string, number>; features: Record<string, number> }`
  - `export function track(event: AnalyticsEvent): void` — 追加事件流（截断 300）+ 累加当日聚合，写失败静默
  - `export function loadAnalytics(): { events: AnalyticsEvent[]; daily: Record<string, DailyAgg> }` — 读两键，损坏 JSON 返回空
  - `export function buildExportPayload(): string` — JSON 字符串（含 events + daily），供导出下载
  - 常量 `EVENTS_KEY = 'life-sim-analytics-events'`、`DAILY_KEY = 'life-sim-analytics-daily'`
- Consumes: `LifeStage`（`src/engine/state.ts` 导出）；日期格式化在 analytics.ts 内联实现（同 `useGame.ts:118` 的 formatDate：本地时区 YYYYMMDD，避免 utils → hooks 反向依赖）

- [ ] **Step 1: 写失败测试**

创建 `src/test/analytics.test.ts`（jsdom 环境，localStorage 可用；每个测试前清空 `localStorage.clear()`）：

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { track, loadAnalytics, buildExportPayload, EVENTS_KEY, DAILY_KEY } from '../utils/analytics';

beforeEach(() => localStorage.clear());

describe('analytics track', () => {
  it('记录开局后当日聚合 starts 累加', () => {
    track({ type: 'game_start', ts: Date.now(), variant: 'normal', pace: 'full', challenge: false });
    const { daily } = loadAnalytics();
    const today = Object.keys(daily)[0];
    expect(daily[today].starts).toBe(1);
  });

  it('结算累加 finishes/ageSum 与结局分布', () => {
    track({ type: 'game_finish', ts: Date.now(), score: 70, age: 60, endingKey: 'top_university' });
    track({ type: 'game_finish', ts: Date.now(), score: 55, age: 40, endingKey: 'top_university' });
    const { daily } = loadAnalytics();
    const today = Object.keys(daily)[0];
    expect(daily[today].finishes).toBe(2);
    expect(daily[today].ageSum).toBe(100);
    expect(daily[today].endings.top_university).toBe(2);
  });

  it('变体与功能计数各自累加', () => {
    track({ type: 'game_start', ts: Date.now(), variant: 'daily', pace: 'lite', challenge: false });
    track({ type: 'feature_use', ts: Date.now(), feature: 'share_card' });
    track({ type: 'feature_use', ts: Date.now(), feature: 'share_card' });
    const { daily } = loadAnalytics();
    const today = Object.keys(daily)[0];
    expect(daily[today].variants.daily).toBe(1);
    expect(daily[today].features.share_card).toBe(2);
  });

  it('事件流超过 300 条裁掉最旧', () => {
    for (let i = 0; i < 305; i++) {
      track({ type: 'feature_use', ts: Date.now(), feature: 'guide' });
    }
    const { events } = loadAnalytics();
    expect(events.length).toBe(300);
    // 事件流只保留 300 条；日聚合按天归并，不截断
  });

  it('跨天事件分属不同聚合条目', () => {
    const yesterday = Date.now() - 86400000;
    track({ type: 'game_start', ts: yesterday, variant: 'normal', pace: 'full', challenge: false });
    track({ type: 'game_start', ts: Date.now(), variant: 'normal', pace: 'full', challenge: false });
    const { daily } = loadAnalytics();
    expect(Object.keys(daily).length).toBe(2);
  });

  it('损坏数据返回空结构', () => {
    localStorage.setItem(EVENTS_KEY, 'not-json{{{');
    localStorage.setItem(DAILY_KEY, '[]');
    const { events, daily } = loadAnalytics();
    expect(events).toEqual([]);
    expect(daily).toEqual({});
  });

  it('导出载荷含事件流与日聚合', () => {
    track({ type: 'game_start', ts: Date.now(), variant: 'seed', pace: 'full', challenge: false });
    const payload = JSON.parse(buildExportPayload());
    expect(payload.daily).toBeTruthy();
    expect(payload.events.length).toBe(1);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/test/analytics.test.ts`
Expected: FAIL — `../utils/analytics` 模块不存在

- [ ] **Step 3: 实现 analytics.ts**

创建 `src/utils/analytics.ts`：

```ts
import type { LifeStage } from '../engine/state';

// 存储键：原始事件流 + 按日聚合
export const EVENTS_KEY = 'life-sim-analytics-events';
export const DAILY_KEY = 'life-sim-analytics-daily';

/** 日期 → YYYYMMDD（本地时区，与 useGame.formatDate 同格式） */
function formatDate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}${month}${day}`;
}

/** 原始事件流上限：超过裁最旧（localStorage 体积控制） */
const MAX_EVENTS = 300;

export type AnalyticsVariant = 'normal' | 'daily' | 'seed' | 'auto';

export type FeatureKey =
  | 'quick_sim' | 'daily' | 'seed' | 'goal'
  | 'achievements' | 'collection' | 'family' | 'stats' | 'guide' | 'data'
  | 'share_card' | 'biography';

export type AnalyticsEvent =
  | { type: 'game_start'; ts: number; variant: AnalyticsVariant; pace: 'full' | 'lite'; challenge: boolean }
  | { type: 'game_finish'; ts: number; score: number; age: number; endingKey: string }
  | { type: 'game_abandon'; ts: number; age: number }
  | { type: 'stage_reach'; ts: number; stage: LifeStage }
  | { type: 'feature_use'; ts: number; feature: FeatureKey };

export type DailyAgg = {
  starts: number;
  finishes: number;
  abandons: number;
  ageSum: number;
  endings: Record<string, number>;
  variants: Record<string, number>;
  features: Record<string, number>;
};

/** 空聚合结构 */
export function emptyDaily(): DailyAgg {
  return { starts: 0, finishes: 0, abandons: 0, ageSum: 0, endings: {}, variants: {}, features: {} };
}

/** 安全读 JSON（损坏返回 null，与 saveStats 同模式静默降级） */
function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * 读取原始事件流与按日聚合（损坏数据降级为空结构）。
 */
export function loadAnalytics(): { events: AnalyticsEvent[]; daily: Record<string, DailyAgg> } {
  const events = readJSON<AnalyticsEvent[]>(EVENTS_KEY);
  const daily = readJSON<Record<string, DailyAgg>>(DAILY_KEY);
  return {
    events: Array.isArray(events) ? events : [],
    daily: daily && typeof daily === 'object' ? daily : {},
  };
}

/** 事件归入当日聚合 */
function mergeIntoDaily(daily: Record<string, DailyAgg>, e: AnalyticsEvent): void {
  const day = formatDate(new Date(e.ts));
  const agg = daily[day] ?? emptyDaily();
  switch (e.type) {
    case 'game_start':
      agg.starts += 1;
      agg.variants[e.variant] = (agg.variants[e.variant] ?? 0) + 1;
      break;
    case 'game_finish':
      agg.finishes += 1;
      agg.ageSum += e.age;
      agg.endings[e.endingKey] = (agg.endings[e.endingKey] ?? 0) + 1;
      break;
    case 'game_abandon':
      agg.abandons += 1;
      break;
    case 'feature_use':
      agg.features[e.feature] = (agg.features[e.feature] ?? 0) + 1;
      break;
    // stage_reach 不进日聚合（面板不展示，原始流可查）
    default:
      break;
  }
  daily[day] = agg;
}

/**
 * 记录一条埋点事件：追加事件流（截断）+ 累加当日聚合。
 * 任一步写失败静默降级，不影响游戏。
 */
export function track(event: AnalyticsEvent): void {
  try {
    const { events, daily } = loadAnalytics();
    events.push(event);
    // 超过上限裁最旧
    if (events.length > MAX_EVENTS) {
      events.splice(0, events.length - MAX_EVENTS);
    }
    mergeIntoDaily(daily, event);
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
    localStorage.setItem(DAILY_KEY, JSON.stringify(daily));
  } catch {
    // 存储不可用时静默丢弃
  }
}

/** 导出载荷：原始事件流 + 日聚合（供「导出 JSON」下载） */
export function buildExportPayload(): string {
  const { events, daily } = loadAnalytics();
  return JSON.stringify({ exportedAt: new Date().toISOString(), events, daily }, null, 2);
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/test/analytics.test.ts`
Expected: PASS（7 个测试全过）

- [ ] **Step 5: 提交**

```bash
git add src/utils/analytics.ts src/test/analytics.test.ts
git commit -m "[NF]: 本地轻量埋点核心——事件流 + 按日聚合

- track() 单入口同时写事件流（截断 300 条）与日聚合
- 5 类事件：开局/结算/放弃/阶段/功能使用
- localStorage 读写失败静默降级，不收集个人信息"
```

---

### Task 2: 采集点接入

**Files:**
- Modify: `src/hooks/useGame.ts`（结算持久化 useEffect 区、startGame/startAutoGame/startDailyGame handler 区、exitToTitle handler 区）
- Modify: `src/components/TitleScreen.tsx`（快捷入口按钮 onClick）
- Modify: `src/components/GameScreen.tsx`（stage useEffect 区）

**Interfaces:**
- Consumes: `track`、`AnalyticsVariant`（Task 1）
- Produces: 无新接口；采集点副作用

- [ ] **Step 1: useGame 采集 game_start / game_finish / game_abandon**

在 `src/hooks/useGame.ts`：

1. 顶部 import：`import { track } from '../utils/analytics';`

2. **game_finish**：在结算持久化 useEffect（`achievementPending` 分支，saveStats 调用之后、saveDaily 分支附近）追加：

```ts
    // 埋点：结算（与成就/统计同一时机，pending 标志保证不重复）
    track({ type: 'game_finish', ts: Date.now(), score, age: rt.game.age, endingKey: rt.pendingEndingKey });
```

（`score`、`rt.pendingEndingKey` 在该 effect 作用域内已存在——score 由 `calcScore(rt.game.attributes)` 算出，pendingEndingKey 在 state 中。）

3. **game_start**：三个开局 handler 各自埋点（`useGame.ts:797-819`，handler 内已知全部字段）：

`startGame`（dispatch START_GAME 处）追加——种子挑战（seed 参数非空）与普通开局区分：

```ts
    // 埋点：开局（种子挑战 variant=seed，普通开局 variant=normal）
    track({ type: 'game_start', ts: Date.now(), variant: seed != null ? 'seed' : 'normal', pace: paceMode, challenge });
```

`startAutoGame`（dispatch START_AUTO_GAME 处）追加：

```ts
    // 埋点：快速模拟开局
    track({ type: 'game_start', ts: Date.now(), variant: 'auto', pace: 'lite', challenge: false });
```

`startDailyGame`（dispatch START_GAME 带 isDaily 处）追加：

```ts
    // 埋点：每日挑战开局
    track({ type: 'game_start', ts: Date.now(), variant: 'daily', pace: 'full', challenge: false });
```

4. **game_abandon**：`reset` handler（`useGame.ts:834-836`，dispatch RESET 前）追加——未到结算回标题即流失；`reset` 的 `useCallback` 依赖从 `[]` 改为 `[rt.game.phase]`（phase 只在 playing→summary 转变一次，重建代价可忽略）：

```ts
  const reset = useCallback(() => {
    // 埋点：中途放弃（未到结算回标题 = 流失点；结算后回标题 phase 已是 summary，不误记）
    if (rt.game.phase !== 'summary') {
      track({ type: 'game_abandon', ts: Date.now(), age: rt.game.age });
    }
    dispatch({ type: 'RESET' });
  }, [rt.game.phase]);
```

- [ ] **Step 2: TitleScreen 采集 feature_use**

在 `src/components/TitleScreen.tsx` 顶部 import `track`，并在快捷入口行按钮的 onClick（`sfx.select()` 旁）追加 `track({ type: 'feature_use', ts: Date.now(), feature: '...' })`：

| 按钮（行号约） | feature |
|---|---|
| ⚡ 快速模拟（line 308 附近 onAutoStart 调用处） | `'quick_sim'` |
| 📅 每日挑战（line 319） | `'daily'` |
| 📊 生涯（line 335） | `'stats'` |
| 🏆 成就（line 343） | `'achievements'` |
| 📖 图鉴（line 351） | `'collection'` |
| 🌳 家族（line 359） | `'family'` |
| ❓ 玩法（line 367） | `'guide'` |
| 🔑 种子（line 375） | `'seed'` |

（Task 3 会加「📊 数据」按钮 → `'data'`。）

- [ ] **Step 3: GameScreen 采集 stage_reach**

在 `src/components/GameScreen.tsx` 的 stage useEffect（line 80-87，`sfx.stage()` 与 `startBgm(game.stage)` 处）追加：

```ts
    // 埋点：阶段切换（首次进入也会触发一次，可接受——标记到达）
    track({ type: 'stage_reach', ts: Date.now(), stage: game.stage });
```

注意：该 effect 依赖 `game.stage`，挂载时首次运行即记录初始阶段，符合「到达」语义，无需特判。

- [ ] **Step 4: 构建 + 手动冒烟验证采集**

Run: `npm run build` → Expected: 构建成功
Run: `npx vitest run` → Expected: 现有 UI 测试全过（采集点不改任何 reducer/渲染逻辑）

- [ ] **Step 5: 提交**

```bash
git add src/hooks/useGame.ts src/components/TitleScreen.tsx src/components/GameScreen.tsx
git commit -m "[NF]: 埋点采集接入——开局/结算/放弃/阶段/功能五类事件

- game_finish 与成就统计同一时机（pending 标志防重复）
- game_abandon 仅未到结算回标题时记录
- 快速模拟/每日挑战/种子开局 variant 区分"
```

---

### Task 3: AnalyticsModal 数据面板 + 标题页入口

**Files:**
- Create: `src/components/AnalyticsModal.tsx`
- Modify: `src/components/TitleScreen.tsx`

**Interfaces:**
- Consumes: `loadAnalytics`、`buildExportPayload`、`DailyAgg`（Task 1）、`downloadText`（`src/utils/biography.ts:77`）、`sfx`（现有音效）
- Produces: `<AnalyticsModal onClose={() => void} />`（TitleScreen 挂载）

- [ ] **Step 1: 创建 AnalyticsModal.tsx**

参考现有模态结构（如 `StatsModal` 的外层遮罩/容器样式）。内容布局：

```tsx
import { useMemo } from 'react';
import { loadAnalytics, buildExportPayload, emptyDaily, type DailyAgg } from '../utils/analytics';
import { downloadText } from '../utils/biography';
import { sfx } from '../utils/sound';
import { VERDICT_ROUTES } from '../engine/verdict';

/** 最近 N 天日期序列（YYYYMMDD，含今天，升序） */
function lastDays(n: number): string[] {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    days.push(`${d.getFullYear()}${month}${day}`);
  }
  return days;
}

/** 全部天聚合求和（面板总览） */
function sumDaily(daily: Record<string, DailyAgg>): DailyAgg {
  const acc = emptyDaily();
  for (const d of Object.values(daily)) {
    acc.starts += d.starts;
    acc.finishes += d.finishes;
    acc.abandons += d.abandons;
    acc.ageSum += d.ageSum;
    for (const [k, v] of Object.entries(d.endings)) {
      acc.endings[k] = (acc.endings[k] ?? 0) + v;
    }
    for (const [k, v] of Object.entries(d.variants)) {
      acc.variants[k] = (acc.variants[k] ?? 0) + v;
    }
    for (const [k, v] of Object.entries(d.features)) {
      acc.features[k] = (acc.features[k] ?? 0) + v;
    }
  }
  return acc;
}

/** 结局 key → 中文名（VERDICT_ROUTES 图鉴表，未收录显示 key 本身） */
function endingLabel(key: string): string {
  return VERDICT_ROUTES[key]?.title ?? key;
}

export default function AnalyticsModal({ onClose }: { onClose: () => void }) {
  const { daily } = useMemo(loadAnalytics, []);
  const totals = useMemo(() => sumDaily(daily), [daily]);
  const days = useMemo(() => lastDays(7), []);
  const endings = useMemo(
    () => Object.entries(totals.endings).sort((a, b) => b[1] - a[1]),
    [totals.endings],
  );
  const features = useMemo(
    () => Object.entries(totals.features).sort((a, b) => b[1] - a[1]).slice(0, 8),
    [totals.features],
  );
  ...
}
```

面板四块（复用 Tailwind 现有样式语言）：
1. 总览：`总开局 {totals.starts} / 完成 {totals.finishes} / 放弃 {totals.abandons} / 完成率 {finishes/starts 百分比，starts=0 显示 '—'} / 平均享年 {ageSum/finishes，finishes=0 显示 '—'}`
2. 近 7 天：每行 `日期（MM-DD 短格式） 开局 n · 完成 n`（无数据行灰显）
3. 结局分布：`结局 label（verdictKey） × 次数`（无数据显示空态「还没有完成的人生」）
4. 功能使用：`功能名 × 次数` 按次数降序前 8 条

底部按钮行：`📥 导出 JSON`（onClick：`sfx.select(); downloadText('life-sim-analytics.json', buildExportPayload());`）+ `关闭`

`verdictKey → 中文结局名` 查 `VERDICT_ROUTES`（`src/engine/verdict.ts` 导出，SummaryScreen 同表）；不在表内（分数档兜底等）直接显示 key。

外层容器按现有模态规范：遮罩 `fixed inset-0 z-50 flex items-center justify-center bg-black/60` + 内容 `max-w-[92vw] max-h-[min(520px,86vh)] overflow-y-auto`（参考 StatsModal 实际 class 为准）。

- [ ] **Step 2: TitleScreen 接入入口**

在 `src/components/TitleScreen.tsx`：
1. import AnalyticsModal
2. 新增 state：`const [showAnalytics, setShowAnalytics] = useState(false);`
3. 快捷入口行新增按钮（排在 🔑 种子之后）：

```tsx
          <button
            className="...（与现有入口按钮同类样式）..."
            onClick={() => { sfx.select(); setShowAnalytics(true); }}
          >
            📊 数据
          </button>
```

4. 模态挂载（与现有模态并列）：

```tsx
        {showAnalytics && <AnalyticsModal onClose={() => setShowAnalytics(false)} />}
```

- [ ] **Step 3: 构建 + UI 冒烟**

Run: `npm run build` → Expected: 成功
Run: `npx vitest run` → Expected: 全过

- [ ] **Step 4: 提交**

```bash
git add src/components/AnalyticsModal.tsx src/components/TitleScreen.tsx
git commit -m "[NF]: 📊 数据面板——标题页查看埋点看板与导出

- 总览：开局/完成/放弃/完成率/平均享年
- 近 7 天趋势、结局分布、功能使用 Top
- 导出 JSON 下载完整埋点数据"
```

---

### Task 4: 文档同步 + 端到端验证

**Files:**
- Modify: `CLAUDE.md`（项目根，运行时章节的 localStorage 键清单）
- Modify: `docs/superpowers/specs/2026-08-06-analytics-design.md`（如实现与 spec 有出入，同步修正）

- [ ] **Step 1: CLAUDE.md 补充存储键说明**

在 CLAUDE.md「运行时（src/hooks/useGame.ts）」段落的本地存储键列表（`life-sim-stats` / `life-sim-achievements` / `life-sim-family` / `life-sim-daily` 附近）追加一句：

```markdown
- **本地埋点**：`life-sim-analytics-events`（原始事件流，截断 300 条）+ `life-sim-analytics-daily`（按日聚合，无限累积）；采集开局/结算/放弃/阶段/功能使用 5 类事件，标题页「📊 数据」面板查看 + 导出 JSON，不收集个人信息
```

- [ ] **Step 2: 端到端验证（Playwright + preview）**

1. `npm run build` && `npm run preview`（或 dev server）
2. 打开页面 → 标题页点「📊 数据」→ 面板显示当前聚合（开局 0 / 完成 0，可能已有首访引导记录）
3. 开局 → 进入游戏 → 中途回标题 → 「📊 数据」显示 开局 1 / 放弃 1
4. 快速模拟跑完一生 → 「📊 数据」显示 完成 1、结局分布 +1、平均享年>0、功能使用含 quick_sim
5. 点「导出 JSON」→ 文件下载且内容含 events/daily 字段

- [ ] **Step 3: 提交**

```bash
git add CLAUDE.md
git commit -m "[CU]: 文档记录本地埋点存储键与查看入口"
```

---

## 完成标准

- [ ] `npx vitest run` 全过（新增 7 个埋点测试 + 现有 UI 测试）
- [ ] `npm run build` 成功，preview 端到端验证埋点数据正确累积
- [ ] 「📊 数据」面板展示 4 块内容 + 导出 JSON 可用
- [ ] 无个人信息采集，localStorage 写失败静默降级
