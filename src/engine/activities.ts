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
  /** flag 排除（任一存在则不可用；相亲要求未婚、投简历要求无职业） */
  requiresNot?: string[];
  /** 人物要求（任一人物已出场即可用；出场 = 该人物在历史中互动过、好感 ≠ 50，见 personas.personaBonds） */
  requiresPersona?: string[];
  /** 活动级 flag 产出（每次执行追加、去重；与结果变体 flags 同机制，如犯罪被抓产出 jailed） */
  flags?: string[];
  /** 结果池（常规活动 3-4 个变体随机抽取；犯罪为 3 类：成功变体 + 被抓 + 逃跑） */
  results: ActivityResult[];
}

/** 犯罪活动 id（reducer 分支判定用） */
export const CRIME_ACTIVITY_ID = 'crime';

/** 犯罪活动：结果池前部的成功变体数量（其余为被抓/逃跑，位置约定） */
const CRIME_SUCCESS_VARIANTS = 3;

/** 职业 flag 清单（与 src/engine/jobs.ts JOB_FLAG_MAP 同步；退休不算在职，由 requiresNot 排除） */
const JOB_FLAGS = ['doctor', 'startup_success', 'civil_servant', 'tech_career', 'grad_school', 'research_path', 'artist_pro', 'artist_life', 'athlete_pro', 'sports_career', 'military_flag', 'skilled_worker'];

