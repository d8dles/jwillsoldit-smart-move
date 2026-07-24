// http.js — shared CORS, origin, CSRF, and request parsing helpers.

import crypto from 'crypto';

export const ADMIN_CSRF_COOKIE = 'smadmin_csrf';

function configuredOrigins() {
  const primary = process.env.ALLOWED_ORIGIN || 'https://move.jwillsoldit.com';
  const extras = String(process.env.PUBLIC_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return [...new Set([primary, ...extras])];
}

function parseCookies(req) {
  const header = req.headers?.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) return;
    try { out[key] = decodeURIComponent(value); } catch { out[key] = value; }
  });
  return out;
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (!left.length || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function applyCors(req, res) {
  const origins = configuredOrigins();
  const requestOrigin = req.headers?.origin;

  // Only echo an origin that is explicitly allow-listed. For same-origin
  // requests without an Origin header, use the primary production origin.
  if (requestOrigin && origins.includes(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
  } else if (!requestOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origins[0]);
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
  res.setHeader('Vary', 'Origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
}

// Returns true if the request was fully handled (OPTIONS preflight) and the
// caller should stop.
export function handlePreflight(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

export function isTrustedOrigin(req) {
  const origins = configuredOrigins();
  const origin = req.headers?.origin;
  if (origin) return origins.includes(origin);

  // Some navigation/form clients omit Origin. Accept only an allow-listed
  // Referer in that case; requests with neither header fail closed.
  const referer = req.headers?.referer;
  if (!referer) return false;
  try {
    return origins.includes(new URL(referer).origin);
  } catch {
    return false;
  }
}

export function requireTrustedOrigin(req, res) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
  if (isTrustedOrigin(req)) return true;
  res.status(403).json({ success: false, error: 'Request origin is not allowed' });
  return false;
}

export function requireAdminCsrf(req, res) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
  if (!requireTrustedOrigin(req, res)) return false;

  const cookies = parseCookies(req);
  const cookieToken = cookies[ADMIN_CSRF_COOKIE];
  const headerToken = req.headers?.['x-csrf-token'];
  if (safeEqual(cookieToken, headerToken)) return true;

  res.status(403).json({ success: false, error: 'Security token is missing or invalid. Please sign in again.' });
  return false;
}

// Best-effort client IP, for rate-limiting only — never for anything
// security-load-bearing on its own (that's what auth.js sessions are for).
// On Vercel, the platform terminates the connection at its edge and sets
// x-forwarded-for / x-real-ip itself from the true socket address; a client
// cannot inject its own value into either header from outside Vercel's edge.
// Locally (`vercel dev`, bare `node`), neither header is present, so every
// request falls into the same 'local' bucket — fine for dev, never hit in
// production traffic.
export function getClientIp(req) {
  const real = req.headers?.['x-real-ip'];
  if (typeof real === 'string' && real) return real;
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
  return 'local';
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function parseJsonBody(req) {
  if (req.body == null) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}');
    } catch {
      return null;
    }
  }
  return req.body;
}
