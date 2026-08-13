import type { DeathCause } from '../types';

/** 死法 → 一句话幽默注脚（克制，不冒犯） */
const LINES: Record<DeathCause, (age: number) => string> = {
  health: a => `健康归零，${a} 岁就把身体造完了——下辈子记得早点睡。`,
  lifespan: a => `寿终正寝，${a} 岁体面谢幕——人生这场戏，你演完了。`,
  accident: a => `意外身亡，${a} 岁戛然而止——明天和意外，终究是意外先到。`,
  illness: a => `病逝于 ${a} 岁——有些病，是年轻时熬出来的利息。`,
  overwork: a => `操劳过度，${a} 岁倒在工位上——下辈子换份不加班的工作。`,
};

/** 死法冷笑话：结算页死亡叙事下的一行注脚 */
export function deathOneLiner(cause: DeathCause | null | undefined, age: number): string {
  const fn = LINES[cause ?? 'lifespan'] ?? LINES.lifespan;
  return fn(age);
}
