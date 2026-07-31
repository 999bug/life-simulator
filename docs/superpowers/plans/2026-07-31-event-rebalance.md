# 事件池再平衡 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 chiled.json 从 357 事件再平衡到 ~420：小学段 291→~100，按原始 66 事件风格为 13-76 岁新增 ~265 个事件，并修复 gap_year 死条件与口径问题。

**Architecture:** 纯数据工程，引擎代码零改动。新增两个带 node:test 的数据工具（`prune-events.mjs` 精选过滤 + gap_year 补丁、`merge-fragments.mjs` 片段合并 + 三重校验）；削减与生成由子代理按 rubric/风格指南执行；最终重跑 `convert-events.mjs` 重新生成 `src/engine/events.json`。

**Tech Stack:** Node ESM 脚本 + node:test（不新增依赖）；Playwright 用于最终 E2E。

**Spec:** `docs/superpowers/specs/2026-07-31-event-rebalance-design.md`

## Global Constraints

- 提交信息：中文 subject + 前缀（`[NF]`/`[CU]`/`[IM]`/`[BF]`），body 用 `- ` 列表，**禁止 AI 署名尾注**
- 注释用中文；if/for 必须带大括号；不用行内注释
- 不新增 npm 依赖；不改 `src/` 引擎代码（本计划只动 `script/`、`docs/`、数据文件）
- 新事件 effects 只允许 `script/convert-events.mjs` ATTR_MAP 中的键（未映射键转换时 fail-fast）
- conditions 引用的 flag 必须有产出者；`script/fragments/` 是临时产物，不入 git
- 原始 66 个主线事件（id 为 2 位数字后缀，如 child_01/young_18）**一个字都不改**；模拟事件（4 位数字后缀，如 child_0017）只能被精选删除，不能改内容

---

### Task 1: 数据工具链（prune + merge + 口径修正，TDD）

**Files:**
- Create: `script/prune-events.mjs`
- Create: `script/merge-fragments.mjs`
- Test: `script/data-tools.test.mjs`
- Modify: `script/convert-events.mjs`（头注释口径一行；无逻辑改动）
- Modify: `script/convert-events.test.mjs`（追加 2 个测试）
- Modify: `docs/superpowers/specs/2026-07-31-events-integration-design.md`（映射表 intelligence 行补一词）

**Interfaces:**
- Produces（Task 2 消费）: `prune(events, keepIds): 过滤后数组`；`fixGapYear(events): 补丁数`；命令行 `node script/prune-events.mjs <keep-list.json>`
- Produces（Task 4 消费）: `mergeFragments(base, fragments): 合并排序后数组`；`checkDistribution(events): 违规字符串数组`；`checkFlagPairs(events): 悬空消费者字符串数组`；命令行 `node script/merge-fragments.mjs`

- [ ] **Step 1: 写失败的测试** `script/data-tools.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prune, fixGapYear } from './prune-events.mjs';
import { mergeFragments, checkDistribution, checkFlagPairs } from './merge-fragments.mjs';

const ev = (id, age, flags = []) => ({
  id, age_range: [age, age + 1], category: 'family', title: 't', text: 'x',
  choices: [{ text: 'c', effects: { happiness: 1 }, flags_add: flags }],
});

test('prune：2 位 id 的原始事件永远保留，4 位 id 按清单过滤', () => {
  const events = [ev('child_01', 3), ev('child_0017', 5), ev('primary_0044', 8), ev('young_18', 29)];
  const out = prune(events, ['child_0017']);
  assert.deepEqual(out.map(e => e.id), ['child_01', 'child_0017', 'young_18']);
});

test('fixGapYear：给 gap_year_done 产出者补 gap_year，重复运行不重复加', () => {
  const events = [ev('young_99', 19, ['gap_year_done'])];
  assert.equal(fixGapYear(events), 1);
  assert.deepEqual(events[0].choices[0].flags_add, ['gap_year_done', 'gap_year']);
  assert.equal(fixGapYear(events), 0);
});

test('mergeFragments：合并、重复 id 抛错、按 age_range[0] 排序', () => {
  const base = [ev('young_01', 18)];
  const out = mergeFragments(base, [[ev('teen_08', 13)], [ev('young_19', 22)]]);
  assert.deepEqual(out.map(e => e.id), ['teen_08', 'young_01', 'young_19']);
  assert.throws(() => mergeFragments(base, [[ev('young_01', 20)]]), /duplicate id "young_01"/);
});

test('checkDistribution：检出超密度与欠密度年龄', () => {
  const sparse = [ev('a01', 30), ev('a02', 30)];
  const violations = checkDistribution(sparse);
  assert.ok(violations.some(v => v.includes('30 岁') && v.includes('过少')));
  const dense = Array.from({ length: 13 }, (_, i) => ev(`c${i}`, 5));
  assert.ok(checkDistribution(dense).some(v => v.includes('5 岁') && v.includes('过多')));
  // 0-2 岁每岁 1 个不算过少
  assert.equal(checkDistribution([ev('b01', 0)]).length, 0);
});

test('checkFlagPairs：检出无产出者的条件 flag，not_flags 不算悬空', () => {
  const orphan = [{ ...ev('a01', 30), conditions: { has_flags: ['ghost_flag'] } }];
  assert.deepEqual(checkFlagPairs(orphan), ['ghost_flag']);
  const ok = [
    ev('a01', 20, ['married']),
    { ...ev('a02', 30), conditions: { has_flags: ['married'], not_flags: ['divorced'] } },
  ];
  assert.deepEqual(checkFlagPairs(ok), []);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd F:/ai/life-simulator && node --test script/data-tools.test.mjs`
