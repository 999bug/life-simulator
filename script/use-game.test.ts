/**
 * useGame reducer 核心流测试（开局/选择/快照/死亡/跳过收集/读档兜底）。
 *
 * 运行：node --experimental-strip-types --test script/use-game.test.ts
 * 说明：reducer 为纯函数（localStorage 读写仅发生在 createInitialRuntime/effect，
 * node 下 localStorage 未定义由 try/catch 兜底为空结构），可用自制事件数组做确定性断言。
 * 埋点断言处安装内存 localStorage 桩（track() 写存储；其余路径空存储 = 与未定义等价）。
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { reducer, createInitialRuntime, saveState, trackAbandonIfPlaying, updateDailyHistory, recordSeedScore, loadDailyHistory, saveDailyHistory, loadSeedScores, saveSeedScores, updateDailyStreak, loadDailyStreak, saveDailyStreak } from '../src/hooks/useGame.ts';
import { getStageForAge, STAGE_ORDER } from '../src/engine/state.ts';
import { setEvents } from '../src/engine/events.ts';
import { loadAnalytics } from '../src/utils/analytics.ts';
import type { Attributes, LifeEvent, RuntimeState } from '../src/types/index.ts';

// 事件数据运行时拆分后，node 测试无 fetch，直接读 public/events.json 注入
setEvents(JSON.parse(readFileSync(new URL('../public/events.json', import.meta.url), 'utf8')));

// RuntimeState 从 useGame 导出，此处类型引用
import type { RuntimeState as Rt } from '../src/hooks/useGame.ts';

// localStorage 内存桩：node 22 无 Web Storage，track() 写存储需桩才能断言（读缺失 = null，与未定义时 try/catch 兜底等价）
const storage = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => { storage.set(k, v); },
  removeItem: (k: string) => { storage.delete(k); },
  clear: () => storage.clear(),
  key: (i: number) => Array.from(storage.keys())[i] ?? null,
  get length() { return storage.size; },
} as unknown as Storage;

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

/** 构造进行中的运行时状态（覆盖为自制事件数组） */
function mkState(events: LifeEvent[], attrs: Partial<Attributes> = {}): Rt {
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
      // 与 START_GAME 一致：初始快照（首事件年龄 + 开局属性）
      snapshots: [{ age: first.age, attrs: attributes }],
    },
  };
}

/** 对当前事件做一次选择（取第一个选项） */
function choose(rt: Rt): Rt {
  const e = rt.currentEvent!;
  return reducer(rt, { type: 'MAKE_CHOICE', choice: e.choices[0], eventId: e.id });
}

test('START_GAME：初始快照 + 事件预载 + 参数生效', () => {
  const rt = reducer(createInitialRuntime(), {
    type: 'START_GAME', gender: 'male', name: '小明', paceMode: 'full', typeSpeed: 'fast', goal: 'wealth',
  });
  assert.strictEqual(rt.game.phase, 'playing');
  assert.strictEqual(rt.game.goal, 'wealth');
  assert.strictEqual(rt.paceMode, 'full');
  assert.strictEqual(rt.typeSpeed, 'fast');
  assert.ok(rt.currentEvent, '应预载首事件');
  // 初始快照：首事件年龄 + 初始属性
  assert.strictEqual(rt.game.snapshots!.length, 1);
  assert.strictEqual(rt.game.snapshots![0].age, rt.game.age);
  assert.strictEqual(rt.game.snapshots![0].attrs.health, 65);
});

test('START_GAME：开局构筑——天赋属性 + 分配点 + 成就加成按序应用', () => {
  const rt0 = createInitialRuntime();
  // 已解锁 12 个成就（成就加成 1 步：全属性 +2）
  const rt = reducer({ ...rt0, achievements: { unlocked: Array.from({ length: 12 }, (_, i) => `ach_${i}` as AchievementId), completedLives: 12, endings: [] } }, {
    type: 'START_GAME', gender: 'male', name: '小明', paceMode: 'full', typeSpeed: 'normal', goal: null,
    talents: ['robust', 'clever'], alloc: { wealth: 5 },
  });
  // 初始：health 65+6(健壮)+2(成就)=73，intelligence 25+6(聪慧)+2=33，wealth 20+5(分配)+2=27
  assert.strictEqual(rt.game.attributes.health, 73);
  assert.strictEqual(rt.game.attributes.intelligence, 33);
  assert.strictEqual(rt.game.attributes.wealth, 27);
  assert.deepStrictEqual(rt.game.talents, ['robust', 'clever']);
  assert.deepStrictEqual(rt.game.allocated, { wealth: 5 });
  assert.strictEqual(rt.game.allocBonus, true);
});

