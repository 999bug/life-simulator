/**
 * 场景背景素材生成器。
 *
 * 复用 src/components 的场景渲染函数（renderStageScene / renderCategoryScene），输出：
 * 1. 18 张独立背景图（7 阶段 + 11 分类）→ public/scenes/
 * 2. 70 张「阶段 × 分类」去重组合背景（由 events.json 实际出现的事件场景推导，
 *    与游戏内每个问题显示的场景完全一致：阶段场景 + 分类场景 80% 叠加）
 *    → public/scenes/events/
 * 3. 事件 → 背景对照表：mapping.json（数据）+ mapping.html（可搜索页面）
 * 4. index.html 画廊页
 *
 * 运行（package.json 的 gen:scenes）：
 *   esbuild script/gen-scenes/entry.tsx --bundle --platform=node --format=cjs \
 *     --jsx=automatic --packages=external --outfile=script/gen-scenes/gen.cjs
 *   node script/gen-scenes/gen.cjs
 */
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import type { LifeStage, EventCategory } from '../../src/types';
import { renderStageScene } from '../../src/components/SceneDecor';
import { renderCategoryScene } from '../../src/components/CategoryDecor';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** 阶段天空渐变（末色 = 场景自身渐变顶色，保证接缝无缝） */
const STAGE_SKY: Record<LifeStage, readonly string[]> = {
  infant: ['#fdf6ea', '#f5e6d0'],
  childhood: ['#7ec0f2', '#4a90d9'],
  teen: ['#0f0f2a', '#1a1a3e'],
  young_adult: ['#0a0a1c', '#050510'],
  adult: ['#a3b2c2', '#8899aa'],
  middle_age: ['#d97b3a', '#c05621'],
  elder: ['#ffd9a0', '#f6ad55'],
};

const STAGE_ORDER: LifeStage[] = ['infant', 'childhood', 'teen', 'young_adult', 'adult', 'middle_age', 'elder'];
const CATEGORY_ORDER: EventCategory[] = [
  'family', 'career', 'health', 'friend', 'education', 'personality',
  'technology', 'love', 'finance', 'hobby', 'sports',
];

/** 分类独立背景的底色阶段（仅用于 11 张分类素材的观感衬托） */
const CATEGORY_STAGE: Record<EventCategory, LifeStage> = {
  family: 'adult',
  career: 'young_adult',
  health: 'adult',
  friend: 'teen',
  education: 'childhood',
  personality: 'teen',
  technology: 'young_adult',
  love: 'teen',
  finance: 'young_adult',
  hobby: 'adult',
  sports: 'childhood',
};

const STAGE_LABELS: Record<LifeStage, string> = {
  infant: '婴儿期', childhood: '童年', teen: '少年', young_adult: '青年',
  adult: '成年', middle_age: '中年', elder: '老年',
};
const CATEGORY_LABELS: Record<EventCategory, string> = {
  family: '家庭', career: '事业', health: '健康', friend: '友谊', education: '教育',
  personality: '个性', technology: '科技', love: '爱情', finance: '金融',
  hobby: '爱好', sports: '运动',
};

/** 场景动画关键帧（独立 SVG 无项目样式表，内联以保证动画生效） */
const ANIM_CSS = `
@keyframes twinkle{0%,100%{opacity:.3}50%{opacity:1}}
@keyframes glow{0%,100%{opacity:.3}50%{opacity:.7}}
@keyframes neon{0%,100%{opacity:.3}50%{opacity:.7}}
@keyframes infantMobile{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
.animate-twinkle{animation:twinkle 3s ease-in-out infinite}
.animate-glow{animation:glow 2s ease-in-out infinite}
.animate-neon{animation:neon 3s ease-in-out infinite}
.animate-infant-mobile{animation:infantMobile 12s linear infinite;transform-origin:480px 180px}
`;