/** 主动行为活动表（27 个：健身/学习/打工/社交/体检/休闲/遛宠/犯罪/投资/相亲/约会夜/育儿/问候家人/投简历/练手艺/冥想/加班/请假/申请升职/就医检查/塑形/美容/找老朋友/拜访贵人/联系初恋/发动态/送礼物） */
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
  {
    id: 'invest',
    name: '投资理财',
    icon: '📈',
    desc: '让钱生钱，也得愿赌服输',
    minAge: 18,
    results: [
      {
        text: '你把发下来的奖金分成十二份，存了三年定期。柜员说利率又降了，你数了数到期的日子，想着正好给家里换台新冰箱。',
        attr: { wealth: 4 },
      },
      {
        text: '定投的基金又翻红了。你看着那条慢慢爬起来的净值曲线，把手机揣回兜里——耐心这东西，市场会付你利息。',
        attr: { wealth: 7 },
      },
      {
        text: '定投的基金绿了三天。你掐着 APP 反复看，最后还是没动——账面上的数字会骗人，你信的是慢慢变富。',
        attr: { wealth: -2 },
      },
      {
        text: '你把闲钱全押进了一只妖股。连着三个涨停，账户余额蹦着往上跳，你关掉行情软件，手心全是汗。',
        attr: { wealth: 13, luck: 2 },
      },
      {
        text: '那只股票连着跌停，你终于割肉离场。账户回到原点，你对着 K 线图发了会儿呆，然后卸载了行情软件。',
        attr: { wealth: -8, luck: -2 },
      },
      {
        text: '你报了个理财课，老师讲得实在：不懂的不碰，别把鸡蛋放一个篮子。你认真做了两页笔记。',
        attr: { intelligence: 2 },
      },
    ],
  },
  {
    id: 'blind_date',
    name: '相亲',
    icon: '💑',
    desc: '缘分说不定就藏在介绍人那儿',
    minAge: 18,
    requiresNot: ['married'],
    results: [
      {
        text: '阿姨牵的线，你硬着头皮去了。没想到对方也是个话匣子，一顿饭聊了俩小时，散场时你俩交换了微信。',
        attr: { social: 6 },
      },
      {
        text: '对方全程低头刷手机，你找话题找得口干舌燥。结账时你们礼貌道别，谁也没再提下次。',
        attr: { social: 2, happiness: -2 },
      },
      {
        text: '对方条件不错，工作稳定人也礼貌。可你心里清楚，聊不到一起去的感觉，和条件好坏无关。',
        attr: { social: 3 },
      },
      {
        text: '约好的咖啡店，对方临时说不来了。你一个人喝完了那杯美式，走的时候反而轻松了些。',
        attr: { social: 2 },
      },
    ],
  },
  {
    id: 'date_night',
    name: '约会夜',
    icon: '🌹',
    desc: '婚后也要记得恋爱时的样子',
    minAge: 18,
    requires: ['married'],
    results: [
      {
        text: '你订了老地方那家西餐厅。蜡烛、红酒、你俩都爱的那道牛排——她说比结婚纪念日那顿还用心。',
        attr: { happiness: 7, social: 2 },
      },
      {
        text: '没有安排什么，你们沿着河边散步。她讲起当年刚认识时的糗事，你笑着听着，路灯把影子拉得很长。',
        attr: { happiness: 6 },
      },
      {
        text: '爆米花买了一大桶，电影却没什么人看。你们在最后一排笑成一团，散场时她挽着你的胳膊说下次还来。',
        attr: { happiness: 5 },
      },
      {
        text: '今晚没出去，你们在家做饭。她掌勺你打下手，厨房里油烟和笑声搅在一起，比什么都香。',
        attr: { happiness: 4 },
      },
    ],
  },
  {
    id: 'parenting',
    name: '育儿陪伴',
    icon: '🧑‍🍼',
    desc: '陪伴是给孩子最好的礼物',
    minAge: 20,
    requires: ['has_child'],
    results: [
      {
        text: '孩子咬着笔杆发呆，你搬了把椅子坐下，把题目拆成一小步一小步讲。他眼睛亮起来的那一刻，你觉得值了。',
        attr: { happiness: 5, social: 2 },
      },
      {
        text: '睡前故事讲到第三遍，孩子还是不肯睡。你把声音放轻，讲着讲着，他攥着你的手指睡着了。',
        attr: { happiness: 4, social: 1 },
      },
      {
        text: '积木搭到一半塌了，孩子咯咯直笑。你俩干脆盘腿坐下，从头再来——塌了再搭，比他写作业耐心多了。',
        attr: { happiness: 5 },
      },
      {
        text: '辅导作业到第八题，你的耐心余额告急。深呼吸三次，你告诉自己：亲生的、亲生的。',
        attr: { happiness: 2 },
      },
    ],
  },
  {
    id: 'family_call',
    name: '问候家人',
    icon: '📞',
    desc: '常回家看看，电话也行',
    minAge: 10,
    results: [
      {
        text: '给爸妈打了个电话，他们问吃了吗、冷不冷、钱够不够花。你听着听着就笑了，跟电话那头唠了半个多小时。',
        attr: { happiness: 4, social: 2 },
      },
      {
        text: '给兄弟姐妹发了条消息，问他最近怎么样。那边秒回一串语音，你听完发现嘴角一直翘着。',
        attr: { happiness: 3, social: 2 },
      },
      {
        text: '周末回了趟家，妈做了你最爱吃的菜。桌上的筷子多添了一双，爸爸说：常回来。',
        attr: { happiness: 6 },
      },
      {
        text: '视频通话里，爸妈的气色看着还行。妈说别老惦记家里，你把镜头转向窗外：看，我这儿下雪了。',
        attr: { happiness: 4 },
      },
    ],
  },
  {
    id: 'job_hunt',
    name: '投简历',
    icon: '💼',
    desc: '广撒网，等一个有缘的 Offer',
    minAge: 16,
    // 职业 flag 清单与 JOB_FLAG_MAP 同步（有职业或退休不再求职）
    requiresNot: ['doctor', 'startup_success', 'civil_servant', 'tech_career', 'grad_school', 'research_path', 'artist_pro', 'artist_life', 'athlete_pro', 'sports_career', 'military_flag', 'skilled_worker', 'retired'],
    results: [
      {
        text: '简历投出去几十份，终于等来一个面试电话。你连夜把项目经历背得滚瓜烂熟，面试官点头的时候，你感觉离那扇门又近了一步。',
        attr: { intelligence: 4 },
      },
      {
        text: '第七封拒信安静地躺在邮箱里。你关掉页面，下楼买了杯热奶茶，告诉自己：这才哪到哪。',
        attr: { happiness: 2 },
      },
      {
        text: '朋友内推的岗位递进了面试。沾了熟人的光，你也不敢掉链子，把状态调到最好，聊得挺投缘。',
        attr: { social: 5 },
      },
      {
        text: 'HR 在电话里跟你聊了薪资范围。你按捺住心跳，翻出收藏夹里的谈薪攻略——这一晚睡得特别踏实。',
        attr: { wealth: 6 },
      },
    ],
  },
  {
    id: 'skill_practice',
    name: '练手艺',
    icon: '🎨',
    desc: '兴趣这口井，越挖越甜',
    minAge: 10,
    // 兴趣 flag（任一即可；音乐/绘画/科技三线，结果池混合变体）
    requires: ['music_path', 'music_piano', 'art_skill', 'artist_life', 'tech_path', 'coding_early'],
    results: [
      {
        text: '琴键按下去的时候，邻居家的猫都会安静下来。练了半小时，指缝间的和弦终于不那么生涩了。',
        attr: { appearance: 4 },
      },
      {
        text: '写生的颜料挤了一盘。夕阳把影子拉长，你把最后一笔落下去，画里的老街比照片还像。',
        attr: { appearance: 5 },
      },
      {
        text: '敲代码敲到晚饭凉了。调完最后一个 bug，程序跑通了——那种感觉，比喝汽水还痛快。',
        attr: { intelligence: 5 },
      },
    ],
  },
  {
    id: 'meditate',
    name: '冥想静心',
    icon: '🧘',
    desc: '给脑子按个暂停键',
    minAge: 8,
    results: [
      {
        text: '早上起来先冥想十分钟。闹钟不响，窗外只有鸟叫，脑子里那团乱麻慢慢松开了。',
        attr: { happiness: 5 },
      },
      {
        text: '睡前做正念呼吸，数着数着呼吸就匀了。这一觉，睡得比以往都沉。',
        attr: { happiness: 4 },
      },
      {
        text: '睡前写下三件感恩的事：热汤、老友的消息、今天没下雨。写着写着，心里就软下来了。',
        attr: { happiness: 4 },
      },
      {
        text: '湖边有张空长椅，你坐下来什么也不做。风从水面吹过来，时间好像也慢了一拍。',
        attr: { happiness: 5 },
      },
    ],
  },
  {
    id: 'overtime',
    name: '加班',
    icon: '💼',
    desc: '多干一点，工资单厚一点',
    minAge: 18,
    // 在职（任一职业 flag）；退休不算在职
    requires: JOB_FLAGS,
    requiresNot: ['retired'],
    results: [
      {
        text: '项目上线前夜，办公室只剩你一个人。敲完最后一个提交，窗外天都亮了——项目顺利上线，绩效单上多了厚厚一笔。',
        attr: { wealth: 9, health: -3 },
      },
      {
        text: '周六的办公室空荡荡的。你把积压的报表一口气处理完，工资条上那串数字又往上跳了一格。',
        attr: { wealth: 7, health: -2 },
      },
      {
        text: '领导路过看到你在加班，拍了拍你肩膀：年轻人不错。月底绩效公布，你的名字排在前头。',
        attr: { wealth: 6, health: -2 },
      },
      {
        text: '连续加了三天班，眼皮快黏在一起了。你灌了第三杯咖啡，把最后一份材料交了上去——钱是赚到了，黑眼圈也是真的。',
        attr: { wealth: 8, health: -3 },
      },
    ],
  },
  {
    id: 'leave',
    name: '请假',
    icon: '🏖️',
    desc: '歇口气，回来更能干',
    minAge: 18,
    // 在职（任一职业 flag）；退休不用请假
    requires: JOB_FLAGS,
    requiresNot: ['retired'],
    results: [
      {
        text: '年假批下来的那天，你关了闹钟睡到自然醒。瘫在沙发上刷了一天剧，骨头缝里的疲惫都化了。',
        attr: { happiness: 6, wealth: -3 },
      },
      {
        text: '感冒了索性请了病假。被子裹成茧，睡到下午三点，才发消息跟领导说没事——其实是有事，睡得正香呢。',
        attr: { happiness: 4, wealth: -2 },
      },
      {
        text: '请了半天事假去办手续，来回跑了两趟总算办完。走出办事大厅，你给领导发了句谢谢，心里松快多了。',
        attr: { happiness: 5, wealth: -2 },
      },
      {
        text: '请假消息发出去，领导秒回：准了，好好休息。你看着手机愣了两秒——原来请假也可以这么顺利。',
        attr: { happiness: 5, wealth: -3 },
      },
    ],
  },
  {
    id: 'promote',
    name: '申请升职',
    icon: '🏆',
    desc: '该争取的时候，别不好意思',
    minAge: 22,
    // 在职（任一职业 flag）；退休不参与晋升
    requires: JOB_FLAGS,
    requiresNot: ['retired'],
    // 结果池前两档为成功（升职加薪）、后两档为失败（被拒，情绪回落）
    results: [
      {
        text: '述职那天你准备得很足，数据、案例、复盘一气呵成。老板当场点头：这季度的晋升名单，加你一个。',
        attr: { wealth: 10, happiness: 5 },
      },
      {
        text: '领导听了你的申请，说了很多话，核心意思就一句：再沉淀沉淀。你点头微笑，回到工位默默更新了简历。',
        attr: { happiness: -3 },
      },
      {
        text: '竞聘演讲你排在最后一个。讲完，台下的掌声比前面都响。结果公布那天，你的名字赫然在列。',
        attr: { wealth: 10, happiness: 5 },
      },
      {
        text: '人事的回复很客气：这个岗位暂时没有空缺，你的努力我们都看到了。你盯着邮件看了很久，把它放进了收藏夹。',
        attr: { happiness: -3 },
      },
    ],
  },
  {
    id: 'doctor_visit',
    name: '就医检查',
    icon: '🩺',
    desc: '小病拖不得，检查要趁早',
    minAge: 18,
    results: [
      {
        text: '医生开了三盒药，叮嘱你按时吃。缴费单上的数字让你肉疼，但病根除了，心里踏实。',
        attr: { health: 3, wealth: -4 },
      },
      {
        text: 'CT 报告出来前你紧张了一下午。医生说片子没问题，你差点在诊室里笑出声——这一趟花得值。',
        attr: { health: 4, wealth: -5 },
      },
      {
        text: '医生说胃有点老毛病，得养。你把这几个字记在手机备忘录里，决定从今晚起好好吃饭。',
        attr: { health: 2, wealth: -6 },
      },
      {
        text: '挂号、排队、等报告，一上午耗在医院。看完出来你只想感叹：健康这东西，真得趁早攒。',
        attr: { health: 2, wealth: -4 },
      },
    ],
  },
  {
    id: 'shape_up',
    name: '塑形',
    icon: '⚖️',
    desc: '管住嘴，迈开腿',
    minAge: 10,
    results: [
      {
        text: '晚饭换了水煮菜，戒了奶茶两周。镜子里的脸轮廓清晰了些，你对着镜子多看了两眼。',
        attr: { appearance: 4, health: 1 },
      },
      {
        text: '跟着视频练了一个月核心，马甲线的影子终于冒头了。拍照打卡那天，评论区全是夸。',
        attr: { appearance: 5, health: 2 },
      },
      {
        text: '体重秤的数字终于动了。你光脚踩上去看了三遍，确认没看错，嘴角压都压不住。',
        attr: { appearance: 3, health: 1 },
      },
      {
        text: '坚持了半个月的减肥，一顿火锅回到解放前。你看着体重秤叹了口气，又点开了健身视频——明天再来。',
        attr: { appearance: 3, health: 1 },
      },
    ],
  },
  {
    id: 'beauty',
    name: '美容',
    icon: '✨',
    desc: '收拾收拾，心情也跟着亮',
    minAge: 18,
    results: [
      {
        text: '新发型剪完，理发师说年轻了五岁。回家路上你走路都带风，连电梯里的镜子都多照了两下。',
        attr: { appearance: 6, wealth: -6 },
      },
      {
        text: '护肤全套安排上，面膜敷完脸水嫩得能掐出水。同事问你是不是偷偷做了什么，你笑而不语。',
        attr: { appearance: 7, wealth: -8 },
      },
      {
        text: '换了个新造型去聚会，老同学盯着你看了半天：你咋越来越年轻了？你心里美滋滋，这笔钱没白花。',
        attr: { appearance: 7, wealth: -7 },
      },
      {
        text: '医美顾问报了个价，你倒吸一口凉气，最后只掏钱做了个护理套餐。镜子前转了两圈，好像确实精神了点。',
        attr: { appearance: 6, wealth: -9 },
      },
    ],
  },
  {
    id: 'call_friend',
    name: '找老朋友',
    icon: '📞',
    desc: '老朋友，越处越亲',
    minAge: 10,
    // 任一老友出场即可（发小/挚友/损友）
    requiresPersona: ['p_best', 'p_buddy', 'p_sidekick'],
    results: [
      {
        text: '约上老友吃了顿烧烤，聊起当年逃课翻墙的日子，笑得直拍桌子。散场时约好下个月还聚。',
        attr: { social: 6, happiness: 2 },
      },
      {
        text: '一个电话打过去，从下班聊到半夜。挂断时手机发烫，你发现这一晚上笑的声音比一周都多。',
        attr: { social: 5, happiness: 2 },
      },
      {
        text: '老友发来一串表情包，你回敬了一串。斗图斗了半小时，最后俩人笑到握不住手机。',
        attr: { social: 4, happiness: 2 },
      },
      {
        text: '约好的饭局，对方临时有事来不了。你一个人吃了那份双人套餐，拍了张照发过去：下次你请。',
        attr: { social: 4, happiness: 2 },
      },
    ],
  },
  {
    id: 'visit_mentor',
    name: '拜访贵人',
    icon: '🍵',
    desc: '前辈一句话，少走十年弯路',
    minAge: 16,
    requiresPersona: ['p_mentor'],
    results: [
      {
        text: '提着一袋水果登门拜访。老师傅听了你的近况，指点了两句，句句都在点子上。',
        attr: { social: 4, intelligence: 2 },
      },
      {
        text: '一壶茶泡了三泡。聊到夕阳西斜，他说：年轻人别急，路是一步一步走出来的。你把这句话记进了备忘录。',
        attr: { social: 4, intelligence: 2 },
      },
      {
        text: '老师傅一眼看出你的问题：心太急。他给你讲了自己当年的弯路，你听着听着，后背出了一层汗。',
        attr: { social: 4, intelligence: 2 },
      },
      {
        text: '这次拜访来得不巧，老师傅身体不适，只坐着喝了杯茶。你放下礼物告辞，心说改天再来。',
        attr: { social: 4, intelligence: 2 },
      },
    ],
  },
  {
    id: 'reconnect',
    name: '联系初恋',
    icon: '💌',
    desc: '有些名字，总是会再想起',
    minAge: 16,
    requiresPersona: ['p_crush'],
    results: [
      {
        text: '翻出那个许久没动的对话框，你打了删、删了打，最后还是发出去了：最近还好吗？屏幕亮起的那一刻，心跳漏了一拍。',
        attr: { happiness: 5, social: 2 },
      },
      {
        text: '翻到那年的合照，你们笑得没心没肺。你盯着看了很久，给照片存了个备份——青春这东西，看看就好。',
        attr: { happiness: 4, social: 2 },
      },
      {
        text: '她答应了见面。咖啡馆里你们聊了一下午，那些年的遗憾和误会，好像都在笑声里化了。',
        attr: { happiness: 6, social: 2 },
      },
      {
        text: '消息发过去，一整天都是已读不回。你盯着那个「已读」看了很久，最后删掉了对话框——有些故事，就留在那年吧。',
        attr: { happiness: 4, social: 2 },
      },
    ],
  },
  {
    id: 'post_social',
    name: '发动态',
    icon: '📱',
    desc: '随手一记，也许就火了',
    minAge: 14,
    // 结果池第 1 个为爆款变体：产出 viral flag（消费事件见 fragments/eggs2.json，merge 配对校验由本产出者满足）
    results: [
      {
        text: '随手发的那条动态爆了，转发和点赞蹭蹭往上涨。你看着粉丝数一路飙升，手都在抖——这下真成大V了。',
        attr: { happiness: 6, social: 6 },
        flags: ['viral'],
      },
      {
        text: '本想抖个机灵，评论区却翻车了。你一条条看完那些评论，默默把动态设成了私密——网络有风险，发言需谨慎。',
        attr: { happiness: -3, social: -2 },
      },
      {
        text: '一条观点引来两拨人对线，你从旁观到下场，辩到半夜。吵完你关了手机，突然觉得有点空虚。',
        attr: { happiness: -2, social: 3 },
      },
      {
        text: '精心编辑的动态发出去，半小时过去，赞还是那两三个。你退出又点开，最后还是没舍得删。',
        attr: { happiness: -2, social: 1 },
      },
    ],
  },
  {
    id: 'give_gift',
    name: '送礼物',
    icon: '🎁',
    desc: '礼轻情意重，给重要的人挑件礼物',
    minAge: 10,
    // 任一人物出场即可（发小/同桌/初恋/挚友/贵人/损友——好感 ≠ 50 即认识）
    requiresPersona: ['p_buddy', 'p_desk', 'p_crush', 'p_best', 'p_mentor', 'p_sidekick'],
    results: [
      {
        text: '商场里挑了半个下午，你终于把那条围巾买了下来，包装纸缠了三层。拆开的那一刻，对方的眼睛亮了一下：你怎么知道我喜欢这个颜色。你笑着说随便挑的，心里却把下一件礼物记进了备忘录。',
        attr: { social: 6, wealth: -3 },
      },
      {
        text: '你按自己的眼光挑了件礼物，送出去的时候对方笑着收下了，只是笑意没到眼底。晚上你翻着聊天记录想了很久——下回，还是多留意TA真正想要什么吧。',
        attr: { social: 3, wealth: -4 },
      },
      {
        text: '趁对方去洗手间的工夫，你把小盒子悄悄塞进了TA的包里。第二天消息提示音响起：你怎么知道我喜欢这个！你盯着屏幕笑了一下午，也没舍得说破。',
        attr: { social: 5, wealth: -4 },
      },
      {
        text: '礼物挑得用心，对方拆开时笑得眼睛弯弯的。可月底账单发来，你还是对着那串数字吸了口凉气——肉疼归肉疼，这情谊，值。',
        attr: { social: 4, wealth: -5 },
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
  // 平衡审计（2026-08）：原 60+luck×0.5+int×0.3 在 50/50 即顶钳位，属性无边际收益；
  // 调整为 55+luck×0.35+int×0.25——低属性新手风险更大（50/50≈75%），满属性仍可达钳位 90
  return Math.max(0, Math.min(90, 55 + luck * 0.35 + intelligence * 0.25));
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