test('START_GAME：无天赋/分配/成就时保持初始属性且不加标记', () => {
  const rt = reducer(createInitialRuntime(), {
    type: 'START_GAME', gender: 'male', name: '小明', paceMode: 'full', typeSpeed: 'normal', goal: null,
  });
  assert.strictEqual(rt.game.attributes.health, 65);
  assert.strictEqual(rt.game.talents, undefined);
  assert.strictEqual(rt.game.allocated, undefined);
  assert.strictEqual(rt.game.allocBonus, undefined);
});

test('RESTART：局中重开保留开局构筑（天赋 + 分配点）', () => {
  const rt = reducer(createInitialRuntime(), {
    type: 'START_GAME', gender: 'male', name: '小明', paceMode: 'full', typeSpeed: 'normal', goal: null,
    talents: ['zen'], alloc: { luck: 2 },
  });
  const rt2 = reducer(rt, { type: 'RESTART' });
  assert.deepStrictEqual(rt2.game.talents, ['zen']);
  assert.deepStrictEqual(rt2.game.allocated, { luck: 2 });
  // 出生配置保留：初始 luck 50 + 分配 2
  assert.strictEqual(rt2.game.attributes.luck, 52);
});

test('START_GAME：每周挑战局（本周目标 + 固定周种子 + 不写存档槽）', () => {
  const rt = reducer(createInitialRuntime(), {
    type: 'START_GAME', gender: 'male', name: '小明', paceMode: 'full', typeSpeed: 'normal', goal: null, isWeekly: true,
  });
  assert.strictEqual(rt.isWeekly, true);
  assert.ok(rt.weeklyGoal.key.length > 0, '应确定本周目标');
  assert.strictEqual(rt.seedChallenge, false, '每周挑战不是种子挑战');
  // 临时局：不写存档槽位
  assert.strictEqual(saveState(rt), null);
});

test('START_AUTO_GAME：精简档 + 中速 + 无目标', () => {
  const rt = reducer(createInitialRuntime(), { type: 'START_AUTO_GAME', gender: 'female', name: '小美' });
  assert.strictEqual(rt.autoPlay, true);
  assert.strictEqual(rt.paceMode, 'lite');
  assert.strictEqual(rt.typeSpeed, 'normal');
  assert.strictEqual(rt.game.goal, null);
});

test('MAKE_CHOICE：同岁连续不重复快照，进入新岁追加', () => {
  const events = [
    evt('a_01', 7, { intelligence: 5 }),
    evt('a_02', 7, { health: 3 }),
    evt('b_01', 8, { wealth: 4 }),
  ];
  let rt = mkState(events);
  // 7 岁第一个事件：属性应用 + 同岁不记录快照
  rt = choose(rt);
  assert.strictEqual(rt.game.attributes.intelligence, 30);
  assert.strictEqual(rt.game.snapshots!.length, 1);
  assert.ok(rt.feedback!.startsWith('你选择了「选择」'));
  // 7 岁第二个事件：next 为 8 岁 → 记录 8 岁快照（8 岁起点 = 7 岁末状态）
  rt = choose(rt);
  assert.strictEqual(rt.game.snapshots!.length, 2);
  assert.strictEqual(rt.game.snapshots![1].age, 8);
  // 进入 8 岁事件后播完 → 终局同岁替换该岁条目（仍 2 条）
  rt = choose(rt);
  assert.strictEqual(rt.game.snapshots!.length, 2);
  assert.strictEqual(rt.game.snapshots![1].age, 8);
  // 8 岁财富上限 33，20 距上限 13 < 过渡带 15 → 4×13/15 衰减为 3
  assert.strictEqual(rt.game.snapshots![1].attrs.wealth, 23);
  // 播完 → 结算（8 岁是最后事件）
  assert.strictEqual(rt.game.phase, 'summary');
  assert.strictEqual(rt.game.deathCause, 'lifespan');
});

