// rate-limit.js — generic per-key request throttle.
//
// Backed by the same single JSON document as everything else (see
// store.js): call inside withDB so the check-and-record happens in the same
// read-modify-write pass as the rest of the handler, not a separate one
// that could race it. Every handler that uses this is reachable without
// admin auth — a form token, or (for /api/admin/login) nothing at all — so
// each gets its own bucket. A single global counter shared by every caller
// is not a defense, it's a denial-of-service vector against the one
// legitimate user: anyone can trip it from anywhere.
//
// Buckets are keyed by caller-supplied string (typically `${endpoint}:${ip}`)
// so a flood against one endpoint doesn't lock a different endpoint out for
// the same IP.

const STALE_BUCKET_MS = 24 * 60 * 60 * 1000; // prune buckets untouched for a day

/**
 * @param {object} db - the store document (mutate in place, call inside withDB)
 * @param {string} key - bucket key, e.g. `login:${ip}` or `submit-client:${ip}`
 * @param {{max: number, windowMs: number, lockoutMs: number}} opts
 * @returns {{allowed: true} | {allowed: false, retryAfterSeconds: number}}
 */
export function checkRateLimit(db, key, { max, windowMs, lockoutMs }) {
  if (!db.rateLimits || typeof db.rateLimits !== 'object') db.rateLimits = {};
  const now = Date.now();

  // Opportunistic cleanup, independent of this call's own window/lockout —
  // other keys in here may belong to differently-configured endpoints.
  for (const [k, bucket] of Object.entries(db.rateLimits)) {
    const lockedUntil = bucket.lockedUntil ? new Date(bucket.lockedUntil).getTime() : 0;
    if (lockedUntil > now) continue;
    const hits = bucket.hits || [];
    const newestHit = hits.length ? Math.max(...hits.map((t) => new Date(t).getTime())) : 0;
    if (now - newestHit > STALE_BUCKET_MS) delete db.rateLimits[k];
  }

  const bucket = db.rateLimits[key] || { hits: [], lockedUntil: null };

  if (bucket.lockedUntil) {
    const until = new Date(bucket.lockedUntil).getTime();
    if (until > now) return { allowed: false, retryAfterSeconds: Math.ceil((until - now) / 1000) };
  }

  bucket.hits = (bucket.hits || []).filter((t) => now - new Date(t).getTime() < windowMs);
  bucket.hits.push(new Date(now).toISOString());

  if (bucket.hits.length > max) {
    bucket.lockedUntil = new Date(now + lockoutMs).toISOString();
    bucket.hits = [];
    db.rateLimits[key] = bucket;
    return { allowed: false, retryAfterSeconds: Math.ceil(lockoutMs / 1000) };
  }

  db.rateLimits[key] = bucket;
  return { allowed: true };
}

/** Reset a bucket, e.g. on a successful login after prior failures. */
export function clearRateLimit(db, key) {
  if (!db.rateLimits) return;
  delete db.rateLimits[key];
}