/** 960×540 独立背景：天空渐变 + 场景内容（场景 art 为 960×400，下移 140 贴底）+ 底部暗角 */
function Background({ sky, children }: { sky: readonly string[]; children: ReactNode }) {
  const stops = sky.map((color, i) => (
    <stop key={i} offset={`${Math.round((i / (sky.length - 1)) * 100)}%`} stopColor={color} />
  ));
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" width="960" height="540">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">{stops}</linearGradient>
        <linearGradient id="vig" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(5,8,20,0)" />
          <stop offset="62%" stopColor="rgba(5,8,20,0)" />
          <stop offset="100%" stopColor="rgba(5,8,20,0.30)" />
        </linearGradient>
      </defs>
      <style>{ANIM_CSS}</style>
      <rect width="960" height="540" fill="url(#sky)" />
      <g transform="translate(0 140)">{children}</g>
      <rect width="960" height="540" fill="url(#vig)" />
    </svg>
  );
}

/** 极简缩进，便于人工查看 */
function pretty(markup: string): string {
  return markup.replace(/></g, '>\n<').trim() + '\n';
}

/** HTML 转义（标题等用户内容） */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const outDir = join(process.cwd(), 'public', 'scenes');
const eventsDir = join(outDir, 'events');
mkdirSync(outDir, { recursive: true });
mkdirSync(eventsDir, { recursive: true });

// ==================== 1. 18 张独立背景（7 阶段 + 11 分类） ====================
interface SceneFile { file: string; group: '阶段' | '分类'; title: string; markup: string; }
const files: SceneFile[] = [];

const STAGE_FILES: Record<LifeStage, string> = {
  infant: 'infant', childhood: 'childhood', teen: 'teen', young_adult: 'young-adult',
  adult: 'adult', middle_age: 'middle-age', elder: 'elder',
};
for (const stage of STAGE_ORDER) {
  const markup = renderToStaticMarkup(<Background sky={STAGE_SKY[stage]}>{renderStageScene(stage)}</Background>);
  files.push({ file: `${STAGE_FILES[stage]}.svg`, group: '阶段', title: `${STAGE_LABELS[stage]} · ${STAGE_FILES[stage]}`, markup });
}
for (const category of CATEGORY_ORDER) {
  const stage = CATEGORY_STAGE[category];
  const markup = renderToStaticMarkup(
    <Background sky={STAGE_SKY[stage]}>
      {renderStageScene(stage)}
      {renderCategoryScene(category)}
    </Background>,
  );
  files.push({ file: `${category}.svg`, group: '分类', title: `${CATEGORY_LABELS[category]} · ${category}`, markup });
}
for (const f of files) {
  writeFileSync(join(outDir, f.file), pretty(f.markup), 'utf8');
}

// ==================== 2. 事件 → 场景组合（按 events.json 实际分布去重） ====================
interface RawEvent { id: string; title?: string; age?: number; stage: LifeStage; category: EventCategory; }
const EVENTS = JSON.parse(readFileSync(join(process.cwd(), 'public', 'events.json'), 'utf8')) as RawEvent[];

interface Combo {
  stage: LifeStage;
  category: EventCategory;
  count: number;
  exampleTitles: string[];
}
const comboMap = new Map<string, Combo>();
for (const ev of EVENTS) {
  const key = `${ev.stage}|${ev.category}`;
  const combo = comboMap.get(key) ?? { stage: ev.stage, category: ev.category, count: 0, exampleTitles: [] };
  combo.count += 1;
  if (combo.exampleTitles.length < 3 && ev.title) {
    combo.exampleTitles.push(ev.title);
  }
  comboMap.set(key, combo);
}
const combos = [...comboMap.values()].sort((a, b) =>
  STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage)
  || CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
);

/** 组合文件名：<stage>-<category>.svg（如 young_adult-career.svg） */
function comboFile(stage: LifeStage, category: EventCategory): string {
  return `${stage}-${category}.svg`;
}

for (const combo of combos) {
  const file = comboFile(combo.stage, combo.category);
  const markup = renderToStaticMarkup(
    <Background sky={STAGE_SKY[combo.stage]}>
      {renderStageScene(combo.stage)}
      <g opacity="0.8">{renderCategoryScene(combo.category)}</g>
    </Background>,
  );
  writeFileSync(join(eventsDir, file), pretty(markup), 'utf8');
}