test('MAKE_CHOICE：健康归零死亡 → 死因/结算标志/快照替换', () => {
  const events = [
    evt('a_01', 7, { happiness: 1 }),
    evt('b_01', 95, {}),
  ];
  let rt = mkState(events, { health: 1 });
  // 7 岁事件后 next 为 95 岁：按 next 年龄先应用老年衰减 health 1-1=0 → 死亡
  rt = choose(rt);
  assert.strictEqual(rt.game.phase, 'summary');
  assert.strictEqual(rt.game.deathCause, 'health');
  assert.strictEqual(rt.game.attributes.health, 0);
  assert.strictEqual(rt.achievementPending, true);
  assert.strictEqual(rt.pendingLives, 1);
  assert.ok(rt.pendingEndingKey.length > 0);
  // 终局快照：死亡岁追加（95 或钳位后年龄）
  const last = rt.game.snapshots![rt.game.snapshots!.length - 1];
  assert.strictEqual(last.age, rt.game.age);
  assert.strictEqual(last.attrs.health, 0);
});

test('MAKE_CHOICE：条件不满足事件被跳过收集', () => {
  const events = [
    evt('ok_01', 7, { happiness: 2 }),                     // 当前事件（满足条件）
    evt('no_01', 7, {}, [], { hasFlags: ['never_got'] }),  // 条件不满足 → 跳过收集
    evt('ok_02', 7, { happiness: 1 }),                     // 满足条件 → 成为下一事件
  ];
  let rt = mkState(events);
  rt = choose(rt);
  assert.strictEqual(rt.skippedEvents.length, 1);
  assert.strictEqual(rt.skippedEvents[0].id, 'no_01');
  assert.strictEqual(rt.currentEvent!.id, 'ok_02');
});

test('CONTINUE 只清反馈；SET_TYPE_SPEED 生效', () => {
  let rt = mkState([evt('a_01', 7, { happiness: 1 })]);
  rt = choose(rt);
  assert.ok(rt.feedback);
  rt = reducer(rt, { type: 'CONTINUE' });
  assert.strictEqual(rt.feedback, null);
  rt = reducer(rt, { type: 'SET_TYPE_SPEED', typeSpeed: 'slow' });
  assert.strictEqual(rt.typeSpeed, 'slow');
});

test('RESET：回标题且保留存档槽位', () => {
  const rt = mkState([evt('a_01', 7, {})]);
  const saves = rt.saves;
  const reset = reducer(rt, { type: 'RESET' });
  assert.strictEqual(reset.game.phase, 'title');
  assert.strictEqual(reset.saves, saves);
  assert.strictEqual(reset.autoPlay, false);
});

test('RESTART：局中重开沿用角色/设置/目标/挑战，换新种子重新开局', () => {
  const base = createInitialRuntime();
  const rt = reducer({ ...base, stats: { ...base.stats, totalLives: 2 } }, {
    type: 'START_GAME', gender: 'female', name: '小美', paceMode: 'lite', typeSpeed: 'slow', goal: 'family', challenge: true,
  });
  const restart = reducer(rt, { type: 'RESTART' });
  assert.strictEqual(restart.game.phase, 'playing');
  assert.strictEqual(restart.game.gender, 'female');
  assert.strictEqual(restart.game.name, '小美');
  assert.strictEqual(restart.game.goal, 'family');
  assert.strictEqual(restart.game.challenge, true);
  assert.strictEqual(restart.paceMode, 'lite');
  assert.strictEqual(restart.typeSpeed, 'slow');
  // 重开普通局：幼儿期幻灯片标记（0-5 岁无需选择，自主点击翻阅，6 岁起交还玩家）
  assert.strictEqual(restart.autoPlay, false);
  assert.strictEqual(restart.introAuto, true);
  // 年龄由首事件驱动
  assert.strictEqual(restart.game.age, restart.currentEvent!.age);
  // 换新随机种子（同岁组顺序不同）
  assert.notStrictEqual(restart.shuffleSeed, rt.shuffleSeed);
  // 初始快照：首事件年龄 + 继承开局属性
  assert.strictEqual(restart.game.snapshots!.length, 1);
  assert.strictEqual(restart.game.snapshots![0].attrs.health, 55); // 挑战开局 65-10
});

