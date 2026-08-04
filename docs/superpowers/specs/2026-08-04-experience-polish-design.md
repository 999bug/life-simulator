# 体验强化设计（第四弹）

日期：2026-08-04
状态：已批准（用户授权自主完成）

## 背景

三弹完成后（节奏/存档/目标成就/条件可见/分享/老年内容），再推进 8 项优化：生涯年表、86-90 岁内容、id 规则校验、反馈收益解释、音效丰富、移动端适配、成就扩展、本地生涯统计。

## 模块 1：生涯年表（人生大事记）

### 现状

结算页只回顾最后 10 个选择，无完整人生线。

### 方案

- `ChoiceRecord` 加可选字段 `flags?: string[]`——`MAKE_CHOICE` 记录该选择产出的 flag（旧存档无此字段，兼容）
- 定义里程碑 flag 组（约 12 个，取自既有 228 个 flag）：`went_to_college`、`grad_school`、`top_university`、`married`、`has_child`、`doctor`、`startup_success`、`civil_servant`、`world_traveler`、`athlete_pro`、`military_flag`、`skilled_worker`、`tech_career`、`retired`
- SummaryScreen「重要选择回顾」区块重写为**完整时间线**：全部 history 按 age 分组展示（滚动），命中里程碑 flag 的事件显示 ⭐ 高亮
- 旧存档无 flags 字段 → 时间线正常显示、无里程碑标记

## 模块 2：86-90 岁内容补强（5 个事件）

- 第三弹补了 76-85 + 91-95，86-90 岁每岁 2 个。补 5 个（elder_0116~0120，86/87/88/89/90 岁各 1 个）
- 主题：晚年生活延续（老友聚会、广场舞比赛、孙辈毕业、老屋修缮、90 大寿）
- 效果键 ATTR_MAP 合法键；无 flag；±3~±20

## 模块 3：数据工具 id 规则校验

- `convert-events.mjs` 的 fail-fast 增加 id 后缀校验：`/_\d{2}$/`（主线）或 `/_\d{4}$/`（模拟），其他（如 3 位）抛错
- 堵住 adult_100 类漏洞（历史数据已全合规，纯防未来）

## 模块 4：反馈页收益解释

- `MAKE_CHOICE` 反馈文本：正向收益因年龄上限衰减时附加说明「（距上限 X 点）」
- 判定：`raw > 0 && (cap - current) < 15`（与 effectiveDelta 过渡带一致），X = `max(0, floor(cap - current))`
- 负向收益不标注（全额生效）

## 模块 5：音效丰富

- `sound.ts` 新增两个合成音：`sfx.achievement()`（上扬琶音，成就解锁时）、`sfx.stage()`（低沉过渡，阶段切换时）
- 播放时机：结算页新成就非空时播 achievement；GameScreen 的 stage 变化（非首次渲染）播 stage
- Web Audio 合成，无外部资源

## 模块 6：移动端适配

- 舞台固定 960×720 逻辑尺寸，外层按视口缩放：`scale = min(vw/960, vh/720)`（<1 时缩小，≥1 时保持 1）
- 实现：App 内 `useEffect` 监听 resize + `transform: scale()` 包裹舞台容器
- 验证：375×667 手机视口完整可见

## 模块 7：成就扩展（12 → 20）

新增 8 个（全部用最终状态/累计统计判据，无历史追踪）：

| id | 名称 | 判据 |
|---|---|---|
| top_score | 名垂青史 | 评分 ≥ 85 |
| genius | 天才大脑 | 智力 ≥ 95 |
| iron_body | 铁打的身体 | 健康 ≥ 90 |
| rich_king | 富可敌国 | 财富 ≥ 95 |
| big_family | 儿孙满堂 | 已婚 + 有娃 + 幸福 ≥ 80 |
| ultra_life | 期颐之年 | 享年 ≥ 95 |
| five_endings | 阅尽千帆 | 累计达成 5 种不同结局 |
| ten_lives | 十世轮回 | 累计完成 10 局 |

- `AchievementStore` 加 `endings: string[]`（结局标题去重集合，结算时并入；旧 store 兜底 []）
- `checkAchievements` 输入加 `endingsCount`（来自 store）

## 模块 8：本地生涯统计

- 新 key `life-sim-stats`：`{ totalLives, bestScore, totalAge, endings: Record<string, number> }`
- 结算时写入（与成就持久化同 effect 时机）：totalLives+1、bestScore 取大、totalAge 累计、endings[结局标题]+1
- 标题页「📊 生涯统计」入口模态（StatsModal）：总局数/最佳评分/平均寿命/结局分布列表（按次数排序）
- 旧数据不存在 → 空统计

## 测试与验证

- checkAchievements 新成就单测（script/goals.test.ts 扩展）
- id 校验：数据工具测试（构造 3 位 id 事件 → 抛错）
- 其余模块浏览器端到端：年表里程碑标记/反馈衰减说明/成就解锁音/375×667 缩放/统计面板
- 回归：存档兼容（ChoiceRecord.flags 可选、AchievementStore.endings 兜底、stats 新 key）
- 720px 标题页不溢出（新增「生涯统计」入口后复查）

## 风险

- ChoiceRecord 加字段不改存档结构校验（isValidSaveData 只查 game/eventIndex）✓
- 时间线全量展示可能较长——结算页本身可滚动，接受
- 移动端缩放 transform 不影响交互（pointer 事件随 transform 映射）
