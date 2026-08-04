# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

人生模拟器：React 18 + TypeScript + Vite + Tailwind 的文字人生模拟游戏。纯前端、无后端，游戏内容由 JSON 事件数据驱动。事件数据源 `script/chiled.json`（513 个事件）经转换器生成引擎格式 `src/engine/events.json`，运行时同岁组内按种子洗牌后线性播放。

## 常用命令

```bash
npm run dev            # vite dev server（端口 5173）
npm run build          # tsc && vite build（生产构建）
npm run build:events   # 重新生成 src/engine/events.json（数据改动后必须跑）
node --test "script/*.test.mjs"   # 数据工具测试（21 个，glob 必须带引号，裸目录形式在本机报错）
node --experimental-strip-types --test script/engine-state.test.ts script/pace-mode.test.ts script/goals.test.ts script/save.test.ts   # 引擎/档位/目标成就/存档测试（47 个，Node 22 直接跑 TS）
```

## 架构

### 数据管道（script/）— 纯数据工程，不改引擎

```
script/chiled.json ──convert-events.mjs──▶ src/engine/events.json
        ▲
        └──prune-events.mjs（精选过滤）/ merge-fragments.mjs（片段合并+三重校验）
```

- **chiled.json**：事件数据源（snake_case 原始格式：`age_range`/`flags_add`/`has_flags`/`min_attrs`）。**所有事件改动都改这里，不手改 events.json**
- **convert-events.mjs**：唯一转换器。`ATTR_MAP`（107 键）把 chiled 属性名映射到 8 大引擎属性；`INVERSE` 集合内的键是负向维度（取反求和，如 `pressure:+8` → happiness:-8）；未映射键 fail-fast 抛错；**事件 id 校验**（2 位主线/4 位模拟，其他抛错）。`ATTR_ORDER`/`STAGE_RANGES` 需与 `src/engine/state.ts` 的 `ATTR_META`/`STAGE_META` 手动同步
- **prune-events.mjs**：精选工具。事件 id 规则：**2 位数字后缀 = 原始主线事件（如 child_01），一字不改、永远保留；4 位数字后缀 = 模拟事件（如 child_0017），只能被精选删除、不能改内容**。`keep-list.json` 记录保留清单（审计用）
- **merge-fragments.mjs**：合并 chiled.json + `script/fragments/` 片段，跑三重校验：convertAll fail-fast + 每岁密度（0-2 岁 1-3 个、3-12 岁 5-12 个、13-75 岁 3-7 个）+ flag 生产/消费配对（has_flags 引用的 flag 必须有产出者，not_flags 不算悬空）。**幂等**：片段中已合并的 id 自动跳过，片段文件保留在 fragments/ 目录可重复运行
- **clamp-effects.mjs**：效果值钳位工具。4 位模拟事件的效果按转换后属性值等比例压缩到 ±3~±20 声明范围内（多键求和超范围时压缩该属性所有来源键）；2 位主线一字不改。幂等，效果值调整后用它 + build:events
- `script/build-events.mjs` 是历史遗留工具（硬编码早期事件数组，与 chiled.json 重复），新工作一律用上述四个

### 引擎（src/engine/）— 纯函数，无副作用

- **state.ts**：属性/阶段元数据（ATTR_META、STAGE_META）与状态纯函数（ageCap 年龄锚点上限、effectiveDelta 收益折算、applyOutcomes 属性钳位 0-100、calcMaxAge 动态寿命、applyElderDecay 65 岁起衰减、checkDeath、calcScore）。**年龄锚点成长上限 `CAP_ANCHORS`**（如智力 7:55→18:85→30:92，锚点间线性插值）：正向收益距当前年龄上限 15 点内线性递减且不越过上限，负向全额；老年衰减下限 1（运气再好每事件也掉 1 点）。初始属性刻意偏低（健康 65/智力 25）。选项展示用 effectiveDelta 实时计算，与引擎一致。**动态寿命**：基础 68 + 平均属性/100×35（封顶 103，均衡属性 ≥77 可达 95 岁——91-95 岁事件设计为高玩可达内容）
- **goals.ts / achievements.ts / verdict.ts**：人生目标判定（6 预设 checkGoal）、成就判定（20 个 checkAchievements）、结局 key 纯函数（verdictKey，13 路线 flag + 5 档分数兜底）
- **events.ts**：加载 events.json 为 `LifeEvent[]`（含 filterEvents 精简模式抽样 + shuffleEvents 同岁组洗牌，共用种子确定性重建）
- **events.json**：生成物（camelCase 引擎格式：`age`/`outcomes.attr`/`outcomes.flags`/`conditions.hasFlags`），**勿手改**

### 运行时（src/hooks/useGame.ts）

