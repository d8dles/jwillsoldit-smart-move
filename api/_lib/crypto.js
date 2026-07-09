// crypto.js — reversible encryption for link tokens at rest.
//
// Tokens are looked up by SHA-256 hash (see tokens.js), so the DB never
// needs to decrypt anything to validate an incoming request. Encryption
// exists solely so the admin can re-open a verification file later and see
// ("copy link") a token it already issued, without regenerating it (which
// would invalidate a link already texted/emailed to a tenant or PM).
//
// The key is derived from TOKEN_ENCRYPTION_KEY if set, otherwise from
// ADMIN_PASSWORD — either way it lives only in env vars, never in the DB,
// so a DB dump alone doesn't yield usable links.

import crypto from 'crypto';

function getKey() {
  const secret =
    process.env.TOKEN_ENCRYPTION_KEY ||
    process.env.ADMIN_PASSWORD ||
    'smart-move-verification-fallback-key-set-TOKEN_ENCRYPTION_KEY';
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
