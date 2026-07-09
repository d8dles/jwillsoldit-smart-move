// store.js — single-document JSON store for the rental verification module.
//
// Backend selection (in order):
//   1. Vercel KV / Upstash Redis REST API, if KV_REST_API_URL + KV_REST_API_TOKEN
//      are set (Vercel dashboard → Storage → KV). This is the required backend
//      for production — it's the only one that survives across serverless
//      invocations and cold starts.
//   2. A local JSON file (.data/verification-db.json) for local dev with
//      `vercel dev` / `node`. NOT durable on Vercel's production runtime
//      (the filesystem there is read-only outside /tmp), so this path exists
//      purely so the module can be exercised without provisioning KV first.
//
// The whole module's state (verifications, invoices, admin sessions, a
// counter) lives under one KV key. Traffic through this module is a single
// admin managing a few dozen files a year, so read-modify-write without
// per-record keys is simpler and plenty fast — no need for real transactions.

import { promises as fs } from 'fs';
import path from 'path';

const DB_KEY = 'smart_move_verification_db_v1';
const LOCAL_DB_PATH = path.join(process.cwd(), '.data', 'verification-db.json');

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
  if (hasKV()) {
    const db = await kvGet(DB_KEY);
    return db || emptyDB();
  }
  if (!warnedNoBackend) {
    warnedNoBackend = true;
    console.warn(
      '[verification-store] KV_REST_API_URL/KV_REST_API_TOKEN not set — falling back to ' +
      'a local JSON file. This is fine for local development but does NOT persist on ' +
      'Vercel\'s production runtime. Provision Vercel KV before relying on this module in production.'
    );
  }
  const db = await fileRead();
  return db || emptyDB();
}

export async function writeDB(db) {
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
  return hasKV();
}