Expected: FAIL，报 `Cannot find module './prune-events.mjs'`

- [ ] **Step 3: 实现** `script/prune-events.mjs`

```js
import { readFileSync, writeFileSync } from 'fs';
import { pathToFileURL } from 'url';

/** 模拟数据事件 ID 特征：4 位数字后缀（child_0017 / primary_0044）；原始主线为 2 位 */
const GENERATED_ID = /_\d{4}$/;

/**
 * 精选过滤：原始事件（2 位 id）全部保留；模拟事件（4 位 id）只保留清单内的。
 *
 * @param events 全量事件数组
 * @param keepIds 保留的模拟事件 id 数组
 * @returns 过滤后的新数组
 */
export function prune(events, keepIds) {
  const keep = new Set(keepIds);
  return events.filter(e => !GENERATED_ID.test(e.id) || keep.has(e.id));
}

/**
 * gap_year 死条件补丁：给产出 gap_year_done 的选项补上 gap_year flag。
 * young_05 的 has_flags: ['gap_year'] 因此可达。幂等，重复运行返回 0。
 *
 * @param events 全量事件数组（原地修改）
 * @returns 打补丁的选项数
 */
export function fixGapYear(events) {
  let patched = 0;
  for (const e of events) {
    for (const c of e.choices) {
      if (Array.isArray(c.flags_add) && c.flags_add.includes('gap_year_done') && !c.flags_add.includes('gap_year')) {
        c.flags_add.push('gap_year');
        patched++;
      }
    }
  }
  return patched;
}

function main() {
  const keepListPath = process.argv[2];
  if (!keepListPath) {
    console.error('用法: node script/prune-events.mjs <keep-list.json>');
    process.exit(1);
  }
  const events = JSON.parse(readFileSync(new URL('./chiled.json', import.meta.url), 'utf8'));
  const keepIds = JSON.parse(readFileSync(keepListPath, 'utf8'));
  const kept = prune(events, keepIds);
  const patched = fixGapYear(kept);
  writeFileSync(new URL('./chiled.json', import.meta.url), JSON.stringify(kept, null, 2), 'utf8');
  console.log(`✅ 精选完成：${events.length} → ${kept.length}（保留模拟事件 ${keepIds.length} 个），gap_year 补丁 ${patched} 处`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
```

- [ ] **Step 4: 实现** `script/merge-fragments.mjs`

