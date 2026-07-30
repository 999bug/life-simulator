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