// ==================== 3. 对照表（mapping.json + mapping.html） ====================
const mappingRows = EVENTS.map((ev) => ({
  id: ev.id,
  title: ev.title ?? '',
  age: ev.age ?? 0,
  stage: ev.stage,
  category: ev.category,
  file: `events/${comboFile(ev.stage, ev.category)}`,
}));
writeFileSync(join(outDir, 'mapping.json'), JSON.stringify({ total: mappingRows.length, scenes: mappingRows }), 'utf8');

const mappingRowsHtml = mappingRows
  .map((r) => `
    <tr>
      <td class="mono">${esc(r.id)}</td>
      <td>${esc(r.title) || '—'}</td>
      <td><span class="tag tag-stage">${STAGE_LABELS[r.stage]}</span><span class="tag tag-cat">${CATEGORY_LABELS[r.category]}</span></td>
      <td>${r.age} 岁</td>
      <td><a href="${r.file}" target="_blank"><img src="${r.file}" width="150" alt="${esc(r.id)}"></a></td>
    </tr>`)
  .join('\n');

const mappingHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>人生模拟器 · 事件背景对照表</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0a0a0f;color:#e8e8e8;font-family:'Microsoft YaHei','PingFang SC',sans-serif;padding:24px 16px 60px}
  h1{font-size:18px;margin-bottom:4px;color:#c9a96e}
  p.desc{color:#8888aa;font-size:13px;margin-bottom:16px}
  .bar{display:flex;gap:10px;align-items:center;margin-bottom:14px;flex-wrap:wrap}
  input{flex:1;min-width:220px;max-width:420px;background:#14142a;border:1px solid #26264a;color:#e8e8e8;padding:8px 12px;border-radius:8px;font-size:14px}
  .count{font-size:13px;color:#8888aa}
  .table-wrap{overflow:auto;border:1px solid #26264a;border-radius:10px;max-height:82vh}
  table{border-collapse:collapse;width:100%;min-width:760px;background:#101022}
  thead th{position:sticky;top:0;background:#1a1a2e;color:#c9a96e;font-size:12px;text-align:left;padding:8px 12px;border-bottom:1px solid #26264a;white-space:nowrap}
  tbody td{padding:8px 12px;border-bottom:1px solid #1c1c38;font-size:13px;vertical-align:middle}
  tbody tr:hover{background:#161630}
  td.mono{font-family:Consolas,monospace;color:#8fb7e8;white-space:nowrap}
  .tag{font-size:11px;padding:2px 8px;border-radius:999px;margin-right:6px;white-space:nowrap}
  .tag-stage{background:#2a3a55;color:#8fb7e8}
  .tag-cat{background:#4a2f3a;color:#f4a0b8}
  img{display:block;border-radius:6px;border:1px solid #26264a}
</style>
</head>
<body>
  <h1>人生模拟器 · 事件背景对照表</h1>
  <p class="desc">共 ${mappingRows.length} 个事件 → ${combos.length} 种「阶段 × 分类」场景（与游戏内每个问题显示的场景一致）。生成命令：npm run gen:scenes</p>
  <div class="bar">
    <input id="q" type="search" placeholder="搜索事件 id 或标题…">
    <span class="count" id="cnt"></span>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>事件 id</th><th>标题</th><th>阶段 · 分类</th><th>年龄</th><th>背景</th></tr></thead>
      <tbody id="rows">${mappingRowsHtml}
      </tbody>
    </table>
  </div>
<script>
  const input = document.getElementById('q');
  const rows = Array.from(document.querySelectorAll('#rows tr'));
  const cnt = document.getElementById('cnt');
  function filter() {
    const q = input.value.trim().toLowerCase();
    let n = 0;
    for (const tr of rows) {
      const hit = !q || tr.textContent.toLowerCase().includes(q);
      tr.style.display = hit ? '' : 'none';
      if (hit) n++;
    }
    cnt.textContent = n + ' / ' + rows.length;
  }
  input.addEventListener('input', filter);
  filter();
</script>
</body>
</html>
`;
writeFileSync(join(outDir, 'mapping.html'), mappingHtml, 'utf8');

// ==================== 4. 画廊页（阶段 + 分类 + 事件场景组合） ====================
const comboCards = combos
  .map((c) => {
    const file = comboFile(c.stage, c.category);
    const examples = c.exampleTitles.map((t) => esc(t)).join('、');
    return `
    <a class="card" href="events/${file}" target="_blank">
      <img src="events/${file}" alt="${file}" loading="lazy">
      <div class="meta"><span class="tag tag-combo">${STAGE_LABELS[c.stage]}·${CATEGORY_LABELS[c.category]}</span></div>
      <div class="sub">${c.count} 个事件 · ${esc(examples)}</div>
    </a>`;
  })
  .join('\n');

const cards = files
  .map((f) => `
    <a class="card" href="${f.file}" target="_blank">
      <img src="${f.file}" alt="${f.title}" loading="lazy">
      <div class="meta"><span class="tag ${f.group === '阶段' ? 'tag-stage' : 'tag-cat'}">${f.group}</span>${f.title}</div>
    </a>`)
  .join('\n');

const gallery = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>人生模拟器 · 场景背景素材</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0a0a0f;color:#e8e8e8;font-family:'Microsoft YaHei','PingFang SC',sans-serif;padding:32px 20px 60px}
  h1{font-size:20px;margin-bottom:6px;color:#c9a96e}
  p.desc{color:#8888aa;font-size:13px;margin-bottom:8px}
  a.cta{display:inline-block;color:#8fb7e8;font-size:13px;margin-bottom:24px;text-decoration:none;border:1px solid #2a3a55;padding:6px 14px;border-radius:999px}
  a.cta:hover{border-color:#8fb7e8}
  h2{font-size:15px;color:#c9a96e;margin:28px 0 14px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px;max-width:1200px}
  .card{display:block;background:#14142a;border:1px solid #26264a;border-radius:10px;overflow:hidden;text-decoration:none;color:#e8e8e8;transition:transform .15s,border-color .15s}
  .card:hover{transform:translateY(-3px);border-color:#c9a96e}
  .card img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;background:#000}
  .meta{padding:10px 12px 0;font-size:13px;display:flex;align-items:center;gap:8px}
  .sub{padding:6px 12px 10px;font-size:12px;color:#8888aa}
  .tag{font-size:11px;padding:2px 8px;border-radius:999px;flex-shrink:0}
  .tag-stage{background:#2a3a55;color:#8fb7e8}
  .tag-cat{background:#4a2f3a;color:#f4a0b8}
  .tag-combo{background:#333a2a;color:#b8d08f}
</style>
</head>
<body>
  <h1>人生模拟器 · 场景背景素材</h1>
  <p class="desc">独立背景 ${files.length} 张（7 阶段 + 11 分类）+ 事件场景组合 ${combos.length} 张（与每个问题的场景对应）</p>
  <a class="cta" href="mapping.html">📋 事件背景对照表（752 个事件）</a>

  <h2>独立背景 · 阶段（7）</h2>
  <div class="grid">${files.filter((f) => f.group === '阶段').map((f) => `
    <a class="card" href="${f.file}" target="_blank">
      <img src="${f.file}" alt="${f.title}" loading="lazy">
      <div class="meta"><span class="tag tag-stage">阶段</span>${f.title}</div>
    </a>`).join('\n')}
  </div>

  <h2>独立背景 · 分类（11）</h2>
  <div class="grid">${files.filter((f) => f.group === '分类').map((f) => `
    <a class="card" href="${f.file}" target="_blank">
      <img src="${f.file}" alt="${f.title}" loading="lazy">
      <div class="meta"><span class="tag tag-cat">分类</span>${f.title}</div>
    </a>`).join('\n')}
  </div>

  <h2>事件场景组合（${combos.length}）· 与每个问题的场景对应</h2>
  <div class="grid">${comboCards}
  </div>
</body>
</html>
`;
writeFileSync(join(outDir, 'index.html'), gallery, 'utf8');

console.log(`✅ 独立背景 ${files.length} 张 + 事件场景组合 ${combos.length} 张 + 对照表（${mappingRows.length} 事件）→ public/scenes/`);