```js
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { pathToFileURL } from 'url';
import { convertAll } from './convert-events.mjs';

/**
 * 合并基础数据与生成片段：拼接、重复 id 抛错、按 age_range 升序排序。
 *
 * @param base chiled.json 事件数组
 * @param fragments 片段数组的数组
 * @returns 合并排序后的新数组
 */
export function mergeFragments(base, fragments) {
  const all = [...base, ...fragments.flat()];
  const ids = new Set();
  for (const e of all) {
    if (ids.has(e.id)) {
      throw new Error(`duplicate id "${e.id}"`);
    }
    ids.add(e.id);
  }
  all.sort((a, b) => a.age_range[0] - b.age_range[0] || a.age_range[1] - b.age_range[1]);
  return all;
}

/**
 * 每岁密度校验：0-2 岁每岁 1-3 个；3-12 岁每岁 5-12 个；13-75 岁每岁 3-7 个。
 *
 * @returns 违规描述数组，空数组表示通过
 */
export function checkDistribution(events) {
  const perAge = new Map();
  for (const e of events) {
    const age = e.age_range[0];
    perAge.set(age, (perAge.get(age) ?? 0) + 1);
  }
  const violations = [];
  for (const [age, count] of [...perAge].sort((a, b) => a[0] - b[0])) {
    if (age <= 2 && (count < 1 || count > 3)) {
      violations.push(`${age} 岁事件 ${count} 个，超出 1-3 范围`);
    } else if (age >= 3 && age <= 12 && (count < 5 || count > 12)) {
      violations.push(`${age} 岁事件 ${count} 个，${count < 5 ? '过少' : '过多'}（要求 5-12）`);
    } else if (age >= 13 && age <= 75 && (count < 3 || count > 7)) {
      violations.push(`${age} 岁事件 ${count} 个，${count < 3 ? '过少' : '过多'}（要求 3-7）`);
    }
  }
  return violations;
}

/**
 * flag 生产/消费配对校验：has_flags 引用的 flag 必须有事件产出；not_flags 不算悬空。
 *
 * @returns 悬空 flag 数组，空数组表示通过
 */
export function checkFlagPairs(events) {
  const producers = new Set();
  for (const e of events) {
    for (const c of e.choices) {
      for (const f of c.flags_add ?? []) {
        producers.add(f);
      }
    }
  }
  const orphans = new Set();
  for (const e of events) {
    for (const f of e.conditions?.has_flags ?? []) {
      if (!producers.has(f)) {
        orphans.add(f);
      }
    }
  }
  return [...orphans];
}

function main() {
  const dir = new URL('./', import.meta.url);
  const base = JSON.parse(readFileSync(new URL('./chiled.json', import.meta.url), 'utf8'));
  const fragDir = new URL('./fragments/', import.meta.url);
  const files = readdirSync(fragDir).filter(f => f.endsWith('.json'));
  const fragments = files.map(f => JSON.parse(readFileSync(new URL(`./fragments/${f}`, import.meta.url), 'utf8')));
  const merged = mergeFragments(base, fragments);
  // 转换器全量校验（未映射键/缺字段/重复 id fail-fast）
  convertAll(merged);
  const violations = checkDistribution(merged);
  const orphans = checkFlagPairs(merged);
  if (violations.length > 0 || orphans.length > 0) {
    violations.forEach(v => console.error('密度违规:', v));
    orphans.forEach(f => console.error('悬空 flag:', f));
    process.exit(1);
  }
  writeFileSync(new URL('./chiled.json', import.meta.url), JSON.stringify(merged, null, 2), 'utf8');
  console.log(`✅ 合并完成：${base.length} + ${fragments.flat().length} = ${merged.length} 个事件（片段：${files.join(', ')}）`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
```

- [ ] **Step 5: 运行测试确认全部通过**

Run: `cd F:/ai/life-simulator && node --test script/data-tools.test.mjs`
Expected: 5 个测试全部 PASS

- [ ] **Step 6: 口径修正（3 处一行改动 + 转换器补测）**

6a. `script/convert-events.mjs` 头注释第一行改为：

```js
/**
 * 107 条 chiled.json 属性名 → 8 大引擎属性映射（数据实际使用 106 键，luck 为冗余映射）。
 * INVERSE 中的键为负向维度，映射后数值取反（pressure: +8 → happiness: -8）。
 */
```

6b. `docs/superpowers/specs/2026-07-31-events-integration-design.md` 映射表 intelligence 行行尾 `specialization, **dependence**` 改为 `specialization, special_skill, **dependence**`，行首计数 `intelligence（37+1）` 改为 `intelligence（38+1）`。

6c. `script/convert-events.test.mjs` 文件末尾追加：

