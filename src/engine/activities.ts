import type { Attributes } from '../types/index.ts';

/** 一次主动行为的结果（叙事 + 属性效果 + 可选 flag 产出） */
export interface ActivityResult {
  text: string;
  attr: Partial<Attributes>;
  flags?: string[];
}

/** 主动行为定义（活动表内嵌引擎，仿 companion.ts：数据在引擎内，不占事件密度） */
export interface Activity {
  id: string;
  name: string;
  icon: string;
  desc: string;
  /** 可用年龄（打工 16 岁起、犯罪 14 岁起、体检 18 岁起） */
  minAge: number;
  /** flag 要求（任一满足即可；遛狗要求养宠 flag） */
  requires?: string[];
  /** 结果池（常规活动 3-4 个变体随机抽取；犯罪为 3 类：成功变体 + 被抓 + 逃跑） */
  results: ActivityResult[];
}

/** 每岁行动配额（第 3 次起拒绝：行动不推进年龄，配额随岁刷新） */
export const ACTIONS_PER_AGE = 2;

/** 犯罪活动 id（reducer 分支判定用） */
export const CRIME_ACTIVITY_ID = 'crime';

/** 犯罪活动：结果池前部的成功变体数量（其余为被抓/逃跑，位置约定） */
const CRIME_SUCCESS_VARIANTS = 3;

/** 主动行为活动表（第一批 8 个：健身/学习/打工/社交/体检/休闲/遛宠/犯罪） */
export const ACTIVITIES: Activity[] = [
  {
    id: 'fitness',
    name: '健身',
    icon: '🏃',
    desc: '出出汗，身体是革命的本钱',
    minAge: 6,
    results: [
      {
        text: '六点的闹钟响了三次，你还是爬了起来。绕小区跑了两圈，晨风灌进肺里，昨天熬夜的疲惫被跑掉了大半。',
        attr: { health: 5 },
      },
      {
        text: '健身房里器械区人不多。你咬着牙把最后一组做完，镜子里胳膊的线条好像又明显了一点。',
        attr: { health: 6 },
      },
      {
        text: '电梯口排着长队，你转身进了楼梯间。爬到十二楼腿有点软，但心跳得很踏实。',
        attr: { health: 3 },
      },
      {
        text: '晚饭后你跟着广场舞的节奏绕圈快走，领舞的阿姨冲你竖了个大拇指，你不自觉地迈大了步子。',
        attr: { health: 4 },
      },
    ],
  },
  {
    id: 'study',
    name: '学习',
    icon: '📚',
    desc: '读读书，脑子越用越灵',
    minAge: 6,
    results: [
      {
        text: '这本书的序言你就读了三遍。读到深夜，脉络终于理顺了，像推开了一扇蒙尘很久的门。',
        attr: { intelligence: 6 },
      },
      {
        text: '网课老师的语速调到 1.5 倍还是有点跟不上，你按下暂停把笔记补全，进度条又往前走了一截。',
        attr: { intelligence: 4 },
      },
      {
        text: '错题本已经翻到卷边。把同一类错误归到一起时你忽然明白了——原来它们都是同一个坑。',
        attr: { intelligence: 5 },
      },
      {
        text: '单词卡片过到第五十张，眼皮开始打架。你往太阳穴抹了点风油精，又翻过去一页。',
        attr: { intelligence: 3 },
      },
    ],
  },
  {
    id: 'work',
    name: '打工',
    icon: '💼',
    desc: '赚点外快，手头宽裕些',
    minAge: 16,
    results: [
      {
        text: '周末去超市理了三天货架，腰酸背痛。工资到账的提示音响起时，你觉得这声音比什么音乐都好听。',
        attr: { wealth: 6 },
      },
      {
        text: '项目赶进度，你主动留了下来。深夜的办公室只剩键盘声，加班费够交下一季度的房租了。',
        attr: { wealth: 8 },
      },
      {
        text: '朋友介绍的单子，你熬了两个通宵做完。尾款到账那天，你请自己吃了顿好的，也没那么累了。',
        attr: { wealth: 10 },
      },
      {
        text: '楼下跑腿的订单你顺手接了一单又一单。腿跑细了，钱包鼓了，晚饭加了个鸡腿。',
        attr: { wealth: 5 },
      },
    ],
  },
  {
    id: 'social',
    name: '社交',
    icon: '🤝',
    desc: '出去走走，见见老朋友',
    minAge: 10,
    results: [
      {
        text: '约了三年没见的老同学吃饭。聊起当年一起逃过的课，笑得差点喷饭。散场时说好明年还聚。',
        attr: { social: 6 },
      },
      {
        text: '本不想去的聚会，你硬着头皮去了。没想到气氛比想象中热络，散场时新朋友主动加了你的好友。',
        attr: { social: 5 },
      },
      {
        text: '给老朋友打了个电话，电话那头的声音还是老样子。聊了四十分钟，挂断时你发现自己一直在笑。',
        attr: { social: 3 },
      },
      {
        text: '集市上人挤人，你在一家旧书摊前站了很久。和摊主从书聊到天气，一上午不知不觉就过去了。',
        attr: { social: 4 },
      },
    ],
  },
  {
    id: 'health',
    name: '体检',
    icon: '🏥',
    desc: '每年体检一次，心里有底',
    minAge: 18,
    results: [
      {
        text: '体检报告出来了，各项指标都在正常范围。医生笑着说保持得不错，你悬着的心放下了。',
        attr: { happiness: 2 },
      },
      {
        text: '医生看着报告皱了皱眉：有点小毛病，平时多注意休息，按时复查。你记下了，回去就把熬夜戒了。',
        attr: { health: 1 },
      },
      {
        text: '报告单上「血脂偏高」几个字有点刺眼。医生叮嘱少油多动，你盯着单子看了很久才收起来。',
        attr: { health: -2 },
      },
    ],
  },
  {
    id: 'leisure',
    name: '休闲',
    icon: '😌',
    desc: '偷个懒，给心情放个假',
    minAge: 6,
    results: [
      {
        text: '沿着河边慢慢走，晚风把白天的烦心事吹散了大半。走到桥头时，你忽然觉得日子也没那么糟。',
        attr: { happiness: 4 },
      },
      {
        text: '影厅灯光暗下来的那一刻，你才真正从忙碌里抽离出来。片尾曲响起时，心里装的全是故事。',
        attr: { happiness: 5 },
      },
      {
        text: '坐在窗边什么也不做，看云慢慢飘。脑子放空的十分钟，像给心情充了一次电。',
        attr: { happiness: 3 },
      },
      {
        text: '犒劳自己一顿热腾腾的火锅。第一口下去，整个人都活过来了，什么烦恼都是小事。',
        attr: { happiness: 6 },
      },
    ],
  },
  {
    id: 'walk_dog',
    name: '遛宠物',
    icon: '🐕',
    desc: '带毛孩子出去放风',
    minAge: 6,
    requires: ['has_dog', 'has_pet', 'has_cat'],
    results: [
      {
        text: '绳子一抖，它已经蹿出去老远。遛了一圈回来，它满足地蹭你的裤腿，你也跟着开心起来。',
        attr: { happiness: 3, social: 2 },
      },
      {
        text: '把玩具扔出去又叼回来，它玩得尾巴都快摇断了。楼下的孩子看得眼馋，都想过来摸摸它。',
        attr: { happiness: 3, social: 3 },
      },
      {
        text: '给它梳毛的时候它舒服得直打呼噜。梳下来的毛团了一小堆，它眯着眼看你，像在说谢谢。',
        attr: { happiness: 3, social: 2 },
      },
    ],
  },
  {
    id: 'crime',
    name: '犯罪',
    icon: '⚖️',
    desc: '高风险，高回报……也要高运气',
    minAge: 14,
    // 结果池 = 3 个成功变体 + 被抓 + 逃跑（位置约定：前 CRIME_SUCCESS_VARIANTS 个为成功变体，末两位为被抓/逃跑）
    results: [
      {
        text: '你盯了半个月的便利店收银台，摸清了换班时间。那天晚上收银员去补货，你伸手、得手、出门——全程不到三十秒。钱在口袋里发烫，心跳得厉害，但你没回头。',
        attr: { wealth: 15, morality: -8 },
      },
      {
        text: '旧货市场里有人急着出手一块「祖传」手表，你压到三折拿下，转手就翻了一倍。买家高高兴兴，你也高高兴兴——只有你知道那块表来路不正。',
        attr: { wealth: 13, morality: -7, luck: 2 },
      },
      {
        text: '帮人销了一笔来路不明的货，佣金厚实。你安慰自己「只是搭了把手」。可夜里总睡不踏实，总觉得这笔钱迟早要还回去。',
        attr: { wealth: 12, morality: -6, luck: -2 },
      },
      {
        text: '手铐冰凉的触感——你终于还是栽了。警车后座很颠，窗外的街景像电影一样后退，你忽然想起家里还晾着没收的衣服。',
        attr: { wealth: -8 },
        flags: ['jailed'],
      },
      {
        text: '被店员的吼声吓得夺门而出。你跑出两条街才敢停下来喘气，膝盖磕青了一块，钱包却比脸还干净。',
        attr: { wealth: -3, happiness: -2 },
      },
    ],
  },
];

