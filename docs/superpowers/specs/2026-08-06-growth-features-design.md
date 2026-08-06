# 增长向三功能 + 数据检查点设计

日期：2026-08-06
状态：已批准（用户授权自主完成，四个方向全做）

## 背景

游戏已上线 GitHub Pages，传播层是唯一未闭环的漏斗。本设计补齐：

- **A. 分享卡片升级**：结局路线名 + 图鉴收集进度 + 每日挑战「今日战绩」CTA——让卡片自带"比较欲"
- **B. PWA 安装引导**：Android/Chrome 下提示「添加到主屏幕」，安装后回访率提升
- **C. 挑战历史**：每日挑战近 7 天记录（StatsModal 内）+ 种子挑战本地比分（SeedModal 内）——把挑战变成习惯
- **D. 数据检查点**：3 天后分析埋点数据做调优（非代码，日程提醒）

## A. 分享卡片升级（ShareCardModal.tsx）

现状：960×540 canvas 卡片，含名字/世代/结局标题/迷你曲线/种子码/CTA。

- **Props 新增**：`endingKey: string`（结局 key，查 `VERDICT_META` 得 icon+title）、`collectionDone: number`（图鉴收集 X/13，App 从 `Object.keys(stats.endings).length`…… 不对——收集数 = VERDICT_ROUTES 中已收集条数，App 算好传入）、`isDaily?: boolean`
- **卡片左侧新增两行**：`{icon} {路线名}`（如 🎓 学术深耕的一生）+ `📖 图鉴 X/13`（全收集显示 `🏆 13/13 全收集`）
- **CTA 文案**：`isDaily` 时改为「今日挑战 · 评分 X · 享年 Y——同样的人生，你拿了几分？」；其余保持现有
- SummaryScreen 传 `endingKey={verdictKey(game)}`（已 import）、collectionDone 与 isDaily 由 App 传下（App 从 useGame 拿 isDaily——useGame 返回值需补 `isDaily`）

## B. PWA 安装引导（新组件 InstallPrompt.tsx）

- 新组件监听 `beforeinstallprompt`（保存 deferredPrompt 到 ref/state），满足「事件触发过 && 未提示过（`life-sim-install-prompted` 标记）&& 非 standalone 模式（`window.matchMedia('(display-mode: standalone)')` 不匹配）」时显示提示条
- 提示条：`📲 添加到主屏幕，离线也能玩` + 按钮「立即安装」（触发 `deferredPrompt.prompt()`）+ 「暂不」（标记后不再显示）
- prompt 完成或拒绝后写标记 `life-sim-install-prompted`（一次即可，不再打扰）；`beforeinstallprompt` 未触发（iOS Safari / 已安装）不显示任何内容
- 挂载：TitleScreen 内（仅标题页显示，不打扰对局）；组件内部自管理事件监听与标记

## C. 挑战历史

### C1. 每日挑战近 7 天（StatsModal 内展示）

- **新存储键** `life-sim-daily-history`：`Record<YYYYMMDD, { score: number; age: number }>`（玩过的天才有记录，同天覆盖）
- **纯函数**（useGame.ts 内，跟随 saveDaily/updateDailyBest 模式）：`loadDailyHistory(): DailyHistory` / `saveDailyHistory(store)` / `updateDailyHistory(prev, today, score, age): DailyHistory`（同天覆盖式合并）
- **写入点**：结算持久化 useEffect 的 isDaily 分支（updateDailyBest 旁）；`DAILY_UPDATED` 类似地需要把 history 放入 RuntimeState 并在 HYDRATE 时读入
- **UI**：StatsModal 新增「📅 每日挑战 · 近 7 天」区块（最近 7 天日期 + 评分 + 享年，无记录的天灰显）；props 加 `dailyHistory: DailyHistory`

### C2. 种子挑战本地比分（SeedModal 内展示）

- **新存储键** `life-sim-seed-scores`：`Record<string, { bestScore: number; bestAge: number; plays: number }>`（seed 以字符串为键）
- **纯函数**（useGame.ts 内）：`loadSeedScores()` / `saveSeedScores(store)` / `recordSeedScore(prev, seed, score, age): SeedScores`（首次 plays=1；再次 plays+1 且 best 取更高评分）
- **写入点**：结算持久化 useEffect，`rt.seedChallenge` 时按 `rt.shuffleSeed` 记录
- **UI**：SeedModal props 加 `scores: SeedScores`；输入有效种子码时下方显示「该种子：最佳评分 X · 享年 Y · 玩过 N 次」（无记录不显示）

## D. 数据检查点

- 设一次性日程提醒：2026-08-09 分析「📊 数据」导出（abandon 集中段/结局分布/功能使用），据此做内容调优决策

## 存储与降级

- 全部新键读写 try-catch 静默降级（saveStats 同模式）；损坏 JSON 返回空结构
- 不收集个人信息；纯前端零依赖

## 测试

- `script/use-game.test.ts`：daily history 同天覆盖/跨天新增、seed scores 首次/复玩/最佳更新（沿用内存 localStorage 桩）
- `script/save.test.ts` 或新纯函数测试：合并逻辑
- UI 冒烟（Playwright）：分享卡片出现路线名与收集进度；PWA 引导不可真实验证（beforeinstallprompt 需真实浏览器），静态验证组件渲染；StatsModal 周视图、SeedModal 比分显示

## 非目标

- 不做 iOS 安装引导文案（无 beforeinstallprompt 事件，静默）
- 不做后端排行榜/云存档
- 不改变每日挑战与种子挑战的玩法本身
