import { applyCors, handlePreflight, parseJsonBody } from '../http.js';
import { requireAdmin } from '../auth.js';
import { withDB } from '../store.js';
import { newId } from '../ids.js';
import { logEvent } from '../audit.js';
import { validateUploadDataUrl, UPLOAD_REJECTED_MESSAGE } from '../uploads.js';

const MAX_EVIDENCE_BYTES = 3 * 1024 * 1024;

export default async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { id } = req.query;
  const body = parseJsonBody(req);
  if (body == null) return res.status(400).json({ success: false, error: 'Invalid JSON' });

  const file = body.file || {};
  const name = String(file.name || '').trim();
  const dataUrl = String(file.dataUrl || '');
  const type = String(file.type || 'application/octet-stream');
  const size = Number(file.size || 0);
  const label = String(body.label || '').trim();

  if (!name || !dataUrl.startsWith('data:')) {
    return res.status(400).json({ success: false, error: 'A valid file is required' });
  }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_EVIDENCE_BYTES) {
    return res.status(400).json({ success: false, error: 'Evidence file must be 3MB or smaller' });
  }
  // NOTE: the size gate above checks the client-reported `size` field, not
  // dataUrl.length — a spoofed `size` doesn't bound what reaches this regex.
  // The regex itself is linear (anchored, no nested quantifiers, no
  // backtracking blowup), so that's a request-size/cost concern, not a
  // ReDoS one, and this handler is admin-only. Left as-is; the size-field
  // mismatch is a separate, already-tracked fix.
  // `startsWith('data:')` alone lets `data:text/html,...` through, which is
  // exactly what this rejects — see uploads.js.
  if (!validateUploadDataUrl(dataUrl).ok) {
    return res.status(400).json({ success: false, error: UPLOAD_REJECTED_MESSAGE });
  }

  const evidence = {
    id: newId('evd'),
    name,
    type,
    size,
    dataUrl,
    label,
    uploadedAt: new Date().toISOString(),
  };

  const result = await withDB((db) => {
    const v = db.verifications[id];
    if (!v) return null;
    if (!Array.isArray(v.evidence)) v.evidence = [];
    v.evidence.push(evidence);
    v.updatedAt = evidence.uploadedAt;
    logEvent(v, 'evidence_uploaded', {
      actor: 'admin',
      detail: `${label || 'Evidence'} uploaded: ${name}`,
    });
    return v;
  });

  if (!result) return res.status(404).json({ success: false, error: 'Not found' });
  return res.status(200).json({ success: true, evidence });
}
