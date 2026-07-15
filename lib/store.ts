// Pluggable datastore: JSON files under .data/ for local dev, Upstash Redis in
// production. Selected automatically by the presence of UPSTASH_REDIS_REST_URL.
// See docs/ARCHITECTURE.md "Datastore abstraction".
//
// Server-only module (uses node:fs). Never import from client components.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Snapshot, SyncMeta, TokenState, PriceMapEntry } from './types';

const DATA_DIR = path.join(process.cwd(), '.data');
const KEY_PREFIX = 'vloeruniq:';

type Key = 'token' | 'snapshot' | 'meta' | 'config';

// Support both env-var naming schemes the Vercel Upstash/Redis integrations use.
function redisEnv(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

function usingRedis(): boolean {
  return redisEnv() !== null;
}

// ── Upstash backend (lazy) ──────────────────────────────────────────────
let redisClient: import('@upstash/redis').Redis | null = null;
async function redis() {
  if (!redisClient) {
    const { Redis } = await import('@upstash/redis');
    const cfg = redisEnv();
    if (!cfg) throw new Error('No Upstash/Redis env vars configured.');
    redisClient = new Redis({ url: cfg.url, token: cfg.token });
  }
  return redisClient;
}

async function redisGet<T>(key: Key): Promise<T | null> {
  const r = await redis();
  // Upstash auto-deserializes JSON values.
  return (await r.get<T>(KEY_PREFIX + key)) ?? null;
}

async function redisSet<T>(key: Key, value: T): Promise<void> {
  const r = await redis();
  await r.set(KEY_PREFIX + key, value);
}

// ── File backend ────────────────────────────────────────────────────────
function filePath(key: Key): string {
  return path.join(DATA_DIR, `${key}.json`);
}

async function fileGet<T>(key: Key): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath(key), 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function fileSet<T>(key: Key, value: T): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(filePath(key), JSON.stringify(value, null, 2), 'utf8');
}

// ── Unified accessors ───────────────────────────────────────────────────
async function get<T>(key: Key): Promise<T | null> {
  return usingRedis() ? redisGet<T>(key) : fileGet<T>(key);
}

async function set<T>(key: Key, value: T): Promise<void> {
  return usingRedis() ? redisSet<T>(key, value) : fileSet<T>(key, value);
}

export const store = {
  backend: () => (usingRedis() ? 'upstash' : 'file'),

  getToken: () => get<TokenState>('token'),
  setToken: (t: TokenState) => set('token', t),

  getSnapshot: () => get<Snapshot>('snapshot'),
  setSnapshot: (s: Snapshot) => set('snapshot', s),

  getMeta: () => get<SyncMeta>('meta'),
  setMeta: (m: SyncMeta) => set('meta', m),

  getConfig: () => get<PriceMapEntry[]>('config'),
  setConfig: (c: PriceMapEntry[]) => set('config', c),
};
