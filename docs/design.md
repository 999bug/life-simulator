# 人生模拟器 — 设计文档

## 概述

一款 Web 端视觉小说风格的人生模拟游戏。玩家选择性别后，从婴儿到晚年经历一系列人生事件，每个选择影响 8 项属性，不同路径导向不同结局。

## 技术栈

| 层面 | 选择 |
|------|------|
| 框架 | React 18 + TypeScript |
| 构建 | Vite |
| 样式 | Tailwind CSS |
| 动画 | Framer Motion |
| 状态 | React Context + useReducer |
| 存储 | localStorage（存档） |
| 部署 | 纯静态，任意 HTTP 服务器 |

## 项目结构

```
life-simulator/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── public/
│   └── assets/            # 立绘、场景背景（后期替换）
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── types/
    │   └── index.ts        # GameState, LifeEvent, Choice 等类型
    ├── engine/
    │   ├── state.ts         # reducer + actions
    │   └── events.ts        # 事件数据
    ├── components/
    │   ├── TitleScreen.tsx
    │   ├── GameScreen.tsx
    │   ├── SceneArea.tsx
    │   ├── StatusBar.tsx
    │   ├── DialogBox.tsx
    │   ├── ChoicePanel.tsx
    │   └── SummaryScreen.tsx
    └── hooks/
        └── useGame.ts       # 游戏主逻辑 hook
```

## 核心数据模型

```typescript
interface GameState {
  gender: 'male' | 'female';
  name: string;
  age: number;
  stage: LifeStage;
  attributes: Record<AttributeKey, number>;  // 8 属性，0-100
  flags: string[];
  history: ChoiceRecord[];
  phase: 'title' | 'playing' | 'summary';
}

type LifeStage = 'infant' | 'childhood' | 'teen' | 'young_adult' | 'adult' | 'middle_age' | 'elder';
type AttributeKey = 'health' | 'intelligence' | 'wealth' | 'happiness' | 'social' | 'appearance' | 'luck' | 'morality';
```

## 数值设计

### 初始属性

刻意偏低，为童年成长留出空间：健康 65 / 智力 25 / 财富 20 / 幸福 60 / 社交 25 / 魅力 45 / 运气 50 / 道德 45。

### 年龄锚点成长上限

事件供给远超属性需求，若无约束所有属性在低龄就涨满。引擎为每属性设**年龄锚点成长上限**（`CAP_ANCHORS` + `ageCap`，见 `src/engine/state.ts`）：属性在对应年龄只能成长到锚点值，锚点间线性插值，形成"童年偏低 → 中年封顶 → 老年缓降"的渐进曲线。

| 属性 | 年龄锚点（岁:上限） |
| --- | --- |
| 健康 | 7:75 → 12:80 → 18:85 → 30:90 → 50:90 → 65:85 |
| 智力 | 7:55 → 12:72 → 18:85 → 30:92 → 50:92 → 65:88 |
| 财富 | 7:30 → 12:45 → 18:65 → 30:85 → 50:95 |
| 幸福 | 7:75 → 18:88 → 30:90 |
| 社交 | 7:55 → 12:70 → 18:80 → 30:88 → 50:88 → 65:85 |
| 魅力 | 7:60 → 12:68 → 18:75 → 30:80 → 50:80 → 65:78 |
| 运气 | 恒 75 |
| 道德 | 7:55 → 12:70 → 18:80 → 30:88 → 50:88 → 65:88 |

### 收益规则

- 正向收益按距当前年龄上限的余量线性递减（距上限 15 点内逐渐归零），单次增量不超过剩余空间，属性永不越过上限；过渡带内至少生效 1 点
- 负向惩罚全额生效，不受上限影响
- 模拟曲线（最优策略）：7 岁智 55 健 75 → 18 岁智 83 健 79 → 30 岁智 91 → 50 岁智 92 健 89 → 75 岁健 77 富 67
- 选项面板展示实时计算的实际生效值（与引擎应用一致）
- 效果值声明范围 ±3~±20：4 位模拟事件已全部钳位（`script/clamp-effects.mjs`）；2 位主线保留原版数值（规则豁免）

### 老年健康衰减

65 岁起每事件衰减 `3 - luck/20` 点健康（`applyElderDecay`），**下限 1**——运气再好老年机能也在衰退，每事件至少掉 1 点。健康归零或年龄超过动态寿命（基础 68 + 平均属性红利，最多 90）则死亡。

## 事件系统

事件按阶段分组，顺序触发。每个事件包含场景文本、选项列表、选项对应的属性变化和标记。

## 游戏流程

```
标题页 → 输入名字 → 选择性别 → 开始游戏
  → 婴儿期（0-2岁，自动叙事）
  → 童年（3-11岁，开始选择）
  → 少年（12-17岁）
  → 青年（18-29岁）
  → 中年（30-49岁）
  → 中老年（50-64岁）
  → 晚年（65+岁，健康衰减至死亡）
  → 结局总结
```

## MVP 范围

- 16 个事件覆盖完整一生
- 8 属性实时显示
- 打字机效果对话框
- 场景背景（渐变色占位）
- 人物剪影（SVG 占位）
- 结局评分 + 选择回顾
