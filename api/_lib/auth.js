import { newToken, hashToken } from './ids.js';
import { readDB, writeDB } from './store.js';

const COOKIE_NAME = 'smadmin_session';
const SESSION_TTL_HOURS = 12;

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
  return String(candidate || '') === expected;
}
