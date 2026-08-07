/**
 * 死法图鉴单元测试：致命 flag → 细分死因（reducer 级）+ 死法分布累计 + 花样作死成就。
 *
 * 运行：node --experimental-strip-types --test script/deaths.test.ts
 * 说明：reducer 为纯函数（localStorage 读写仅发生在 createInitialRuntime/effect），
 * 可用自制事件数组做确定性断言（沿用 use-game.test.ts 的 mkState/choose 模式）。
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { reducer, createInitialRuntime, accumulateDeaths } from '../src/hooks/useGame.ts';
import { getStageForAge, fatalCause, STAGE_ORDER } from '../src/engine/state.ts';
import { checkAchievements } from '../src/engine/achievements.ts';
import { setEvents } from '../src/engine/events.ts';
import type { Attributes, GameState, LifeEvent, RuntimeState as Rt } from '../src/types/index.ts';

// 事件数据运行时拆分后，node 测试无 fetch，直接读 public/events.json 注入
setEvents(JSON.parse(readFileSync(new URL('../public/events.json', import.meta.url), 'utf8')));

// localStorage 内存桩（埋点 track() 写存储需桩；读缺失 = null，与 try/catch 兜底等价）
const storage = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => { storage.set(k, v); },
  removeItem: (k: string) => { storage.delete(k); },
  clear: () => storage.clear(),
  key: (i: number) => Array.from(storage.keys())[i] ?? null,
  get length() { return storage.size; },
} as unknown as Storage;

/** 构造测试事件（单选项；attrs 为选项效果、flags 为选项产出 flag） */
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
      snapshots: [{ age: first.age, attrs: attributes }],
    },
  };
}

/** 对当前事件做一次选择（取第一个选项） */
function choose(rt: Rt): Rt {
  const e = rt.currentEvent!;
  return reducer(rt, { type: 'MAKE_CHOICE', choice: e.choices[0], eventId: e.id });
}

/** 推进两岁（7 岁普通事件 → 21 岁意外事件并选择） */
function reachFatal(rt: Rt): Rt {
  rt = choose(rt);
  rt = choose(rt);
  return rt;
}

/**
 * 死亡事件后必须仍有后续事件：引擎 isDead 判定要求 next !== null
 * （事件流末尾选择后按「事件播完」寿终处理，不判健康）。
 */
const TAIL = [evt('z_01', 22, { happiness: 1 })];

test('fatalCause：致命 flag → 细分死因映射', () => {
  assert.strictEqual(fatalCause(['fatal_accident']), 'accident');
  assert.strictEqual(fatalCause(['fatal_illness']), 'illness');
  assert.strictEqual(fatalCause(['fatal_overwork']), 'overwork');
  // 混入其他 flag 不影响判定
  assert.strictEqual(fatalCause(['married', 'fatal_accident']), 'accident');
  // 无致命 flag → null
  assert.strictEqual(fatalCause([]), null);
  assert.strictEqual(fatalCause(['married']), null);
});

test('MAKE_CHOICE：致命 flag + 健康归零 → 细分死因 accident', () => {
  const events = [
    evt('a_01', 7, { happiness: 1 }),
    evt('d_01', 21, { health: -100 }, ['fatal_accident']),
    ...TAIL,
  ];
  let rt = mkState(events);
  assert.strictEqual(rt.game.phase, 'playing');
  rt = reachFatal(rt);
  // 意外死亡：立即结算 + 细分死因 + 健康归零
  assert.strictEqual(rt.game.phase, 'summary');
  assert.strictEqual(rt.game.deathCause, 'accident');
  assert.strictEqual(rt.game.attributes.health, 0);
  assert.strictEqual(rt.game.flags.includes('fatal_accident'), true);
  assert.strictEqual(rt.achievementPending, true);
});

test('MAKE_CHOICE：fatal_illness / fatal_overwork → 细分死因', () => {
  const cases: Array<[string, 'illness' | 'overwork']> = [
    ['fatal_illness', 'illness'],
    ['fatal_overwork', 'overwork'],
  ];
  for (const [flag, cause] of cases) {
    const events = [
      evt('a_01', 7, { happiness: 1 }),
      evt(`d_${cause}`, 21, { health: -100 }, [flag]),
      ...TAIL,
    ];
    const rt = reachFatal(mkState(events));
    assert.strictEqual(rt.game.deathCause, cause, `flag ${flag} 应判为 ${cause}`);
    assert.strictEqual(rt.game.phase, 'summary');
  }
});