```js
test('convertAll 正常路径：全量转换并保持顺序', () => {
  const out = convertAll([base, { ...base, id: 'test_02', age_range: [30, 31] }]);
  assert.equal(out.length, 2);
  assert.equal(out[0].id, 'test_01');
  assert.equal(out[1].stage, 'adult');
});

test('stage 超界（>95 岁）fallback 为 elder', () => {
  assert.equal(convertEvent({ ...base, age_range: [96, 97] }).stage, 'elder');
});
```

验证： `cd F:/ai/life-simulator && node --test script/` → data-tools 5 个 + convert-events 14 个全部 PASS。

- [ ] **Step 7: Commit**

```bash
cd F:/ai/life-simulator
git add script/prune-events.mjs script/merge-fragments.mjs script/data-tools.test.mjs script/convert-events.mjs script/convert-events.test.mjs docs/superpowers/specs/2026-07-31-events-integration-design.md
git commit -m "[NF]: 事件数据工具链：精选过滤 + 片段合并 + 口径修正

- prune-events.mjs：按保留清单过滤模拟事件 + gap_year 补丁
- merge-fragments.mjs：片段合并 + 密度校验 + flag 生产消费配对校验
- convert-events.mjs 头注释 106→107 口径；旧 spec 映射表补 special_skill
- convert-events 补测 convertAll 正常路径与 stage 超界 fallback"
```

---

### Task 2: 小学削减执行（精选 291 → ~100）

**Files:**
- Create: `script/keep-list.json`（精选保留清单，入 git 作为审计记录）
- Modify: `script/chiled.json`（工具过滤结果）
- Modify: `src/engine/events.json`（重新生成）

**Interfaces:**
- Consumes: Task 1 的 `node script/prune-events.mjs <keep-list.json>`
- Produces: 精选后 chiled.json（~166 事件 = 原始 66 + 模拟精选 ~100）

- [ ] **Step 1: 精选子代理产出 keep-list.json**

精选子代理（content curator）任务要点：
1. `node -e "const a=JSON.parse(require('fs').readFileSync('script/chiled.json','utf8'));const s=a.filter(e=>/_\d{4}$/.test(e.id));console.log(s.length);require('fs').writeFileSync('/tmp/moni.json',JSON.stringify(s,null,2))"` 导出 291 个模拟事件到临时文件阅读
2. 按 rubric 为 3-12 岁每岁选出 ~10 个（总 ~100）：
   - 优先「第一次」里程碑系列
   - 每岁 category 不扎堆（family/school/friend/learning/sports/emotion/animal 等铺开）
   - 优先带 flags_add、choices ≥ 3
   - 同岁同主题只留最好的一个
3. 把保留 id 数组写入 `script/keep-list.json`（纯 JSON 字符串数组）
4. 报告：每岁保留数量分布、淘汰理由摘要

- [ ] **Step 2: 执行精选 + gap_year 补丁**

Run: `cd F:/ai/life-simulator && node script/prune-events.mjs script/keep-list.json`
Expected: `✅ 精选完成：357 → ~166（保留模拟事件 ~100 个），gap_year 补丁 1 处`

- [ ] **Step 3: 重新生成 events.json 并验证**

Run: `cd F:/ai/life-simulator && npm run build:events && node --test script/ && npm run build`
Expected: 转换 ~166 事件无报错；全部测试通过；构建绿。

抽查 gap_year 修复生效：
Run: `cd F:/ai/life-simulator && node -e "const a=JSON.parse(require('fs').readFileSync('src/engine/events.json','utf8'));const p=a.filter(e=>e.choices.some(c=>c.outcomes.flags?.includes('gap_year')));console.log('gap_year 产出事件:',p.map(e=>e.id));const c=a.find(e=>e.id==='young_05');console.log('young_05 条件:',JSON.stringify(c.conditions));"`
Expected: 产出事件非空（1 个），young_05 条件 `{"hasFlags":["gap_year"]}`

- [ ] **Step 4: Commit**

```bash
cd F:/ai/life-simulator
git add script/keep-list.json script/chiled.json src/engine/events.json
git commit -m "[CU]: 小学事件精选 291→~100，修复 gap_year 死条件

- keep-list.json 记录保留清单（每岁 ~10 个，里程碑 + 类别多样 + flags 优先）
- gap_year_done 产出事件补 gap_year flag，young_05 变为可达
- events.json 重新生成（~166 事件）"
```

---

