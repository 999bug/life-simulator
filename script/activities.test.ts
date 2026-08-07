/**
 * 主动行为系统测试（活动表完整性/犯罪成功率与分支/MAKE_ACTION 流）。
 *
 * 运行：node --experimental-strip-types --test script/activities.test.ts
 * 说明：reducer 为纯函数（localStorage 读写仅发生在 createInitialRuntime/effect，
 * node 下 localStorage 未定义由 try/catch 兜底为空结构），可用自制事件数组做确定性断言。
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { reducer, createInitialRuntime } from '../src/hooks/useGame.ts';
import { getStageForAge, STAGE_ORDER, ATTR_META } from '../src/engine/state.ts';
import { ACTIVITIES, crimeSuccessRate, pickActivityResult, rollCrime } from '../src/engine/activities.ts';
import type { Attributes, LifeEvent, RuntimeState } from '../src/types/index.ts';

/** 构造测试事件 */
function evt(
  id: string, age: number, attrs: Partial<Attributes> = {},
  flags: string[] = [], conditions?: LifeEvent['conditions'],
): LifeEvent {
  return {
    id,
    stage: getStageForAge(age),
    age,
    text: `事件 ${id}`,
    choices: [{ text: '选择', effects: '', outcomes: { attr: attrs, flags } }],
    conditions,
  };
}

/** 构造进行中的运行时状态（覆盖为自制事件数组；无 actionsThisAge = 旧存档兼容场景） */
function mkPlaying(events: LifeEvent[], attrs: Partial<Attributes> = {}): RuntimeState {
  const base = createInitialRuntime();
  const first = events[0];
  const attributes: Attributes = {
    health: 65, intelligence: 25, wealth: 20, happiness: 60,
    social: 25, appearance: 45, luck: 50, morality: 45, ...attrs,
  };
  const stage = getStageForAge(first.age);
  return {
    ...base,
    shuffledEvents: events,
    eventIndex: 0,
    currentEvent: first,
    game: {
      ...base.game,
      age: first.age, stage, stageIdx: STAGE_ORDER.indexOf(stage),
      attributes, phase: 'playing',
    },
  };
}

// ============ 活动表完整性 ============

test('活动表：8 个活动、id 唯一、结果池 ≥3、属性键合法、minAge 与设计表一致', () => {
  const ids = new Set(ACTIVITIES.map(a => a.id));
  assert.strictEqual(ACTIVITIES.length, 8);
  assert.strictEqual(ids.size, ACTIVITIES.length, '活动 id 必须唯一');
  const attrKeys = Object.keys(ATTR_META);
  for (const a of ACTIVITIES) {
    assert.ok(a.name.length > 0 && a.icon.length > 0 && a.desc.length > 0, `${a.id} 应有名称/图标/描述`);
    assert.ok(a.results.length >= 3, `${a.id} 结果池应 ≥3`);
    for (const r of a.results) {
      assert.ok(r.text.length > 0, `${a.id} 结果应有文案`);
      for (const k of Object.keys(r.attr)) {
        assert.ok(attrKeys.includes(k), `${a.id} 属性键 ${k} 非法`);
      }
    }
  }
  // minAge 与设计表一致（6 岁起基础活动/10 岁社交/14 岁犯罪/16 岁打工/18 岁体检）
  const expected: Record<string, number> = { fitness: 6, study: 6, work: 16, social: 10, health: 18, leisure: 6, walk_dog: 6, crime: 14 };
  for (const a of ACTIVITIES) {
    assert.strictEqual(a.minAge, expected[a.id], `${a.id} minAge 应=${expected[a.id]}`);
  }
});

test('活动表：遛狗要求养宠 flag（任一），犯罪结果池含被抓/逃跑变体', () => {
  const walkDog = ACTIVITIES.find(a => a.id === 'walk_dog')!;
  assert.deepStrictEqual(walkDog.requires, ['has_dog', 'has_pet', 'has_cat']);
  const crime = ACTIVITIES.find(a => a.id === 'crime')!;
  assert.ok(crime.results.some(r => r.flags?.includes('jailed')), '犯罪结果池应含被抓变体（jailed flag）');
  assert.strictEqual(crime.results.filter(r => r.flags?.includes('jailed')).length, 1);
});