test('MAKE_CHOICE：意外事件安全选项不致死', () => {
  const events = [
    evt('a_01', 7, { happiness: 1 }),
    evt('d_02', 21, { health: -20 }),
    ...TAIL,
  ];
  const rt = reachFatal(mkState(events));
  assert.strictEqual(rt.game.phase, 'playing');
  assert.strictEqual(rt.game.deathCause, null);
  assert.strictEqual(rt.game.attributes.health, 45);
  assert.strictEqual(rt.game.flags.includes('fatal_accident'), false);
});

test('MAKE_CHOICE：无致命 flag 健康归零 → 通用死因 health（回归）', () => {
  const events = [
    evt('a_01', 7, { happiness: 1 }),
    evt('d_03', 21, { health: -100 }),
    ...TAIL,
  ];
  const rt = reachFatal(mkState(events));
  assert.strictEqual(rt.game.phase, 'summary');
  assert.strictEqual(rt.game.deathCause, 'health');
});

test('MAKE_CHOICE：致命 flag 未致死（health 未归零）不判细分死因', () => {
  // 防御性：flag 存在但 health 未归零 → 继续游戏，死因不细分（后续正常结算仍按两档）
  const events = [
    evt('a_01', 7, { happiness: 1 }),
    evt('d_04', 21, { health: -10 }, ['fatal_accident']),
    ...TAIL,
  ];
  const rt = reachFatal(mkState(events));
  assert.strictEqual(rt.game.phase, 'playing');
  assert.strictEqual(rt.game.deathCause, null);
  assert.strictEqual(rt.game.attributes.health, 55);
});

test('accumulateDeaths：死法分布累计（旧档缺失兜底）', () => {
  // 旧存档无字段 → 以本局死因初始化
  assert.deepStrictEqual(accumulateDeaths(undefined, 'lifespan'), { lifespan: 1 });
  // 已有分布追加新死因
  const d1 = accumulateDeaths({ lifespan: 2, health: 1 }, 'accident');
  assert.deepStrictEqual(d1, { lifespan: 2, health: 1, accident: 1 });
  // 同死因再累计
  const d2 = accumulateDeaths(d1, 'accident');
  assert.deepStrictEqual(d2, { lifespan: 2, health: 1, accident: 2 });
  // 死因缺失防御性兜底 lifespan
  assert.deepStrictEqual(accumulateDeaths({}, undefined as never), { lifespan: 1 });
});

/** 构造终局状态 */
function game(overrides: Partial<GameState> = {}): GameState {
  return {
    gender: 'male',
    name: '测试',
    age: 40,
    stage: 'adult',
    stageIdx: 4,
    attributes: { health: 50, intelligence: 50, wealth: 50, happiness: 50, social: 50, appearance: 50, luck: 50, morality: 50 },
    flags: [],
    history: [],
    phase: 'summary',
    deathCause: 'lifespan',
    goal: null,
    ...overrides,
  };
}

test('checkAchievements：花样作死（跨局 3 种以上不同死因）', () => {
  const input = (deaths: Record<string, number> | undefined) => ({
    game: game(),
    completedLives: 3,
    wasLite: false,
    wasAuto: false,
    endingsCount: 1,
    dailyStreak: 0,
    deaths,
  });
  // 恰好 3 种 → 解锁（键数 ≥3）
  assert.ok(checkAchievements(input({ health: 1, lifespan: 1, accident: 1 })).includes('varied_deaths'));
  // 3 种含累计次数 → 解锁
  assert.ok(checkAchievements(input({ health: 2, lifespan: 3, overwork: 1 })).includes('varied_deaths'));
  // 4 种 → 解锁
  assert.ok(checkAchievements(input({ health: 1, lifespan: 1, accident: 1, illness: 1 })).includes('varied_deaths'));
  // 仅 2 种 → 不解锁
  assert.ok(!checkAchievements(input({ health: 1, lifespan: 2 })).includes('varied_deaths'));
  // 无字段（旧存档）→ 不解锁
  const legacy = { game: game(), completedLives: 3, wasLite: false, wasAuto: false, endingsCount: 1, dailyStreak: 0 };
  assert.ok(!checkAchievements(legacy).includes('varied_deaths'));
});
