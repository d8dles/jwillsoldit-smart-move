import { applyCors, handlePreflight, parseJsonBody } from '../http.js';
import { requireAdmin } from '../auth.js';
import { withDB, getRecord } from '../store.js';
import { logEvent, AUDIT_EVENTS } from '../audit.js';
import { deriveStatus } from '../verification.js';

export default async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { id } = req.query;
  const body = parseJsonBody(req) || {};
  const note = String(body.note || '').trim();

  const result = await withDB((db) => {
    const v = getRecord(db.verifications, id);
    if (!v) return null;
    v.manuallyVerified = true;
    v.manuallyVerifiedAt = new Date().toISOString();
    v.manuallyVerifiedBy = 'Joey Williams';
    v.updatedAt = v.manuallyVerifiedAt;
    logEvent(v, AUDIT_EVENTS.MANUALLY_VERIFIED, {
      actor: 'admin',
      detail: note || 'Marked manually verified',
    });
    return v;
  });

  if (!result) return res.status(404).json({ success: false, error: 'Not found' });
  return res.status(200).json({ success: true, verification: { ...result, status: deriveStatus(result) } });
}
