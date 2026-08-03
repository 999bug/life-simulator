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

### 属性成长上限

事件供给远超属性需求，若无约束所有属性都会涨满 100。引擎对每属性设成长上限（`ATTR_CAP`，见 `src/engine/state.ts`），达到上限后正向收益不再生效；负向惩罚全额生效，属性可被惩罚拉低后重新增长。

| 属性 | 上限 | 说明 |
| --- | --- | --- |
| 健康 | 90 | 出生健康值 80，上限留足衰减空间 |
| 智力 | 92 | 学霸封顶，不设满值 |
| 财富 | 95 | 金钱最可积累，上限最高 |
| 幸福 | 90 | 幸福难求满 |
| 社交 | 88 | |
| 魅力 | 80 | 先天条件限制 |
| 运气 | 75 | 最难提升 |
| 道德 | 88 | |

### 收益规则

- 正向收益按距离上限的余量线性递减（距上限 15 点内逐渐归零），单次增量不超过剩余空间，属性永不越过上限；过渡带内至少生效 1 点
- 负向惩罚全额生效，不受上限影响
- 选项面板展示实时计算的实际生效值（与引擎应用一致）

### 老年健康衰减

65 岁起每事件衰减 `3 - luck/20` 点健康（`applyElderDecay`），下限 0——运气足够好（≥60）时老年不掉血，但不会反向回血。健康归零或年龄超过动态寿命（基础 68 + 平均属性红利，最多 90）则死亡。

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
