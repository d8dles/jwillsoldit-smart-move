// store.js — durable backend for the private Smart Move admin module.
//
// Production uses Supabase RPC functions over normalized record tables. Each
// write carries the version read with the snapshot, so concurrent submissions
// fail instead of silently overwriting one another. The original single-row
// JSON store remains in Supabase as a rollback copy but is no longer used by
// this branch.

import { promises as fs } from 'fs';
import path from 'path';

const LOCAL_DB_PATH = path.join(process.cwd(), '.data', 'verification-db.json');
const MAX_WRITE_RETRIES = 3;

function emptyDB() {
  return {
    verifications: {},
    invoices: {},
    listings: {},
    cdas: {},
    inventory: {},
    adminSessions: {},
    counters: { invoice: 0 },
    __storeVersion: 1,
  };
}

function hasSupabase() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function hasKV() {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function supabaseUrl(pathname) {
  return `${process.env.SUPABASE_URL.replace(/\/+$/, '')}${pathname}`;
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function responseError(prefix, res) {
  const body = await res.text().catch(() => '');
  const error = new Error(`${prefix} failed: ${res.status}${body ? ` ${body}` : ''}`);
  error.status = res.status;
  error.body = body;
  return error;
}

async function supabaseReadState() {
  const res = await fetch(supabaseUrl('/rest/v1/rpc/sm_read_state'), {
    method: 'POST',
    headers: supabaseHeaders(),
    body: '{}',
    cache: 'no-store',
  });
  if (!res.ok) throw await responseError('Supabase state read', res);
  const db = await res.json();
  return db && typeof db === 'object' ? db : emptyDB();
}

async function supabaseReplaceState(db, expectedVersion) {
  const clean = { ...db };
  delete clean.__storeVersion;

  const res = await fetch(supabaseUrl('/rest/v1/rpc/sm_replace_state'), {
    method: 'POST',
    headers: supabaseHeaders(),
    body: JSON.stringify({ p_state: clean, p_expected_version: expectedVersion }),
    cache: 'no-store',
  });
  if (!res.ok) throw await responseError('Supabase state write', res);
  return Number(await res.json());
}

async function kvGet() {
  const res = await fetch(`${process.env.KV_REST_API_URL}/get/smart_move_verification_db_v1`, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
  });
  if (!res.ok) throw new Error(`KV get failed: ${res.status}`);
  const data = await res.json();
  return data.result == null ? null : JSON.parse(data.result);
}

async function kvSet(value) {
  const res = await fetch(`${process.env.KV_REST_API_URL}/set/smart_move_verification_db_v1`, {
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
    return JSON.parse(await fs.readFile(LOCAL_DB_PATH, 'utf8'));
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
  if (hasSupabase()) return supabaseReadState();
  if (hasKV()) return (await kvGet()) || emptyDB();

  if (!warnedNoBackend) {
    warnedNoBackend = true;
    console.warn('[verification-store] No durable backend configured; using local development storage.');
  }
  return (await fileRead()) || emptyDB();
}

export async function writeDB(db) {
  if (hasSupabase()) {
    const expected = Number(db.__storeVersion || 1);
    db.__storeVersion = await supabaseReplaceState(db, expected);
    return;
  }
  if (hasKV()) {
    await kvSet(db);
    return;
  }
  await fileWrite(db);
}

function isConflict(error) {
  return error?.status === 400 && String(error.body || error.message).includes('smart_move_store_conflict');
}

// Read, mutate, and commit atomically. A conflicting writer causes a fresh
// read and replay, rather than a last-write-wins overwrite of another form.
export async function withDB(mutator) {
  for (let attempt = 1; attempt <= MAX_WRITE_RETRIES; attempt += 1) {
    const db = await readDB();
    const result = await mutator(db);
    try {
      await writeDB(db);
      return result;
    } catch (error) {
      if (!hasSupabase() || !isConflict(error) || attempt === MAX_WRITE_RETRIES) throw error;
    }
  }
  throw new Error('Could not safely save the record after repeated concurrent updates');
}

export function isDurableBackendConfigured() {
  return hasSupabase() || hasKV();
}

export function getRecord(collection, id) {
  if (!collection || typeof id !== 'string' || !id) return undefined;
  return Object.prototype.hasOwnProperty.call(collection, id) ? collection[id] : undefined;
}
