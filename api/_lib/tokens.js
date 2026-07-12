import { newToken, hashToken } from './ids.js';
import { encryptToken } from './crypto.js';

const DEFAULT_TTL_DAYS = 21;

// Builds a fresh token record for a verification's client/pm link. The raw
// token is returned once (to embed in the URL); at rest we keep a SHA-256
// hash (used to validate incoming tokens) plus an encrypted copy (used only
// so the admin can re-display an already-issued link — see crypto.js).
export function makeLinkRecord(ttlDays = DEFAULT_TTL_DAYS) {
  const raw = newToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
  return {
    raw,
    record: {
      tokenHash: hashToken(raw),
      encryptedToken: encryptToken(raw),
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      revoked: false,
      viewCount: 0,
      lastViewedAt: null,
    },
  };
}

export function isLinkValid(linkRecord) {
  if (!linkRecord || !linkRecord.tokenHash) return false;
  if (linkRecord.revoked) return false;
  if (new Date(linkRecord.expiresAt).getTime() < Date.now()) return false;
  return true;
}

// Finds the verification whose client or pm token hash matches `token`.
// Returns { verification, role } or null. O(n) over verifications, which is
// fine at this module's scale (a solo agent's rental files).
export function findByToken(db, token, role) {
  const hash = hashToken(token);
  const field = role === 'client' ? 'clientLink' : 'pmLink';
  for (const verification of Object.values(db.verifications)) {
    const link = verification[field];
    if (link && link.tokenHash === hash) {
      return { verification, link };
    }
  }
  return null;
}

// Same idea for listing-intake links. Separate function (not a new param on
// findByToken) so existing verification flows keep their exact behavior.
export function findListingByToken(db, token) {
  const hash = hashToken(token);
  for (const listing of Object.values(db.listings || {})) {
    const link = listing.clientLink;
    if (link && link.tokenHash === hash) {
      return { listing, link };
    }
  }
  return null;
}
