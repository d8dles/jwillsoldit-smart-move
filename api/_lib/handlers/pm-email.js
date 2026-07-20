import { applyCors, handlePreflight, parseJsonBody, escapeHtml } from '../http.js';
import { requireAdmin } from '../auth.js';
import { withDB, getRecord } from '../store.js';
import { makeLinkRecord } from '../tokens.js';
import { decryptToken } from '../crypto.js';
import { logEvent, AUDIT_EVENTS } from '../audit.js';
import { fieldRows, sendEmail } from '../email.js';

function baseUrl(req) {
  return process.env.ALLOWED_ORIGIN || `https://${req.headers.host}`;
}

function linkUrl(req, link) {
  const raw = decryptToken(link.encryptedToken);
  return raw ? `${baseUrl(req)}/forms/property-verification/${raw}` : null;
}

function emailHtml(v, url) {
  const rows = fieldRows([
    ['Client', v.clientName],
    ['Property / Community', v.propertyName],
    ['Property Address', v.propertyAddress],
    ['Unit', v.unitNumber],
  ]);
  return `
<div style="font-family:Arial,sans-serif;line-height:1.55;color:#111;">
  <h2 style="margin:0 0 12px;">Placement confirmation request</h2>
  <p>Hello,</p>
  <p>Joey Williams with JWILLSOLDIT / Christin Rachelle Group is requesting confirmation of this rental placement for locator commission invoicing.</p>
  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:14px 0;">${rows}</table>
  <p><a href="${escapeHtml(url)}" style="display:inline-block;background:#1c3b2e;color:#fff;padding:11px 16px;text-decoration:none;border-radius:6px;">Confirm placement and invoice details</a></p>
  <p>If your team does not open outside links, please reply directly with the commission offered, invoice submission method, attention line, vendor document requirements, and payment timeline.</p>
  <p>You can also verify this request by contacting Joey Williams directly.</p>
  <p style="margin-top:18px;">Joey Williams<br>JWILLSOLDIT / Christin Rachelle Group</p>
</div>`.trim();
}

function emailText(v, url) {
  return [
    'Hello,',
    '',
    'Joey Williams with JWILLSOLDIT / Christin Rachelle Group is requesting confirmation of this rental placement for locator commission invoicing.',
    '',
    `Client: ${v.clientName || '-'}`,
    `Property / Community: ${v.propertyName || '-'}`,
    `Property Address: ${v.propertyAddress || '-'}`,
    `Unit: ${v.unitNumber || '-'}`,
    '',
    `Confirm placement and invoice details: ${url}`,
    '',
    'If your team does not open outside links, please reply directly with the commission offered, invoice submission method, attention line, vendor document requirements, and payment timeline.',
    'You can also verify this request by contacting Joey Williams directly.',
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
  if (!recipient) return res.status(400).json({ success: false, error: 'Property email is required' });

  const result = await withDB((db) => {
    const v = getRecord(db.verifications, id);
    if (!v) return null;
    if (!v.pmLink) v.pmLink = makeLinkRecord().record;
    v.updatedAt = new Date().toISOString();
    v.pmEmailStatus = {
      to: recipient,
      lastAttemptedAt: v.updatedAt,
      lastSentAt: v.pmEmailStatus?.lastSentAt || null,
    };
    logEvent(v, AUDIT_EVENTS.SENT, { actor: 'admin', role: 'pm', detail: `Property verification email prepared for ${recipient}` });
    return { verification: v, url: linkUrl(req, v.pmLink) };
  });

  if (!result) return res.status(404).json({ success: false, error: 'Not found' });
  if (!result.url) return res.status(500).json({ success: false, error: 'Could not generate property manager link' });

  const emailResult = await sendEmail({
    to: recipient,
    subject: `Placement confirmation request${result.verification.clientName ? ` - ${result.verification.clientName}` : ''}`,
    html: emailHtml(result.verification, result.url),
    text: emailText(result.verification, result.url),
  });

  if (emailResult.sent) {
    await withDB((db) => {
      const v = getRecord(db.verifications, id);
      if (!v) return;
      if (!v.pmEmailStatus) v.pmEmailStatus = { to: recipient };
      v.pmEmailStatus.to = recipient;
      v.pmEmailStatus.lastSentAt = new Date().toISOString();
      v.updatedAt = v.pmEmailStatus.lastSentAt;
      logEvent(v, AUDIT_EVENTS.SENT, { actor: 'admin', role: 'pm', detail: `Property verification email sent to ${recipient}` });
    });
  }

  return res.status(200).json({
    success: true,
    emailed: emailResult.sent,
    reason: emailResult.reason || null,
    url: result.url,
  });
}