// ============ 犯罪成功率与分支 ============

test('crimeSuccessRate：基础值/钳位边界', () => {
  assert.strictEqual(crimeSuccessRate(0, 0), 60, '零运气零智力 = 基础 60%');
  // 60 + 50×0.5 + 50×0.3 = 100 → 钳位 90
  assert.strictEqual(crimeSuccessRate(50, 50), 90);
  // 60 + 100×0.5 + 100×0.3 = 140 → 钳位 90
  assert.strictEqual(crimeSuccessRate(100, 100), 90);
  // 60 + 0 + 100×0.3 = 90（恰好上限）
  assert.strictEqual(crimeSuccessRate(0, 100), 90);
  // 下限 0
  assert.strictEqual(crimeSuccessRate(-200, -200), 0);
});

test('rollCrime：rand 恒 0 → 必成功（高收益变体，无 jailed）', () => {
  const r = rollCrime(50, 50, () => 0);
  assert.ok((r.attr.wealth ?? 0) >= 12, '成功应获得大额财富');
  assert.ok((r.attr.morality ?? 0) <= -6, '成功应付出道德代价');
  assert.ok(!(r.flags ?? []).includes('jailed'));
});

test('rollCrime：rand 恒 0.9 → 必失败 → 落荒而逃（小损）', () => {
  // 成功率最高 90%：0.9 < 0.9 为 false → 失败；第二次 0.9 ≥ 0.5 → 逃跑
  const r = rollCrime(50, 50, () => 0.9);
  assert.strictEqual(r.attr.wealth, -3);
  assert.strictEqual(r.attr.happiness, -2);
  assert.ok(!(r.flags ?? []).includes('jailed'));
});

test('rollCrime：失败后第二次 rand 控制——被抓产出 jailed flag', () => {
  const queue = [0.9, 0.2];
  const r = rollCrime(0, 0, () => queue.shift()!);
  // 0.9 ≥ 0.6 → 失败；0.2 < 0.5 → 被抓
  assert.ok(r.flags!.includes('jailed'), '被抓应产出 jailed flag');
  assert.strictEqual(r.attr.wealth, -8, '被抓钱被没收');
});

test('rollCrime：成功时随机挑成功变体（第二个 rand 控变体）', () => {
  const queue = [0, 0.99];
  const r = rollCrime(50, 50, () => queue.shift()!);
  // 0 < 0.9 → 成功；0.99 → 挑第 3 个成功变体（luck 波动负向）
  assert.ok((r.attr.wealth ?? 0) >= 12);
  assert.ok(!(r.flags ?? []).includes('jailed'));
  assert.strictEqual(r.attr.luck, -2);
});

// ============ SKIP_INTRO（幼儿期走过场快进） ============

test('SKIP_INTRO：普通局 0 岁自动播放开启，快进到 6 岁并交还控制', () => {
  const events = [
    evt('a_01', 0, { health: 2 }),
    evt('a_02', 1, { intelligence: 2 }),
    evt('a_03', 3, { happiness: 2 }),
    evt('b_01', 6, { wealth: 3 }),
  ];
  const base = createInitialRuntime();
  const rt = reducer(base, { type: 'START_GAME', gender: 'male', name: '小明', paceMode: 'full', typeSpeed: 'normal', goal: null });
  // 普通手动局 0 岁：幼儿期幻灯片标记开启（introAuto；autoPlay 仅快速模拟为 true）
  assert.strictEqual(rt.introAuto, true);
  assert.strictEqual(rt.autoPlay, false);
  // 覆盖事件流（自制数组）
  const setup = { ...rt, shuffledEvents: events, currentEvent: events[0], eventIndex: 0 };
  const skipped = reducer(setup, { type: 'SKIP_INTRO' });
  assert.strictEqual(skipped.game.age, 6, '应推进到 6 岁');
  assert.strictEqual(skipped.introAuto, false, '幻灯片标记清除');
  assert.strictEqual(skipped.autoPlay, false, '保持手动');
  assert.ok(skipped.game.attributes.health >= 65, '自动选择应积累了属性');
  // 非幼儿期局 SKIP_INTRO 原样返回
  const manual = { ...setup, introAuto: false, autoPlay: false };
  assert.strictEqual(reducer(manual, { type: 'SKIP_INTRO' }), manual);
});

