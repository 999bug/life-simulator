/**
 * 人生模拟器匿名排行榜 + 云存档 Worker。
 *
 * 免费档约束下刻意保持简单：
 * - 单 KV namespace 承载榜单、限流计数、云存档；
 * - 榜单只保留 top N，降低读放大和单 key 体积；
 * - 匿名 deviceId 只做去重与限流，不收集任何个人信息。
 */

const TOP_N = 100;
const SAVE_MAX_BYTES = 64 * 1024;
const SCORE_MAX_BYTES = 8 * 1024;
const DEVICE_RATE_LIMIT_MAX = 20;
const IP_RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_SECONDS = 60;

const VALID_MODES = new Set(['daily', 'weekly', 'seed', 'auto']);
const DEVICE_ID_RE = /^[A-Za-z0-9._-]{8,128}$/;

// 16 条路线结局 key + 5 个分数档 key，与前端 src/engine/verdict.ts 对齐。
const ENDING_KEYS = new Set([
  'startup_success',
  'world_traveler',
  'grad_school',
  'top_university',
  'retake',
  'doctor',
  'military_flag',
  'athlete_pro',
  'artist',
  'tech_career',
  'escaped',
  'gang_boss',
  'jailed',
  'went_to_college',
  'skilled_worker',
  'civil_servant',
  'score:75+',
  'score:60+',
  'score:45+',
  'score:30+',
  'score:low',
]);

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