### Task 3: 五批事件生成（13-76 岁，新增 ~265）

**Files:**
- Create: `script/fragments/teen.json`、`young.json`、`adult.json`、`mid.json`、`elder.json`（临时产物，不入 git）

**执行方式（SDD 适配）：** 5 个生成子代理**并行**派发（输出文件互不相交），每个只写片段文件 + 生成报告，**不提交 git**；每批完成后派一个审查子代理抽样 5 个事件对照风格指南（只读，可与生成并行）。

**通用生成规范（每个子代理 dispatch 中逐字给出）：**

> 你在为人生模拟器生成 `<<阶段名>>` 段事件，产出 `F:/ai/life-simulator/script/fragments/<<文件名>>`（JSON 数组，**原始 chiled.json 格式**，不是引擎格式）。
>
> **先读三样东西**：
> 1. `F:/ai/life-simulator/script/convert-events.mjs` 的 ATTR_MAP——effects 只允许这 107 个键，多一个都会 fail-fast
> 2. 风格基准：运行 `node -e "const a=JSON.parse(require('fs').readFileSync('F:/ai/life-simulator/script/chiled.json','utf8'));console.log(JSON.stringify(a.filter(e=>/^<<前缀>>_\d{2}$/.test(e.id)),null,2))"` 精读该龄段现有原始事件（2 位 id），模仿其叙事密度——**不要**模仿 4 位 id 模拟事件的单薄一句话风格
> 3. `F:/ai/life-simulator/docs/superpowers/specs/2026-07-31-event-rebalance-design.md` 的「新事件生成规范」节
>
> **格式**（每个事件）：
> ```json
> {
>   "id": "<<前缀>>_<<续号>>",
>   "age_range": [年龄, 年龄 或 年龄+1],
>   "category": "family|career|health|friend|education|personality|technology|love|finance",
>   "title": "事件标题（≤10 字）",
>   "text": "第二人称叙事 50-150 字：具体场景 + 细节 + 情绪，常以年龄开头（「三十岁，」）。2-4 句。",
>   "choices": [
>     { "text": "第一人称行动或台词", "effects": { "happiness": 8, "money": -5 }, "flags_add": [] }
>   ]
> }
> ```
> - choices 2-4 个，正/中/负取向混合；effects 每项 ±3~±20、每项 1-3 个键；键的选择要多样（别什么都往 intelligence 堆）
> - conditions 可选：`{ "has_flags": [...], "not_flags": [...], "min_attrs": {...}, "max_attrs": {...} }`；**has_flags 只允许引用**：已有产出者的 12 个 flag（best_friend/bully/first_love/academic_path/tech_path/went_to_college/tech_career/startup/civil_servant/world_traveler/married/marriage_renewed/grandparent/gap_year）**或你本批自己产出的 flag**
> - 每岁事件数：目标每岁 <<N>> 个（±1 浮动），age_range 均匀铺开
>
> **报告**：完成后写 `F:/ai/life-simulator/script/fragments/<<前缀>>-report.md`：事件数、每岁分布、新引入 flag 清单（flag 名 + 产出事件 id + 消费事件 id，纯记录型标注「无消费者」）、自查发现的问题。回复只给：事件数、一行分布、疑虑。

**分批参数表：**

| 批次 | 文件 | 年龄 | 新增 | ID 起始 | 每岁目标 | 主题主线（防同质） | 特殊要求 |
|---|---|---|---|---|---|---|---|
| teen | teen.json | 13-17 | ~18 | teen_08 | ~4（13-17 各 3-4） | 中考/文理分科/高考志愿/初恋（first_love 已有消费者 teen_04）/叛逆/友谊裂变/竞赛/自我认同 | 高考去向事件须产出 went_to_college（现仅 4 个产出者，且 young 段有消费者） |
| young | young.json | 18-29 | ~42 | young_19 | ~5 | 大学专业/社团/实习/考研 vs 就业/第一份工作/租房/异地/跳槽/创业萌芽/买房压力/婚恋 | **married 至少新增 3 条产出路径**（现仅 1 条，adult/mid 有大量消费者）；可产 has_child |
| adult | adult.json | 30-49 | ~88 | adult_13 | ~5（±1，文件可分多次追加写） | 晋升/带团队/裁员/转型/婚姻经营/育儿/教育焦虑/房贷/父母生病/健康红灯/同学差距/创业成败 | 婚育分支用 married/has_child 条件（has_child 为本批新 flag，需在报告登记）；约 1/3 事件带 conditions |
| mid | mid.json | 50-64 | ~68 | mid_08 | ~5 | 空巢/孩子离家/退休过渡/带孙（grandparent 已有消费者 elder_03）/父母离世/夫妻重启/健康革命/老友离世/返聘 | grandparent 相关事件用 has_flags married + 已有产出；离婚/再婚线用 divorced/marriage_renewed |
| elder | elder.json | 65-76 | ~50 | elder_11 | ~4 | 退休日常/孙辈/疾病与和解/回忆录/老友重聚/捐赠与遗产/孤独与自洽/身后事 | 健康/财富分支继续用 min_attrs/max_attrs（health/money/empathy 三键，映射表内） |

