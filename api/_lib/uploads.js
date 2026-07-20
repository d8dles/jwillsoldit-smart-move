// Uploads arrive as `data:` URLs from public, token-authenticated forms and are
// later rendered into `href` attributes on the admin pages. An unconstrained
// string in that position is a script-injection vector, so the value is pinned
// to a strict shape at the door rather than cleaned up later: an allow-listed
// binary MIME type, base64 transfer encoding, and nothing outside the base64
// alphabet. Anything else is rejected — there is no legitimate client upload
// this excludes, and a `data:text/html,...` payload is exactly what it stops.
//
// A browser file picker cannot produce a non-conforming value, but these
// endpoints are reachable by anyone holding a form token, so the check has to
// live on the server, not in `public-form-common.js`.

export const ALLOWED_UPLOAD_MIME = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
];

// Anchored, single-pass, no nested quantifiers — safe to run on a multi-MB
// string. Callers must still length-check before calling (see below).
const DATA_URL_RE = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/;

/**
 * Validate an upload `data:` URL.
 *
 * Returns `{ ok: true, mime }` when the value is safe to store, or
 * `{ ok: false, reason }` where reason is 'empty' | 'malformed' | 'mime'.
 * Length is the caller's responsibility and must be checked FIRST — running
 * any regex over an unbounded attacker-supplied string is its own problem.
 */
export function validateUploadDataUrl(value) {
  const dataUrl = String(value ?? '');
  if (!dataUrl) return { ok: false, reason: 'empty' };

  const match = DATA_URL_RE.exec(dataUrl);
  if (!match) return { ok: false, reason: 'malformed' };

  const mime = match[1].toLowerCase();
  if (!ALLOWED_UPLOAD_MIME.includes(mime)) return { ok: false, reason: 'mime' };

  return { ok: true, mime };
}

// One wording for every rejection: a caller who fails the MIME check and one
// who sends a crafted string get the same message, so the response never
// doubles as a probe for what the filter accepts.
export const UPLOAD_REJECTED_MESSAGE =
  'That file could not be accepted. Please upload a PDF or an image (PNG, JPEG, GIF, WEBP, HEIC).';