test('SKIP_INTRO：每日挑战局不开幼儿期自动播放（公平同局）', () => {
  const base = createInitialRuntime();
  const rt = reducer(base, {
    type: 'START_GAME', gender: 'male', name: '小明', paceMode: 'full', typeSpeed: 'normal',
    goal: null, challenge: false, seed: 12345, isDaily: true,
  });
  assert.strictEqual(rt.autoPlay, false, '每日挑战保持手动');
  assert.strictEqual(rt.introAuto, false, '每日挑战无幼儿期标记');
});

// ============ 结果池随机抽取 ============

test('pickActivityResult：返回结果池中一员（8 个活动各抽 50 次）', () => {
  for (const a of ACTIVITIES) {
    for (let i = 0; i < 50; i++) {
      const r = pickActivityResult(a);
      assert.ok(a.results.includes(r), `${a.id} 应返回结果池中一员`);
    }
  }
});

// ============ MAKE_ACTION（reducer 流） ============

test('MAKE_ACTION：正常执行——属性变化 + 记录已做 + 反馈文本', () => {
  const rt0 = mkPlaying([evt('a_01', 7, {})]);
  const rt = reducer(rt0, { type: 'MAKE_ACTION', activityId: 'leisure' });
  // 7 岁 happiness 上限 75、初始 60：距上限 15 点无衰减，+3~6 全值生效
  assert.ok(rt.game.attributes.happiness >= 63 && rt.game.attributes.happiness <= 66, `happiness 应为 63~66，实际 ${rt.game.attributes.happiness}`);
  assert.deepStrictEqual(rt.game.actionsDone, ['leisure'], '应记录本岁已做过该活动');
  assert.ok(rt.feedback!.length > 0, '反馈应展示结果文本');
  // 活动不推年龄、不进 history、不进后悔栈、不动事件流（不污染人物推导）
  assert.strictEqual(rt.game.age, 7);
  assert.strictEqual(rt.game.history.length, 0);
  assert.strictEqual(rt.undoStack.length, 0);
  assert.strictEqual(rt.currentEvent, rt0.currentEvent);
});

test('MAKE_ACTION：同一活动本岁重复做拒绝，不同活动可继续做（每活动限 1 次）', () => {
  let rt = mkPlaying([evt('a_01', 7, {})]);
  // 活动反馈页需 CONTINUE 清掉后才能再次行动（与事件反馈同一机制）
  rt = reducer(rt, { type: 'MAKE_ACTION', activityId: 'leisure' });
  rt = reducer(rt, { type: 'CONTINUE' });
  // 重复同一活动：拒绝
  const rejected = reducer(rt, { type: 'MAKE_ACTION', activityId: 'leisure' });
  assert.strictEqual(rejected, rt, '重复同活动应原样返回');
  // 换一个活动：可继续（不限制总次数）
  const next = reducer(rt, { type: 'MAKE_ACTION', activityId: 'fitness' });
  assert.notStrictEqual(next, rt, '不同活动应可继续执行');
  assert.deepStrictEqual(next.game.actionsDone, ['leisure', 'fitness']);
});

test('MAKE_ACTION：minAge 拒绝（6 岁打工/体检/犯罪不可用，健身可用）', () => {
  const rt = mkPlaying([evt('a_01', 6, {})]);
  for (const id of ['work', 'health', 'crime']) {
    assert.strictEqual(reducer(rt, { type: 'MAKE_ACTION', activityId: id }), rt, `${id} 未到年龄应拒绝`);
  }
  assert.notStrictEqual(reducer(rt, { type: 'MAKE_ACTION', activityId: 'fitness' }), rt, '6 岁可健身');
});

