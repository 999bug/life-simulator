# 本地轻量埋点设计

日期：2026-08-06
状态：已批准

## 背景

游戏已上线 GitHub Pages，但没有任何可观测性：不知道玩家开几局、完成率多少、在哪流失、哪个功能有人用。后续「内容补强」与「留存钩子」的决策需要数据依据。

约束：纯前端、零后端、PWA 离线可用——埋点全部走 localStorage，不引入任何外部依赖。

## 目标

1. 采集 5 类事件：开局、结算、中途放弃、阶段到达、功能使用
2. 按日聚合，支撑「近 7 天趋势 / 完成率 / 平均享年 / 结局分布 / 功能使用」看板
3. 标题页「📊 数据」入口提供可视化面板 + 导出 JSON
4. 不记录任何个人信息（不存玩家名字）

## 数据模型

### 原始事件流

存储键：`life-sim-analytics-events`，`AnalyticsEvent[]`，**保留最近 300 条**（超限裁最旧）。

```ts
type StageKey = 'infant' | 'childhood' | 'teen' | 'young_adult' | 'adult' | 'middle_age' | 'elder'; // 与 STAGE_META 的 LifeStage 一致，96+ 岁归 elder

type FeatureKey =
  | 'quick_sim' | 'daily' | 'seed' | 'goal'        // 标题页入口
  | 'achievements' | 'collection' | 'family' | 'stats' | 'guide' | 'data'  // 模态
  | 'share_card' | 'biography';                    // 结算页功能

type AnalyticsEvent =
  | { type: 'game_start'; ts: number; variant: 'normal'|'daily'|'seed'|'auto'; pace: 'full'|'lite'; challenge: boolean }
  | { type: 'game_finish'; ts: number; score: number; age: number; endingKey: string }
  | { type: 'game_abandon'; ts: number; age: number }
  | { type: 'stage_reach'; ts: number; stage: StageKey }
  | { type: 'feature_use'; ts: number; feature: FeatureKey };
```

### 按日聚合

存储键：`life-sim-analytics-daily`，`Record<YYYY-MM-DD, DailyAgg>`，无限累积。

```ts
type DailyAgg = {
  starts: number;                          // 开局次数
  finishes: number;                        // 结算完成次数
  abandons: number;                        // 中途放弃次数（完成率 = finishes / starts）
  ageSum: number;                          // 享年累计（平均享年 = ageSum / finishes）
  endings: Record<string, number>;         // 结局 key 分布
  variants: Record<string, number>;        // normal/daily/seed/auto 计数
  features: Record<string, number>;        // 功能使用计数
};
```

## 采集点（挂载位置）

| 事件 | 挂载点 | 说明 |
|---|---|---|
| `game_start` | TitleScreen 各开局处理函数（开始人生 / ⚡ 快速模拟 / 📅 每日 / 🔑 种子） | variant/pace/challenge 在调用处已知 |
| `game_finish` | `useGame` 的 `achievementPending` useEffect，与 `saveStats` 同一时机 | 结算统计写库时一并埋点，不重复计数 |
| `game_abandon` | GameScreen 回标题处理处（RESET 前），`gameOver === false` 时记 | 中途放弃即流失 |
| `stage_reach` | GameScreen 渲染层 watch `game.stage` 变化（进入游戏后首次不记） | 阶段切换 |
| `feature_use` | 标题页各入口 + 结算页分享卡片打开/传记导出 | 功能使用热度 |

## 数据面板

标题页快捷入口行新增「📊 数据」，打开 AnalyticsModal（复用现有模态规范：`max-w-[92vw]` + `max-h-[min(520px,86vh)]`）：

- **总览卡片**：总开局 / 完成 / 放弃 / 完成率 / 平均享年
- **近 7 天趋势**：每天开局 vs 完成（数字列表，无数据的天显示空）
- **结局分布**：与图鉴一致的样式（按次数排序）
- **功能使用 Top**：各入口点击次数排序
- **「导出 JSON」按钮**：下载 `life-sim-analytics.json`（含原始事件流 + 日聚合）

## 健壮性

- localStorage 读写全部 try-catch 静默降级（与 saveStats/loadStats 模式一致）
- 事件流超 300 条裁最旧；日聚合按天 key，跨天自动开新条目
- 面板只展示聚合 + 导出功能，原始事件流不在 UI 展示

## 测试

`src/test/analytics.test.ts`（vitest，jsdom）：

1. 事件追加：正常追加、超过 300 条裁最旧
2. 日聚合：同天多次开局/结算累加、结局分布累加、跨天分开
3. 损坏数据降级：JSON 解析失败返回空结构
4. 变体计数：normal/daily/seed/auto 各自累加

## 非目标

- 不做后端上报、不做跨设备同步
- 不做排行榜（依赖后端，另行决策）
- 不采集姓名、设备信息等个人数据
