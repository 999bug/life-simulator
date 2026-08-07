# 选择体验提升：性格画像系统 设计文档

日期：2026-08-07
状态：已批准（方案 A，用户授权自主推进）

## 背景与问题

实测反馈「选择环节枯燥无味」，拆解为三个层面：

1. **外观层**：所有选项都是同一排纯文字按钮，无风格区分，扫一眼分不清
2. **反馈层**：选完只有一段静态文字 + 属性数字变化，选择没有「实感」与「分量」
3. **内容层**：部分事件与选项文案平淡，缺少戏剧张力（用户已确认分批全量重写，作为后续独立批次）

## 目标

- 让每个选项一眼有性格区分度（外观层）
- 让选择累积成「性格画像」，世界记住你是谁（反馈层 + 长期塑造）
- 为内容层重写铺路（flag → 性格映射表可扩充、预留手工标注位）

## 核心设计：3 维 6 端性格画像

| 维度 | 两端 | 性格感 |
|---|---|---|
| 思维模式 | 🧠 理性 ↔ 😊 感性 | 用头脑 vs 跟随内心 |
| 风险偏好 | ⚡ 冒险 ↔ 🏠 安稳 | 敢赌 vs 求稳 |
| 价值取向 | 💰 利己 ↔ 🤝 利他 | 为自己 vs 为他人 |

**不做「外向/内敛」维**：与八大属性 social 高度重叠，且 npcs 关系线已覆盖社交维度，加进去标签饱和、噪音大。

### 映射规则（强信号，无信号不标注）

对选项 `outcomes.attr` 求和后判定（阈值定义为常量）：

| 性格端 | 规则 |
|---|---|
| 理性 | 智力 ≥ 6 且 幸福 ≤ 0（用头脑而非情感） |
| 感性 | 幸福 ≥ 6 且 智力 ≤ 0（跟随内心） |
| 冒险 | 负向总额 ≤ -8 且 正向总额 ≥ 8（付出代价换高回报） |
| 利己 | 财富 ≥ 8 且 道德为负（牺牲道德换财富；道德无变化不标——「没提道德 ≠ 主动利己」，避免财富选项泛滥） |
| 利他 | 道德 ≥ 6（为他人付出） |
| 安稳 | **无自动规则**（效果结构无可靠信号），由 flag 补充表或未来手工标注供给 |

flag 补充规则 `PERSONA_FLAG_RULES`：叙事性强的 flag 手工映射（如 gap_year 休学 → 冒险、volunteer 志愿者 → 利他）。初始表从现有 flag 清单中挑选叙事信号明确者，内容层重写时持续扩充。

一个选项最多命中 2 端；一生的画像由几百次选择累积（每次选择命中端 +1）。

## 架构

### 引擎层 `src/engine/personality.ts`（新文件，纯函数，零存档字段）

- `PersonaTrait`：6 端联合类型
- `PERSONA_META`：每端 name/icon/color/dimension/opposite（展示元数据）
- `PERSONA_FLAG_RULES`：flag → 性格端映射表
- `EMPTY_PERSONA`：全 0 画像
- `traitForOutcome(attr, flags)`：选项效果 → 命中的性格端数组（0-2 个）
- `derivePersona(history, eventsMap)`：从 `GameState.history`（已记录 eventId+choiceIndex）反查事件数据推导画像；**事件 id 缺失（被 prune）或 choiceIndex 越界 → 跳过该条**，不崩溃
- `personaSummary(persona)`：一句话概括（见下）

**纯推导的兼容性**（与 npcs/jobs/assets 同一架构）：

- 旧存档自动兼容（无新字段）
- undo 回退自动正确（history 随快照回退）
- 每日/每周/种子挑战、快速模拟、结算回看（detail.history）全部自动兼容
- 性能：O(history)，运行时事件表用 Map 构建一次

### 数据流

```
选择 → history push → 反馈页：traitForOutcome(最后一条 history 反查的选项) 展示「⚡ 冒险 +1」
                      → 结算页：derivePersona(全量 history) 展示画像
```

「本次选择贡献」无需 diff 计算：每次选择命中端即 +1，直接对当前选项算标签即可。

### UI 层

1. **ChoicePanel**：选项按钮加性格徽章（小圆角标签，PERSONA_META 配色）；无信号选项不显示徽章（留白也是区分）。真实模式徽章保留（徽章是风格提示不是数值，不违背「防按数值选择」的实测反馈）
2. **GameScreen 反馈页**：反馈文字下方一行「你的选择：⚡ 冒险 +1 · 🤝 利他 +1」（从 history 最后一条推导）
3. **SummaryScreen 结算页**：性格画像区块——3 维双端条形图 + 一句话概括；安稳端为 0 时淡化显示
4. **biography.ts**：传记 markdown 加「性格画像」段落

### 一句话概括规则

每端定义 adj（形容词）+ noun（人设名词）：

| 端 | adj | noun |
|---|---|---|
| 理性 | 理智清醒 | 思考者 |
| 感性 | 情感丰沛 | 浪漫主义者 |
| 冒险 | 大胆无畏 | 冒险家 |
| 安稳 | 谨慎踏实 | 稳行人 |
| 利己 | 精明务实 | 现实主义者 |
| 利他 | 温暖善良 | 给予者 |

- 总分 < 2：无鲜明印记（「这一生没有留下鲜明的性格印记」）
- 取 Top1、Top2（不同端）：`一个${adj(Top1)}的${noun(Top2)}`（如「一个大胆无畏的浪漫主义者」）
- Top2 与 Top1 同维对冲或无 Top2：`一个${adj(Top1)}的${noun(Top1)}`

## 测试

`script/personality.test.ts`（node --experimental-strip-types，风格对齐 family.test.ts）：

- traitForOutcome：5 条自动规则各自命中与边界（6 命中 5 不中）、双端命中、无信号返回空
- flag 补充规则命中
- derivePersona：累积正确、缺失事件跳过、旧档兼容
- personaSummary：门槛、Top1/Top2 组合

验证：`node --experimental-strip-types --test script/personality.test.ts` + 全量引擎测试 + `npm run test:ui` + `npm run build`

## 文档同步

- CLAUDE.md：引擎章节新增 personality 推导系统；UI 章节更新 ChoicePanel/SummaryScreen/传记
- `src/data/changelog.ts` 更新日志条目

## 后续批次（内容层重写，独立任务）

- PERSONA_FLAG_RULES 随重写扩充
- 预留数据层可选手工标注字段（`personality: []`），convert-events.mjs 透传
- 分批全量重写 681 个事件（371 主线 + 310 模拟）的选项文案，重写时同步打磨性格信号
