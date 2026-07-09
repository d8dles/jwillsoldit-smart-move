import { applyCors, handlePreflight } from '../../../_lib/http.js';
import { requireAdmin } from '../../../_lib/auth.js';
import { withDB } from '../../../_lib/store.js';
import { newId } from '../../../_lib/ids.js';
import { buildInvoiceDraft, nextInvoiceNumber } from '../../../_lib/invoice.js';
import { logEvent, AUDIT_EVENTS } from '../../../_lib/audit.js';
import { deriveStatus } from '../../../_lib/verification.js';

export default async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { id } = req.query;

  const result = await withDB((db) => {
    const v = db.verifications[id];
    if (!v) return { error: 'not_found' };

    // Reuse the existing invoice record if one was already prepared for this
    // file, rather than minting a new invoice number every time the admin
    // revisits the page.
    if (v.invoiceId && db.invoices[v.invoiceId]) {
      return { invoice: db.invoices[v.invoiceId], verification: v };
    }

    const invoiceNumber = nextInvoiceNumber(db);
    const fields = buildInvoiceDraft(v, invoiceNumber);
    const invoice = {
      id: newId('inv'),
      verificationId: v.id,
      status: 'draft', // draft -> approved -> sent -> paid
      fields,
      createdAt: new Date().toISOString(),
      approvedAt: null,
      sentAt: null,
      paidAt: null,
    };
    db.invoices[invoice.id] = invoice;
    v.invoiceId = invoice.id;
    v.updatedAt = invoice.createdAt;
    logEvent(v, AUDIT_EVENTS.INVOICE_GENERATED, {
      actor: 'admin',
      detail: `Invoice ${invoiceNumber} prepared (draft)`,
    });

    return { invoice, verification: v };
  });

  if (result.error === 'not_found') return res.status(404).json({ success: false, error: 'Not found' });

  return res.status(200).json({
    success: true,
    invoice: result.invoice,
    verification: { ...result.verification, status: deriveStatus(result.verification) },
  });
}
