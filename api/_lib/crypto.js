// crypto.js — reversible encryption for link tokens at rest.
//
// Tokens are looked up by SHA-256 hash (see tokens.js), so the DB never
// needs to decrypt anything to validate an incoming request. Encryption
// exists solely so the admin can re-open a verification file later and see
// ("copy link") a token it already issued, without regenerating it (which
// would invalidate a link already texted/emailed to a tenant or PM).
//
// TOKEN_ENCRYPTION_KEY is preferred. ADMIN_PASSWORD remains a compatibility
// fallback so existing links do not break during rollout, but there is no
// public/default key: production must have at least one server-side secret.

import crypto from 'crypto';

let warnedPasswordFallback = false;

function getKey() {
  const dedicated = process.env.TOKEN_ENCRYPTION_KEY;
  const fallback = process.env.ADMIN_PASSWORD;
  const secret = dedicated || fallback;

  if (!secret) {
    throw new Error('TOKEN_ENCRYPTION_KEY or ADMIN_PASSWORD must be configured');
  }
  if (!dedicated && !warnedPasswordFallback) {
    warnedPasswordFallback = true;
    console.warn('[crypto] TOKEN_ENCRYPTION_KEY is not set; using ADMIN_PASSWORD for compatibility. Configure a dedicated key before rotating the admin password.');
  }

  return crypto.scryptSync(secret, 'smart-move-verification-salt-v1', 32);
}

export function encryptToken(raw) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(raw, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptToken(packed) {
  try {
    const buf = Buffer.from(packed, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
