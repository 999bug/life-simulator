import type { LifeEvent } from '../types';

/**
 * 全部人生事件。
 *
 * 分支机制：
 * - choice.outcomes.nextEvent 指定选择后跳转到哪个事件
 * - event.conditions 控制事件是否出现（不满足则跳过）
 * - 无 nextEvent 时按数组顺序继续
 */
const EVENTS: LifeEvent[] = [
  // ==================== 婴儿期（0-2岁）====================
  {
    id: 'birth', stage: 'infant', age: 0,
    text: '产房里响起第一声啼哭。\n\n一个新的生命来到了这个世界。护士把你擦干净，裹进柔软的襁褓，轻轻放在妈妈身边。\n\n"是个健康的宝宝呢。"\n\n你闭着眼睛，还不知道未来有多长，也不知道这一生会遇见谁、经历什么。但故事，已经开始了。',
    choices: [{ text: '……', effects: '', outcomes: { attr: {}, nextAge: 1 } }],
  },
  {
    id: 'first_words', stage: 'infant', age: 1,
    text: '你一岁了。妈妈每天对着你说话，教你叫"爸爸"、"妈妈"。\n\n这天下午，你坐在婴儿椅上，嘴里咿咿呀呀地嘟囔着。突然，一个清晰的音节蹦了出来。\n\n全家人愣了一秒，然后笑得合不拢嘴。',
    choices: [{ text: '……', effects: '', outcomes: { attr: { intelligence: 3, happiness: 5, social: 2 }, nextAge: 3 } }],
  },

  // ==================== 童年（3-11岁）====================
  {
    id: 'kindergarten', stage: 'childhood', age: 3,
    text: '三岁了。第一天上幼儿园。\n\n陌生的教室里摆满了五颜六色的玩具，墙上贴着动物贴纸。周围全是和你差不多高的小朋友——有的在嚎啕大哭，有的在抢积木，有的在角落里自己翻绘本。\n\n一个扎马尾的老师蹲下来，温柔地看着你："小朋友，你想玩什么呀？"',
    choices: [
      { text: '跑向积木区，大声喊"谁要一起搭城堡？"', effects: '👥+8 😊+5 🧠+2', outcomes: { attr: { social: 8, happiness: 5, intelligence: 2 }, nextAge: 5, flags: ['outgoing_kid'] } },
      { text: '安静地去图书角，拿起一本恐龙绘本', effects: '👥-3 😊-2 🧠+6', outcomes: { attr: { social: -3, happiness: -2, intelligence: 6 }, nextAge: 5, flags: ['quiet_kid'] } },
      { text: '死死抱着妈妈的腿不松手，眼泪汪汪', effects: '😊-8 👥-5 💪-2', outcomes: { attr: { happiness: -8, social: -5, health: -2 }, nextAge: 5, flags: ['shy_kid'] } },
    ],
  },
  {
    id: 'pet_choice', stage: 'childhood', age: 5,
    text: '五岁生日那天，爸妈带你去宠物市场。笼子里有毛茸茸的小狗、软绵绵的小猫，还有一只缩在角落的小兔子。\n\n"选一只吧，但你要答应好好照顾它。"你蹲在笼子前，眼睛亮晶晶的。',
    choices: [
      { text: '选那只摇尾巴的小黄狗，它看起来最热情', effects: '😊+8 👥+5 💪+3', outcomes: { attr: { happiness: 8, social: 5, health: 3 }, nextAge: 6, flags: ['has_dog'] } },
      { text: '抱起那只安静的小白猫，它的眼睛好漂亮', effects: '😊+6 🧠+3 🎨+3', outcomes: { attr: { happiness: 6, intelligence: 3, appearance: 3 }, nextAge: 6, flags: ['has_cat'] } },
      { text: '选了笼子角落那只不起眼的小兔子', effects: '😊+5 ⚖️+5', outcomes: { attr: { happiness: 5, morality: 5 }, nextAge: 6, flags: ['has_pet'] } },
      { text: '"不了，我怕照顾不好它。"——五岁的你认真地说', effects: '🧠+5 ⚖️+3', outcomes: { attr: { intelligence: 5, morality: 3 }, nextAge: 6 } },
    ],
  },
  {
    id: 'hobby_choice', stage: 'childhood', age: 6,
    text: '上小学了。爸妈觉得你应该在课外发展一项兴趣。\n\n周末带你去了少年宫——画画班里颜料缤纷、钢琴房里琴声叮咚、跆拳道馆里小朋友们踢腿喊得震天响、编程教室里电脑屏幕闪着神秘的光。\n\n"你自己选一个，但选了就要坚持哦。"',
    choices: [
      { text: '画画！你从小就喜欢在纸上涂涂抹抹', effects: '🎨+6 😊+5 💰-3', outcomes: { attr: { appearance: 6, happiness: 5, wealth: -3 }, nextAge: 8, flags: ['art_skill'] } },
      { text: '钢琴——虽然看起来不容易，但弹琴的人好优雅', effects: '🎨+4 🧠+5 💰-4', outcomes: { attr: { appearance: 4, intelligence: 5, wealth: -4 }, nextAge: 8, flags: ['music_skill'] } },
      { text: '跆拳道！踢腿喊"哈"的样子太帅了', effects: '💪+8 👥+5 😊+2', outcomes: { attr: { health: 8, social: 5, happiness: 2 }, nextAge: 8, flags: ['martial_arts'] } },
      { text: '编程班——虽然还不太懂，但电脑好像很神奇', effects: '🧠+10 👥-3 😊-1', outcomes: { attr: { intelligence: 10, social: -3, happiness: -1 }, nextAge: 8, flags: ['coding_early'] } },
    ],
  },
  {
    id: 'school_competition', stage: 'childhood', age: 8,
    text: '学校要举办朗诵比赛，语文老师鼓励你报名参加。\n\n你站在班级门口犹豫了很久——脑子里一半是"我想试试"，一半是"万一忘词了多丢人"。',
    choices: [
      { text: '报名！回家让妈妈陪你练了一个星期', effects: '🎨+5 😊+5 🧠+3', outcomes: { attr: { appearance: 5, happiness: 5, intelligence: 3 }, nextAge: 10, flags: ['public_speaking'] } },
      { text: '不想上台。但帮参赛的同学做了好看的背景板', effects: '🎨+4 👥+4 ⚖️+3', outcomes: { attr: { appearance: 4, social: 4, morality: 3 }, nextAge: 10 } },
      { text: '算了，把时间花在看书上好了', effects: '🧠+5 😊-2', outcomes: { attr: { intelligence: 5, happiness: -2 }, nextAge: 10 } },
    ],
  },
  // 分支事件：根据是否交了朋友走不同路线
  {
    id: 'new_friend', stage: 'childhood', age: 10,
    text: '班里转来了一个新同学。他总是一个人坐在座位上，课间也不和别人一起玩。\n\n有天下着大雨，放学铃响了很久他还没走——原来没带伞，在等雨停。你手里的伞不大，但两个人挤一挤也够。',
    choices: [
      { text: '"一起走吧！"你笑着把伞举过他的头顶', effects: '👥+10 😊+5 ⚖️+5', outcomes: { attr: { social: 10, happiness: 5, morality: 5 }, nextAge: 12, flags: ['kind_heart', 'best_friend'], nextEvent: 'popular_kid' } },
      { text: '叫上几个同学一起送他回家，一路说说笑笑', effects: '👥+7 😊+4 🧠+2', outcomes: { attr: { social: 7, happiness: 4, intelligence: 2 }, nextAge: 12, flags: ['best_friend'], nextEvent: 'popular_kid' } },
      { text: '假装没看见，和朋友们打打闹闹地跑了', effects: '⚖️-5 👥-2 🍀-3', outcomes: { attr: { morality: -5, social: -2, luck: -3 }, nextAge: 12, nextEvent: 'middle_school_start' } },
      { text: '觉得他一定有什么毛病，和几个同学一起嘲笑他', effects: '⚖️-15 😊-3 👥+5', outcomes: { attr: { morality: -15, happiness: -3, social: 5 }, nextAge: 12, flags: ['bully'], nextEvent: 'bullied_reflection' } },
    ],
  },
  // 分支：善良的孩子
  {
    id: 'popular_kid', stage: 'childhood', age: 11,
    text: '自从交了那个好朋友，你们俩形影不离。一起上学、一起写作业、一起在操场上疯跑。\n\n你发现帮助别人是一件让自己也开心的事。班里同学都说你很可靠，有什么事都喜欢来找你商量。\n\n六年级毕业典礼上，你被评为"最受欢迎的同学"。',
    conditions: { hasFlags: ['best_friend'], notFlags: ['bully'] },
    choices: [
      { text: '心里暖洋洋的。原来善良真的会传染', effects: '😊+8 👥+6 ⚖️+5', outcomes: { attr: { happiness: 8, social: 6, morality: 5 }, nextAge: 12 } },
    ],
  },
  // 分支：悔过
  {
    id: 'bullied_reflection', stage: 'childhood', age: 11,
    text: '那天之后，班主任把你叫到办公室谈了很久。\n\n她没有骂你。只是让你想象——如果你是那个新同学，第一天到一个陌生的地方，没有朋友，还有人嘲笑你……\n\n你低着头，眼泪啪嗒啪嗒掉在校服上。那天晚上你翻来覆去睡不着。\n\n第二天，你走到他面前，小声说了句"对不起"。他愣了一下，然后轻轻点了点头。',
    conditions: { hasFlags: ['bully'] },
    choices: [
      { text: '从此改变了。主动帮新同学适应班级', effects: '⚖️+10 👥+5 😊+3', outcomes: { attr: { morality: 10, social: 5, happiness: 3 }, nextAge: 12, flags: ['redeemed'] } },
      { text: '道歉了，但还是不太会和人相处。独自一人比较多', effects: '⚖️+3 😊-3', outcomes: { attr: { morality: 3, happiness: -3 }, nextAge: 12 } },
    ],
  },

  // ==================== 少年（12-17岁）====================
  {
    id: 'middle_school_start', stage: 'teen', age: 12,
    text: '初中了。科目一下子多了起来——地理、历史、物理、化学。\n\n每天作业写到很晚，周末还有补习班。你开始理解大人们说的"压力"是什么意思了。',
    choices: [
      { text: '"我要考年级前二十。"列了详细的学习计划贴在床头', effects: '🧠+12 😊-4 💪-2', outcomes: { attr: { intelligence: 12, happiness: -4, health: -2 }, nextAge: 14, flags: ['top_student'] } },
      { text: '"成绩中上就好，多交点朋友更重要。"', effects: '👥+8 😊+5 🧠+3', outcomes: { attr: { social: 8, happiness: 5, intelligence: 3 }, nextAge: 14, flags: ['social_butterfly'] } },
      { text: '"其实我更想打篮球……"', effects: '💪+8 👥+5 🧠-3', outcomes: { attr: { health: 8, social: 5, intelligence: -3 }, nextAge: 14, flags: ['athlete'] } },
    ],
  },
  {
    id: 'first_crush', stage: 'teen', age: 14,
    text: '初二。你发现自己最近总是走神——脑子里总是浮现隔壁班那个人的影子。\n\n课间操的时候假装不经意地往那个方向看，走廊擦肩而过的时候心跳漏一拍。\n\n你怀疑自己是不是"早恋"了。但这感觉，好像也不是坏事。',
    choices: [
      { text: '把心情写进带锁的日记本，然后加倍努力学习来转移注意力', effects: '🧠+10 ⚖️+3 😊-3', outcomes: { attr: { intelligence: 10, morality: 3, happiness: -3 }, nextAge: 15, flags: ['diary_writer'] } },
      { text: '鼓起勇气写了张小纸条，趁没人注意塞进TA的课桌', effects: '😊+8 🎨+4 🍀+5', outcomes: { attr: { happiness: 8, appearance: 4, luck: 5 }, nextAge: 15, flags: ['first_love', 'brave'], nextEvent: 'first_date' } },
      { text: '找闺蜜/死党倾诉，在朋友们的起哄声中度过这段时间', effects: '👥+8 😊+4 🧠-4', outcomes: { attr: { social: 8, happiness: 4, intelligence: -4 }, nextAge: 15 } },
    ],
  },
  // 分支：早恋路线
  {
    id: 'first_date', stage: 'teen', age: 14,
    text: 'TA回了你的纸条！\n\n你们约好放学后在学校后面的奶茶店见面。你提前了半小时到，紧张得手心全是汗。\n\nTA进来的时候，你差点把奶茶打翻。但聊着聊着，发现TA也会紧张——原来大家一样。\n\n那一天，奶茶特别甜。',
    conditions: { hasFlags: ['first_love'] },
    choices: [
      { text: '小心翼翼地经营这段感情，互相鼓励好好学习', effects: '😊+10 🧠+5 👥+5', outcomes: { attr: { happiness: 10, intelligence: 5, social: 5 }, nextAge: 15 } },
      { text: '太兴奋了，整天想着TA，成绩一路下滑', effects: '😊+8 🧠-8 👥+3', outcomes: { attr: { happiness: 8, intelligence: -8, social: 3 }, nextAge: 15 } },
    ],
  },
  {
    id: 'family_conflict', stage: 'teen', age: 15,
    text: '青春期撞上更年期。你开始觉得爸妈什么都不懂，他们觉得你越来越不听话。\n\n今天又因为成绩的事吵了一架。你摔了房门，把自己反锁在房间里。耳机里的音乐开到最大，盖过了门外妈妈的叹气声。\n\n深夜，你躺在床上，看着天花板上贴的荧光星星……',
    choices: [
      { text: '爬起来写了封信塞到爸妈房门下："对不起，但我也有自己的想法"', effects: '⚖️+8 😊+5 🧠+3', outcomes: { attr: { morality: 8, happiness: 5, intelligence: 3 }, nextAge: 16, flags: ['reconciled'] } },
      { text: '冷战到底。用成绩说话，让他们以后不敢说你', effects: '🧠+8 😊-6 👥-3', outcomes: { attr: { intelligence: 8, happiness: -6, social: -3 }, nextAge: 16 } },
      { text: '找爷爷奶奶诉苦，让他们帮你说话', effects: '👥+5 😊+3 ⚖️-2', outcomes: { attr: { social: 5, happiness: 3, morality: -2 }, nextAge: 16 } },
    ],
  },
  {
    id: 'high_school_crossroad', stage: 'teen', age: 16,
    text: '中考成绩出来了。不算顶尖，但足够让你有选择权。\n\n家里为此开了个小型家庭会议。爸爸说重点高中才能上好大学，妈妈说按你的兴趣来，你坐在沙发上听着，心里翻江倒海。\n\n这是人生第一个真正意义上的十字路口。',
    choices: [
      { text: '去重点高中。目标是985/211名校', effects: '🧠+15 💰+5 😊-8 💪-3', outcomes: { attr: { intelligence: 15, wealth: 5, happiness: -8, health: -3 }, nextAge: 18, flags: ['academic_path'] } },
      { text: '上普通高中实验班，保持自己的节奏', effects: '👥+6 😊+5 🧠+5', outcomes: { attr: { social: 6, happiness: 5, intelligence: 5 }, nextAge: 18, flags: ['balanced_path'] } },
      { text: '去职业高中学一门实用技术', effects: '💰+10 ⚖️+5 🧠-6 👥+3', outcomes: { attr: { wealth: 10, morality: 5, intelligence: -6, social: 3 }, nextAge: 18, flags: ['tech_path'] } },
    ],
  },

  // ==================== 青年（18-29岁）====================
  {
    id: 'coming_of_age', stage: 'young_adult', age: 18,
    text: '成年了。十八岁生日这天，你站在镜子前看了很久。\n\n镜子里的人和几年前判若两人——长高了、眼神不一样了。法律上你已经是大人了，但心里有一个声音在问：我真的准备好了吗？\n\n吹灭蜡烛的时候，你许的愿望是——',
    choices: [
      { text: '"去远方，看看更大的世界。"', effects: '😊+8 🍀+8 💰-3', outcomes: { attr: { happiness: 8, luck: 8, wealth: -3 }, nextAge: 19, flags: ['wanderlust'] } },
      { text: '"考上好大学，不给爸妈丢脸。"', effects: '🧠+8 ⚖️+5 😊-2', outcomes: { attr: { intelligence: 8, morality: 5, happiness: -2 }, nextAge: 19, flags: ['filial'] } },
      { text: '"希望能遇到对的人。"', effects: '😊+5 🎨+5 🍀+5', outcomes: { attr: { happiness: 5, appearance: 5, luck: 5 }, nextAge: 19 } },
    ],
  },
  // 分支：根据高中路径决定大学走向
  {
    id: 'college_top', stage: 'young_adult', age: 19,
    text: '重点高中三年的拼搏没有白费。你收到了一所985大学的录取通知书。\n\n那天爸妈高兴得请了所有亲戚吃饭，席间爸爸多喝了几杯，拍着你的肩膀说"好孩子"。\n\n你看着通知书上烫金的校名，有点恍惚——新的世界在前面等着。',
    conditions: { hasFlags: ['academic_path'] },
    choices: [
      { text: '去北京/上海。见识一下真正的大城市', effects: '🧠+12 👥+8 💰-6 😊+5', outcomes: { attr: { intelligence: 12, social: 8, wealth: -6, happiness: 5 }, nextAge: 22, flags: ['went_to_college', 'big_city'] } },
      { text: '留在省会。离家近，周末还能回去吃饭', effects: '💰+5 😊+5 ⚖️+3', outcomes: { attr: { wealth: 5, happiness: 5, morality: 3 }, nextAge: 22, flags: ['went_to_college', 'hometown'] } },
    ],
  },
  {
    id: 'college_normal', stage: 'young_adult', age: 19,
    text: '高考成绩出来了，上了一所不错的本科。\n\n虽然不是顶尖名校，但专业是你喜欢的。爸妈挺满意——祖上三代第一个大学生呢。\n\n去学校报到那天，你回头看了一眼站在校门口挥手告别的爸妈，然后深吸一口气，转身走进了属于你的四年。',
    conditions: { notFlags: ['academic_path', 'tech_path'] },
    choices: [
      { text: '积极参加各种活动，把大学生活过得丰富多彩', effects: '👥+8 😊+6 🧠+3', outcomes: { attr: { social: 8, happiness: 6, intelligence: 3 }, nextAge: 22, flags: ['went_to_college'] } },
      { text: '专心读书。图书馆成了你的第二个家', effects: '🧠+10 💰+3 👥-2', outcomes: { attr: { intelligence: 10, wealth: 3, social: -2 }, nextAge: 22, flags: ['went_to_college'] } },
    ],
  },
  {
    id: 'vocational_school', stage: 'young_adult', age: 19,
    text: '职高三年，你学到了一门实打实的技术。\n\n当那些上大学的同学还在背理论、刷题的时候，你已经能独立做出产品了。老师傅拍着你的肩说：小伙子/姑娘，这手艺够你吃一辈子。\n\n毕业的时候，几家工厂抢着要你。你第一次尝到被需要的滋味。',
    conditions: { hasFlags: ['tech_path'] },
    choices: [
      { text: '进了一家大厂做技术工，底薪加绩效，日子有奔头', effects: '💰+14 🧠+3 😊+3', outcomes: { attr: { wealth: 14, intelligence: 3, happiness: 3 }, nextAge: 22, flags: ['skilled_worker'] } },
      { text: '和朋友合伙开了个小作坊，自己当老板', effects: '💰+8 😊+8 🍀+8', outcomes: { attr: { wealth: 8, happiness: 8, luck: 8 }, nextAge: 22, flags: ['small_business'] } },
    ],
  },
  {
    id: 'gap_year_story', stage: 'young_adult', age: 19,
    text: '你背着一个大包出发了。\n\n这一年里，你在青旅里和来自世界各地的人聊天到深夜、在山区小学支教时被孩子们围在中间叫老师、在海边的帐篷里醒来看到此生最美的日出。\n\n有人说不务正业。但你知道，这一年的收获比任何课堂都多。',
    conditions: { hasFlags: ['gap_year'] },
    choices: [
      { text: '旅行结束后去了一个从没计划过的城市定居', effects: '😊+10 🍀+10 👥+8 💰-5', outcomes: { attr: { happiness: 10, luck: 10, social: 8, wealth: -5 }, nextAge: 22, flags: ['gap_year_done'] } },
    ],
  },
  {
    id: 'college_life', stage: 'young_adult', age: 21,
    text: '二十出头的日子。有大把的时间、大把的精力、大把的迷茫。\n\n快毕业了，回头看一眼这几年——',
    conditions: { hasFlags: ['went_to_college'] },
    choices: [
      { text: '大部分时间在图书馆和实验室，成绩名列前茅', effects: '🧠+10 💰+5 👥-4', outcomes: { attr: { intelligence: 10, wealth: 5, social: -4 }, nextAge: 23, flags: ['high_gpa'] } },
      { text: '混社团、搞活动、认识了一大帮朋友', effects: '👥+12 😊+5 🧠-3', outcomes: { attr: { social: 12, happiness: 5, intelligence: -3 }, nextAge: 23, flags: ['social_leader'] } },
      { text: '谈了一场轰轰烈烈的恋爱', effects: '😊+10 🎨+5 🧠-2', outcomes: { attr: { happiness: 10, appearance: 5, intelligence: -2 }, nextAge: 23, flags: ['college_romance'] } },
    ],
  },
  {
    id: 'career_choice', stage: 'young_adult', age: 23,
    text: '踏入社会。投了上百份简历、面了十几家公司、被拒了无数次。\n\n终于，几张offer摆在桌上。每一张都指向完全不同的人生。\n\n有人追逐财富、有人追逐热爱、有人追逐安稳。而你——',
    choices: [
      { text: '去互联网大厂，趁年轻多赚点', effects: '💰+20 🧠+8 😊-8 💪-5', outcomes: { attr: { wealth: 20, intelligence: 8, happiness: -8, health: -5 }, nextAge: 26, flags: ['tech_career'], nextEvent: 'tech_life' } },
      { text: '加入创业公司，赌一把大的', effects: '💰+5 😊+8 🍀+10', outcomes: { attr: { wealth: 5, happiness: 8, luck: 10 }, nextAge: 26, flags: ['startup'], nextEvent: 'startup_life' } },
      { text: '考公务员。铁饭碗，安稳过一辈子', effects: '💰+12 ⚖️+5 😊+2 🧠-3', outcomes: { attr: { wealth: 12, morality: 5, happiness: 2, intelligence: -3 }, nextAge: 26, flags: ['civil_servant'], nextEvent: 'civil_life' } },
      { text: '先不找正式工作。趁年轻去看世界', effects: '😊+15 👥+12 💰-10 🎨+5', outcomes: { attr: { happiness: 15, social: 12, wealth: -10, appearance: 5 }, nextAge: 26, flags: ['world_traveler'], nextEvent: 'traveler_life' } },
    ],
  },
  // 分支：创业路线
  {
    id: 'startup_life', stage: 'young_adult', age: 25,
    text: '创业两年了。公司经历了三轮融资、一次差点散伙、无数次通宵。\n\n今天签下了第一个大客户。团队十几个人挤在小办公室里开香槟——用的是一次性纸杯。\n\n你看着这群愿意跟你一起疯的人，眼眶有点热。',
    conditions: { hasFlags: ['startup'] },
    choices: [
      { text: '被风投看中，公司估值翻了五倍', effects: '💰+20 🍀+10 😊+8 💪-5', outcomes: { attr: { wealth: 20, luck: 10, happiness: 8, health: -5 }, nextAge: 28, flags: ['startup_success'] } },
      { text: '撑了两年还是倒闭了。但学到了比MBA还多的东西', effects: '🧠+12 😊-5 🍀+5', outcomes: { attr: { intelligence: 12, happiness: -5, luck: 5 }, nextAge: 28, flags: ['startup_fail'] } },
    ],
  },
  // 分支：公务员路线
  {
    id: 'civil_life', stage: 'young_adult', age: 25,
    text: '公务员做了两年，日子规律得像是上了发条。\n\n朝九晚五、食堂管饭、同事关系简单。虽然工资不算高，但在这座小城足够体面。\n\n只是偶尔翻到大学同学在北上广的动态，心里会闪过一丝说不清的感觉。',
    conditions: { hasFlags: ['civil_servant'] },
    choices: [
      { text: '知足常乐。这种安稳是多少人想要的', effects: '😊+8 ⚖️+5 💰+5', outcomes: { attr: { happiness: 8, morality: 5, wealth: 5 }, nextAge: 28 } },
      { text: '在体制内也不躺平——考了在职研究生，提升自己', effects: '🧠+8 💰+3 😊+3', outcomes: { attr: { intelligence: 8, wealth: 3, happiness: 3 }, nextAge: 28 } },
    ],
  },
  // 分支：大厂路线
  {
    id: 'tech_life', stage: 'young_adult', age: 25,
    text: '大厂两年，你变了。\n\n发际线后退了一点，黑眼圈重了一点，银行账户多了好几个零。学会了在会议室里说"赋能""闭环""颗粒度"，也学会了凌晨三点对着电脑屏幕怀疑人生。\n\n今天拿到年度绩效A+，leader拍着你肩膀说"明年升P7"。你在微信上给爸妈发了个红包，配文"我挺好的"——然后继续低头写周报。',
    conditions: { hasFlags: ['tech_career'] },
    choices: [
      { text: '继续卷。这条路虽然累，但回报也是实打实的', effects: '💰+15 🧠+5 😊-5 💪-5', outcomes: { attr: { wealth: 15, intelligence: 5, happiness: -5, health: -5 }, nextAge: 28, flags: ['tech_lead'] } },
      { text: '决定辞职。钱够了，想去一家小公司做真正想做的东西', effects: '😊+10 🧠+5 💰-8', outcomes: { attr: { happiness: 10, intelligence: 5, wealth: -8 }, nextAge: 28, flags: ['escaped_rat_race'] } },
    ],
  },
  // 分支：旅行者路线
  {
    id: 'traveler_life', stage: 'young_adult', age: 25,
    text: '你走了很远的路。\n\n在拉萨的街头和陌生人喝过青稞酒、在大理的洱海边看着云发呆了一整个下午、在清迈的夜市里用蹩脚的英语讨价还价。\n\n朋友圈里你是个"过得很酷的人"。但夜深人静的时候，你也会问自己：这样漂着，到底是在寻找什么，还是在逃避什么？',
    conditions: { hasFlags: ['world_traveler'] },
    choices: [
      { text: '在路上找到了一生热爱的事——开了家青年旅舍', effects: '😊+12 💰+5 👥+8', outcomes: { attr: { happiness: 12, wealth: 5, social: 8 }, nextAge: 28, flags: ['hostel_owner'] } },
      { text: '走累了。回到城市找了份普通工作，但心里装着一个世界', effects: '😊+8 🧠+5 💰+3', outcomes: { attr: { happiness: 8, intelligence: 5, wealth: 3 }, nextAge: 28, flags: ['settled_down'] } },
    ],
  },
  {
    id: 'love_marriage', stage: 'young_adult', age: 28,
    text: '身边的朋友陆续结婚了。每个月的工资有一半花在了份子钱上。\n\n今天和恋人散步，TA突然停下来，认真地看着你的眼睛："你觉得……咱俩以后会怎么样？"\n\n晚风吹过。你看到TA眼睛里的期待和一点不安。',
    choices: [
      { text: '握住TA的手："我想和你一起走下去。"', effects: '😊+12 👥+8 ⚖️+5 💰-5', outcomes: { attr: { happiness: 12, social: 8, morality: 5, wealth: -5 }, nextAge: 30, flags: ['married'], nextEvent: 'wedding_day' } },
      { text: '"再等我两年，事业稳了就结婚。"', effects: '💰+10 🧠+5 👥-8 😊-3', outcomes: { attr: { wealth: 10, intelligence: 5, social: -8, happiness: -3 }, nextAge: 30, nextEvent: 'thirty_alone' } },
      { text: '沉默了很久。"我……还没有准备好。"', effects: '😊-12 👥-8 ⚖️+3 🍀+5', outcomes: { attr: { happiness: -12, social: -8, morality: 3, luck: 5 }, nextAge: 30, nextEvent: 'thirty_alone' } },
    ],
  },
  {
    id: 'wedding_day', stage: 'young_adult', age: 29,
    text: '婚礼那天阳光很好。\n\n你站在台上，看着TA穿着婚纱/西装一步一步走过来。司仪在说什么你已经听不清了，只看到TA含着泪光的眼睛。\n\n"我愿意。"——这三个字你练了好几遍，但真说出口的时候声音还是抖了。\n\n台下妈妈在擦眼角。爸爸难得地笑着。',
    conditions: { hasFlags: ['married'] },
    choices: [
      { text: '这是一生中最幸福的日子之一', effects: '😊+10 👥+8 ⚖️+5 💰-5', outcomes: { attr: { happiness: 10, social: 8, morality: 5, wealth: -5 }, nextAge: 30 } },
    ],
  },
  // 分支：三十未婚
  {
    id: 'thirty_alone', stage: 'young_adult', age: 30,
    text: '三十岁。单身。\n\n过年回家的时候，亲戚的关心像刀子一样扎过来——"有对象了吗？""要求别太高了。""隔壁老王的儿子刚离婚，要不要见见？"\n\n你躲到天台上抽烟/发呆，看着远处的烟花一明一灭。\n\n这条路是你自己选的。但有时候也会想：如果当初做了不同的选择……',
    conditions: { notFlags: ['married'] },
    choices: [
      { text: '不后悔。宁缺毋滥，一个人的生活也精彩', effects: '😊+5 🧠+5 💰+5', outcomes: { attr: { happiness: 5, intelligence: 5, wealth: 5 }, nextAge: 33, flags: ['single_and_thriving'] } },
      { text: '开始认真地通过朋友介绍认识新的人', effects: '👥+8 🍀+5 😊+2', outcomes: { attr: { social: 8, luck: 5, happiness: 2 }, nextAge: 33 } },
      { text: '孤独感越来越重，用工作填满所有时间', effects: '💰+10 😊-8 💪-3', outcomes: { attr: { wealth: 10, happiness: -8, health: -3 }, nextAge: 33 } },
    ],
  },

  // ==================== 中年（30-49岁）====================
  {
    id: 'parent_pressure', stage: 'adult', age: 30,
    text: '三十而立。\n\n同学聚会时——有人已经二胎了、有人升了总监、有人创业失败正在打工还债。大家碰杯的时候都有点沉默。\n\n回家路上你一直在想：我到底"立"了什么？',
    choices: [
      { text: '觉得自己干得还不错。每一步都走得很稳', effects: '😊+8 ⚖️+5 💰+5', outcomes: { attr: { happiness: 8, morality: 5, wealth: 5 }, nextAge: 33, flags: ['thirty_steady'] } },
      { text: '焦虑了。换工作、报课程、逼自己学新东西', effects: '🧠+10 😊-6 💪-3', outcomes: { attr: { intelligence: 10, happiness: -6, health: -3 }, nextAge: 33, flags: ['career_change'] } },
      { text: '恍惚觉得时间过太快了，但不知道该做什么', effects: '😊-8 💪-5 🍀+5', outcomes: { attr: { happiness: -8, health: -5, luck: 5 }, nextAge: 33 } },
    ],
  },
  {
    id: 'health_wakeup', stage: 'adult', age: 34,
    text: '年度体检报告出来了。几个红色箭头刺眼地躺在纸上。\n\n脂肪肝、颈椎曲度变直、血脂偏高。医生推了推眼镜："年轻人，身体可不是永动机。"\n\n你从医院出来，秋风把落叶吹到脚边。',
    choices: [
      { text: '从明天开始跑步+调整饮食。这是最后一次看到红箭头', effects: '💪+10 😊+5 💰-3', outcomes: { attr: { health: 10, happiness: 5, wealth: -3 }, nextAge: 37, flags: ['fitness_journey'] } },
      { text: '吓了几天，然后继续熬夜加班。没办法啊', effects: '💪-8 💰+8 😊-3', outcomes: { attr: { health: -8, wealth: 8, happiness: -3 }, nextAge: 37 } },
      { text: '办了健身卡。去了三周，第四周找不到了', effects: '💪+3 💰-3 😊-2', outcomes: { attr: { health: 3, wealth: -3, happiness: -2 }, nextAge: 37 } },
    ],
  },
  {
    id: 'parent_aging', stage: 'adult', age: 37,
    text: '妈妈的电话越来越多了。她总说"没事，就是想听听你的声音"。\n\n上个月爸爸住院的事，她从没提过。等你从亲戚嘴里知道的时候，爸爸已经出院一周了。\n\n你在工位上挂了电话，看着屏幕上的deadline，心里翻江倒海。',
    choices: [
      { text: '请了年假回家。工作可以再找，爸妈的时间不能等', effects: '⚖️+15 😊+8 💰-5', outcomes: { attr: { morality: 15, happiness: 8, wealth: -5 }, nextAge: 40, flags: ['prioritized_family'] } },
      { text: '每天固定时间视频通话，按月打生活费', effects: '⚖️+5 💰-5 😊+2', outcomes: { attr: { morality: 5, wealth: -5, happiness: 2 }, nextAge: 40 } },
      { text: '心里难受，但项目走不开。对自己说下次一定请假', effects: '😊-8 ⚖️-5 💰+5', outcomes: { attr: { happiness: -8, morality: -5, wealth: 5 }, nextAge: 40 } },
    ],
  },
  {
    id: 'midlife_reflection', stage: 'adult', age: 40,
    text: '四十岁。某个初夏的夜晚，一个人坐在阳台上。远处万家灯火，每扇窗户后面都有不一样的人生。\n\n你想起二十岁时写在日记里的话——那个想要成为的人、想去的地方、想要的生活。\n\n一股复杂的情绪涌上来。说不清是满足、遗憾、释然还是不甘。',
    choices: [
      { text: '很满足。虽然没有波澜壮阔，但每一天都活得很踏实', effects: '😊+10 ⚖️+5 💰+8 💪+3', outcomes: { attr: { happiness: 10, morality: 5, wealth: 8, health: 3 }, nextAge: 44, flags: ['content_midlife'] } },
      { text: '不甘心！辞掉工作去追那个搁置了十五年的梦想', effects: '🧠+10 😊+8 💰-10 🍀+8', outcomes: { attr: { intelligence: 10, happiness: 8, wealth: -10, luck: 8 }, nextAge: 44, flags: ['midlife_reinvention'], nextEvent: 'reinvention_story' } },
      { text: '哭了很久，然后擦干眼泪继续生活', effects: '😊-15 💪-10 🧠+8', outcomes: { attr: { happiness: -15, health: -10, intelligence: 8 }, nextAge: 44 } },
    ],
  },
  {
    id: 'reinvention_story', stage: 'adult', age: 42,
    text: '四十多岁重新出发。你辞掉了稳定的工作，重新开始。\n\n身边的人都说你疯了。但只有你自己知道——那个在格子间里日渐枯萎的自己，才是真的疯了。\n\n新领域一切从头学起，和你一起上课的都是二十出头的年轻人，他们叫你"大哥"/"大姐"。你笑着应了一声，然后低头继续记笔记。',
    conditions: { hasFlags: ['midlife_reinvention'] },
    choices: [
      { text: '转型成功了。虽然收入没以前高，但每天早上醒来都是笑着的', effects: '😊+15 🧠+10 💰-5', outcomes: { attr: { happiness: 15, intelligence: 10, wealth: -5 }, nextAge: 48 } },
      { text: '比预想的难很多。但至少试过了，不后悔', effects: '🧠+8 😊+3 ⚖️+8', outcomes: { attr: { intelligence: 8, happiness: 3, morality: 8 }, nextAge: 48 } },
    ],
  },
  {
    id: 'kids_education', stage: 'adult', age: 44,
    text: '孩子上中学了。每天作业写到深夜，周末被补习班塞满。\n\n你看着TA伏在书桌上的瘦小背影，想起了当年的自己。那个时候你最讨厌爸妈说的那些话，现在好像也快要从自己嘴里说出来了。',
    conditions: { hasFlags: ['married'] },
    choices: [
      { text: '和TA好好谈了一次。问TA到底喜欢什么，而不是逼TA学什么', effects: '⚖️+10 😊+8 👥+5', outcomes: { attr: { morality: 10, happiness: 8, social: 5 }, nextAge: 48, flags: ['good_parent'] } },
      { text: '现在不卷以后就晚了——报了最好的补习班', effects: '💰-8 🧠+5 😊-5', outcomes: { attr: { wealth: -8, intelligence: 5, happiness: -5 }, nextAge: 48 } },
      { text: '放手让TA自己安排。路要自己走', effects: '😊+5 🍀+5 ⚖️+3', outcomes: { attr: { happiness: 5, luck: 5, morality: 3 }, nextAge: 48 } },
    ],
  },
  {
    id: 'elder_care_full', stage: 'adult', age: 48,
    text: '爸爸的膝盖不行了，走路要拄拐。妈妈的记性越来越差，昨天把钥匙锁在屋里已经是这周第三次了。\n\n每次打电话回去，他们都说"没事没事，你忙你的"。但你听得出电话那头的虚弱。\n\n上有老、下有小。四十多岁，是所有重量的支点。',
    choices: [
      { text: '把爸妈接到家里一起住。虽然挤，但踏实', effects: '⚖️+20 😊+8 💰-5 👥-3 💪-3', outcomes: { attr: { morality: 20, happiness: 8, wealth: -5, social: -3, health: -3 }, nextAge: 52, flags: ['filial_child'] } },
      { text: '请了最好的护工，自己每周回去看一次', effects: '⚖️+5 💰-10 😊-2', outcomes: { attr: { morality: 5, wealth: -10, happiness: -2 }, nextAge: 52 } },
      { text: '办了养老社区入住。环境好有医护，爸妈起初不习惯但后来交了新朋友', effects: '⚖️+10 💰-12 😊+3', outcomes: { attr: { morality: 10, wealth: -12, happiness: 3 }, nextAge: 52 } },
    ],
  },

  // ==================== 中老年（50-64岁）====================
  {
    id: 'empty_nest', stage: 'middle_age', age: 52,
    text: '孩子考上大学走了。送TA到学校那天，帮TA铺好床单、挂好蚊帐，嘱咐了无数遍"好好吃饭"。"知道了知道了！"——TA一边推你出门一边笑着嫌你啰嗦。\n\n回来的火车上，窗外田野飞驰而过。车厢好安静。\n\n家里少了个人，房子突然变大了。你和伴侣大眼瞪小眼——有点不习惯。',
    choices: [
      { text: '重新捡起年轻时的爱好。学画画/吉他/摄影', effects: '😊+8 🎨+6 🧠+3', outcomes: { attr: { happiness: 8, appearance: 6, intelligence: 3 }, nextAge: 55, flags: ['rediscovered_hobby'] } },
      { text: '把空出来的房间改成书房，终于有时间读了', effects: '🧠+8 😊+5', outcomes: { attr: { intelligence: 8, happiness: 5 }, nextAge: 55 } },
      { text: '闲不下来，去社区大学旁听', effects: '🧠+6 👥+5 😊+3', outcomes: { attr: { intelligence: 6, social: 5, happiness: 3 }, nextAge: 55 } },
    ],
  },
  {
    id: 'grandchildren', stage: 'middle_age', age: 55,
    text: '孩子打电话来说你要当爷爷/奶奶了。\n\n你愣了好一会儿。挂了电话走到镜子前——头发白了一半。那个昨天还在你怀里哭的小家伙，现在要有自己的小家伙了。\n\n生命就是这样，一代接一代。',
    conditions: { hasFlags: ['married'] },
    choices: [
      { text: '高兴坏了。立刻在家庭群里发各种婴儿用品链接', effects: '😊+12 👥+8 ⚖️+5', outcomes: { attr: { happiness: 12, social: 8, morality: 5 }, nextAge: 58, flags: ['grandparent'] } },
      { text: '开心但有点复杂——这意味着自己真的老了', effects: '😊+5 🧠+3 🎨-3', outcomes: { attr: { happiness: 5, intelligence: 3, appearance: -3 }, nextAge: 58, flags: ['grandparent'] } },
      { text: '主动提出帮忙带孩子，让年轻人安心拼事业', effects: '⚖️+12 😊+8 💪-5', outcomes: { attr: { morality: 12, happiness: 8, health: -5 }, nextAge: 58, flags: ['grandparent', 'helpful_grandparent'] } },
    ],
  },
  {
    id: 'health_scare', stage: 'middle_age', age: 58,
    text: '体检报告有一个让人紧张的词。医生表情严肃地建议做进一步检查。\n\n等在检查室外的那个下午，可能是这辈子最长的几个小时。你想了很多——那些还没说的话、还没去的地方、还没和解的人和事。\n\n万幸，结果是良性的。但这次经历，改变了很多东西。',
    choices: [
      { text: '开始养生。早睡早起、清淡饮食、每天一万步', effects: '💪+10 😊+5 ⚖️+3', outcomes: { attr: { health: 10, happiness: 5, morality: 3 }, nextAge: 60, flags: ['health_conscious'] } },
      { text: '列了一张"余生清单"，开始一项一项去做', effects: '😊+12 🍀+8 💰-5', outcomes: { attr: { happiness: 12, luck: 8, wealth: -5 }, nextAge: 60, flags: ['bucket_list'] } },
      { text: '吓坏了，变得疑神疑鬼，总觉得身上哪都疼', effects: '😊-8 💪-3 🧠+3', outcomes: { attr: { happiness: -8, health: -3, intelligence: 3 }, nextAge: 60 } },
    ],
  },
  {
    id: 'retirement', stage: 'middle_age', age: 60,
    text: '退休手续办完了。走出公司/单位大楼的那一刻，你站了很久。\n\n几十年的工龄，换成了一张退休证。同事们的告别蛋糕上奶油已经化了，贺卡上的签名有的熟悉、有的已经认不出了。\n\n现在，时间完完整整属于你自己了。这种感觉，既自由又有点慌。',
    choices: [
      { text: '订了机票开始环游世界！护照上很快盖满了章', effects: '😊+15 👥+8 💰-10 💪+3', outcomes: { attr: { happiness: 15, social: 8, wealth: -10, health: 3 }, nextAge: 64, flags: ['world_tour'] } },
      { text: '加入社区志愿者。用半辈子经验帮助别人', effects: '⚖️+12 👥+10 😊+5', outcomes: { attr: { morality: 12, social: 10, happiness: 5 }, nextAge: 64, flags: ['volunteer'] } },
      { text: '在郊区租了块菜地。日出而作、日落而息', effects: '💪+8 😊+8 💰-3 👥-3', outcomes: { attr: { health: 8, happiness: 8, wealth: -3, social: -3 }, nextAge: 64, flags: ['gardener'] } },
      { text: '返聘回去做顾问。不想太快停下来', effects: '💰+10 🧠+5 😊-3 💪-2', outcomes: { attr: { wealth: 10, intelligence: 5, happiness: -3, health: -2 }, nextAge: 64 } },
    ],
  },

  // ==================== 晚年（65+岁）====================
  {
    id: 'golden_years', stage: 'elder', age: 65,
    text: '六十五岁。早上去公园打太极，中午和老伴去菜市场讨价还价，下午在阳台的摇椅上看书打盹。\n\n生活变得很慢。也不着急——反正没有deadline了。\n\n偶尔翻翻旧相册，泛黄的照片里的人笑得那么灿烂。你认出了每一张脸，但有些名字已经模糊了。',
    conditions: { minAttrs: { health: 35 } },
    choices: [
      { text: '开始写回忆录。把这一生的故事记下来留给孙辈', effects: '😊+8 🧠+5 ⚖️+5', outcomes: { attr: { happiness: 8, intelligence: 5, morality: 5 }, nextAge: 68, flags: ['memoir'] } },
      { text: '组织老同学聚会。有些人五十多年没见了', effects: '👥+10 😊+8', outcomes: { attr: { social: 10, happiness: 8 }, nextAge: 68 } },
      { text: '学着用微信拍短视频，笨拙地拍些花草发出去', effects: '🧠+5 👥+3 😊+3', outcomes: { attr: { intelligence: 5, social: 3, happiness: 3 }, nextAge: 68 } },
    ],
  },
  // 分支：身体不好
  {
    id: 'ailing_elder', stage: 'elder', age: 65,
    text: '六十五岁。身体的零件一个接一个地出问题——膝盖疼、血压高、血糖也控制不住了。\n\n药盒占了床头柜的一半，医院的走廊比家里的客厅还熟悉。\n\n年轻时透支的那些夜晚，现在连本带利地找回来了。',
    conditions: { maxAttrs: { health: 35 } },
    choices: [
      { text: '虽然身体不好，但心态还行。每天坚持散步半小时', effects: '💪+3 😊+5 ⚖️+3', outcomes: { attr: { health: 3, happiness: 5, morality: 3 }, nextAge: 68 } },
      { text: '后悔了。当初要是对自己好一点就好了', effects: '😊-5 ⚖️+3', outcomes: { attr: { happiness: -5, morality: 3 }, nextAge: 68, flags: ['regret_health'] } },
    ],
  },
  // 分支：富豪路线 vs 普通路线 vs 温馨路线
  {
    id: 'twilight_legacy_rich', stage: 'elder', age: 70,
    text: '七十岁了。你坐在自己公司/大房子的露台上，看着夕阳。\n\n这辈子赚了不少钱。但你也明白了——钱能买来房子，买不来家；能买来钟表，买不来时间。\n\n一个年轻人来采访你，问"成功的秘诀是什么"。你沉默了很久……',
    conditions: { minAttrs: { wealth: 55, health: 30 } },
    choices: [
      { text: '「钱很重要，但它只是工具。真正富足的是内心。」', effects: '最终章', outcomes: { attr: { morality: 10, happiness: 5 }, final: true } },
      { text: '「运气。我赶上了好时代。能帮到别人的时候尽量帮。」', effects: '最终章', outcomes: { attr: { morality: 8, luck: 5 }, final: true } },
    ],
  },
  {
    id: 'twilight_legacy_poor', stage: 'elder', age: 70,
    text: '七十岁了。钱一直不宽裕，但你有一群惦记着你的老朋友和时不时来看你的晚辈。\n\n坐在老旧的沙发上，旁边的收音机放着咿咿呀呀的戏曲。窗外银杏叶金灿灿落了一地。\n\n你想起这辈子——苦过、累过、笑过、哭过。如果要留一句话给这个世界……',
    conditions: { maxAttrs: { wealth: 40 } },
    choices: [
      { text: '「钱少的时候，爱就要多。这辈子值了。」', effects: '最终章', outcomes: { attr: { happiness: 10, morality: 8 }, final: true } },
      { text: '「如果重来一次……可能还是老样子吧。」', effects: '最终章', outcomes: { attr: { happiness: -2, luck: 8 }, final: true } },
    ],
  },
  {
    id: 'twilight_legacy_normal', stage: 'elder', age: 70,
    text: '黄昏时分，你坐在公园的长椅上。旁边放着刚买的面包——老伴嘱咐你出来买的。\n\n银杏叶落了一地。一个小孩跑过来捡叶子，他的奶奶在后面追。你看着他们笑了。小孩跑远了，公园又安静下来。\n\n一生走到这里。把最重要的领悟浓缩成一句话——',
    conditions: { notFlags: [] },
    choices: [
      { text: '「爱是最值得的事。勇敢去爱，别怕受伤。」', effects: '最终章', outcomes: { attr: { happiness: 10, morality: 5 }, final: true } },
      { text: '「做自己。人生不长，不要活在别人的期待里。」', effects: '最终章', outcomes: { attr: { happiness: 8, intelligence: 5, morality: 3 }, final: true } },
      { text: '「钱和健康，健康更重要。可惜年轻时不明白。」', effects: '最终章', outcomes: { attr: { wealth: 3, health: 8, morality: 5 }, final: true } },
      { text: '「如果能重来一次……」', effects: '最终章', outcomes: { attr: { happiness: -2, luck: 8 }, final: true } },
    ],
  },
  // ==================== 补充：童年更多分支 ====================
  {
    id: 'sibling_arrival', stage: 'childhood', age: 4,
    text: '四岁那年，妈妈肚子里多了一个小生命。\n\n你不太明白"弟弟妹妹"是什么意思。但你注意到妈妈的肚子越来越大，家里的婴儿用品越来越多，爸爸的笑容也越来越灿烂。\n\n有一天，他们带你去医院看一个小小的人。那个皱巴巴的、被包在襁褓里的小家伙——是和你共享同一个血脉的人。',
    choices: [
      { text: '轻轻地摸了摸TA的小手，觉得好神奇', effects: '😊+5 ⚖️+5 👥+5', outcomes: { attr: { happiness: 5, morality: 5, social: 5 }, nextAge: 5, flags: ['loving_sibling'] } },
      { text: '有点吃醋——为什么大家都在看TA不看我了', effects: '😊-3 ⚖️-3 👥-3', outcomes: { attr: { happiness: -3, morality: -3, social: -3 }, nextAge: 5 } },
      { text: '好奇地观察一切，问了好多"为什么"', effects: '🧠+5 😊+3', outcomes: { attr: { intelligence: 5, happiness: 3 }, nextAge: 5 } },
    ],
  },
  {
    id: 'tv_addiction', stage: 'childhood', age: 7,
    text: '七岁。你迷上了电视里的动画片。每天放学回家第一件事就是开电视，作业要妈妈催三遍才开始写。\n\n周末更是从早看到晚。妈妈叹了口气——"这样下去眼睛要坏掉了。"',
    choices: [
      { text: '听话地减少了看电视的时间，和妈妈约定每天只看一小时', effects: '⚖️+5 🧠+3 💪+2', outcomes: { attr: { morality: 5, intelligence: 3, health: 2 }, nextAge: 8 } },
      { text: '假装听话但趁妈妈不注意又偷偷打开', effects: '⚖️-5 😊+3', outcomes: { attr: { morality: -5, happiness: 3 }, nextAge: 8 } },
      { text: '"那我去外面踢球好了！"——自己找到了替代方案', effects: '💪+6 👥+5 😊+3', outcomes: { attr: { health: 6, social: 5, happiness: 3 }, nextAge: 8, flags: ['outdoor_kid'] } },
    ],
  },
  {
    id: 'parent_quarrel', stage: 'childhood', age: 9,
    text: '晚上被一阵争吵声吵醒了。爸妈以为你睡着了，在客厅压低声音吵着。\n\n你听不太懂他们在吵什么——好像是关于钱，关于工作，关于外婆的病。\n\n你缩在被子里，紧紧抱着枕头。这是你第一次隐约感觉到：大人们的世界，也不是那么牢不可破。',
    choices: [
      { text: '第二天早起给妈妈倒了杯水，帮爸爸整理了拖鞋', effects: '😊+5 ⚖️+5 👥+3', outcomes: { attr: { happiness: 5, morality: 5, social: 3 }, nextAge: 10, flags: ['empathetic'] } },
      { text: '假装什么都没发生。但变得更加安静和敏感了', effects: '🧠+5 😊-5 👥-2', outcomes: { attr: { intelligence: 5, happiness: -5, social: -2 }, nextAge: 10 } },
      { text: '去问外婆发生了什么。外婆摸着你的头说"没事"', effects: '👥+5 😊+2', outcomes: { attr: { social: 5, happiness: 2 }, nextAge: 10 } },
    ],
  },
  {
    id: 'reading_discovery', stage: 'childhood', age: 11,
    text: '十一岁那年，你在学校图书馆角落里翻到了一本旧书。\n\n封皮已经磨破了，书页泛着黄，散发着一股旧纸张特有的味道。你随手翻开第一页，然后——就像掉进了一个全新的世界。\n\n那天你忘记了时间，直到图书馆的老师来催你回家。你合上书的时候，第一次觉得世界比想象中大得多。',
    conditions: { hasFlags: ['quiet_kid'] },
    choices: [
      { text: '从此成了图书馆常客。每周借两本，什么都读', effects: '🧠+12 😊+5 👥-2', outcomes: { attr: { intelligence: 12, happiness: 5, social: -2 }, nextAge: 12, flags: ['bookworm'] } },
    ],
  },
  {
    id: 'sports_day', stage: 'childhood', age: 11,
    text: '学校运动会。操场上彩旗飘飘，广播里放着的进行曲震得耳朵嗡嗡响。\n\n你报名了接力跑。站在起跑线上的时候，全班同学都在喊你的名字。你从来没觉得这么紧张过——但也从来没这么兴奋过。',
    conditions: { hasFlags: ['outdoor_kid', 'martial_arts'] },
    choices: [
      { text: '跑出了个人最好成绩，班级拿了第二名', effects: '💪+8 😊+8 👥+5', outcomes: { attr: { health: 8, happiness: 8, social: 5 }, nextAge: 12, flags: ['athletic'] } },
      { text: '接棒的时候掉棒了。但全班还是为你鼓掌', effects: '😊+3 👥+5 ⚖️+3', outcomes: { attr: { happiness: 3, social: 5, morality: 3 }, nextAge: 12 } },
    ],
  },

  // ==================== 补充：少年更多事件 ====================
  {
    id: 'online_game', stage: 'teen', age: 13,
    text: '班上开始流行一款网络游戏。每天中午吃饭的时候，男生们围在一起讨论装备和战术。\n\n你偷偷注册了一个账号。一开始只是想试试，但很快发现每到晚上九点手就不自觉地摸向鼠标。\n\n期中考试成绩单发下来的时候，数学比上学期低了二十分。',
    choices: [
      { text: '意识到不对，主动删了游戏，把账号给了同学', effects: '⚖️+8 🧠+5 😊-3', outcomes: { attr: { morality: 8, intelligence: 5, happiness: -3 }, nextAge: 14, flags: ['self_discipline'] } },
      { text: '"再玩一周就不玩了"——结果一直玩到了期末', effects: '🧠-8 😊+5 👥+3', outcomes: { attr: { intelligence: -8, happiness: 5, social: 3 }, nextAge: 14 } },
      { text: '把游戏当成奖励——写完作业才能玩一局', effects: '🧠+3 😊+3 ⚖️+3', outcomes: { attr: { intelligence: 3, happiness: 3, morality: 3 }, nextAge: 14 } },
    ],
  },
  {
    id: 'class_election', stage: 'teen', age: 17,
    text: '高三，班里选班长。有人提名了你。\n\n你愣了一秒——从来没想过自己会站在讲台上对着全班同学拉票。\n\n下面五十多双眼睛看着你。你深吸了一口气……',
    choices: [
      { text: '走上讲台。虽然紧张，但讲出了自己想为班级做的事', effects: '👥+10 😊+5 🎨+5', outcomes: { attr: { social: 10, happiness: 5, appearance: 5 }, nextAge: 18, flags: ['class_leader'] } },
      { text: '婉拒了。高考在即，不想分心', effects: '🧠+8 😊-3 👥-2', outcomes: { attr: { intelligence: 8, happiness: -3, social: -2 }, nextAge: 18 } },
      { text: '推荐了好朋友参选，自己帮忙做策划', effects: '👥+5 ⚖️+5 🎨+3', outcomes: { attr: { social: 5, morality: 5, appearance: 3 }, nextAge: 18 } },
    ],
  },

  // ==================== 补充：青年更多路线 ====================
  {
    id: 'college_club', stage: 'young_adult', age: 20,
    text: '大学社团招新。食堂门口摆满了摊位，音乐声、吆喝声此起彼伏——街舞社在地板上倒立，辩论社拉着喇叭喊"真理越辩越明"，支教团挂满了山区的照片。\n\n你拿着一叠宣传单站在人群中，有点眼花缭乱。',
    conditions: { hasFlags: ['went_to_college'] },
    choices: [
      { text: '加入了辩论队，大学四年几乎打遍了省内所有高校', effects: '🧠+8 👥+6 🎨+4', outcomes: { attr: { intelligence: 8, social: 6, appearance: 4 }, nextAge: 21, flags: ['debater'] } },
      { text: '加入了志愿者协会，周末去社区和敬老院', effects: '⚖️+10 👥+6 😊+5', outcomes: { attr: { morality: 10, social: 6, happiness: 5 }, nextAge: 21, flags: ['volunteer_spirit'] } },
      { text: '加入了创业社，开始捣鼓一些小项目', effects: '🧠+5 💰+3 🍀+5', outcomes: { attr: { intelligence: 5, wealth: 3, luck: 5 }, nextAge: 21, flags: ['entrepreneurial'] } },
    ],
  },
  {
    id: 'internship_struggle', stage: 'young_adult', age: 22,
    text: '大三暑假去实习了。公司不大，但每个人都很忙。你被安排在一张靠墙的小桌子前，做的工作是整理Excel表格和复印文件。\n\n有一天你在洗手间听到有人抱怨"那个实习生什么都不会"。你站在隔间里，好久没动。',
    conditions: { hasFlags: ['went_to_college'] },
    choices: [
      { text: '从那天起每天最早到最晚走，主动向每个前辈请教', effects: '🧠+8 💰+5 😊-3', outcomes: { attr: { intelligence: 8, wealth: 5, happiness: -3 }, nextAge: 23, flags: ['resilient'] } },
      { text: '没有太放在心上。实习经历而已，学到多少算多少', effects: '😊+3 🧠+3', outcomes: { attr: { happiness: 3, intelligence: 3 }, nextAge: 23 } },
      { text: '深受打击，开始怀疑自己适不适合这个行业', effects: '😊-8 🧠+3 🍀-3', outcomes: { attr: { happiness: -8, intelligence: 3, luck: -3 }, nextAge: 23 } },
    ],
  },
  {
    id: 'graduate_school', stage: 'young_adult', age: 24,
    text: '周围不少同学在准备考研。图书馆里早上六点就有人排队占座，保温杯里装着黑咖啡，桌上堆着小山一样的参考资料。\n\n你也站在了人生又一个分叉口——继续深造还是彻底踏入社会？',
    conditions: { hasFlags: ['academic_path', 'went_to_college'] },
    choices: [
      { text: '全力以赴考研。又一次把自己扔进了题海', effects: '🧠+15 💪-5 😊-6', outcomes: { attr: { intelligence: 15, health: -5, happiness: -6 }, nextAge: 26, flags: ['grad_school'] } },
      { text: '决定不考了。已经读了十几年书，该去实战了', effects: '💰+8 😊+5 🧠-3', outcomes: { attr: { wealth: 8, happiness: 5, intelligence: -3 }, nextAge: 26 } },
    ],
  },
  {
    id: 'side_hustle', stage: 'young_adult', age: 25,
    text: '工资不太够花。房租、吃饭、交通、偶尔和朋友下馆子——月底一看账户余额，总觉得哪里不对。\n\n你开始想能不能搞点副业。朋友做微商、有人接私单、还有人在B站做UP主。',
    choices: [
      { text: '利用专业技能接私活。虽然累但收入上来了', effects: '💰+10 🧠+5 💪-3 😊+2', outcomes: { attr: { wealth: 10, intelligence: 5, health: -3, happiness: 2 }, nextAge: 26, flags: ['side_hustle'] } },
      { text: '尝试做了短视频，意外地有了几千粉丝', effects: '🎨+5 👥+5 🍀+5', outcomes: { attr: { appearance: 5, social: 5, luck: 5 }, nextAge: 26, flags: ['content_creator'] } },
      { text: '算了太累了。身体和钱包只能牺牲一个', effects: '😊+3 💪+3 💰-2', outcomes: { attr: { happiness: 3, health: 3, wealth: -2 }, nextAge: 26 } },
    ],
  },
  {
    id: 'friendship_test', stage: 'young_adult', age: 27,
    text: '好朋友找你借钱。数目不小——说是投资了一个项目，周转不开。\n\n你知道TA不是坏人，但这个项目听起来不太靠谱。而且这笔钱是你攒了一年多的积蓄。\n\n微信对话框里，TA发了一句"你是我最好的朋友"。你盯着这句话看了很久。',
    choices: [
      { text: '借钱了。但让TA写了借条，约定了还款时间', effects: '⚖️+5 👥+8 💰-8', outcomes: { attr: { morality: 5, social: 8, wealth: -8 }, nextAge: 28, flags: ['loyal_friend'] } },
      { text: '婉拒了。"我不能借钱给你，但我可以帮你看看还有什么别的办法"', effects: '🧠+5 ⚖️+3 👥-3', outcomes: { attr: { intelligence: 5, morality: 3, social: -3 }, nextAge: 28 } },
      { text: '直接借了。没有借条，因为"朋友之间不用这些"', effects: '⚖️+8 👥+5 💰-10 🍀-5', outcomes: { attr: { morality: 8, social: 5, wealth: -10, luck: -5 }, nextAge: 28, flags: ['too_trusting'] } },
    ],
  },

  // ==================== 补充：中年更多路线 ====================
  {
    id: 'promotion_race', stage: 'adult', age: 32,
    text: '部门经理的位置空出来了。你和另一个同事都在候选名单上。\n\n你们关系原本不错——一起吃午饭、一起吐槽加班。但自从名单出来以后，茶水间碰面时的微笑都变得有点僵硬了。\n\n总监找你们分别谈话。出来后，你在走廊碰见TA——',
    choices: [
      { text: '公平竞争。在PPT里展示了最漂亮的业绩数据和下季度规划', effects: '🧠+8 💰+5 👥-3', outcomes: { attr: { intelligence: 8, wealth: 5, social: -3 }, nextAge: 34, flags: ['promoted'] } },
      { text: '主动和TA沟通——"不管谁上，我们都要继续好好合作"', effects: '⚖️+8 👥+5 😊+3', outcomes: { attr: { morality: 8, social: 5, happiness: 3 }, nextAge: 34 } },
      { text: '私下打听了总监的偏好，针对性地包装了自己', effects: '💰+8 🧠+3 ⚖️-5', outcomes: { attr: { wealth: 8, intelligence: 3, morality: -5 }, nextAge: 34, flags: ['promoted'] } },
    ],
  },
  {
    id: 'marriage_crisis', stage: 'adult', age: 35,
    text: '七年了。热恋时的激情像退潮一样慢慢褪去，露出日常生活的礁石。\n\n你们开始为一些小事吵架——谁洗碗、谁接孩子、谁忘了关客厅的灯。有时候吵到一半，你忽然不记得为什么开始吵的。\n\n昨天晚上，TA背对着你睡。你看着TA的后脑勺，心里一阵凉。',
    conditions: { hasFlags: ['married'] },
    choices: [
      { text: '约TA去第一次约会的那家餐厅。点上当年的菜，聊了很多', effects: '😊+10 👥+5 ⚖️+5', outcomes: { attr: { happiness: 10, social: 5, morality: 5 }, nextAge: 37, flags: ['marriage_renewed'] } },
      { text: '觉得太累了。各退一步，分居一段时间冷静', effects: '😊-8 👥-8 🧠+5', outcomes: { attr: { happiness: -8, social: -8, intelligence: 5 }, nextAge: 37 } },
      { text: '把心里的话全都倒出来。吵了一整夜，但第二天早上TA给你倒了杯水', effects: '😊+3 ⚖️+5 👥+3', outcomes: { attr: { happiness: 3, morality: 5, social: 3 }, nextAge: 37 } },
    ],
  },
  {
    id: 'charity_work', stage: 'adult', age: 38,
    text: '朋友拉你周末去给山区孩子送冬衣。你本来想睡懒觉，但架不住TA的软磨硬泡。\n\n开车三个小时到了山里。一个扎马尾的小女孩拉着你的衣角叫你"叔叔/阿姨"，她的小手凉凉的，但眼睛亮亮的。\n\n回城的路上你一句话没说。周一到公司，打开电脑，总觉得屏幕上的PPT有什么地方不对。',
    choices: [
      { text: '从此定期参与公益活动。资助了那个小女孩上学', effects: '⚖️+15 😊+10 💰-5', outcomes: { attr: { morality: 15, happiness: 10, wealth: -5 }, nextAge: 40, flags: ['philanthropist'] } },
      { text: '捐了一笔钱。虽然人没再去，但心里有个温暖的角落', effects: '⚖️+8 😊+3 💰-3', outcomes: { attr: { morality: 8, happiness: 3, wealth: -3 }, nextAge: 40 } },
    ],
  },
  {
    id: 'burnout', stage: 'adult', age: 42,
    text: '持续的加班、反复的会议、永远改不完的方案。某天早上闹钟响的时候你按掉了它，然后盯着天花板看了二十分钟。\n\n身体没有问题。但没有动力做任何事——连最喜欢的菜吃到嘴里都像嚼蜡。\n\n你第一次认真地问自己：我是不是，有点坚持不下去了？',
    choices: [
      { text: '去看心理医生了。每周三下午，聊了半年', effects: '💪+8 😊+8 💰-5', outcomes: { attr: { health: 8, happiness: 8, wealth: -5 }, nextAge: 44, flags: ['therapy_helped'] } },
      { text: '请了长假去海边住了两周。每天看日出日落，什么都不想', effects: '😊+10 💰-5 🍀+5', outcomes: { attr: { happiness: 10, wealth: -5, luck: 5 }, nextAge: 44 } },
      { text: '硬扛着。跟谁都没说，自己默默扛了下来', effects: '💪-8 😊-10 🧠+5', outcomes: { attr: { health: -8, happiness: -10, intelligence: 5 }, nextAge: 44 } },
    ],
  },
  {
    id: 'high_school_reunion', stage: 'adult', age: 46,
    text: '高中同学二十年聚会。\n\n饭桌上，当年的班长现在在做房产中介、学霸在大厂被裁了正在家里带娃、当初最不爱说话的那个坐在角落里——他现在是一家上市公司的CFO。\n\n有人发福了，有人看着比实际年龄老了十岁，有人还穿着二十年前同款风格的衣服。\n\n酒过三巡，有人提议每个人都讲一件"这些年最难忘的事"。轮到你了——',
    choices: [
      { text: '讲了那个曾经帮过的孩子现在考上大学回来看你的事', effects: '😊+8 ⚖️+5 👥+5', outcomes: { attr: { happiness: 8, morality: 5, social: 5 }, nextAge: 48 } },
      { text: '坦承这些年不容易，但好在都过来了', effects: '👥+8 😊+3 ⚖️+3', outcomes: { attr: { social: 8, happiness: 3, morality: 3 }, nextAge: 48 } },
      { text: '心里有点不是滋味。总觉得别人都过得比自己好', effects: '😊-5 💰-3 🍀+3', outcomes: { attr: { happiness: -5, wealth: -3, luck: 3 }, nextAge: 48 } },
    ],
  },

  // ==================== 补充：中老年更多路线 ====================
  {
    id: 'silver_divorce', stage: 'middle_age', age: 53,
    text: '孩子大学毕业后，你们之间的对话越来越少。\n\n有一天晚饭后，TA放下筷子，平静地说了一句："我们离婚吧。"\n\n空气凝住了。你看着桌上那盘还没怎么动的番茄炒蛋，脑子里一片空白。\n\n但奇怪的是——你的第一反应不是愤怒，而是一种说不清的、如释重负的感觉。',
    conditions: { hasFlags: ['married'], notFlags: ['marriage_renewed'] },
    choices: [
      { text: '同意了。办理手续的那天，两人反而比平时聊得多', effects: '😊+3 ⚖️+5 💰-10', outcomes: { attr: { happiness: 3, morality: 5, wealth: -10 }, nextAge: 55, flags: ['divorced'] } },
      { text: '请求再试一试。一起去做了婚姻咨询', effects: '⚖️+8 😊+5 👥+3', outcomes: { attr: { morality: 8, happiness: 5, social: 3 }, nextAge: 55, flags: ['marriage_renewed'] } },
      { text: '愤怒地大吵了一架，然后搬去了客房', effects: '😊-12 💪-5 ⚖️-3', outcomes: { attr: { happiness: -12, health: -5, morality: -3 }, nextAge: 55 } },
    ],
  },
  {
    id: 'digital_age', stage: 'middle_age', age: 56,
    text: '时代变得太快了。AI、区块链、元宇宙、ChatGPT——每个新词出现的时候你都要去百度一下。\n\n同事们在群里聊得热火朝天，你插不上话。\n\n你想起了爸妈当年不会用智能手机的时候，你教了他们很多遍。现在，好像轮到你了。',
    choices: [
      { text: '不服老。报了个在线课程，从Python基础开始学', effects: '🧠+10 😊+3 💰-3', outcomes: { attr: { intelligence: 10, happiness: 3, wealth: -3 }, nextAge: 58, flags: ['tech_savvy'] } },
      { text: '"这些东西让年轻人去搞吧。"继续用自己的老方法做事', effects: '😊+3 🧠-5', outcomes: { attr: { happiness: 3, intelligence: -5 }, nextAge: 58 } },
      { text: '让公司里的年轻人教你。他们很热心，你也学到了不少', effects: '🧠+5 👥+5 😊+5', outcomes: { attr: { intelligence: 5, social: 5, happiness: 5 }, nextAge: 58 } },
    ],
  },
  {
    id: 'old_friend_loss', stage: 'middle_age', age: 62,
    text: '老张走了。\n\n昨天他还在群里发了一条搞笑的视频，今天他女儿打来电话说——心梗，没抢救过来。\n\n去参加追悼会的时候，你看到好多老面孔。大家都瘦了、老了、头发少了。互相拍肩膀的时候，力气象是比年轻时轻了很多。\n\n回来的路上你没说话。老伴问你"怎么了"，你说"没事"。但晚上你失眠了。',
    choices: [
      { text: '第二天给所有久未联系的老朋友都打了一遍电话', effects: '👥+10 😊+5 ⚖️+5', outcomes: { attr: { social: 10, happiness: 5, morality: 5 }, nextAge: 64, flags: ['reconnected'] } },
      { text: '开始更加珍惜每一天。早晨的咖啡、傍晚的散步都认真对待', effects: '😊+8 ⚖️+5 💪+2', outcomes: { attr: { happiness: 8, morality: 5, health: 2 }, nextAge: 64 } },
      { text: '陷入了很深的伤感。觉得人活一辈子到头来什么都留不下', effects: '😊-10 💪-3 🧠+3', outcomes: { attr: { happiness: -10, health: -3, intelligence: 3 }, nextAge: 64 } },
    ],
  },

  // ==================== 补充：晚年更多结局 ====================
  {
    id: 'grandchild_wisdom', stage: 'elder', age: 68,
    text: '孙子/孙女放暑假了，吵着要来爷爷奶奶家。\n\n小不点趴在你膝盖上，仰着脸问："爷爷/奶奶，你小时候是什么样的呀？"\n\n你愣了一下——从来没人问过你这个问题。\n\n你翻出藏在柜子深处的那本旧相册，一页一页地给TA讲。那些尘封了几十年的故事，说起来的时候，好像就发生在昨天。',
    conditions: { hasFlags: ['grandparent'] },
    choices: [
      { text: '讲了很多——好的坏的、骄傲的遗憾的。TA听得入迷了', effects: '😊+10 👥+8 🧠+3', outcomes: { attr: { happiness: 10, social: 8, intelligence: 3 }, nextAge: 70 } },
      { text: '挑那些快乐的故事讲。不想让TA太早知道人生有多难', effects: '😊+5 ⚖️+3', outcomes: { attr: { happiness: 5, morality: 3 }, nextAge: 70 } },
    ],
  },
  {
    id: 'last_wish', stage: 'elder', age: 75,
    text: '七十五岁生日那天，孩子们都回来了。\n\n家里很久没这么热闹了。小孩子们在客厅追逐打闹、大人们围在厨房里一边做饭一边聊着各自的烦恼、电视里放着不知道什么节目。\n\n你坐在角落的单人沙发里，裹着毯子，看着这一切。\n\n心里想：差不多了。这一生，该经历的都经历了。如果还有一个愿望……',
    conditions: { hasFlags: ['married'] },
    choices: [
      { text: '「希望你们都能好好爱自己。」——你在心里默默许愿', effects: '最终章', outcomes: { attr: { happiness: 12, morality: 8 }, final: true } },
      { text: '「没什么愿望了。这样就很好。」', effects: '最终章', outcomes: { attr: { happiness: 10, morality: 5 }, final: true } },
      { text: '「多希望还能再活一遍……」', effects: '最终章', outcomes: { attr: { happiness: -3, luck: 5 }, final: true } },
    ],
  },
  {
    id: 'solitary_sunset', stage: 'elder', age: 75,
    text: '七十五岁。一个人的公寓里很安静——只有墙上时钟的滴答声。\n\n窗外的世界依然喧嚣，年轻人的笑声从楼下传来。你坐在窗边，膝盖上搭着一条旧毛毯。\n\n这辈子一个人走了大半程。不是没有遇到过机会，只是在每一个路口，你都选择了另一条路。\n\n后悔吗？你想了想……',
    conditions: { notFlags: ['married'] },
    choices: [
      { text: '「不后悔。自由是一生最好的伴侣。」', effects: '最终章', outcomes: { attr: { happiness: 8, intelligence: 5 }, final: true } },
      { text: '「有时候也会想——如果当初……」', effects: '最终章', outcomes: { attr: { happiness: -3, luck: 8 }, final: true } },
    ],
  },
  {
    id: 'successful_legacy', stage: 'elder', age: 72,
    text: '你的公司/事业成了很多人谈论的话题。有媒体来采访，有大学请你去讲座。\n\n但你最在意的不是这个。\n\n你资助的那些孩子里，有人成了医生、有人做了老师、有人开了自己的工作室。他们的照片被你在墙上贴了一排。\n\n这些，才是你心里真正的"成功"。',
    conditions: { minAttrs: { wealth: 60, morality: 50 } },
    choices: [
      { text: '「我这辈子最骄傲的不是赚了多少钱，而是帮了多少人。」', effects: '最终章', outcomes: { attr: { morality: 10, happiness: 8 }, final: true } },
      { text: '「钱是手段，不是目的。可惜很多人一辈子都没搞明白。」', effects: '最终章', outcomes: { attr: { morality: 5, intelligence: 5 }, final: true } },
    ],
  },
  {
    id: 'struggling_end', stage: 'elder', age: 72,
    text: '钱不多、身体也不好、儿女们各有各的难处。\n\n这些年在医院和家里之间来回跑，药盒占了床头柜的一半。\n\n但今天天气不错。隔壁老李头拎着象棋过来敲你的门——"来一局？"\n\n你慢慢坐起来。外面的阳光透过窗户照在棋盘上。活着，好像也不是那么坏。',
    conditions: { maxAttrs: { wealth: 30, health: 30 } },
    choices: [
      { text: '「日子苦是苦了点，但能走到今天也是一种本事。」', effects: '最终章', outcomes: { attr: { happiness: 5, morality: 5 }, final: true } },
      { text: '「下辈子，可能该对自己好一点。」', effects: '最终章', outcomes: { attr: { happiness: -3, luck: 5 }, final: true } },
    ],
  },
];

export default EVENTS;
