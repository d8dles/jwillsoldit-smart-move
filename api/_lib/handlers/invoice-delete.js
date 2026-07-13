import { applyCors, handlePreflight } from '../http.js';
import { requireAdmin } from '../auth.js';
import { withDB } from '../store.js';
import { logEvent, AUDIT_EVENTS } from '../audit.js';

// Only drafts can be hard-deleted (a mistaken/duplicate invoice before it
// ever left the building). Anything approved, sent, or paid is a financial
// record — archive it instead (invoice-archive.js), never delete it.
export default async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { id } = req.query;

  const result = await withDB((db) => {
    const invoice = db.invoices[id];
    if (!invoice) return { error: 'not_found' };
    if (invoice.status !== 'draft') return { error: 'not_draft', status: invoice.status };

    const verification = db.verifications[invoice.verificationId];
    if (verification) {
      if (verification.invoiceId === id) verification.invoiceId = null;
      logEvent(verification, AUDIT_EVENTS.INVOICE_DELETED, {
        actor: 'admin',
        detail: `Draft invoice ${invoice.fields.invoiceNumber} deleted`,
      });
      verification.updatedAt = new Date().toISOString();
    }

    delete db.invoices[id];
    return { ok: true };
  });

  if (result.error === 'not_found') return res.status(404).json({ success: false, error: 'Not found' });
  if (result.error === 'not_draft') {
    return res.status(409).json({ success: false, error: `Only draft invoices can be deleted (currently ${result.status}) — archive it instead` });
  }
  return res.status(200).json({ success: true });
}
