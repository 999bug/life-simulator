# 主动行为系统（BitLife 仿照大版本）设计文档

日期：2026-08-07
状态：已批准（用户指令「仿照 BitLife 开抄，大版本，开发前已存档 tag v0.7.0」）

## 背景与目标

对标 BitLife 最大玩法差异：**玩家主动经营人生**。当前项目是纯被动事件流（事件来 → 选择），玩家无法「主动做一件事」。本版本引入主动行为系统：局内随时发起健身/学习/打工/社交/体检/休闲/犯罪等活动，立即产出结果。游戏从「看命运」变成「经营人生」。

## 核心设计

### 活动（Activity）

```ts
interface Activity {
  id: string;              // 'fitness' | 'study' | 'work' | 'social' | 'health' | 'leisure' | 'walk_dog' | 'crime'
  name: string;            // 中文名
  icon: string;
  desc: string;            // 面板说明
  minAge: number;          // 可用年龄（工作 16+、犯罪 14+）
  requires?: string[];     // flag 要求（遛狗要求 has_dog/has_pet/has_cat）
  results: ActivityResult[]; // 结果池（3-4 个变体，抽取一个）
}
interface ActivityResult {
  text: string;            // 结果叙事（第二人称，useName 称呼替换）
  attr: Partial<Attributes>; // 属性效果（克制：+3~6，犯罪高风险高收益）
  flags?: string[];        // 产出 flag（犯罪被抓 → jailed）
}
```

活动表内嵌 `src/engine/activities.ts`（仿 companion.ts 模式，数据在引擎内，不占事件密度）。

### 时间模型：每岁行动配额（替代 BitLife 的年龄推进）

BitLife 每次行动 +1 岁；本项目年龄驱动事件流，推年龄会打乱线性播放。**采用配额制**：

- `GameState.actionsThisAge?: number`（可选字段，旧存档兼容；undo 快照自然携带回退）
- 每岁限 **2 次**行动；第 3 次起行动按钮置灰（「本岁已行动 2/2，明年再来」）
- 行动**不推进年龄、不进 history**（不污染性格/传记/npc/人物推导——纯即时操作）

### 活动清单（第一批 8 个）

| id | 名称 | 效果（结果池 ±） | 备注 |
|---|---|---|---|
| fitness | 🏃 健身 | health +3~6 | 晨跑/健身房/爬楼梯变体 |
| study | 📚 学习 | intelligence +3~6 | 读书/网课/自习变体 |
| work | 💼 打工 | wealth +5~10 | 16+ 岁；零工/加班/私活变体 |
| social | 🤝 社交 | social +3~6 | 约友/聚会/打电话变体 |
| health | 🏥 体检 | 概率性：安好(+happiness)/小问题(health 预警) | 每年可查 |
| leisure | 😌 休闲 | happiness +3~6 | 散步/电影/发呆变体 |
| walk_dog | 🐕 遛宠物 | happiness + social +3~5 | requires 宠物 flag |
| crime | ⚖️ 犯罪 | 成功 wealth +15 morality -8 / 被抓 → jailed / 失败小损 | 14+ 岁；高风险高收益 |

### 犯罪成功率（纯函数，可测试）

```
成功率 = 基础 60% + 运气 × 0.5% + 智力 × 0.3%，上限 90%
```
- 成功：财富大额 +，道德 -（进结果池文案）
- 失败：随机——被抓（**直接产出 jailed flag**，后续事件流自然播放 prison_0035 入狱第一天——审判事件 prison_0034 留给 gray_deep 被动链，两条入口平行）；落荒而逃（小损）

### 引擎接入（useGame）

- 新 action：`MAKE_ACTION { activityId }`
  - 校验：actionsThisAge < 2、minAge、requires、非快速模拟/非反馈页
  - 应用：结果池抽取（`Math.random`——不要求确定性，活动是即时操作）→ 属性 clamp → flags 追加（jailed 等）→ `actionsThisAge++` → feedback 展示结果文本
- feedback 复用现有机制（反馈页展示 + 「你的选择」徽章行不适用——活动不产生性格徽章，跳过该行）
- undo 不覆盖活动（不进 undo 栈；undo 回退 age 后 actionsThisAge 随快照回退——配额自然恢复，可接受）

### UI

- GameScreen 底部操作区（速度按钮旁）加「⚡ 行动」按钮（非 autoPlay 显示；反馈页隐藏——反馈页是纯点击继续）
- `ActionModal`：活动列表（icon + 名 + 描述 + 可用性置灰），点击执行 → 关闭 → feedback 展示结果
- 按钮旁小字显示「本岁已行动 N/2」
- 快速模拟模式不显示（autoPlay 跳过）

### 存档/兼容

- GameState.actionsThisAge 可选字段（旧存档无 = 0）
- 活动不进 history：性格/传记/npc/人物推导零影响
- 犯罪被抓的 jailed flag 与铁窗路线（v0.7.0）无缝衔接

### 平衡原则

- 常规活动收益（+3~6）低于事件收益（+8~20）——活动可重复（2 次/岁），事件一次性
- 犯罪 +15/-8 高风险：成功收益略高于事件但代价大，被抓 → 铁窗路线（生涯级影响）
- 活动收益不享受年龄上限递减以外的任何加成（不与天赋/传承叠加计算，直接 applyOutcomes）

## 测试

- `script/activities.test.ts`：活动表完整性（8 个、结果池 ≥3、效果合法）、成功率函数（边界/上限 90%）、被抓判定、MAKE_ACTION 逻辑（配额/年龄/flag 要求）
- UI：ActionModal 组件测试（列表渲染/置灰/执行回调）
- 全量回归：引擎/数据/UI 现有测试不能破坏

## 文档同步

- CLAUDE.md：引擎章节加 activities.ts；GameScreen 章节加「⚡ 行动」入口与 ActionModal；useGame 章节加 MAKE_ACTION
- changelog 0.8.0「主动人生」；README 玩法章节
- 版本号 package.json 0.8.0

## 后续批次（本版本不做）

- 📱 社交媒体（发动态/涨粉/翻车）
- 💀 死亡彩蛋（离谱意外死亡，低概率）
- 技能树（工作技能成长体系）