test('MAKE_ACTION：requires 拒绝（无养宠 flag 遛狗；任一 flag 可执行）', () => {
  const rt = mkPlaying([evt('a_01', 7, {})]);
  assert.strictEqual(reducer(rt, { type: 'MAKE_ACTION', activityId: 'walk_dog' }), rt);
  const hasDog = { ...rt, game: { ...rt.game, flags: ['has_dog'] } };
  assert.notStrictEqual(reducer(hasDog, { type: 'MAKE_ACTION', activityId: 'walk_dog' }), hasDog);
});

test('MAKE_ACTION：反馈页/快速模拟/非 playing 阶段拒绝', () => {
  const base = mkPlaying([evt('a_01', 7, {}), evt('b_01', 8, {})]);
  // 反馈页（先选择出反馈，事件流未终局）
  const withFeedback = reducer(base, { type: 'MAKE_CHOICE', choice: base.currentEvent!.choices[0], eventId: base.currentEvent!.id });
  assert.ok(withFeedback.feedback, '前置：应处于反馈页');
  assert.strictEqual(reducer(withFeedback, { type: 'MAKE_ACTION', activityId: 'leisure' }), withFeedback);
  // 快速模拟
  const auto = { ...base, autoPlay: true };
  assert.strictEqual(reducer(auto, { type: 'MAKE_ACTION', activityId: 'leisure' }), auto);
  // 结算页
  const summary = { ...base, game: { ...base.game, phase: 'summary' } };
  assert.strictEqual(reducer(summary, { type: 'MAKE_ACTION', activityId: 'leisure' }), summary);
});

test('MAKE_ACTION：未知活动 id 拒绝（原样返回）', () => {
  const rt = mkPlaying([evt('a_01', 7, {})]);
  assert.strictEqual(reducer(rt, { type: 'MAKE_ACTION', activityId: 'nonexistent' }), rt);
});

test('MAKE_ACTION：犯罪走 rollCrime 专用分支（Math.random 桩控制成败）', () => {
  const mk = (attrs: Partial<Attributes>) => mkPlaying([evt('a_01', 15, {})], { luck: 50, intelligence: 50, ...attrs });
  const orig = Math.random;
  try {
    // 必成功（rand = 0）：wealth +12~15、morality -6~-8，无 jailed
    Math.random = () => 0;
    const win = reducer(mk({}), { type: 'MAKE_ACTION', activityId: 'crime' });
    assert.ok(win.game.attributes.wealth >= 32 && win.game.attributes.wealth <= 35, `犯罪成功财富应为 32~35，实际 ${win.game.attributes.wealth}`);
    assert.ok(win.game.attributes.morality <= 39, '犯罪成功道德下滑');
    assert.ok(!win.game.flags.includes('jailed'));
  } finally {
    Math.random = orig;
  }
  try {
    // 必失败 → 落荒而逃（rand = 0.9）：wealth -3、happiness -2
    Math.random = () => 0.9;
    const flee = reducer(mk({}), { type: 'MAKE_ACTION', activityId: 'crime' });
    assert.strictEqual(flee.game.attributes.wealth, 17, '逃跑财富 20-3=17');
    assert.strictEqual(flee.game.attributes.happiness, 58, '逃跑幸福 60-2=58');
    assert.ok(!flee.game.flags.includes('jailed'));
  } finally {
    Math.random = orig;
  }
  try {
    // 失败后第二次 rand < 0.5 → 被抓：产出 jailed flag（接入铁窗路线）
    const queue = [0.9, 0.2];
    Math.random = () => queue.shift() ?? 0;
    const caught = reducer(mk({}), { type: 'MAKE_ACTION', activityId: 'crime' });
    assert.ok(caught.game.flags.includes('jailed'), '被抓应产出 jailed flag');
    assert.strictEqual(caught.game.attributes.wealth, 12, '被抓财富 20-8=12');
  } finally {
    Math.random = orig;
  }
});

test('MAKE_ACTION 后 CONTINUE：清反馈、已做记录保留', () => {
  let rt = mkPlaying([evt('a_01', 7, {})]);
  rt = reducer(rt, { type: 'MAKE_ACTION', activityId: 'leisure' });
  rt = reducer(rt, { type: 'CONTINUE' });
  assert.strictEqual(rt.feedback, null);
  assert.deepStrictEqual(rt.game.actionsDone, ['leisure'], '已做记录不随 CONTINUE 重置');
});
