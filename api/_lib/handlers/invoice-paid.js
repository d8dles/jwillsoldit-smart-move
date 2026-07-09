import { applyCors, handlePreflight } from '../http.js';
import { requireAdmin } from '../auth.js';
import { withDB } from '../store.js';
import { logEvent, AUDIT_EVENTS } from '../audit.js';

export default async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { id } = req.query;

  const result = await withDB((db) => {
    const invoice = db.invoices[id];
    if (!invoice) return { error: 'not_found' };
    if (invoice.status !== 'sent') return { error: 'bad_state', invoice };

    invoice.status = 'paid';
    invoice.paidAt = new Date().toISOString();

    const verification = db.verifications[invoice.verificationId];
    if (verification) {
      logEvent(verification, AUDIT_EVENTS.PAID, {
        actor: 'admin',
        detail: `Invoice ${invoice.fields.invoiceNumber} marked paid`,
      });
      verification.updatedAt = invoice.paidAt;
    }
    return { invoice };
  });

  if (result.error === 'not_found') return res.status(404).json({ success: false, error: 'Not found' });
  if (result.error === 'bad_state') {
    return res.status(409).json({ success: false, error: `Invoice must be sent before marking paid (currently ${result.invoice.status})` });
  }
  return res.status(200).json({ success: true, invoice: result.invoice });
}
