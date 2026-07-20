import { applyCors, handlePreflight, parseJsonBody } from '../http.js';
import { requireAdmin } from '../auth.js';
import { withDB, getRecord } from '../store.js';
import { ensureCdas, newCda, toCdaSummary, buildCdaDraft } from '../cda.js';
import { logEvent, AUDIT_EVENTS } from '../audit.js';

export default async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (!(await requireAdmin(req, res))) return;

  if (req.method === 'GET') {
    const result = await withDB((db) => {
      return Object.values(ensureCdas(db))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(toCdaSummary);
    });
    return res.status(200).json({ success: true, cdas: result });
  }

  if (req.method === 'POST') {
    const body = parseJsonBody(req);
    if (body == null) return res.status(400).json({ success: false, error: 'Invalid JSON' });

    const sourceInvoiceId = body.sourceInvoiceId ? String(body.sourceInvoiceId) : null;

    const result = await withDB((db) => {
      let draft = {};
      if (sourceInvoiceId) {
        const invoice = getRecord(db.invoices, sourceInvoiceId);
        if (!invoice) return { error: 'invoice_not_found' };
        draft = buildCdaDraft(invoice);
      }

      const clientName = String(body.clientName || draft.clientName || '').trim();
      const propertyAddress = String(body.propertyAddress || draft.propertyAddress || '').trim();
      if (!clientName || !propertyAddress) {
        return { error: 'missing_fields' };
      }

      const cda = newCda({
        ...draft,
        clientName,
        propertyAddress,
        unitNumber: body.unitNumber ?? draft.unitNumber,
        community: body.community ?? draft.community,
        closingDate: body.closingDate,
        transactionValue: body.transactionValue ?? draft.transactionValue,
        totalCommission: body.totalCommission ?? draft.totalCommission,
        commissionBasis: body.commissionBasis ?? draft.commissionBasis,
        payeeName: body.payeeName ?? draft.payeeName,
        payeeCompany: body.payeeCompany ?? draft.payeeCompany,
        payeeEmail: body.payeeEmail,
        payeeAmount: body.payeeAmount ?? draft.payeeAmount,
        notes: body.notes ?? draft.notes,
      });
      logEvent(cda, AUDIT_EVENTS.CREATED, {
        actor: 'admin',
        detail: sourceInvoiceId ? `CDA file created, prefilled from invoice ${sourceInvoiceId}` : 'CDA file created',
      });
      ensureCdas(db)[cda.id] = cda;
      return { cda };
    });

    if (result.error === 'invoice_not_found') {
      return res.status(400).json({ success: false, error: 'Source invoice not found' });
    }
    if (result.error === 'missing_fields') {
      return res.status(400).json({ success: false, error: 'clientName and propertyAddress are required' });
    }

    return res.status(201).json({ success: true, cda: toCdaSummary(result.cda) });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
