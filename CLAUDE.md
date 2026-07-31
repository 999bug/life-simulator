# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

人生模拟器：React 18 + TypeScript + Vite + Tailwind 的文字人生模拟游戏。纯前端、无后端，游戏内容由 JSON 事件数据驱动。事件数据源 `script/chiled.json`（468 个事件）经转换器生成引擎格式 `src/engine/events.json`，运行时线性播放。

## 常用命令

```bash
npm run dev            # vite dev server（端口 5173）
npm run build          # tsc && vite build（生产构建）
npm run build:events   # 重新生成 src/engine/events.json（数据改动后必须跑）
node --test "script/*.test.mjs"   # 全部数据工具测试（19 个，glob 必须带引号，裸目录形式在本机报错）
```

## 架构

### 数据管道（script/）— 纯数据工程，不改引擎

```
script/chiled.json ──convert-events.mjs──▶ src/engine/events.json
        ▲
        └──prune-events.mjs（精选过滤）/ merge-fragments.mjs（片段合并+三重校验）
```

- **chiled.json**：事件数据源（snake_case 原始格式：`age_range`/`flags_add`/`has_flags`/`min_attrs`）。**所有事件改动都改这里，不手改 events.json**
- **convert-events.mjs**：唯一转换器。`ATTR_MAP`（107 键）把 chiled 属性名映射到 8 大引擎属性；`INVERSE` 集合内的键是负向维度（取反求和，如 `pressure:+8` → happiness:-8）；未映射键 fail-fast 抛错。`ATTR_ORDER`/`STAGE_RANGES` 需与 `src/engine/state.ts` 的 `ATTR_META`/`STAGE_META` 手动同步
- **prune-events.mjs**：精选工具。事件 id 规则：**2 位数字后缀 = 原始主线事件（如 child_01），一字不改、永远保留；4 位数字后缀 = 模拟事件（如 child_0017），只能被精选删除、不能改内容**。`keep-list.json` 记录保留清单（审计用）
- **merge-fragments.mjs**：合并 chiled.json + `script/fragments/` 片段，跑三重校验：convertAll fail-fast + 每岁密度（0-2 岁 1-3 个、3-12 岁 5-12 个、13-75 岁 3-7 个）+ flag 生产/消费配对（has_flags 引用的 flag 必须有产出者，not_flags 不算悬空）
- `script/build-events.mjs` 是历史遗留工具（硬编码早期事件数组，与 chiled.json 重复），新工作一律用上述三个

### 引擎（src/engine/）— 纯函数，无副作用

- **state.ts**：属性/阶段元数据（ATTR_META、STAGE_META）与状态纯函数（applyOutcomes 属性钳位 0-100、calcMaxAge 动态寿命、applyElderDecay 65 岁起衰减、checkDeath、calcScore）
- **events.ts**：加载 events.json 为 `LifeEvent[]`（注释标 357 个是过期信息，实际 428）
- **events.json**：生成物（camelCase 引擎格式：`age`/`outcomes.attr`/`outcomes.flags`/`conditions.hasFlags`），**勿手改**

### 运行时（src/hooks/useGame.ts）

`useReducer` 驱动游戏循环，核心机制：
- **线性播放**：`findNextEvent` 从当前 index+1 线性扫描第一个 conditions 满足的事件；**年龄由事件自身驱动**（同一岁的多个事件连续触发，同岁顺序 = events.json 数组顺序）
- conditions 不满足的事件静默跳过；flags 累积在 `game.flags`（不重复）
- 死亡判定：健康归零或超过 `calcMaxAge`（基于平均属性，基础 68 + 每 100 平均 +22）
- `MAKE_CHOICE` 预载下一事件，`CONTINUE` 只清反馈

### UI（src/components/）

- **GameScreen**：场景 + 数值栏 + 底部对话框区。**数值栏在 `top-[42%]`，底部区 `max-h-[45%] overflow-y-auto`——两者位置耦合，改动需保持不重叠**
- **DialogBox**：打字机效果 + 「▼ 点击继续」；事件标题显示为「标题」
- **ChoicePanel**：选项按钮（`button.group` class，effects 展示串由转换器生成）
- **SummaryScreen**：结算页（「享年 X 岁」+ 评分 + 重要选择回顾）
- **SceneArea/SceneDecor**：按阶段/年龄渲染的场景背景

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