/**
 * 犯罪成功率：基础 60% + 运气 ×0.5% + 智力 ×0.3%，钳位 [0, 90]。
 *
 * @param luck 当前运气
 * @param intelligence 当前智力
 * @returns 成功率（0-90 的百分数值）
 */
export function crimeSuccessRate(luck: number, intelligence: number): number {
  return Math.max(0, Math.min(90, 60 + luck * 0.5 + intelligence * 0.3));
}

/**
 * 犯罪结果判定（可测试的专用分支，rand 注入）。
 * 先按成功率判成败：成功 → 从成功变体池随机挑一个（大额财富 + 道德代价 + 运气波动）；
 * 失败 → 再掷一次：50% 被抓（产出 jailed flag，接入铁窗路线）/ 50% 落荒而逃（小损）。
 *
 * @param luck 当前运气
 * @param intelligence 当前智力
 * @param rand 随机数源（0-1；测试注入控制分支）
 * @returns 判定后的结果（results 池中的一员）
 */
export function rollCrime(luck: number, intelligence: number, rand: () => number): ActivityResult {
  const crime = ACTIVITIES.find(a => a.id === CRIME_ACTIVITY_ID)!;
  if (rand() < crimeSuccessRate(luck, intelligence) / 100) {
    // 成功：从成功变体池（结果池前部）随机挑一个
    const pool = crime.results.slice(0, CRIME_SUCCESS_VARIANTS);
    return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
  }
  // 失败：50% 被抓 / 50% 落荒而逃（末两位位置约定）
  if (rand() < 0.5) {
    return crime.results[crime.results.length - 2];
  }
  return crime.results[crime.results.length - 1];
}

/**
 * 结果池随机抽取（常规活动）。
 * 犯罪活动由 reducer 走 rollCrime 专用分支（需属性判定成功率），此处仅作兜底随机。
 *
 * @param activity 活动定义
 * @returns 结果池中随机一员
 */
export function pickActivityResult(activity: Activity): ActivityResult {
  const pool = activity.results;
  return pool[Math.floor(Math.random() * pool.length)];
}
