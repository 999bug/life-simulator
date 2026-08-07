import type { Choice, LifeEvent } from '../types';

/** 伴侣互动起始年龄（婚后第一个互动） */
export const COMPANION_START_AGE = 25;
/** 伴侣互动间隔（每 4 岁一次） */
export const COMPANION_INTERVAL = 4;
/** 伴侣互动截止年龄 */
export const COMPANION_END_AGE = 61;
/** 伴侣互动未启用的哨兵值（存档字段） */
export const COMPANION_DISABLED = 99;

/** 伴侣互动题库（婚后日常：love 分类——自动计入伴侣关系值统计） */
const COMPANION_TEXTS: Array<{ title: string; text: string; choices: Choice[] }> = [
  {
    title: '晚饭后的散步',
    text: '晚饭后，伴侣问你：「今天散步去？」小区里的路灯刚亮，风很舒服。你想起最近忙得已经很久没有这样并肩走过了。',
    choices: [
      { text: '牵着TA的手，走远一点，聊聊最近各自的心事', effects: '', outcomes: { attr: { happiness: 4, social: 3 } } },
      { text: '今天累了，改天吧，先回家休息', effects: '', outcomes: { attr: { happiness: 1 } } },
      { text: '提议去常去的那家小店，一人一碗糖水', effects: '', outcomes: { attr: { happiness: 3, wealth: -2 } } },
    ],
  },
  {
    title: '纪念日怎么过',
    text: '结婚纪念日快到了，伴侣试探着问：「今年还要不要好好过？」去年因为加班，两个人都没腾出时间。',
    choices: [
      { text: '提前订好餐厅，认真准备一份礼物', effects: '', outcomes: { attr: { happiness: 5, wealth: -4 } } },
      { text: '在家做一顿饭，把纪念日过成平常又特别的一天', effects: '', outcomes: { attr: { happiness: 4, morality: 2 } } },
      { text: '又没空，发个红包意思一下', effects: '', outcomes: { attr: { happiness: -2, wealth: -2 } } },
    ],
  },
  {
    title: '家务分工',
    text: '「碗还堆着，地也没拖。」伴侣的语气带着疲惫。家里的事最近都压在TA一个人身上，你下班回来只想躺着。',
    choices: [
      { text: '二话不说，起身把家务全干了', effects: '', outcomes: { attr: { morality: 4, happiness: 2 } } },
      { text: '和TA商量重新分工，周末一起大扫除', effects: '', outcomes: { attr: { social: 3, happiness: 2 } } },
      { text: '装作没听见，继续刷手机', effects: '', outcomes: { attr: { happiness: -4, morality: -3 } } },
    ],
  },
  {
    title: '一场小冷战',
    text: '为了一件小事，你和伴侣已经两天没怎么说话了。饭桌上安静得能听见时钟。TA似乎在等你先开口。',
    choices: [
      { text: '先低头，递一杯TA爱喝的茶，把话说开', effects: '', outcomes: { attr: { happiness: 4, morality: 3 } } },
      { text: '写一张纸条塞在TA包里，给彼此台阶', effects: '', outcomes: { attr: { happiness: 3, social: 2 } } },
      { text: '谁也不理谁，耗着，看谁先撑不住', effects: '', outcomes: { attr: { happiness: -5 } } },
    ],
  },
  {
    title: '周末的小计划',
    text: '周五晚上，伴侣翻着手机问你：「周末要不要出去转转？」附近新开了个夜市，还有部电影要上映。',
    choices: [
      { text: '去夜市从头吃到尾，再散步回家', effects: '', outcomes: { attr: { happiness: 4, wealth: -3 } } },
      { text: '看场电影，出来刚好赶上晚风', effects: '', outcomes: { attr: { happiness: 3, social: 2 } } },
      { text: '周末想加班，让TA自己去', effects: '', outcomes: { attr: { wealth: 3, happiness: -4 } } },
    ],
  },
  {
    title: '深夜的聊天',
    text: '深夜，伴侣翻了个身，忽然问：「你说，我们以后会一直这样吗？」窗外的城市安安静静，只有TA的呼吸声。',
    choices: [
      { text: '把TA搂进怀里：「会，而且会越来越好。」', effects: '', outcomes: { attr: { happiness: 5, morality: 2 } } },
      { text: '认真和TA聊聊对未来的打算', effects: '', outcomes: { attr: { social: 3, happiness: 3 } } },
      { text: '困得睁不开眼，敷衍了一句就睡了', effects: '', outcomes: { attr: { happiness: -3, social: -2 } } },
    ],
  },
  {
    title: 'TA的生日',
    text: '明天是伴侣的生日。TA嘴上说不用过，但今天路过蛋糕店时，多看了橱窗两眼。你全看在眼里。',
    choices: [
      { text: '偷偷订蛋糕，零点给TA一个惊喜', effects: '', outcomes: { attr: { happiness: 5, wealth: -3 } } },
      { text: '亲手做一顿TA爱吃的菜，简单但用心', effects: '', outcomes: { attr: { happiness: 4, morality: 3 } } },
      { text: '白天忙忘了，晚上才想起来，补了个红包', effects: '', outcomes: { attr: { happiness: -2, wealth: -2 } } },
    ],
  },
  {
    title: '一起看老照片',
    text: '整理柜子翻出一本老相册，你俩从恋爱到结婚的照片都在。伴侣坐过来，指着其中一张笑：「那时候真年轻啊。」',
    choices: [
      { text: '和TA从头看到尾，回忆每个瞬间', effects: '', outcomes: { attr: { happiness: 4, social: 2 } } },
      { text: '约定退休后把没去过的地方都走一遍', effects: '', outcomes: { attr: { happiness: 3, luck: 2 } } },
      { text: '看了一会儿就被工作电话打断了', effects: '', outcomes: { attr: { happiness: -2 } } },
    ],
  },
];

/**
 * 构建指定年龄的伴侣互动事件（love 分类——计入伴侣关系值统计）。
 * 题库按年龄轮转：序号 = (年龄 - 起始) / 间隔 % 题库长度，保证同岁同题库事件。
 *
 * @param age 互动年龄（25-61 岁之间，4 的步长）
 * @returns 事件对象（id 形如 companion_01，独立于事件表）
 */
export function buildCompanionEvent(age: number): LifeEvent {
  const idx = Math.floor((age - COMPANION_START_AGE) / COMPANION_INTERVAL) % COMPANION_TEXTS.length;
  const t = COMPANION_TEXTS[idx];
  return {
    id: `companion_${String(idx + 1).padStart(2, '0')}`,
    stage: age <= 29 ? 'young_adult' : age <= 49 ? 'adult' : 'middle_age',
    age,
    title: t.title,
    text: t.text,
    category: 'love',
    choices: t.choices,
  };
}

/** 伴侣互动是否启用（已婚且未到截止年龄） */
export function companionEnabled(hasMarriedFlag: boolean, nextAge: number): boolean {
  return hasMarriedFlag && nextAge <= COMPANION_END_AGE;
}
