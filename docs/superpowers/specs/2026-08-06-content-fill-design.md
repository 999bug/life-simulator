# 内容补强：四类事件加量设计

日期：2026-08-06
状态：已批准（用户授权自主完成）

## 背景

埋点数据尚未积累，但事件分类分布已实锤重复感源头：`sports 9 / technology 15 / hobby 16 / love 38` 对比 `personality 114 / family 108`。高频玩家在这四条线上会很快看到重复事件。本设计补 63 个模拟事件（4 位 id，2 位主线一字不动），消除明显空缺段。

## 现状空缺（按起始岁口径）

- **sports**：壮年（30-49）/ 中年（50-64）/ 老年（65+）几乎空白，仅 42 岁 1 个
- **technology**：青年（18-32）空白
- **hobby**：**12-44 岁整段空白**（最严重）
- **love**：中年（30-49）稀疏，仅 8 个

## 岁位分配（全局统筹，每岁不超密度上限）

密度上限（merge 校验，起始岁口径）：0-2 岁 5、3-12 岁 13、13-75 岁 8、76+ 无限制。

| 岁 | 事件 | 岁 | 事件 |
|---|---|---|---|
| 3 | sport | 49 | tech + hobby |
| 4 | sport | 50 | love |
| 5 | sport + hobby | 51 | sport + hobby |
| 6 | sport + hobby | 55 | tech |
| 7 | sport + hobby | 56 | sport + hobby |
| 8 | tech | 58 | tech |
| 9 | tech | 59 | tech |
| 10 | tech | 61 | hobby |
| 11 | hobby + love | 64 | tech |
| 12 | hobby + love | 65 | love |
| 13 | sport | 67 | sport + hobby |
| 37 | love | 68 | tech |
| 41 | hobby | 69 | love |
| 43 | hobby | 71 | sport + hobby |
| 44 | tech | 72 | tech |
| 45 | sport + hobby | 73 | love |
| 48 | sport | 74 | love |

| 岁 | 事件 | 岁 | 事件 |
|---|---|---|---|
| 77 | sport + hobby | 86 | hobby |
| 78 | tech | 87 | sport |
| 79 | love | 88 | tech |
| 80 | sport | 89 | sport |
| 82 | tech | 90 | hobby |
| 83 | sport | 91 | love |
| 84 | love | 92 | tech |
| 85 | sport | 93 | love |
|  |  | 95 | hobby |

合计：**sport 18 / tech 15 / hobby 18 / love 12 = 63 个**。

## 创作规范（4 个 fragment 文件，经 merge-fragments.mjs 合入）

1. **文件**：`script/fragments/sport-fill.json`（18 个，id `sport_0001` 起）/ `tech-fill.json`（15 个，`tech_0001` 起）/ `hobby-fill.json`（18 个，`hobby_0001` 起）/ `love-fill.json`（12 个，`love_0001` 起）
2. **格式**：chiled.json snake_case（`id/age_range:[n,n] 单岁/category/title/text/choices/conditions`）
3. **叙事**：中文第二人称 50-150 字，情绪真实，避免与现有同类标题主题重复
4. **选项**：3 个，第一人称行动/台词；每项 `effects` 1-3 键（仅 ATTR_MAP 键，值 ±3~±20）；`flags_add` 可选
5. **flag 规则**：`has_flags` 仅可引用「可消费 flag 清单」（见下）；`flags_add` 仅可延续清单内 flag——**不设计新 flag**（避免死 flag）
6. **conditions**：`{ has_flags, not_flags, min_attrs, max_attrs }`，默认空数组/空对象
7. **效果合理性**：与叙事匹配；压力/焦虑等负向键（INVERSE 集）注意是负向维度（压力:+8 → 幸福-8），创作时按"幸福压力"的语义书写效果而非直接加幸福

## 可消费 flag 清单（均有产出者，安全引用）

- **运动链**：`athlete` / `fitness_journey` / `martial_arts` / `regional_competitor` / `school_competitor`
- **科技链**：`tech_savvy` / `technology_path` / `tech_lead` / `ai_interest` / `coding_early` / `future_programmer` / `content_creator`
- **兴趣链**：`artist_life` / `music_path` / `gardener` / `rediscovered_hobby` / `has_dog` / `has_cat` / `animal_love`
- 注：`sports_teacher` 是职业向（青年教师当体育老师），sport 事件可生产但不宜消费

## 主题方向（不限定死，作为创作启发）

- **sport**：童年运动启蒙（轮滑/游泳/球类/校运会）→ 13 中考体育 → 壮年周末球局/健身 → 中年骑行/羽毛球 → 老年太极/晨练/门球 → 76+ 高龄运动
- **tech**：童年科技启蒙（遥控车/电器/家庭电脑）→ 壮年职场数字化/远程办公 → 中年智能家居/手机摄影/短视频（content_creator 链）→ 老年学用智能设备/网购/视频通话
- **hobby**：童年兴趣延续（音乐/绘画/宠物/模型）→ **重点填 12-44 空白**：少年社团、青年爱好、壮年兴趣重燃（rediscovered_hobby 链）→ 中年园艺/书法/钓鱼 → 老年老年大学/下棋/社区
- **love**：11-12 懵懂好感 → 壮年婚姻经营/危机和解/纪念日 → 中年空巢重燃/黄昏恋 → 老年老伴/再婚

## 校验流程

1. `node script/merge-fragments.mjs`（三重校验 fail-fast：convertAll + 每岁密度 + flag 配对）
2. 同步 `script/keep-list.json` 追加全部新 id（否则 prune 会被过滤）
3. `node script/build:events`（即 `npm run build:events`）重新生成 public/events.json
4. `node script/stats.mjs` 复核密度与分类分布
5. `node --experimental-strip-types script/sim-balance.ts 500` 平衡审计（属性归零率/享年/结局分布）
6. UI 测试 + build 回归（events.json 格式变化不破坏引擎）

## 非目标

- 不改 2 位主线事件、不改现有 4 位事件内容
- 不新增 flag（全部沿用清单内 flag）
- 不调整其他类别密度
