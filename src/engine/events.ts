import type { LifeEvent } from '../types';
import eventsJson from './events.json';

/**
 * 全部人生事件（357 个）。
 * 由 script/convert-events.mjs 从 script/chiled.json 生成，数据请勿手改；
 * 修改事件请编辑 script/chiled.json 后运行 npm run build:events。
 *
 * 播放机制：
 * - 线性按数组顺序推进，conditions 不满足的事件跳过
 * - 年龄由事件自身 age 驱动（同一岁的多个事件连续触发）
 */
const EVENTS = eventsJson as unknown as LifeEvent[];

export default EVENTS;