function text(message, status = 400) {
  return new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

function getAllowedOrigins(env) {
  const raw = typeof env.CORS_ORIGINS === 'string' ? env.CORS_ORIGINS : '';
  const fallback = 'https://999bug.github.io,http://localhost:5173';
  return (raw || fallback)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) {
    return {};
  }
  if (!getAllowedOrigins(env).includes(origin)) {
    return {};
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clampInt(value, min, max) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function getClientIp(request) {
  const connectingIp = request.headers.get('CF-Connecting-IP');
  if (connectingIp) {
    return connectingIp.slice(0, 64);
  }
  const forwarded = request.headers.get('X-Forwarded-For');
  if (forwarded) {
    return forwarded.split(',')[0].trim().slice(0, 64) || 'unknown';
  }
  return 'unknown';
}

async function readJsonBody(request, maxBytes) {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    return { error: '请求体过大', status: 413 };
  }
  try {
    return { data: JSON.parse(raw) };
  } catch {
    return { error: 'body 必须是合法 JSON', status: 400 };
  }
}

function hasJsonContentType(request) {
  const contentType = request.headers.get('Content-Type') ?? '';
  return contentType.split(';')[0].trim().toLowerCase() === 'application/json';
}

function isValidDeviceId(value) {
  return typeof value === 'string' && DEVICE_ID_RE.test(value);
}

function isValidKey(mode, key) {
  if (typeof key !== 'string' || key.length > 64) {
    return false;
  }
  if (mode === 'daily') {
    return /^\d{8}$/.test(key);
  }
  if (mode === 'weekly') {
    return /^\d{4}-W\d{2}$/.test(key);
  }
  if (mode === 'seed') {
    return /^\d{1,10}$/.test(key);
  }
  if (mode === 'auto') {
    return key === 'global' || /^\d{8}$/.test(key);
  }
  return false;
}

function leaderboardKey(mode, key) {
  return `lb:${mode}:${key}`;
}

async function readJson(env, key) {
  const raw = await env.LEADERBOARD.get(key);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function readLeaderboard(env, mode, key) {
  const value = await readJson(env, leaderboardKey(mode, key));
  return Array.isArray(value) ? value : [];
}

async function writeLeaderboard(env, mode, key, entries) {
  await env.LEADERBOARD.put(leaderboardKey(mode, key), JSON.stringify(entries));
}

function rankInfo(entries, deviceId) {
  const index = entries.findIndex((entry) => entry.deviceId === deviceId);
  if (index < 0) {
    return { myRank: null, myPercentile: null, total: entries.length };
  }
  const myRank = index + 1;
  const total = entries.length;
  return {
    myRank,
    myPercentile: total > 0 ? Math.round((myRank / total) * 100) : null,
    total,
  };
}

async function enforceRateLimit(env, scope, max) {
  const windowKey = `rl:${scope}:${Math.floor(Date.now() / (RATE_LIMIT_WINDOW_SECONDS * 1000))}`;
  const currentRaw = await env.LEADERBOARD.get(windowKey);
  const current = currentRaw ? Number.parseInt(currentRaw, 10) || 0 : 0;
  if (current >= max) {
    return false;
  }
  await env.LEADERBOARD.put(windowKey, String(current + 1), {
    expirationTtl: RATE_LIMIT_WINDOW_SECONDS * 2,
  });
  return true;
}

async function handleScore(request, env) {
  if (!hasJsonContentType(request)) {
    return json({ error: 'Content-Type 必须是 application/json' }, 415);
  }

  const parsed = await readJsonBody(request, SCORE_MAX_BYTES);
  if (parsed.error) {
    return json({ error: parsed.error }, parsed.status);
  }
  const body = parsed.data;

  if (!isPlainObject(body)) {
    return json({ error: 'body 必须是 JSON 对象' }, 400);
  }

  const { mode, key, deviceId } = body;
  if (!VALID_MODES.has(mode)) {
    return json({ error: 'mode 必须是 daily、weekly 或 seed' }, 400);
  }
  if (!isValidKey(mode, key)) {
    return json({ error: 'key 格式不合法' }, 400);
  }
  if (!isValidDeviceId(deviceId)) {
    return json({ error: 'deviceId 格式不合法' }, 400);
  }
  if (typeof body.score !== 'number' || !Number.isFinite(body.score)) {
    return json({ error: 'score 必须是数字' }, 400);
  }
  if (typeof body.age !== 'number' || !Number.isFinite(body.age)) {
    return json({ error: 'age 必须是数字' }, 400);
  }
  if (typeof body.endingKey !== 'string' || !ENDING_KEYS.has(body.endingKey)) {
    return json({ error: 'endingKey 不在白名单内' }, 400);
  }

  const deviceOk = await enforceRateLimit(env, `device:${deviceId}`, DEVICE_RATE_LIMIT_MAX);
  const ipOk = await enforceRateLimit(env, `ip:${getClientIp(request)}`, IP_RATE_LIMIT_MAX);
  if (!deviceOk || !ipOk) {
    return json({ error: '请求过于频繁，请稍后再试' }, 429);
  }

  const score = clampInt(body.score, 0, 100);
  const age = clampInt(body.age, 0, 103);
  const incoming = {
    deviceId,
    score,
    age,
    endingKey: body.endingKey,
    ts: Date.now(),
  };

  const entries = await readLeaderboard(env, mode, key);
  const existingIndex = entries.findIndex((entry) => entry.deviceId === deviceId);
  let accepted = false;

  if (existingIndex >= 0) {
    if (entries[existingIndex].score >= incoming.score) {
      return json({
        accepted: false,
        ...rankInfo(entries, deviceId),
      });
    }
    entries.splice(existingIndex, 1);
    entries.push(incoming);
    accepted = true;
  } else {
    entries.push(incoming);
    accepted = true;
  }

  entries.sort((a, b) => b.score - a.score);
  const trimmed = entries.slice(0, TOP_N);
  await writeLeaderboard(env, mode, key, trimmed);

  return json({
    accepted,
    ...rankInfo(trimmed, deviceId),
  });
}

async function handleLeaderboard(request, env) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('mode');
  const key = url.searchParams.get('key');
  const deviceId = url.searchParams.get('deviceId');

  if (!VALID_MODES.has(mode)) {
    return json({ error: 'mode 必须是 daily、weekly 或 seed' }, 400);
  }
  if (!isValidKey(mode, key)) {
    return json({ error: 'key 格式不合法' }, 400);
  }
  if (deviceId !== null && !isValidDeviceId(deviceId)) {
    return json({ error: 'deviceId 格式不合法' }, 400);
  }

  const entries = await readLeaderboard(env, mode, key);
  const my = deviceId ? rankInfo(entries, deviceId) : { myRank: null, myPercentile: null, total: entries.length };

  return json({
    mode,
    key,
    entries: entries.slice(0, TOP_N),
    myRank: my.myRank,
    myPercentile: my.myPercentile,
    total: my.total,
  });
}

async function handleSaveGet(request, env) {
  const url = new URL(request.url);
  const deviceId = url.searchParams.get('deviceId');
  if (!isValidDeviceId(deviceId)) {
    return json({ error: 'deviceId 格式不合法' }, 400);
  }

  const data = await readJson(env, `save:${deviceId}`);
  return json({ exists: data !== null, data });
}

async function handleSavePut(request, env) {
  const url = new URL(request.url);
  const deviceId = url.searchParams.get('deviceId');
  if (!isValidDeviceId(deviceId)) {
    return json({ error: 'deviceId 格式不合法' }, 400);
  }

  if (!hasJsonContentType(request)) {
    return json({ error: 'Content-Type 必须是 application/json' }, 415);
  }

  const deviceOk = await enforceRateLimit(env, `device:${deviceId}`, DEVICE_RATE_LIMIT_MAX);
  const ipOk = await enforceRateLimit(env, `ip:${getClientIp(request)}`, IP_RATE_LIMIT_MAX);
  if (!deviceOk || !ipOk) {
    return json({ error: '请求过于频繁，请稍后再试' }, 429);
  }

  const parsed = await readJsonBody(request, SAVE_MAX_BYTES);
  if (parsed.error) {
    return json({ error: parsed.error }, parsed.status);
  }
  const body = parsed.data;
  if (!isPlainObject(body)) {
    return json({ error: '云存档 body 必须是 JSON 对象' }, 400);
  }

  const serialized = JSON.stringify(body);
  if (new TextEncoder().encode(serialized).byteLength > SAVE_MAX_BYTES) {
    return json({ error: '云存档超过 64KB 上限' }, 413);
  }

  const stored = {
    updatedAt: Date.now(),
    data: body,
  };
  await env.LEADERBOARD.put(`save:${deviceId}`, JSON.stringify(stored));
  return json({ ok: true, updatedAt: stored.updatedAt });
}

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }

  if (method === 'POST' && path === '/api/score') {
    return handleScore(request, env);
  }
  if (method === 'GET' && path === '/api/leaderboard') {
    return handleLeaderboard(request, env);
  }
  if (method === 'GET' && path === '/api/save') {
    return handleSaveGet(request, env);
  }
  if (method === 'PUT' && path === '/api/save') {
    return handleSavePut(request, env);
  }

  return json({ error: 'Not Found' }, 404);
}

export default {
  async fetch(request, env) {
    try {
      const response = await handleRequest(request, env);
      const headers = new Headers(response.headers);
      for (const [name, value] of Object.entries(corsHeaders(request, env))) {
        headers.set(name, value);
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      console.error('life-simulator-api error', error);
      return json({ error: 'Internal Server Error' }, 500);
    }
  },
};
