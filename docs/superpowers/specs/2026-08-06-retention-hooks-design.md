# 留存钩子：图鉴进度外显 + 结局线索设计

日期：2026-08-06
状态：已批准（用户授权自主完成）

## 背景

重玩引擎已齐（周目解锁/每日挑战/种子分享/继承），但差一个「钩子」：玩家不知道还有哪些人生没走过、下一局该往哪走。本设计把 13 条结局路线变成**可探索的迷宫**：

1. **结算页「下一站」线索**：按当前结局滚动提示下一条未收集路线（icon + 标题 + hint），收集欲驱动开下一局
2. **标题页图鉴进度外显**：「📖 图鉴」入口直接显示 7/13 收集进度，让收集状态时刻可见

## 现状

- `VERDICT_ROUTES`（13 条，含 key/icon/title/hint）与 `VERDICT_META` 查表在 `src/engine/verdict.ts`；图鉴模态 CollectionModal 已有 `done/13` 进度与 hint 展示（未收集路线）
- 结算页 SummaryScreen 结局标题查 `VERDICT_META`，props 无收集数据
- App 层已有 `stats.endings`（key → 次数，持久化）

## 设计

### 1. 纯函数 `nextRouteToExplore`（src/engine/verdict.ts）

```ts
/**
 * 结算页「下一站」：从当前结局之后循环找第一条未收集路线。
 * 全部收集返回 null（通关成就感文案由调用方展示）。
 */
export function nextRouteToExplore(currentKey: string, collected: ReadonlySet<string>): VerdictRoute | null
```

- 从 `currentKey` 在 VERDICT_ROUTES 的**下一个位置**开始，循环滚动找第一条 `!collected.has(key)` 的路线
- 分数档结局（key 不在表内）→ 从第一条开始（idx=-1，+1 后为 0）
- 全收集 → null

### 2. SummaryScreen「下一站」区块

- props 新增 `collectedEndings: string[]`（App 传 `Object.keys(stats.endings)`）
- 位置：结局标题（h2）与 desc 之后、死因区块之前——结算页第一屏可见
- 未全收集：`🧭 下一站：{icon} {title}——{hint}`
- 全收集且 ≥1 次：`🏆 13 条人生路线已全部走过`（通关感）

### 3. TitleScreen 图鉴入口进度

- 「📖 图鉴」按钮内容追加 `<span>7/13</span>` 小字（从 stats.endings 计算），实时可见收集进度

### 4. 测试

- `script/verdict.test.ts`（node:test）追加：
  - 未收集时返回当前结局之后的第一条未收集路线
  - 循环滚动：最后一条结局 → 回到第一条
  - 全收集 → null
  - 分数档 key → 从第一条未收集开始
- UI 冒烟：快速模拟一局 → 结算页出现「下一站」→ 标题页图鉴按钮显示进度

## 非目标

- 不改 VERDICT_ROUTES 内容与判定逻辑
- 不做路线之间的「迁移指引」文案表（hint 已够，避免维护成本）
