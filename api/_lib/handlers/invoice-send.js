// send.js — the ONLY place this module ever emails an invoice, and only when
// Joey explicitly clicks "Send" on an already-approved invoice (never
// automatic). Reuses the same Resend integration already approved for Smart
// Move lead alerts (RESEND_API_KEY / LEAD_ALERT_FROM). If those aren't
// configured, or there's no recipient email, the invoice is still marked
// "sent" (Joey sent it himself another way) — email is a convenience, not a
// requirement. The recipient can be overridden from the admin UI; it's
// prefilled from whatever the property manager submitted, but is not final
// until Joey confirms/edits it.

import { applyCors, handlePreflight, escapeHtml, parseJsonBody } from '../http.js';
import { requireAdmin } from '../auth.js';
import { readDB, writeDB } from '../store.js';
import { logEvent, AUDIT_EVENTS } from '../audit.js';
import { INVOICE_FIELD_LABELS } from '../invoice.js';
import { renderInvoicePdf } from '../pdf.js';

function isValidEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

async function tryEmailInvoice(invoice, recipient) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.LEAD_ALERT_FROM;
  if (!apiKey || !from || !recipient) return { sent: false, reason: 'not_configured_or_no_recipient' };

  const rows = Object.entries(invoice.fields)
    .map(([key, value]) => {
      const label = INVOICE_FIELD_LABELS[key] || key;
      return `<tr><td style="font-weight:bold;padding:4px 16px 4px 0;">${escapeHtml(label)}</td><td style="padding:4px 0;">${escapeHtml(value) || '&mdash;'}</td></tr>`;
    })
    .join('');

  const html = `
<h2 style="font-family:sans-serif;">Locator Placement Invoice ${escapeHtml(invoice.fields.invoiceNumber)}</h2>
<p style="font-family:sans-serif;font-size:14px;">The invoice is attached as a PDF. A summary of the fields is below.</p>
<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:14px;">${rows}</table>
`.trim();

  const text = Object.entries(invoice.fields)
    .map(([key, value]) => `${INVOICE_FIELD_LABELS[key] || key}: ${value || '—'}`)
    .join('\n');

  let attachments;
  try {
    const pdfBuffer = await renderInvoicePdf(invoice.fields);
    attachments = [{
      filename: `${invoice.fields.invoiceNumber || invoice.id}.pdf`,
      content: pdfBuffer.toString('base64'),
    }];
  } catch (err) {
    console.warn('[invoice/send] Could not generate PDF attachment, sending without it:', err.message);
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject: `Locator Placement Invoice ${invoice.fields.invoiceNumber} — ${invoice.fields.client}`,
      html,
      text,
      ...(attachments ? { attachments } : {}),
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.warn('[invoice/send] Resend delivery failed:', res.status, errBody);
    return { sent: false, reason: 'delivery_failed' };
  }
  return { sent: true };
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { id } = req.query;
  const body = parseJsonBody(req) || {};
  const overrideEmail = isValidEmail(body.email) ? body.email.trim() : null;

  const db = await readDB();
  const invoice = db.invoices[id];
  if (!invoice) return res.status(404).json({ success: false, error: 'Not found' });
  if (invoice.status !== 'approved') {
    return res.status(409).json({ success: false, error: `Invoice must be approved before sending (currently ${invoice.status})` });
  }

  const verification = db.verifications[invoice.verificationId];
  const detectedRecipient =
    verification?.pmSubmission?.pmEmail ||
    verification?.clientSubmission?.pmEmail ||
    null;
  const recipient = overrideEmail || detectedRecipient;

  const emailResult = await tryEmailInvoice(invoice, recipient);

  invoice.status = 'sent';
  invoice.sentAt = new Date().toISOString();
  invoice.sentTo = emailResult.sent ? recipient : (invoice.sentTo || null);
  if (verification) {
    logEvent(verification, AUDIT_EVENTS.INVOICE_SENT, {
      actor: 'admin',
      detail: emailResult.sent
        ? `Invoice ${invoice.fields.invoiceNumber} emailed to ${recipient} (with PDF attached)`
        : `Invoice ${invoice.fields.invoiceNumber} marked sent (manual delivery — no email sent)`,
    });
    verification.updatedAt = invoice.sentAt;
  }

  await writeDB(db);

  return res.status(200).json({ success: true, invoice, emailed: !!emailResult.sent, recipient: emailResult.sent ? recipient : null });
}
