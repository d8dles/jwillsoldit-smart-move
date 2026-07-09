// send.js — the ONLY place this module ever emails an invoice, and only when
// Joey explicitly clicks "Send" on an already-approved invoice (never
// automatic). Reuses the same Resend integration already approved for Smart
// Move lead alerts (RESEND_API_KEY / LEAD_ALERT_FROM). If those aren't
// configured, or the invoice has no recipient email on file, the invoice is
// still marked "sent" (Joey sent it himself another way) — email is a
// convenience, not a requirement.

import { applyCors, handlePreflight, escapeHtml } from '../http.js';
import { requireAdmin } from '../auth.js';
import { readDB, writeDB } from '../store.js';
import { logEvent, AUDIT_EVENTS } from '../audit.js';
import { INVOICE_FIELD_LABELS } from '../invoice.js';

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
<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:14px;">${rows}</table>
`.trim();

  const text = Object.entries(invoice.fields)
    .map(([key, value]) => `${INVOICE_FIELD_LABELS[key] || key}: ${value || '—'}`)
    .join('\n');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject: `Locator Placement Invoice ${invoice.fields.invoiceNumber} — ${invoice.fields.client}`,
      html,
      text,
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

  const db = await readDB();
  const invoice = db.invoices[id];
  if (!invoice) return res.status(404).json({ success: false, error: 'Not found' });
  if (invoice.status !== 'approved') {
    return res.status(409).json({ success: false, error: `Invoice must be approved before sending (currently ${invoice.status})` });
  }

  const verification = db.verifications[invoice.verificationId];
  const recipient =
    verification?.pmSubmission?.pmEmail ||
    verification?.clientSubmission?.pmEmail ||
    null;

  const emailResult = await tryEmailInvoice(invoice, recipient);

  invoice.status = 'sent';
  invoice.sentAt = new Date().toISOString();
  if (verification) {
    logEvent(verification, AUDIT_EVENTS.INVOICE_SENT, {
      actor: 'admin',
      detail: emailResult.sent
        ? `Invoice ${invoice.fields.invoiceNumber} emailed to ${recipient}`
        : `Invoice ${invoice.fields.invoiceNumber} marked sent (manual delivery — no email sent)`,
    });
    verification.updatedAt = invoice.sentAt;
  }

  await writeDB(db);

  return res.status(200).json({ success: true, invoice, emailed: !!emailResult.sent });
}
