import { applyCors, handlePreflight } from '../http.js';
import { requireAdmin } from '../auth.js';
import { withDB, getRecord } from '../store.js';
import { ensureCdas, deriveCdaStatus } from '../cda.js';
import { logEvent, AUDIT_EVENTS } from '../audit.js';

export default async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { id } = req.query;

  const result = await withDB((db) => {
    const c = getRecord(ensureCdas(db), id);
    if (!c) return { error: 'not_found' };
    if (c.approved) return { error: 'bad_state', cda: c };

    c.approved = true;
    c.approvedAt = new Date().toISOString();
    c.updatedAt = c.approvedAt;
    logEvent(c, AUDIT_EVENTS.APPROVED, { actor: 'admin', detail: 'CDA approved by Joey' });
    return { cda: c };
  });

  if (result.error === 'not_found') return res.status(404).json({ success: false, error: 'Not found' });
  if (result.error === 'bad_state') {
    return res.status(409).json({ success: false, error: 'CDA is already approved' });
  }
  return res.status(200).json({
    success: true,
    cda: { ...result.cda, status: deriveCdaStatus(result.cda) },
  });
}