- [ ] **Step 1: 并行派发 5 个生成子代理**（模型 sonnet；输出互不冲突，不写 git）
- [ ] **Step 2: 每批完成后并行派发抽样审查**（只读）：对照风格指南抽 5 个事件/批，检查叙事密度、选项取向混合、effects 键合法多样、conditions 的 flag 有产出者；不合格批次打回重写（resume 原生成子代理，附审查发现）
- [ ] **Step 3: 片段自查**（控制器）：`node -e` 校验 5 个片段 JSON 可解析、事件总数 ≈265、id 前缀/续号无重叠

---

### Task 4: 合并校验 + E2E + 提交

**Files:**
- Modify: `script/chiled.json`（merge-fragments 合并结果）
- Modify: `src/engine/events.json`（重新生成）

- [ ] **Step 1: 合并 + 三重校验**

Run: `cd F:/ai/life-simulator && node script/merge-fragments.mjs`
Expected: `✅ 合并完成：~166 + ~265 = ~420 个事件`；密度违规与悬空 flag 均为 0（如有违规，列出后打回对应批次修正再跑）

- [ ] **Step 2: 重新生成 + 全部测试 + 构建**

Run: `cd F:/ai/life-simulator && npm run build:events && node --test script/ && npm run build`
Expected: 转换 ~420 事件；19 个测试全过；构建绿。

- [ ] **Step 3: E2E 自动播放**

`npm run dev` 后台启动 → Playwright：
1. 开局 → 确认 `「出生」` 标题与 0 岁
2. 自动播放循环（检测条件：按钮精确文本 `重新开始` 或正文含 `享年`；点「▼ 点击继续」或第一个 `button.group`，每块 400 次迭代 × 200ms）重复执行直到结算页（预计 6-10 块）
3. 确认结算页 `享年 X 岁` + 评分 + 时间线含 adult/mid 段新事件文本
4. 抽查分支：时间线或中途快照确认 adult 段带 conditions 的事件按 flags 出现/跳过（如已婚线看到育儿事件）
5. 停止 dev server

- [ ] **Step 4: Commit**

```bash
cd F:/ai/life-simulator
git add script/chiled.json src/engine/events.json
git commit -m "[NF]: 新增 ~265 个成年/老年事件，全龄段均衡到 ~420

- young+42 / adult+88 / mid+68 / elder+50 / teen+18，按原始 66 事件风格生成
- married 增加多条产出路径；新增 has_child 等 flag（生产/消费成对）
- 合并经转换器 fail-fast + 每岁密度 + flag 配对三重校验
- E2E 自动播放全流程进结算页"
```

- [ ] **Step 5: 收尾**

1. 删除临时片段目录：`rm -rf script/fragments`
2. `git status` 确认工作区干净

---

## Self-Review 结论

- **Spec 覆盖**：削减 rubric（T2）、生成规范与分批参数（T3）、三重校验（T1 工具 + T4 执行）、gap_year/口径/补测（T1）、抽样审（T3 Step 2）、E2E（T4 Step 3）——全部有对应任务
- **类型一致性**：prune/merge 函数的签名在测试与命令行 main 中一致；片段格式 = chiled.json 原始格式，与 convertAll 校验输入一致
- **已知取舍**：fragments 不入 git（审计价值低，chiled.json 即事实源）；keep-list.json 入 git（削减审计需要）；生成批次不单独提交（避免 git 索引冲突，合并后一次提交）
