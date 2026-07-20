import { applyCors, handlePreflight, parseJsonBody } from '../http.js';
import { requireAdmin } from '../auth.js';
import { withDB, getRecord } from '../store.js';
import { logEvent, AUDIT_EVENTS } from '../audit.js';

// Archiving is a reversible hide — invoices are financial records, so they
// are never hard-deleted once approved (see invoice-delete.js, which only
// allows removing drafts). POST body { archived: false } restores it.
export default async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { id } = req.query;
  const body = parseJsonBody(req) || {};
  const archived = body.archived !== false;

  const result = await withDB((db) => {
    const invoice = getRecord(db.invoices, id);
    if (!invoice) return { error: 'not_found' };

    invoice.archived = archived;
    invoice.archivedAt = archived ? new Date().toISOString() : null;

    const verification = getRecord(db.verifications, invoice.verificationId);
    if (verification) {
      logEvent(verification, AUDIT_EVENTS.INVOICE_ARCHIVED, {
        actor: 'admin',
        detail: `Invoice ${invoice.fields.invoiceNumber} ${archived ? 'archived' : 'restored from archive'}`,
      });
      verification.updatedAt = new Date().toISOString();
    }

    return { invoice };
  });

  if (result.error === 'not_found') return res.status(404).json({ success: false, error: 'Not found' });
  return res.status(200).json({ success: true, invoice: result.invoice });
}
