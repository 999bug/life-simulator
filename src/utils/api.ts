import { API_BASE } from '../config';

export type ChallengeMode = 'daily' | 'weekly' | 'seed';

export interface LeaderboardEntry {
  deviceId: string;
  score: number;
  age: number;
  endingKey: string;
  ts: number;
}

export interface LeaderboardResponse {
  mode: ChallengeMode;
  key: string;
  entries: LeaderboardEntry[];
  myRank: number | null;
  myPercentile: number | null;
  total: number;
}

export interface ScoreResponse {
  accepted: boolean;
  myRank: number | null;
  myPercentile: number | null;
  total: number;
}

export interface ScorePayload {
  mode: ChallengeMode;
  key: string;
  deviceId: string;
  score: number;
  age: number;
  endingKey: string;
}

const DEVICE_ID_KEY = 'life-sim-device-id';
const DEVICE_ID_RE = /^[A-Za-z0-9._-]{8,128}$/;
const FETCH_TIMEOUT_MS = 4000;

let memoryDeviceId: string | null = null;

/** 后端是否已配置；未配置时所有 API 都静默跳过。 */
export function isApiConfigured(): boolean {
  return API_BASE.length > 0;
}

function createDeviceId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  const randomPart = () => Math.random().toString(36).slice(2).padEnd(12, '0');
  return `${Date.now().toString(36)}-${randomPart()}-${randomPart()}`;
}

/**
 * 读取匿名设备 ID；不存在则生成并写入 localStorage。
 * localStorage 不可用时退回内存 ID（当次会话内稳定）。
 */
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing && DEVICE_ID_RE.test(existing)) {
      return existing;
    }
    const id = createDeviceId();
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    if (!memoryDeviceId) {
      memoryDeviceId = createDeviceId();
    }
    return memoryDeviceId;
  }
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  if (!isApiConfigured()) {
    throw new Error('API_BASE 未配置');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      throw new Error(`API ${response.status}`);
    }
    return await response.json() as T;
  } finally {
    clearTimeout(timer);
  }
}

/** 上报一局成绩；未配置后端或网络失败时返回 null，调用方静默忽略。 */
export async function reportScore(payload: ScorePayload): Promise<ScoreResponse | null> {
  if (!isApiConfigured()) {
    return null;
  }
  try {
    return await apiJson<ScoreResponse>('/api/score', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch {
    return null;
  }
}

/** 拉取某个榜单；未配置后端或网络失败时返回 null。 */
export async function fetchLeaderboard(
  mode: ChallengeMode,
  key: string,
  deviceId?: string,
): Promise<LeaderboardResponse | null> {
  if (!isApiConfigured()) {
    return null;
  }
  const params = new URLSearchParams({ mode, key });
  if (deviceId) {
    params.set('deviceId', deviceId);
  }
  try {
    return await apiJson<LeaderboardResponse>(`/api/leaderboard?${params.toString()}`);
  } catch {
    return null;
  }
}

/** 云存档接口预留（当前前端未接入）。 */
export async function fetchCloudSave(deviceId: string): Promise<unknown | null> {
  if (!isApiConfigured()) {
    return null;
  }
  try {
    const data = await apiJson<{ exists: boolean; data: unknown }>(`/api/save?deviceId=${encodeURIComponent(deviceId)}`);
    return data.exists ? data.data : null;
  } catch {
    return null;
  }
}

/** 云存档写入接口预留（当前前端未接入）。 */
export async function putCloudSave(deviceId: string, data: unknown): Promise<boolean> {
  if (!isApiConfigured()) {
    return false;
  }
  try {
    await apiJson(`/api/save?deviceId=${encodeURIComponent(deviceId)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return true;
  } catch {
    return false;
  }
}
