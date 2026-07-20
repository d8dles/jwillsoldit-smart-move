// http.js — shared CORS/method plumbing for the verification module's API
// routes. Mirrors the pattern already used in api/smart-move.js.

export function applyCors(req, res) {
  const fallbackOrigin = process.env.ALLOWED_ORIGIN || 'https://move.jwillsoldit.com';
  const publicOrigins = String(process.env.PUBLIC_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const requestOrigin = req.headers?.origin;
  const allowedOrigin = requestOrigin && [fallbackOrigin, ...publicOrigins].includes(requestOrigin)
    ? requestOrigin
    : fallbackOrigin;
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
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
