import { applyCors, handlePreflight, parseJsonBody, escapeHtml } from '../http.js';
import { requireAdmin } from '../auth.js';
import { withDB, getRecord } from '../store.js';
import { makeLinkRecord } from '../tokens.js';
import { decryptToken } from '../crypto.js';
import { ensureCdas, computeOutstandingItems } from '../cda.js';
import { logEvent, AUDIT_EVENTS } from '../audit.js';
import { sendEmail } from '../email.js';

function baseUrl(req) {
  return process.env.ALLOWED_ORIGIN || `https://${req.headers.host}`;
}

function itemsHtml(items) {
  return items
    .map((i) => `<li style="margin-bottom:4px;">${escapeHtml(i.label)}</li>`)
    .join('');
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { id } = req.query;
  const body = parseJsonBody(req) || {};

  const result = await withDB((db) => {
    const c = getRecord(ensureCdas(db), id);
    if (!c) return null;
    if (!c.clientLink) c.clientLink = makeLinkRecord().record;
    const recipient = String(body.email || c.payeeEmail || c.clientSubmission?.email || '').trim();
    const outstanding = computeOutstandingItems(c);
    const raw = decryptToken(c.clientLink.encryptedToken);
    const url = raw ? `${baseUrl(req)}/forms/cda/${raw}` : null;
    return { cda: c, recipient, outstanding, url };
  });

  if (!result) return res.status(404).json({ success: false, error: 'Not found' });
  if (!result.recipient) return res.status(400).json({ success: false, error: 'No payee email on file — pass one in the request' });
  if (!result.outstanding.length) return res.status(409).json({ success: false, error: 'Nothing outstanding — CDA is complete' });
  if (!result.url) return res.status(500).json({ success: false, error: 'Could not generate CDA link' });

  const { cda, recipient, outstanding, url } = result;
  const address = cda.propertyAddress || 'this transaction';

  const html = `
<div style="font-family:Arial,sans-serif;line-height:1.55;color:#111;">
  <h2 style="margin:0 0 12px;">Still needed for the commission disbursement</h2>
  <p>Hi ${escapeHtml(cda.payeeName || 'there')},</p>
  <p>Quick reminder — I'm still missing the following for ${escapeHtml(address)}:</p>
  <ul style="margin:12px 0;padding-left:20px;">${itemsHtml(outstanding)}</ul>
  <p><a href="${escapeHtml(url)}" style="display:inline-block;background:#1c3b2e;color:#fff;padding:11px 16px;text-decoration:none;border-radius:6px;">Confirm & submit</a></p>
  <p>You can also reply to this email or text me the documents directly.</p>
  <p style="margin-top:18px;">Joey Williams<br>JWILLSOLDIT / Christin Rachelle Group</p>
</div>`.trim();

  const text = [
    `Hi ${cda.payeeName || 'there'},`,
    '',
    `Quick reminder — I'm still missing the following for ${address}:`,
    '',
    ...outstanding.map((i) => `  • ${i.label}`),
    '',
    `Confirm & submit: ${url}`,
    '',
    'You can also reply to this email or text me the documents directly.',
    '',
    'Joey Williams',
    'JWILLSOLDIT / Christin Rachelle Group',
  ].join('\n');

  const emailResult = await sendEmail({
    to: recipient,
    subject: `Still needed for the commission disbursement - ${address}`,
    html,
    text,
  });

  if (emailResult.sent) {
    await withDB((db) => {
      const c = getRecord(ensureCdas(db), id);
      if (!c) return;
      c.updatedAt = new Date().toISOString();
      logEvent(c, AUDIT_EVENTS.REMINDER, { actor: 'admin', role: 'client', detail: `Outstanding-items reminder sent to ${recipient} (${outstanding.length} items)` });
    });
  }

  return res.status(200).json({
    success: true,
    emailed: emailResult.sent,
    reason: emailResult.reason || null,
    outstanding,
  });
}
