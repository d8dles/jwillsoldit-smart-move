import { applyCors, handlePreflight, parseJsonBody, escapeHtml } from '../http.js';
import { requireAdmin } from '../auth.js';
import { withDB, getRecord } from '../store.js';
import { makeLinkRecord } from '../tokens.js';
import { decryptToken } from '../crypto.js';
import { ensureCdas } from '../cda.js';
import { logEvent, AUDIT_EVENTS } from '../audit.js';
import { fieldRows, sendEmail } from '../email.js';

function baseUrl(req) {
  return process.env.ALLOWED_ORIGIN || `https://${req.headers.host}`;
}

function linkUrl(req, link) {
  const raw = decryptToken(link.encryptedToken);
  return raw ? `${baseUrl(req)}/forms/cda/${raw}` : null;
}

function emailHtml(c, url) {
  const rows = fieldRows([
    ['Property', c.propertyAddress],
    ['Client', c.clientName],
    ['Commission', c.payeeAmount ? `$${c.payeeAmount}` : ''],
    ['Closing date', c.closingDate],
  ]);
  return `
<div style="font-family:Arial,sans-serif;line-height:1.55;color:#111;">
  <h2 style="margin:0 0 12px;">Commission Disbursement Authorization</h2>
  <p>Hi ${escapeHtml(c.payeeName || 'there')},</p>
  <p>Please confirm your payee details below and acknowledge the commission disbursement for this transaction. It takes about two minutes.</p>
  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:14px 0;">${rows}</table>
  <p><a href="${escapeHtml(url)}" style="display:inline-block;background:#1c3b2e;color:#fff;padding:11px 16px;text-decoration:none;border-radius:6px;">Confirm & submit</a></p>
  <p>If you do not want to open the form, reply to this email and we can handle it over the phone instead.</p>
  <p>If anything looks suspicious, call or text Joey Williams at the number you already have before opening anything.</p>
  <p style="margin-top:18px;">Joey Williams<br>JWILLSOLDIT / Christin Rachelle Group</p>
</div>`.trim();
}

function emailText(c, url) {
  return [
    `Hi ${c.payeeName || 'there'},`,
    '',
    'Please confirm your payee details and acknowledge the commission disbursement for this transaction. It takes about two minutes.',
    '',
    `Property: ${c.propertyAddress || '-'}`,
    `Client: ${c.clientName || '-'}`,
    `Commission: ${c.payeeAmount ? `$${c.payeeAmount}` : '-'}`,
    `Closing date: ${c.closingDate || '-'}`,
    '',
    `Confirm & submit: ${url}`,
    '',
    'If you do not want to open the form, reply to this email and we can handle it over the phone instead.',
    'If anything looks suspicious, call or text Joey Williams at the number you already have before opening anything.',
    '',
    'Joey Williams',
    'JWILLSOLDIT / Christin Rachelle Group',
  ].join('\n');
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { id } = req.query;
  const body = parseJsonBody(req) || {};
  const recipient = String(body.email || '').trim();
  if (!recipient) return res.status(400).json({ success: false, error: 'Payee email is required' });

  const result = await withDB((db) => {
    const c = getRecord(ensureCdas(db), id);
    if (!c) return null;
    if (!c.clientLink) c.clientLink = makeLinkRecord().record;
    c.payeeEmail = recipient;
    c.updatedAt = new Date().toISOString();
    logEvent(c, AUDIT_EVENTS.SENT, { actor: 'admin', role: 'client', detail: `CDA email prepared for ${recipient}` });
    return { cda: c, url: linkUrl(req, c.clientLink) };
  });

  if (!result) return res.status(404).json({ success: false, error: 'Not found' });
  if (!result.url) return res.status(500).json({ success: false, error: 'Could not generate CDA link' });

  const emailResult = await sendEmail({
    to: recipient,
    subject: `Commission Disbursement Authorization${result.cda.propertyAddress ? ` - ${result.cda.propertyAddress}` : ''}`,
    html: emailHtml(result.cda, result.url),
    text: emailText(result.cda, result.url),
  });

  if (emailResult.sent) {
    await withDB((db) => {
      const c = getRecord(ensureCdas(db), id);
      if (!c) return;
      c.updatedAt = new Date().toISOString();
      logEvent(c, AUDIT_EVENTS.SENT, { actor: 'admin', role: 'client', detail: `CDA email sent to ${recipient}` });
    });
  }

  return res.status(200).json({
    success: true,
    emailed: emailResult.sent,
    reason: emailResult.reason || null,
    url: result.url,
  });
}
