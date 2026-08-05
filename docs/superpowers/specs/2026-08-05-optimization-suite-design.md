# 12 项优化并行开发 — 设计文档

日期：2026-08-05
状态：已获用户批准（分节确认：架构+内容组 → 玩法组+工程组）

## 背景

产品视角盘点出 12 项优化，按文件冲突划分 3 组 8 个 agent 并行开发。数据事实（2026-08-05 实测）：

- 513 事件；97-103 岁零事件、96 岁仅 1 个（`elder_0115 [95,96]`）
- 0 岁仅 1 个事件；1/2 岁各 3/4 个
- 29 个分类中 11 个 ≤3 个事件（creativity/animal/nature/art/social/conflict/leadership/interest 各 1）
- 76-90 岁每岁 4 个事件，密度校验只到 75 岁（76+ 无约束）
- `category` 在 `src/` 零引用（UI/引擎不依赖分类）
- 每岁密度规则：0-2 岁 1-3、3-12 岁 5-12、13-75 岁 3-7 个/岁（`script/merge-fragments.mjs`）

## 已确认的决策

| 决策点 | 结论 |
|---|---|
| 执行策略 | 三组全并行（内容组 4 agent / 玩法组 1 agent 内部串行 / 工程组 3 agent） |
| T1 寿星主题 | 世纪回望（时代见证） |
| T2 开局主题 | 家庭底色（出生/家庭经济氛围刻画） |
| T4 支线题材 | 三条全做：养宠一生、创业沉浮、音乐人生 |
| T10 晚年倾向 | 家人回忆 : 爱好传承 = 6:4 |
| 并行冲突消除 | 按文件所有权划分 agent；新 fragment 一律用目标分类；T2 独占改 merge-fragments.mjs |
| 组间依赖 | T5 周目扩展无数据依赖（传承加成 + 双命运事件） |

## 并行架构（8 agent，三组）

| Agent | 任务 | 独占文件 | 备注 |
|---|---|---|---|
| 内容-1 | T1 世纪回望 | `script/fragments/century.json` | id `elder_0116+` |
| 内容-2 | T2 家庭底色 | `script/fragments/infant.json` + `merge-fragments.mjs`（密度规则） | id `infant_0001+`，唯一改 merge 脚本者 |
| 内容-3 | T4 三条支线 | `saga-pet.json` / `saga-venture.json` / `saga-music.json` | id `pet_/venture_/music_` |
| 内容-4 | T10 晚年温情 | `script/fragments/elder-warmth.json` | id `elderwarm_0001+` |
| 玩法 | T9→T6→T7→T5 | `src/**` | 组内串行（共享 useGame.ts/TitleScreen） |
| 工程-1 | T3 分类合并 | `script/chiled.json` + 存量 4 片段 | 不碰新片段文件 |
| 工程-2 | T8+T12 | `vite.config.ts` / `package.json` / `src/test/**` | 合并（两者共享配置文件） |
| 工程-3 | T11 事件看板 | `script/stats.mjs` + `stats.test.mjs` | 独立新文件 |

约定：
1. 新 fragment 文件直接用 T3 合并后的目标分类（T3 只改存量文件）
2. 事件 id 前缀错开，杜绝冲突
3. 所有效果键限 `ATTR_MAP` 白名单；flag 生产/消费成对

## 组 A 内容组

### T1 世纪回望（century.json，6 个事件，97-103 岁各 1 个）

| age | 主题 |
|---|---|
| 97 | 跨过百年（时代变迁回望：煤油灯到智能手机） |
| 99 | 旧友的最后告别（讣告/代收的信） |
| 100 | 百岁宴（重孙/记者/时代采访） |
| 101 | 老手艺传人 |
| 102 | 给后辈留话 |
| 103 | 世纪的回信（终局；播完 `next===null` 自然寿终） |

- 效果温和正向（happiness/social/morality +1~+3），不给死亡压力
- 103 岁事件为数据流终点，闭环完整

### T2 家庭底色（infant.json，新增约 6 个）

- 0 岁补 2-3 个（产房清晨/大雪夜出生/满月酒）→ 0 岁 3-4 个
- 1-2 岁补 3-4 个（发高烧的夜/邻居串门/第一句「不」）→ 每岁 4-5 个
- 效果刻画家庭底色：wealth/happiness/morality 小幅开局分化
- **merge-fragments.mjs 密度规则 0-2 岁从 1-3 放宽到 3-5**（先跑现状确认计数口径——现有 2 岁 4 个已可能越界）

### T4 三条支线（各 5 段、2 个 flag 闭环）

- **养宠一生**：6 岁街角小狗(`pet_dog`)→ 14 岁狗老了 → 22 岁送别(`pet_memory`)→ 40 岁路遇流浪猫 → 60 岁想起它。分类 animal×3 + family/health；喂饱 animal 分类（现 1 个）
- **创业沉浮**：24 岁辞职创业(`venture`)→ 28 岁融资失败 → 33 岁成/败(`venture_out`)→ 45 岁行业寒冬 → 60 岁回望。分类 career + finance
- **音乐人生**：8 岁第一次摸琴(`music_piano`)→ 16 岁校园乐队 → 21 岁放弃/坚持(`music_stick`)→ 35 岁深夜琴房 → 70 岁琴声。分类 creativity×2 + personality/emotion；喂饱 creativity（现 1 个）