test('种子挑战：START_GAME 传 seed 锁定种子，同种子两次开局事件序列相同', () => {
  const base = createInitialRuntime();
  const start = (seed?: number) => reducer(base, {
    type: 'START_GAME', gender: 'male', name: '小明', paceMode: 'full', typeSpeed: 'normal', goal: null, challenge: false, seed,
  });
  const a = start(123456789);
  const b = start(123456789);
  // 锁定种子并标记种子挑战局
  assert.strictEqual(a.shuffleSeed, 123456789);
  assert.strictEqual(a.seedChallenge, true);
  // 同种子 → 同事件序列（好友比分的基础）
  assert.deepStrictEqual(a.shuffledEvents.map(e => e.id), b.shuffledEvents.map(e => e.id));
  // 不传 seed → 非种子挑战局
  assert.strictEqual(start(undefined).seedChallenge, false);
});

test('种子挑战：RESTART 重开保持锁定种子（与每日挑战同规则）', () => {
  const base = createInitialRuntime();
  const rt = reducer(base, {
    type: 'START_GAME', gender: 'male', name: '小明', paceMode: 'full', typeSpeed: 'normal', goal: null, challenge: false, seed: 987654321,
  });
  const restart = reducer(rt, { type: 'RESTART' });
  assert.strictEqual(restart.shuffleSeed, 987654321);
  assert.strictEqual(restart.seedChallenge, true);
  // 事件序列与重开前一致
  assert.deepStrictEqual(restart.shuffledEvents.map(e => e.id), rt.shuffledEvents.map(e => e.id));
});

test('CONTINUE_GAME：旧档字段兜底（paceMode/typeSpeed/deathCause/snapshots）', () => {
  const base = createInitialRuntime();
  const saved = {
    game: {
      ...base.game, phase: 'playing' as const, age: 20,
      attributes: { ...base.game.attributes, health: 80 },
      // 旧档无 deathCause/snapshots 字段
    },
    currentEventId: null,
    feedback: null,
    eventIndex: 0,
    shuffleSeed: 42,
    // 旧档无 paceMode/typeSpeed 字段
  };
  base.saves = { active: 0, slots: [saved, null, null] };
  let rt = reducer(base, { type: 'CONTINUE_GAME', slot: 0 });
  assert.strictEqual(rt.game.phase, 'playing');
  assert.strictEqual(rt.paceMode, 'full');          // 旧档兜底
  assert.strictEqual(rt.typeSpeed, 'normal');
  assert.strictEqual(rt.game.deathCause, null);     // 旧档兜底
  assert.strictEqual(rt.game.snapshots, undefined); // 旧档无快照
  assert.strictEqual(rt.shuffleSeed, 42);           // 种子还原
  assert.strictEqual(rt.autoPlay, false);           // 读档恢复为手动模式
  // 空槽位：不改变状态
  const empty = reducer(rt, { type: 'CONTINUE_GAME', slot: 1 });
  assert.strictEqual(empty, rt);
});

test('START_GAME：挑战开局属性整体下调 10 点', () => {
  const rt = reducer(createInitialRuntime(), {
    type: 'START_GAME', gender: 'male', name: '小明', paceMode: 'full', typeSpeed: 'normal', goal: null, challenge: true,
  });
  assert.strictEqual(rt.game.challenge, true);
  assert.strictEqual(rt.game.attributes.health, 55);       // 65 - 10
  assert.strictEqual(rt.game.attributes.intelligence, 15); // 25 - 10
  // 初始快照与下调后的属性一致
  assert.strictEqual(rt.game.snapshots![0].attrs.health, 55);
  // 非挑战开局不受影响
  const normal = reducer(createInitialRuntime(), {
    type: 'START_GAME', gender: 'male', name: '小明', paceMode: 'full', typeSpeed: 'normal', goal: null, challenge: false,
  });
  assert.strictEqual(normal.game.challenge, false);
  assert.strictEqual(normal.game.attributes.health, 65);
});

test('START_GAME：周目门控——第 1 局无命运事件，第 3 局起抽取', () => {
  const base = createInitialRuntime();
  // 第 1 局（totalLives=0）：无命运事件
  const round1 = reducer({ ...base, stats: { ...base.stats, totalLives: 0 } }, {
    type: 'START_GAME', gender: 'male', name: '小明', paceMode: 'full', typeSpeed: 'normal', goal: null, challenge: false,
  });
  assert.strictEqual(round1.fateEventIds.length, 0);
  // 第 3 局（totalLives=2）：抽取 1 个命运事件
  const round3 = reducer({ ...base, stats: { ...base.stats, totalLives: 2 } }, {
    type: 'START_GAME', gender: 'male', name: '小明', paceMode: 'full', typeSpeed: 'normal', goal: null, challenge: false,
  });
  assert.strictEqual(round3.fateEventIds.length, 1, '第 3 局应抽取 1 个命运事件');
});

