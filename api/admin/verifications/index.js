import { applyCors, handlePreflight, parseJsonBody } from '../../_lib/http.js';
import { requireAdmin } from '../../_lib/auth.js';
import { withDB } from '../../_lib/store.js';
import { newVerification, toListSummary, deriveStatus } from '../../_lib/verification.js';
import { logEvent, AUDIT_EVENTS } from '../../_lib/audit.js';

export default async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (!(await requireAdmin(req, res))) return;

  if (req.method === 'GET') {
    const result = await withDB((db) => {
      const list = Object.values(db.verifications)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(toListSummary);
      return list;
    });
    return res.status(200).json({ success: true, verifications: result });
  }

  if (req.method === 'POST') {
    const body = parseJsonBody(req);
    if (body == null) return res.status(400).json({ success: false, error: 'Invalid JSON' });

    const clientName = String(body.clientName || '').trim();
    const propertyName = String(body.propertyName || '').trim();
    if (!clientName) {
      return res.status(400).json({ success: false, error: 'clientName is required' });
    }

    const verification = newVerification({
      clientName,
      propertyName,
      propertyAddress: body.propertyAddress,
      unitNumber: body.unitNumber,
      notes: body.notes,
    });
    logEvent(verification, AUDIT_EVENTS.CREATED, { actor: 'admin', detail: 'Verification file created' });

    await withDB((db) => {
      db.verifications[verification.id] = verification;
    });

    return res.status(201).json({
      success: true,
      verification: { ...toListSummary(verification), status: deriveStatus(verification) },
    });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
