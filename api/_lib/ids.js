import crypto from 'crypto';

// Opaque record ids — not secrets, just need to be unique and URL-safe.
export function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(9).toString('base64url')}`;
}

// Unguessable link tokens. 256 bits of entropy, base64url so it's URL-safe
// with no padding. Only ever stored as a SHA-256 hash — see tokens.js.
export function newToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}
