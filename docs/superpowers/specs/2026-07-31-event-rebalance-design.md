# 事件池再平衡 — 设计文档

日期：2026-07-31
状态：已获用户批准

## 背景

`script/chiled.json` 现有 357 个事件，分布严重失衡：小学段（3-12 岁）291 个，而 20-50 岁「最精彩」的成年段只有 30 个（每岁约 1 个）。用户目标：减少小学事件，按已有事件风格丰富 20 岁以后（重点 20-50 岁）的事件。

## 已确认的决策

| 决策点 | 结论 |
|---|---|
| 小学段密度 | 每岁 ~10 个（291 → ~100，含 12 岁） |
| 20-50 岁密度 | 每岁 ~5 个（新增 ~150） |
| 50+ 密度 | 大幅丰富，每岁 ~5 个（新增 ~118） |
| teen 13-17 | 补到每岁 ~5 个（新增 ~18） |
| 原始 66 个主线事件 | **全部保留**，增删围绕它进行 |
| 生成方式 | 子代理按龄段分 5 批生成（teen/young/adult/mid/elder） |
| 播放机制 | 保持线性顺序不变（单局时长随之变长，用户已知悉） |

## 目标分布

| 阶段 | 现状 | 目标 | 变化 |
|---|---|---|---|
| infant 0-2 | 2 | 2 | 不动 |
| childhood 3-11 | 274 | ~90 | 删 ~184（精选 ~80 + 原始 10） |
| teen 12-17 | 34 | ~35 | 删 17（12 岁留 ~10）+ 新增 ~18 |
| young_adult 18-29 | 18 | ~60 | 新增 ~42 |
| adult 30-49 | 12 | ~100 | 新增 ~88 |
| middle_age 50-64 | 7 | ~75 | 新增 ~68 |
| elder 65-76 | 10 | ~60 | 新增 ~50 |
| **合计** | 357 | **~420** | 删 ~200 / 新增 ~265 |

## 小学削减 rubric（291 → ~100）

子代理按规则挑选保留清单，**脚本按清单过滤**（不手改 JSON）：

1. 优先保留「第一次」里程碑系列（第一次养宠物/阅读/体育活动…）
2. 每岁 category 多样化（family/school/friend/learning/sports/emotion/animal 等不扎堆）
3. 优先带 `flags_add`、choices ≥ 3 的事件
4. 同岁同主题只留质量最好的一个

## 新事件生成规范（风格指南，从 66 个原始事件提炼）

- **text**：第二人称「你」、2-4 句、具体场景 + 细节 + 情绪，50-150 字，常以年龄开头（「三十岁，」）
- **choices**：2-4 个，正/中/负取向混合；选项文本是第一人称行动或台词
- **effects**：只用现有 106 键属性白名单（`script/convert-events.mjs` 的 ATTR_MAP，未映射键转换时 fail-fast）；单项 ±3~±20，负面选择给代价
- **age_range**：`[age, age]` 或 `[age, age+1]`
- **ID**：沿用前缀续号（young_19+、adult_13+、mid_08+、elder_11+、teen_08+）

### flag 规范（gap_year 教训）

现状：316 个 flag 有生产者，仅 12 个有消费者（best_friend/bully/first_love/academic_path/tech_path/went_to_college/tech_career/startup/civil_servant/world_traveler/married/marriage_renewed/grandparent）。

- conditions 引用的 flag **必须有产出者**，禁止 `gap_year` 式死条件
- 关键人生 flag（married、has_child、promoted 等）应在新事件中获得**多条产出路径**（目前 married 仅 1 个产出事件）
- 纯记录型 flag（无消费者）允许存在，但新引入的 flag 需在生成报告里登记

## 顺带修复（上一轮 parked findings）

1. **gap_year 死条件**：现状是产出者叫 `gap_year_done`、消费者要 `gap_year`（一词之差）。修法：给产出 `gap_year_done` 的那个事件的 `flags_add` 补上 `gap_year`（一词不改，只补 flag），`young_05` 变为可达
2. **口径修正**：`convert-events.mjs` 头注释「106 个属性名」改为「107 条映射（数据实际使用 106 键）」；旧设计文档 `2026-07-31-events-integration-design.md` 的映射表 intelligence 行补 `special_skill`（一行改动，随本次提交）
3. 转换器单测补齐：`convertAll` 正常路径、stage 超界 fallback

## 流水线

1. 削减子代理输出保留 id 清单 → 过滤脚本产出新 chiled.json（含 gap_year flag 修复）
2. 5 个生成子代理并行产出 JSON 片段（每批带风格指南 + 属性白名单 + flag 规范 + 该龄段现有事件样本）
3. 合并片段 → 重跑 `convert-events.mjs`（fail-fast 校验属性键/重复 id/缺字段）→ 重跑 `node --test`
4. 每批抽样 5 个事件对照风格指南人工审（控制器或审查子代理执行）
5. `npm run build` + Playwright 自动播放全流程（无卡死、进结算页、阶段/条件过滤正确）

## 验证

- 转换器 fail-fast 全过（0 未映射键、0 重复 id）
- 新增分布校验：合并后每岁事件数 childhood ≤12、其他段 3-7（脚本断言）
- 抽样质量审：5 批 × 5 个事件 = 25 个，对照风格指南
- E2E：Playwright 自动播放到结算页，抽查 young/adult 段条件分支事件按 flags 正确出现/跳过

## 范围外（不做）

- 不改动引擎代码（useGame/state/types 不动，除非 E2E 暴露缺陷）
- 不做随机抽取机制（用户已确认保持线性）
- 不为新 flag 批量追加消费事件（后续迭代再做）
