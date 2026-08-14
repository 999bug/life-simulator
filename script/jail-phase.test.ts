/**
 * 监狱/越狱路线事件串线修复的单元测试。
 *
 * 运行：node --experimental-strip-types --test script/jail-phase.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert';
import {
  isIncarcerated,
  isJailContextEvent,
  JAIL_SUPPRESS_MIN_AGE,
  JAIL_SUPPRESS_MAX_AGE,
} from '../src/engine/events.ts';
import { getRoute } from '../src/engine/routes.ts';
import type { LifeEvent } from '../src/types/index.ts';

/** 只关心 id 的最小事件桩 */
function evt(id: string): LifeEvent {
  return { id } as unknown as LifeEvent;
}

test('isIncarcerated：jailed 且未 released/escaped 才算在押', () => {
  assert.equal(isIncarcerated(['jailed']), true);
  assert.equal(isIncarcerated(['jailed', 'released']), false);
  assert.equal(isIncarcerated(['jailed', 'escaped']), false);
  assert.equal(isIncarcerated(['jailed', 'released', 'escaped']), false);
  assert.equal(isIncarcerated([]), false);
});

test('isJailContextEvent：只识别 prison_ / pesc_ 事件', () => {
  assert.equal(isJailContextEvent(evt('prison_0035')), true);
  assert.equal(isJailContextEvent(evt('pesc_0001')), true);
  assert.equal(isJailContextEvent(evt('gang_0005')), false);
  assert.equal(isJailContextEvent(evt('adult_0012')), false);
});

test('在押抑制窗口覆盖监狱/越狱链主要年龄', () => {
  assert.ok(JAIL_SUPPRESS_MIN_AGE <= JAIL_SUPPRESS_MAX_AGE);
  assert.equal(JAIL_SUPPRESS_MIN_AGE, 34);
  assert.equal(JAIL_SUPPRESS_MAX_AGE, 44);
});

test('铁窗人生 / 亡命天涯路线种子改为入口 flag', () => {
  assert.deepEqual(getRoute('prison')?.seedFlags, ['gray_deep']);
  assert.deepEqual(getRoute('escape')?.seedFlags, ['gray_deep', 'escape_plan']);
});
