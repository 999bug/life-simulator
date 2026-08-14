/** 开局人生路线（「这一生想体验什么」）：自由人生不注入 flag，其余路线注入入口 flag 稳定触发对应事件链 */
export interface LifeRoute {
  key: string;
  icon: string;
  name: string;
  desc: string;
  /** 开局注入的 flag（让该路线的事件链可靠触发） */
  seedFlags: string[];
}

export const LIFE_ROUTES: LifeRoute[] = [
  {
    key: 'doctor',
    icon: '⚕️',
    name: '白衣天使',
    desc: '从医学生到主治医师，救死扶伤的一生',
    seedFlags: ['doctor'],
  },
  {
    key: 'gangster',
    icon: '🔫',
    name: '黑道风云',
    desc: '混迹江湖，看场子、收账、上位当大哥',
    seedFlags: ['gang_member'],
  },
  {
    key: 'underworld',
    icon: '🕶️',
    name: '江湖末路',
    desc: '混江湖 → 东窗事发进监狱 → 越狱亡命，一条路走到黑',
    seedFlags: ['gang_member', 'gray_deep', 'escape_plan'],
  },
  {
    key: 'prison',
    icon: '🔒',
    name: '铁窗人生',
    desc: '灰色生意东窗事发，高墙内度过人生',
    seedFlags: ['gray_deep'],
  },
  {
    key: 'escape',
    icon: '🏃',
    name: '亡命天涯',
    desc: '狱中盘算越狱，成功翻墙或被抓个正着',
    seedFlags: ['gray_deep', 'escape_plan'],
  },
  {
    key: 'entrepreneur',
    icon: '🚀',
    name: '创业弄潮儿',
    desc: '从第一笔融资到上市敲钟，把一家公司做成',
    seedFlags: ['startup_success'],
  },
  {
    key: 'artist',
    icon: '🎨',
    name: '艺术人生',
    desc: '从第一次个展到回顾展，把热爱变成一生的事业',
    seedFlags: ['artist_pro'],
  },
  {
    key: 'athlete',
    icon: '🏅',
    name: '赛场传奇',
    desc: '走上职业运动员之路，日复一日的训练',
    seedFlags: ['athlete_pro'],
  },
  {
    key: 'military',
    icon: '🎖️',
    name: '铁血人生',
    desc: '响应号召参军入伍，把青春融进军营',
    seedFlags: ['military_flag'],
  },
];

/** 按 key 查人生路线；未知/缺省返回 undefined（自由人生） */
export function getRoute(key: string | undefined): LifeRoute | undefined {
  return LIFE_ROUTES.find(r => r.key === key);
}
