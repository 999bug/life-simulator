/**
 * 节奏档位测试（打字速度常量 + filterEvents 抽样引擎）。
 *
 * 运行：node --experimental-strip-types --test script/pace-mode.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { TYPE_SPEED_RANGES } from '../src/engine/state.ts';
import EVENTS, { filterEvents, isMainlineEvent } from '../src/engine/events.ts';
import type { LifeEvent } from '../src/types/index.ts';

test('TYPE_SPEED_RANGES：三档齐全且范围合法', () => {
  assert.deepStrictEqual(Object.keys(TYPE_SPEED_RANGES), ['slow', 'normal', 'fast']);
  for (const [min, max] of Object.values(TYPE_SPEED_RANGES)) {
    assert.ok(min >= 0 && min <= max, `范围非法: ${min}-${max}`);
  }
});

test('isMainlineEvent：2 位数字后缀为主线', () => {
  assert.strictEqual(isMainlineEvent('child_01'), true);
  assert.strictEqual(isMainlineEvent('child_0017'), false);
});

test('filterEvents：full 模式返回原数组', () => {
  assert.strictEqual(filterEvents(EVENTS, 'full', 123), EVENTS);
});

test('filterEvents：lite 确定性（同 seed 同结果）', () => {
  const a = filterEvents(EVENTS, 'lite', 42);
  const b = filterEvents(EVENTS, 'lite', 42);
  assert.deepStrictEqual(a, b);
});

test('filterEvents：lite 每岁密度接近目标上限（闭包允许小幅突破）', () => {
  // 多 seed 循环断言，避免与单一种子耦合。+3 容差为 50 seed 扫描观测值
  // （实测最大溢出 3，如 seed 26/28/33/40/49 某岁达 5），数据演进后需重新校准
  for (let seed = 1; seed <= 10; seed++) {
    const lite = filterEvents(EVENTS, 'lite', seed);
    const byAge = new Map<number, number>();
    for (const e of lite) {
      byAge.set(e.age, (byAge.get(e.age) ?? 0) + 1);
    }
    for (const [age, n] of byAge) {
      // 目标：0-2 全保留；3-12 岁 2 个；13+ 岁 1 个。flag 闭包补回产出者允许 +3 溢出
      const cap = age <= 2 ? Infinity : (age <= 12 ? 2 : 1) + 3;
      assert.ok(n <= cap, `seed ${seed} ${age} 岁 ${n} 个超过上限 ${cap}`);
    }
  }
});

test('filterEvents：lite 0-2 岁事件全保留', () => {
  const lite = filterEvents(EVENTS, 'lite', 7);
  for (const e of EVENTS) {
    if (e.age <= 2) {
      assert.ok(lite.includes(e), `${e.id} 应保留`);
    }
  }
});

test('filterEvents：lite flag 闭包（消费事件的产出者在子集内）', () => {
  const lite = filterEvents(EVENTS, 'lite', 7);
  const producers = new Map<string, LifeEvent[]>();
  for (const e of EVENTS) {
    for (const c of e.choices) {
      for (const f of c.outcomes?.flags ?? []) {
        const list = producers.get(f) ?? [];
        list.push(e);
        producers.set(f, list);
      }
    }
  }
  const ids = new Set(lite.map(e => e.id));
  for (const e of lite) {
    for (const f of e.conditions?.hasFlags ?? []) {
      // parent_ 前缀为开局跨代注入 flag，无事件产出者，豁免闭包检查
      if (f.startsWith('parent_')) {
        continue;
      }
      const ps = (producers.get(f) ?? []).filter(p => p !== e);
      assert.ok(ps.some(p => ids.has(p.id)), `${e.id} 需要的 flag ${f} 无产出者在子集内`);
    }
  }
});

test('filterEvents：lite 总量约 130（抽样正常）', () => {
  // 实测 120-140（50 seed 扫描，每岁 1-2 个 + flag 闭包），下限 90 保留余量防抽样故障
  const lite = filterEvents(EVENTS, 'lite', 7);
  assert.ok(lite.length < EVENTS.length, 'lite 应少于全量');
  assert.ok(lite.length >= 90, `lite 过少: ${lite.length}`);
});

test('filterEvents：不同 seed 结果不同（重玩性）', () => {
  const a = filterEvents(EVENTS, 'lite', 1).map(e => e.id).join(',');
  const b = filterEvents(EVENTS, 'lite', 2).map(e => e.id).join(',');
  assert.notStrictEqual(a, b);
});