test('MAKE_CHOICE：命运事件效果放大 ×1.5，普通事件不受影响', () => {
  const base = createInitialRuntime();
  // 构造命运事件流：年轻 1 岁事件（+5 智力）+ 普通 2 岁事件
  const base2 = mkState([evt('young_02', 19, { intelligence: 10 }), evt('birth_02', 1, { happiness: 4 })]);
  let rt = { ...base2, stats: { ...base2.stats, totalLives: 2 }, fateEventIds: ['young_02'] };
  // 命运事件：智力 25 + round(10×1.5)=15 → 40
  rt = choose(rt);
  assert.strictEqual(rt.game.attributes.intelligence, 40);
  // 普通事件：幸福 60 + 4 → 64
  rt = choose(rt);
  assert.strictEqual(rt.game.attributes.happiness, 64);
});

test('trackAbandonIfPlaying：进行中回标题记 game_abandon，结算后（summary）不误记', () => {
  storage.clear();
  // 模拟进行中的一局（phase=playing）：回标题 → 记中途放弃
  trackAbandonIfPlaying('playing', 30);
  // 模拟结算页回标题（phase=summary）：不误记放弃
  trackAbandonIfPlaying('summary', 60);
  const { events } = loadAnalytics();
  const abandons = events.filter(e => e.type === 'game_abandon');
  assert.strictEqual(abandons.length, 1, '仅进行中放弃记 1 条，结算后回标题不误记');
  assert.strictEqual((abandons[0] as { age: number }).age, 30);
});

// ============ 挑战历史（每日周视图 + 种子比分）============

test('updateDailyHistory：同天更高分覆盖、低分保留、跨天新增', () => {
  const base = { '20260806': { score: 60, age: 50 } };
  const higher = updateDailyHistory(base, '20260806', 75, 70);
  assert.strictEqual(higher['20260806'].score, 75);
  assert.strictEqual(higher['20260806'].age, 70);
  const lower = updateDailyHistory(higher, '20260806', 55, 30);
  assert.strictEqual(lower['20260806'].score, 75);
  const nextDay = updateDailyHistory(lower, '20260807', 66, 60);
  assert.deepStrictEqual(nextDay['20260807'], { score: 66, age: 60 });
  assert.strictEqual(nextDay['20260806'].score, 75);
});

test('recordSeedScore：首次/复玩/最佳更新', () => {
  const first = recordSeedScore({}, '12345', 66, 60);
  assert.deepStrictEqual(first['12345'], { bestScore: 66, bestAge: 60, plays: 1 });
  const again = recordSeedScore(first, '12345', 70, 80);
  assert.deepStrictEqual(again['12345'], { bestScore: 70, bestAge: 80, plays: 2 });
  const lower = recordSeedScore(again, '12345', 40, 20);
  assert.strictEqual(lower['12345'].bestScore, 70);
  assert.strictEqual(lower['12345'].bestAge, 80);
  assert.strictEqual(lower['12345'].plays, 3);
  const otherSeed = recordSeedScore(lower, '99999', 88, 90);
  assert.deepStrictEqual(otherSeed['99999'], { bestScore: 88, bestAge: 90, plays: 1 });
  assert.strictEqual(otherSeed['12345'].plays, 3);
});

test('挑战历史存储往返（内存桩）', () => {
  storage.clear();
  const store = { '20260806': { score: 66, age: 60 } };
  saveDailyHistory(store);
  assert.deepStrictEqual(loadDailyHistory(), store);
  saveSeedScores({ '12345': { bestScore: 70, bestAge: 80, plays: 2 } });
  assert.deepStrictEqual(loadSeedScores(), { '12345': { bestScore: 70, bestAge: 80, plays: 2 } });
  storage.clear();
  assert.deepStrictEqual(loadDailyHistory(), {});
  assert.deepStrictEqual(loadSeedScores(), {});
});

// ============ 连续打卡（每日挑战日活钩子）============

