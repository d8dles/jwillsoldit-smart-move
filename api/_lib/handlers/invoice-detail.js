import { applyCors, handlePreflight, parseJsonBody } from '../http.js';
import { requireAdmin } from '../auth.js';
import { withDB, readDB } from '../store.js';

export default async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (!(await requireAdmin(req, res))) return;

  const { id } = req.query;

  if (req.method === 'GET') {
    const db = await readDB();
    const invoice = db.invoices[id];
    if (!invoice) return res.status(404).json({ success: false, error: 'Not found' });
    const verification = db.verifications[invoice.verificationId] || null;
    const detectedEmail = verification
      ? verification.pmSubmission?.pmEmail || verification.clientSubmission?.pmEmail || null
      : null;
    return res.status(200).json({
      success: true,
      invoice,
      verification: verification
        ? {
            id: verification.id,
            clientName: verification.clientName,
            propertyName: verification.propertyName,
            auditLog: verification.auditLog,
            detectedEmail,
          }
        : null,
    });
  }

  if (req.method === 'PATCH') {
    const body = parseJsonBody(req);
    if (body == null) return res.status(400).json({ success: false, error: 'Invalid JSON' });
    const patch = body.fields && typeof body.fields === 'object' ? body.fields : null;
    if (!patch) return res.status(400).json({ success: false, error: 'fields object is required' });

    const result = await withDB((db) => {
      const invoice = db.invoices[id];
      if (!invoice) return null;
      if (invoice.status !== 'draft') return { locked: true, invoice };
      for (const [key, value] of Object.entries(patch)) {
        if (Object.prototype.hasOwnProperty.call(invoice.fields, key)) {
          invoice.fields[key] = String(value ?? '');
        }
      }
      return { invoice };
    });

    if (!result) return res.status(404).json({ success: false, error: 'Not found' });
    if (result.locked) {
      return res.status(409).json({ success: false, error: 'Invoice is no longer a draft and cannot be edited', invoice: result.invoice });
    }
    return res.status(200).json({ success: true, invoice: result.invoice });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
