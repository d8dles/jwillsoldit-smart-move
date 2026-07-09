import { applyCors, handlePreflight } from '../../../_lib/http.js';
import { requireAdmin } from '../../../_lib/auth.js';
import { withDB } from '../../../_lib/store.js';
import { logEvent, AUDIT_EVENTS } from '../../../_lib/audit.js';

export default async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { id } = req.query;

  const result = await withDB((db) => {
    const invoice = db.invoices[id];
    if (!invoice) return { error: 'not_found' };
    if (invoice.status !== 'draft') return { error: 'bad_state', invoice };

    invoice.status = 'approved';
    invoice.approvedAt = new Date().toISOString();

    const verification = db.verifications[invoice.verificationId];
    if (verification) {
      logEvent(verification, AUDIT_EVENTS.INVOICE_GENERATED, {
        actor: 'admin',
        detail: `Invoice ${invoice.fields.invoiceNumber} approved by Joey — ready to send`,
      });
      verification.updatedAt = invoice.approvedAt;
    }
    return { invoice };
  });

  if (result.error === 'not_found') return res.status(404).json({ success: false, error: 'Not found' });
  if (result.error === 'bad_state') {
    return res.status(409).json({ success: false, error: `Invoice must be in draft to approve (currently ${result.invoice.status})` });
  }
  return res.status(200).json({ success: true, invoice: result.invoice });
}
