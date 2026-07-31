# 357 事件接入游戏引擎 — 设计文档

日期：2026-07-31
状态：已获用户批准

## 背景

`script/chiled.json` 已合并「模拟」数据，共 357 个事件（0-76 岁全生命周期）。游戏引擎当前使用 `src/engine/events.ts` 内硬编码的稀疏事件数组（另一格式）。本次任务：把 chiled.json 的 357 个事件接入游戏引擎，替换现有硬编码数据。

## 已确认的决策

| 决策点 | 结论 |
|---|---|
| 事件选择机制 | **保持线性顺序**：357 个事件按数组顺序依次播放，条件不满足的跳过；同一岁多个事件连续触发（age 不变），播完进入下一岁 |
| 属性体系统一 | **映射到现有 8 大属性**：106 个 JSON 属性名 → 8 个引擎属性，含 10 个取反映射 |
| 取反映射语义 | 已确认：`pressure: +8` 意为「压力+8」（坏事），映射为 `happiness: -8` |
| 标题展示 | **显示标题**：`DialogBox` 增加标题展示 |
| 接入方式 | **构建时转换**：`script/convert-events.mjs` 生成 `src/engine/events.json` |

## 数据流

```
script/chiled.json（事实源，357 事件）
   ↓ node script/convert-events.mjs（新增，含 106→8 属性映射表）
src/engine/events.json（引擎 LifeEvent 格式，生成物，入 git）
   ↓ import
src/engine/events.ts（从硬编码数组改为 import JSON + 类型导出）
   ↓
useGame.ts（线性播放 + 条件跳过，年龄由事件驱动）
```

## 格式差异对照

| 维度 | chiled.json | 引擎 LifeEvent |
|---|---|---|
| 年龄 | `age_range: [min, max]` | `age: number` + `stage` |
| 标题/分类 | `title` + `category` | 无（本次为 title 扩展类型） |
| choice 效果 | `effects: { 属性名: 数值 }` | `effects: string`（emoji 展示串）+ `outcomes.attr` |
| choice 标记 | `flags_add: string[]` | `outcomes.flags` |
| 条件 | `conditions: { has_flags, not_flags, min_attrs, max_attrs }` | `conditions: { hasFlags, notFlags, minAttrs, maxAttrs }` |
| 跳转 | 无 | `outcomes.nextAge / nextEvent / final`（本次删除） |

## 组件设计

### 1. 转换脚本 `script/convert-events.mjs`（新增）

- 内置 **ATTR_MAP**：106 个属性名 → 8 大属性（完整表见下），其中 10 个为取反映射
- 遇到未映射的属性名 → **报错退出**，不静默丢失
- 每个事件：`age = age_range[0]`；`stage` 按年龄推导（与 `getStageForAge` 相同规则）；`title`/`text`/`id` 原样保留；`category` 不接入引擎（仅数据保留在源 JSON）
- 每个 choice：`effects` 对象 → `outcomes.attr`（映射后同属性**求和合并**，如 `learning+5` 与 `knowledge+3` 合并为 `intelligence+8`）；并用 `ATTR_META` 图标生成 emoji 展示串（如 `💪+10 😊-5`）；`flags_add` → `outcomes.flags`
- `conditions`：snake_case → camelCase；`min_attrs`/`max_attrs` 的键走同一 ATTR_MAP（当前数据仅出现 health/money/empathy 三个正向键；若出现取反键则报错退出——反向条件无法直译，需人工处理）
- 输出 `src/engine/events.json`，控制台打印统计（事件数、stage 分布、警告）
- `package.json` 增加脚本：`"build:events": "node script/convert-events.mjs"`

### 2. 属性映射表（106 键，**加粗**为取反）

| 目标属性 | 来源属性名 |
|---|---|
| intelligence（37+1） | learning, knowledge, intelligence, curiosity, thinking, critical_thinking, logic, observation, memory, problem_solving, research, science, math, language, technology, engineering, creativity, imagination, innovation, independence, self_reliance, experience, maturity, adaptability, skill, talent, growth, planning, strategy, judgement, caution, focus, ambition, vision, self_awareness, efficiency, specialization, **dependence** |
| morality（10+3） | empathy, responsibility, discipline, willpower, patience, persistence, self_control, emotion_control, gratitude, loyalty, **avoidance**, **procrastination**, **impulse** |
| social（9+1） | social, friendship, relationship, family_relation, teacher_relation, teamwork, communication, leadership, trust, **introversion** |
| happiness（16+4） | happiness, stability, pride, emotion, entertainment, family_need, freedom, security_need, security, motivation, comfort, fun, balance, interest, interest_change, gaming, **pressure**, **anger**, **anxiety**, **conflict** |
| health（6） | health, sports, safety, safety_awareness, mental, resilience |
| wealth（6） | money, financial, saving, business, money_management, money_awareness |
| appearance（10） | appearance, confidence, charisma, courage, action, competition, art, music, ego, power |
| luck（3） | luck, risk, future_opportunity |

### 3. 类型变更（`src/types/index.ts`）

- `LifeEvent` 增加 `title?: string`
- `ChoiceOutcome` 删除 `nextAge` / `nextEvent` / `final`（新数据无这些字段，线性播放后为死代码）
- `Choice.effects`（emoji 展示串）保留，由转换器生成

### 4. `src/engine/events.ts`（重写）

- 从硬编码数组改为 `import events from './events.json'`，以 `LifeEvent[]` 类型导出
- 文件头部的分支机制注释更新为新机制说明

### 5. `src/hooks/useGame.ts`（简化）

- 事件推进：从 `eventIndex` 向后扫描第一个 `checkConditions` 通过的事件；`game.age` 取该事件的 `age`；`stage` 由 `getStageForAge(age)` 推导
- 删除：`out.nextAge` / `out.nextEvent` 分支跳转逻辑、`findNextEvent` 中手动推进 stage 的逻辑、`findFirstEvent` 的年龄窗口匹配（改为第一个条件通过的事件）
- 不变：老年衰减 `applyElderDecay`、死亡判断 `checkDeath`/`calcMaxAge`、历史记录、反馈文本构建、`checkConditions` 条件检查
- 事件播完 `currentEvent = null` 的行为不变（UI 现有处理）

### 6. UI（`DialogBox.tsx` + `GameScreen.tsx`）

- `DialogBox` Props 增加 `title?: string`，在元信息行（name/age/stage）中追加显示标题
- `GameScreen` 传入 `currentEvent.title`

## 错误处理

- 转换期 fail-fast：未映射属性名、缺字段（id/age_range/title/text/choices）、空 choices → 报错退出，不产出 events.json
- 运行期：`checkConditions` 对缺失属性按 `?? 0` 处理（现状保留）

## 验证

1. 转换脚本输出：357 事件全部转换、0 未映射键、抽样 3 个事件人工对比源数据
2. `npm run build`（tsc + vite）通过
3. Playwright 实际开局：标题显示正确；做 2-3 个选择后属性变化与映射表一致；年龄随事件推进；fast-forward 到老年能进入结算页

## 范围外（不做）

- 不改动 `src/engine/events.ts` 以外的引擎算法（衰减/寿命/评分公式不变）
- 不把 `category` 接入 UI
- 不做随机抽事件、加权、每岁多事件等机制（用户已选线性顺序）
- `script/build-events.mjs` 保持现状（已知会覆写 chiled.json，另案处理）
