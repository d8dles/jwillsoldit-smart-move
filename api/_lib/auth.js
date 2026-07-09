import crypto from 'crypto';
import { newToken, newId, hashToken } from './ids.js';
import { readDB, writeDB } from './store.js';

const COOKIE_NAME = 'smadmin_session';
const SESSION_TTL_HOURS = 12;

// Login throttle: the admin password is a single shared secret, so throttle
// globally (not per-IP — forwarded-for headers are spoofable and there is
// exactly one legitimate user). After MAX_LOGIN_FAILURES wrong passwords
// within LOCKOUT_WINDOW_MS, all logins are refused for LOCKOUT_MS.
const MAX_LOGIN_FAILURES = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

// 2FA email codes: 6 digits, short-lived, few attempts.
const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;

function timingSafeEqualHex(aHex, bHex) {
  const a = Buffer.from(aHex, 'hex');
  const b = Buffer.from(bHex, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function parseCookies(req) {
  const header = req.headers?.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  });
  return out;
}

function isSecureRequest(req) {
  // Vercel terminates TLS upstream; the forwarded-proto header tells us the
  // client's actual scheme. Only skip Secure for plain local dev.
  const proto = req.headers?.['x-forwarded-proto'];
  return proto ? proto === 'https' : process.env.NODE_ENV === 'production';
}

export function setSessionCookie(req, res, rawToken) {
  const secure = isSecureRequest(req) ? '; Secure' : '';
  const maxAge = SESSION_TTL_HOURS * 60 * 60;
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(rawToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
  );
}

export function clearSessionCookie(req, res) {
  const secure = isSecureRequest(req) ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

export async function createAdminSession(req, res) {
  const raw = newToken();
  const hash = hashToken(raw);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString();

  const db = await readDB();
  // Opportunistically drop expired sessions so this object doesn't grow forever.
  for (const [key, session] of Object.entries(db.adminSessions)) {
    if (new Date(session.expiresAt).getTime() < Date.now()) delete db.adminSessions[key];
  }
  db.adminSessions[hash] = { createdAt: now.toISOString(), expiresAt };
  await writeDB(db);

  setSessionCookie(req, res, raw);
}

export async function destroyAdminSession(req, res) {
  const cookies = parseCookies(req);
  const raw = cookies[COOKIE_NAME];
  if (raw) {
    const hash = hashToken(raw);
    const db = await readDB();
    delete db.adminSessions[hash];
    await writeDB(db);
  }
  clearSessionCookie(req, res);
}

export async function isAdminAuthenticated(req) {
  const cookies = parseCookies(req);
  const raw = cookies[COOKIE_NAME];
  if (!raw) return false;
  const hash = hashToken(raw);
  const db = await readDB();
  const session = db.adminSessions[hash];
  if (!session) return false;
  if (new Date(session.expiresAt).getTime() < Date.now()) return false;
  return true;
}

// Call at the top of every /api/admin/* handler (after CORS/method checks).
// Writes a 401 JSON response and returns false if the caller should stop.
export async function requireAdmin(req, res) {
  const ok = await isAdminAuthenticated(req);
  if (!ok) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return false;
  }
  return true;
}

export function checkPassword(candidate) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  // Compare hashes with timingSafeEqual so response time doesn't leak how
  // much of the password matched.
  return timingSafeEqualHex(hashToken(String(candidate || '')), hashToken(expected));
}

// ── Login throttle ─────────────────────────────────────────
// All three helpers mutate the db object in place; call inside withDB.

export function isLoginLocked(db) {
  const throttle = db.loginThrottle;
  if (!throttle?.lockedUntil) return { locked: false };
  const until = new Date(throttle.lockedUntil).getTime();
  if (until <= Date.now()) return { locked: false };
  return { locked: true, retryAfterSeconds: Math.ceil((until - Date.now()) / 1000) };
}

export function recordLoginFailure(db) {
  if (!db.loginThrottle) db.loginThrottle = { failures: [], lockedUntil: null };
  const now = Date.now();
  db.loginThrottle.failures = (db.loginThrottle.failures || [])
    .filter((t) => now - new Date(t).getTime() < LOCKOUT_WINDOW_MS);
  db.loginThrottle.failures.push(new Date(now).toISOString());
  if (db.loginThrottle.failures.length >= MAX_LOGIN_FAILURES) {
    db.loginThrottle.lockedUntil = new Date(now + LOCKOUT_MS).toISOString();
    db.loginThrottle.failures = [];
  }
}

export function clearLoginFailures(db) {
  db.loginThrottle = { failures: [], lockedUntil: null };
}

// ── 2FA email-code challenges ──────────────────────────────
// 2FA is enabled by setting ADMIN_2FA_EMAIL. When enabled, a correct
// password only earns a challenge: a 6-digit code is emailed to that
// address, and the session cookie is issued by /api/admin/verify-2fa.
// Only the code's hash is stored. Helpers mutate db in place (use withDB).

export function is2faEnabled() {
  return !!process.env.ADMIN_2FA_EMAIL;
}

export function createLoginChallenge(db) {
  if (!db.loginChallenges) db.loginChallenges = {};
  // Drop expired challenges so the object doesn't grow forever.
  for (const [key, challenge] of Object.entries(db.loginChallenges)) {
    if (new Date(challenge.expiresAt).getTime() < Date.now()) delete db.loginChallenges[key];
  }
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const id = newId('chal');
  db.loginChallenges[id] = {
    codeHash: hashToken(code),
    expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
    attempts: 0,
  };
  return { id, code };
}

export function verifyLoginChallenge(db, challengeId, code) {
  const challenge = db.loginChallenges?.[challengeId];
  if (!challenge) return { ok: false, reason: 'invalid', restart: true };
  if (new Date(challenge.expiresAt).getTime() < Date.now()) {
    delete db.loginChallenges[challengeId];
    return { ok: false, reason: 'expired', restart: true };
  }
  challenge.attempts += 1;
  if (challenge.attempts > MAX_CODE_ATTEMPTS) {
    delete db.loginChallenges[challengeId];
    return { ok: false, reason: 'too_many_attempts', restart: true };
  }
  if (!timingSafeEqualHex(hashToken(String(code || '').trim()), challenge.codeHash)) {
    return { ok: false, reason: 'wrong_code', restart: false };
  }
  delete db.loginChallenges[challengeId];
  return { ok: true };
}
