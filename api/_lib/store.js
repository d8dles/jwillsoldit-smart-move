// store.js — single-document JSON store for the rental verification module.
//
// Backend selection (in order):
//   1. Supabase Postgres via the Data API, if SUPABASE_URL +
//      SUPABASE_SERVICE_ROLE_KEY are set. This is the preferred production
//      backend because it survives serverless cold starts.
//   2. Vercel KV / Upstash Redis REST API, if KV_REST_API_URL +
//      KV_REST_API_TOKEN are set.
//   3. A local JSON file (.data/verification-db.json) for local dev with
//      `vercel dev` / `node`. NOT durable on Vercel's production runtime
//      (the filesystem there is read-only outside /tmp), so this path exists
//      purely so the module can be exercised without provisioning a durable
//      backend first.
//
// The whole module's state (verifications, invoices, admin sessions, a
// counter) lives under one KV key. Traffic through this module is a single
// admin managing a few dozen files a year, so read-modify-write without
// per-record keys is simpler and plenty fast — no need for real transactions.

import { promises as fs } from 'fs';
import path from 'path';

const DB_KEY = 'smart_move_verification_db_v1';
const LOCAL_DB_PATH = path.join(process.cwd(), '.data', 'verification-db.json');
const SUPABASE_TABLE = process.env.SUPABASE_STORE_TABLE || 'smart_move_store';

function emptyDB() {
  return {
    verifications: {},
    invoices: {},
    adminSessions: {},
    counters: { invoice: 0 },
  };
}

function hasKV() {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function hasSupabase() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function supabaseRestUrl(pathname, query = '') {
  const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
  return `${base}/rest/v1/${pathname}${query ? `?${query}` : ''}`;
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    ...extra,
  };
}

async function supabaseError(prefix, res) {
  const body = await res.text().catch(() => '');
  return new Error(`${prefix} failed: ${res.status}${body ? ` ${body}` : ''}`);
}

async function supabaseGet(key) {
  const query = new URLSearchParams({
    key: `eq.${key}`,
    select: 'value',
    limit: '1',
  });
  const res = await fetch(supabaseRestUrl(SUPABASE_TABLE, query.toString()), {
    headers: supabaseHeaders(),
  });
  if (!res.ok) throw await supabaseError('Supabase get', res);
  const rows = await res.json();
  return rows?.[0]?.value || null;
}

async function supabaseSet(key, value) {
  const res = await fetch(supabaseRestUrl(SUPABASE_TABLE, 'on_conflict=key'), {
    method: 'POST',
    headers: supabaseHeaders({
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    }),
    body: JSON.stringify([{ key, value }]),
  });
  if (!res.ok) throw await supabaseError('Supabase set', res);
}

async function kvGet(key) {
  const res = await fetch(`${process.env.KV_REST_API_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
  });
  if (!res.ok) throw new Error(`KV get failed: ${res.status}`);
  const data = await res.json();
  if (data.result == null) return null;
  try {
    return JSON.parse(data.result);
  } catch {
    return null;
  }
}

async function kvSet(key, value) {
  const res = await fetch(`${process.env.KV_REST_API_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      'Content-Type': 'text/plain',
    },
    body: JSON.stringify(value),
  });
  if (!res.ok) throw new Error(`KV set failed: ${res.status}`);
}

async function fileRead() {
  try {
    const raw = await fs.readFile(LOCAL_DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function fileWrite(value) {
  await fs.mkdir(path.dirname(LOCAL_DB_PATH), { recursive: true });
  await fs.writeFile(LOCAL_DB_PATH, JSON.stringify(value, null, 2), 'utf8');
}

let warnedNoBackend = false;

export async function readDB() {
  if (hasSupabase()) {
    const db = await supabaseGet(DB_KEY);
    return db || emptyDB();
  }
  if (hasKV()) {
    const db = await kvGet(DB_KEY);
    return db || emptyDB();
  }
  if (!warnedNoBackend) {
    warnedNoBackend = true;
    console.warn(
      '[verification-store] No durable backend configured — falling back to ' +
      'a local JSON file. This is fine for local development but does NOT persist on ' +
      'Vercel\'s production runtime. Configure Supabase or Vercel KV before relying on this module in production.'
    );
  }
  const db = await fileRead();
  return db || emptyDB();
}

export async function writeDB(db) {
  if (hasSupabase()) {
    await supabaseSet(DB_KEY, db);
    return;
  }
  if (hasKV()) {
    await kvSet(DB_KEY, db);
    return;
  }
  await fileWrite(db);
}

// Convenience helper: read, mutate, write. `mutator` receives the DB object
// and may mutate it in place and/or return a value to hand back to the caller.
export async function withDB(mutator) {
  const db = await readDB();
  const result = await mutator(db);
  await writeDB(db);
  return result;
}

export function isDurableBackendConfigured() {
  return hasSupabase() || hasKV();
}