`useReducer` 驱动游戏循环，核心机制：
- **线性播放**：`findNextEvent` 从当前 index+1 线性扫描第一个 conditions 满足的事件，**同时收集条件不满足的跳过事件**（`skippedEvents`，结算页「本可发生而未触发」展示）；**年龄由事件自身驱动**（同一岁的多个事件连续触发）
- **同岁组洗牌（重玩性）**：开局随机种子对同岁事件洗牌（`shuffleEvents`，含 flag 依赖修正——消费事件排在产出者之后），同种子可复现；种子随存档保存
- **节奏档位**：密度（沉浸全量 / 精简每岁 2-3 个，`filterEvents` 主线优先抽样 + flag 闭包）开局选定；打字速度（慢/中/快）游戏内实时切换（DialogBox speedRef，不重启打字机）；点击跳过打字
- **存档 v2**：`life-sim-saves-v2` = 3 槽位 + active（`src/engine/save.ts`：SavesV2/migrateLegacySave 旧版自动迁移/isValidSaveData 内容校验）；标题页 3 卡片点击继续、开始新局覆盖确认；**快速模拟不写槽**（autoPlay guard）；RESET 保留槽位（回标题不丢档）
- **目标/成就/统计**：`goal` 入 GameState；成就存 `life-sim-achievements`（unlocked/completedLives/endings）；统计存 `life-sim-stats`（totalLives/bestScore/totalAge/endings 分布）；结算时经 `achievementPending` 标志一次性持久化（读档恢复不重复计数）
- conditions 不满足的事件静默跳过；flags 累积在 `game.flags`（不重复）；历史 `history` 含 `flags?` 字段（生涯年表里程碑标记，旧存档兼容）
- 死亡判定：健康归零或超过 `calcMaxAge`；死因记录在 `game.deathCause`（health 耗尽 / lifespan 寿终），结算页展示临终叙事
- `MAKE_CHOICE` 预载下一事件（gameOver 时判定成就/统计），`CONTINUE` 只清反馈；反馈页正向收益距年龄上限 15 点内标注「（距上限 X 点）」
- **音效**：`src/utils/sound.ts` 用 Web Audio 合成轻量 UI 音效（点击/选择/打字/推进/落幕/成就琶音/阶段过渡），无外部资源，浏览器不可用时静默降级；`setMuted` 供快速模拟模式静音高频交互音
- **成长曲线**：`GameState.snapshots`（可选，`AttrSnapshot[]`）每岁属性快照——`appendSnapshot`（state.ts）进入新岁或终局记录、同岁内不重复、同岁终局替换该岁条目；开局记首事件年龄，旧存档无字段从读档岁重建；结算页 GrowthChart canvas 绘制（x 0→享年、y 0-100、末端圆点 + HTML 图例带终值）
- **快速模拟**：标题页「⚡ 快速模拟」以随机性别/名字开局（`START_AUTO_GAME`），自动模式每 220ms 随机选择推进、跳过打字机（DialogBox `instant`）与选择面板，直到结算；重新开始或读档自动退出自动模式

### UI（src/components/）

- **GameScreen**：场景 + 数值栏 + 底部对话框区。**数值栏在 `top-[42%]`，底部区 `max-h-[45%] overflow-y-auto`（含 `pb-9` 防速度按钮遮挡）——两者位置耦合，改动需保持不重叠**；右上角 ✕ 中途退出（确认后回标题，存档保留）
- **DialogBox**：打字机效果（速度档位 + 点击跳过）+ 「▼ 点击继续」；事件标题显示为「标题」
- **ChoicePanel**：选项按钮（`button.group` class，effects 展示串由转换器生成）
- **TitleScreen**：名字/性别 + **节奏档位（沉浸/精简）+ 打字速度 + 3 存档卡片 + 目标选择模态（GoalModal）+ 成就（AchievementsModal）/生涯统计（StatsModal）入口**——720px 高度余量极小（约 1px），改动必须回归检查
- **SummaryScreen**：结算页（享年 + 结局 + 评分 + 属性 + **成长曲线（GrowthChart canvas 8 维随年龄折线图）+ 人生大事记完整时间线（里程碑 ⭐）+ 目标达成度 + 新解锁成就 + 本可发生而未触发 + 分享卡片（ShareCardModal canvas PNG）**）
- **SceneArea/SceneDecor**：按阶段/年龄渲染的场景背景
- **App**：移动端视口等比缩放（scale = min(vw/960, vh/720)，<1 才缩放）

## 事件数据格式

```jsonc
// chiled.json 原始格式（snake_case）
{
  "id": "young_20",
  "age_range": [18, 19],
  "category": "family|career|health|friend|education|personality|technology|love|finance",
  "title": "事件标题",
  "text": "第二人称叙事 50-150 字",
  "choices": [
    { "text": "第一人称行动或台词", "effects": { "happiness": 8, "money": -5 }, "flags_add": ["gap_year"] }
  ],
  "conditions": { "has_flags": [], "not_flags": [], "min_attrs": {}, "max_attrs": {} }
}
```

- effects 键只能取 `ATTR_MAP` 内的键（107 个）；值 ±3~±20（原版数据有 ±2 与 25 的先例）；每项 1-3 键
- flags 生产（`flags_add`）/消费（`has_flags`）必须成对；新 flag 必须登记产出者与消费者
- 合并后密度校验：0-2 岁 1-3、3-12 岁 5-12、13-75 岁 3-7 个/岁
- 测试数据工具用 node:test，见 `script/data-tools.test.mjs` 的 `ev()` 辅助函数

## 约定

- 提交信息：中文 subject + 前缀（[NF]/[BF]/[CU]/[IM]），body 用 `- ` 列表，禁止 AI 署名尾注
- 注释中文、日志英文（script 脚本的 console 输出用中文 ✅ 符号）
- 不改 `src/engine/` 已生成文件与 2 位 id 原始事件；数据改动走 chiled.json + build:events
