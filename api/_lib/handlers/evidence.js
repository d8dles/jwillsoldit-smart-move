import { applyCors, handlePreflight, parseJsonBody } from '../http.js';
import { requireAdmin } from '../auth.js';
import { withDB } from '../store.js';
import { newId } from '../ids.js';
import { logEvent } from '../audit.js';

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