- flag 语义：hasFlags 消费后 flag 仍保留在 `game.flags`，多段推进靠 age_range 不同岁
- 支线选项效果值 ±3~±20，每项 1-3 键

### T10 晚年温情（elder-warmth.json，10 个事件）

- 6:4 混合：家人回忆 6 个（孙辈/老友/相册/旧信/老伴/儿时物件）+ 爱好传承 4 个（老年大学/园艺/回忆录/手艺）
- 放置 76-90 岁区间（每岁补 1 个，无密度约束），属性 happiness/social/empathy 正向，中和老年衰减挫败感

## 组 B 玩法组（src/**，组内按序 T9→T6→T7→T5）

### T9 局中重开

- 复用右上角 ✕ 确认弹窗，增加第三选项「🔄 重新开始本局」（同设置、新随机种子洗牌、丢本局进度）
- reducer 新增 `RESTART` action，复用 START_GAME 初始化逻辑
- autoPlay（快速模拟）模式下不显示

### T6 自定义目标

- GoalModal 增加「🎯 自定义目标」→ 选 2-3 个属性 + 滑杆设目标值（0-100）
- `GoalKey`/`game.goal` 类型扩展为 union（预设 key | 自定义 `{ attrs: Partial<Attributes> }`）
- `checkGoal` 扩展：自定义目标逐属性对比，全部达标 = 达成
- 结算页目标区块按「目标值 / 实际值」展示
- 旧存档兼容：读档时 goal 缺失/旧 key 照常处理

### T7 每日挑战

- TitleScreen 新增「📅 每日挑战」入口（并入现有按钮区；720px 极限，改动后必须回归）
- 种子 = 日期确定性哈希（YYYYMMDD → number），同日全局同一局；手动推进、无目标/无挑战
- 持久化 `life-sim-daily`：`{ date, bestScore, bestAge }`；入口显示「今日最佳」
- 结算后更新当日最佳；不写存档槽（同快速模拟约定）

### T5 周目扩展

- 第 4 周目（totalLives ≥ 3）「传承加成」：
  - Stats 新增 `lastEndAttrs: Partial<Attributes>`（结算时写入终局属性；旧存档缺失 = 无加成，向后兼容）
  - 开局取其中最高的 2 项属性各 +8；挑战开局 -10 独立叠加；结算页标注「传承」
- 第 5 周目（totalLives ≥ 4）「双命运事件」：`pickFateEvent` 抽 2 个
- 无数据依赖，纯引擎 + 持久化

## 组 C 工程组

### T3 分类合并（29 → 11）

| 并入目标 | 来源分类 |
|---|---|
| personality | creativity, art, milestone, growth, future |
| health | animal, nature |
| friend | social, conflict |
| career | leadership, competition |
| hobby | interest |
| finance | money |
| education | exam, school, teacher, learning |
| love | emotion |

保留：family / career / health / friend / education / personality / technology / love / finance / hobby / sports（11 个）
改 chiled.json + 存量 4 片段；`src/` 无分类引用（已核实），纯数据改动。

### T8+T12（合并：共享 vite.config/package.json）

- PWA：vite-plugin-pwa + manifest（192/512 PNG 图标，node 脚本生成）+ SW 离线缓存 app shell
- UI 测试基建：vitest + @testing-library/react + jsdom
- 首批测试选稳定组件：DialogBox / SummaryScreen / AchievementsModal / StatsModal / biography.ts / sound.ts；明确避开 TitleScreen / GameScreen / GoalModal（玩法组改动中）

### T11 事件看板（script/stats.mjs）

输出：每岁密度表（0-103）/ 分类分布 / flag 生产-消费配对与悬空引用 / 效果值范围分布 / 96+ 岁空缺提示 / 2 位 vs 4 位 id 统计。
统计逻辑抽纯函数 + `stats.test.mjs`（并入 node --test "script/*.test.mjs" 体系）。

## 统一验证流程（主会话收尾）

1. `node script/merge-fragments.mjs` + `npm run build:events`（密度/flag 三重校验）
2. `node --test "script/*.test.mjs"` + 引擎测试（47 个）+ 新增测试
3. `npm run build`（tsc 严格）
4. TitleScreen 720px 回归（T6/T7 触碰）
5. `npm run dev` 冒烟：快速模拟一局 → 每日挑战入口 → 重开弹窗 → 自定义目标
6. 更新 CLAUDE.md（新功能/新配置/状态字段）与 docs/design.md
7. 按功能分组提交（[NF] 新功能 / [IM] 改进）

## 风险与对策

| 风险 | 对策 |
|---|---|
| 内容质量参差（4 个 agent 创作） | 统一写作规范（id 前缀/属性白名单/文本 50-150 字/效果 ±3~±20）；merge 三重校验兜底 |
| TitleScreen 720px 极限被 T6/T7 破坏 | 改动后必须回归检查；入口并入现有按钮区不新增行高 |
| T5 新增 stats 字段破坏旧存档 | 字段校验宽松（缺失即 undefined），缺失则无加成 |
| 密度规则放宽与现有数据冲突 | T2 先跑现状确认计数口径，再定新阈值 |
| 多 agent 并行改 package.json | T8+T12 合并为同一 agent 独占 |