test('updateDailyStreak：昨天打卡连续 +1，今天重复不变，断档重来', () => {
  // 已知日期：20260806 的昨天 = 20260805
  const first = updateDailyStreak({ date: '', count: 0 }, '20260806');
  assert.deepStrictEqual(first, { date: '20260806', count: 1 });
  // 今天重复：不变
  const sameDay = updateDailyStreak(first, '20260806');
  assert.deepStrictEqual(sameDay, { date: '20260806', count: 1 });
  // 昨天打过：+1
  const nextDay = updateDailyStreak(first, '20260807');
  assert.deepStrictEqual(nextDay, { date: '20260807', count: 2 });
  // 断档（前天及更早）：重来
  const broken = updateDailyStreak(nextDay, '20260810');
  assert.deepStrictEqual(broken, { date: '20260810', count: 1 });
  // 跨月边界：20260901 的昨天 = 20260831
  const monthEdge = updateDailyStreak({ date: '20260831', count: 5 }, '20260901');
  assert.deepStrictEqual(monthEdge, { date: '20260901', count: 6 });
});

test('连续打卡存储往返（内存桩）', () => {
  storage.clear();
  saveDailyStreak({ date: '20260806', count: 3 });
  assert.deepStrictEqual(loadDailyStreak(), { date: '20260806', count: 3 });
  storage.clear();
  assert.deepStrictEqual(loadDailyStreak(), { date: '', count: 0 });
});

// ============ 人生重开（第 6 周目）============

test('REINCARNATE：取「初始+终局」均值重新投胎（保底初始）+ 轮回标记', () => {
  let rt = mkState([evt('a_01', 7, {})]);
  // 造一个终局属性偏高的状态（高分项与低分项并存）
  rt = { ...rt, game: { ...rt.game, attributes: { health: 80, intelligence: 60, wealth: 40, happiness: 70, social: 50, appearance: 30, luck: 20, morality: 10 }, phase: 'summary' } };
  const re = reducer(rt, { type: 'REINCARNATE' });
  assert.strictEqual(re.game.phase, 'playing');
  assert.strictEqual(re.game.reincarnated, true);
  // 均值：health (65+80)/2=73、intelligence (25+60)/2=43、wealth (20+40)/2=30、happiness (60+70)/2=65
  assert.strictEqual(re.game.attributes.health, 73);
  assert.strictEqual(re.game.attributes.intelligence, 43);
  assert.strictEqual(re.game.attributes.wealth, 30);
  assert.strictEqual(re.game.attributes.happiness, 65);
  // 低分项保底初始：appearance 38→45、luck 35→50、morality 28→45
  assert.strictEqual(re.game.attributes.appearance, 45);
  assert.strictEqual(re.game.attributes.luck, 50);
  assert.strictEqual(re.game.attributes.morality, 45);
  // 不叠加挑战/传承标记
  assert.strictEqual(re.game.challenge, undefined);
  assert.strictEqual(re.game.inherited, undefined);
});

// ============ 存档状态同步（中途回标题存档卡显示）============

test('saveState：对局中写入并返回新 saves，内容未变返回 null（防循环）', () => {
  storage.clear();
  const rt = mkState([evt('a_01', 7, { happiness: 1 })]);
  // 对局中（playing）：写入并返回新 saves
  const next = saveState(rt);
  assert.ok(next, '应返回更新后的 saves');
  assert.strictEqual(next.slots[next.active]?.game.age, 7);
  assert.ok(next !== rt.saves, '应为新对象（触发状态更新）');
  // 内容未变：返回 null（SAVES_UPDATED 同步后的 effect 重跑不循环）
  const again = saveState({ ...rt, saves: next });
  assert.strictEqual(again, null);
});

test('saveState：标题页/快速模拟/每日挑战不写库', () => {
  storage.clear();
  const base = createInitialRuntime();
  // 标题页 phase
  assert.strictEqual(saveState(base), null);
  // 快速模拟局
  const auto = { ...base, autoPlay: true, game: { ...base.game, phase: 'playing' as const } };
  assert.strictEqual(saveState(auto), null);
  // 每日挑战局
  const daily = { ...base, isDaily: true, game: { ...base.game, phase: 'playing' as const } };
  assert.strictEqual(saveState(daily), null);
});

test('SAVES_UPDATED：同步存档回运行时状态', () => {
  const rt = mkState([evt('a_01', 7, {})]);
  const next = saveState(rt)!;
  const updated = reducer(createInitialRuntime(), { type: 'SAVES_UPDATED', saves: next });
  assert.strictEqual(updated.saves.slots[updated.saves.active]?.game.age, 7);
});
