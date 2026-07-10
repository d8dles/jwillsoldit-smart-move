import { applyCors, handlePreflight, parseJsonBody, escapeHtml } from '../http.js';
import { requireAdmin } from '../auth.js';
import { withDB } from '../store.js';
import { makeLinkRecord } from '../tokens.js';
import { decryptToken } from '../crypto.js';
import { logEvent, AUDIT_EVENTS } from '../audit.js';
import { fieldRows, sendEmail } from '../email.js';

function baseUrl(req) {
  return process.env.ALLOWED_ORIGIN || `https://${req.headers.host}`;
}

function linkUrl(req, link) {
  const raw = decryptToken(link.encryptedToken);
  return raw ? `${baseUrl(req)}/forms/client-verification/${raw}` : null;
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
  <h2 style="margin:0 0 12px;">Rental placement verification</h2>
  <p>Hi ${escapeHtml(v.clientName || 'there')},</p>
  <p>I'm documenting your rental placement so I can verify the file and prepare the correct locator paperwork with the property.</p>
  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:14px 0;">${rows}</table>
  <p><a href="${escapeHtml(url)}" style="display:inline-block;background:#1c3b2e;color:#fff;padding:11px 16px;text-decoration:none;border-radius:6px;">Confirm your rental details</a></p>
  <p>If you do not want to open the form, reply to this email with any corrections or missing details.</p>
  <p>If anything looks suspicious, call or text Joey Williams at the number you already have before opening anything.</p>
  <p style="margin-top:18px;">Joey Williams<br>JWILLSOLDIT / Christin Rachelle Group</p>
</div>`.trim();
}

function emailText(v, url) {
  return [
    `Hi ${v.clientName || 'there'},`,
    '',
    "I'm documenting your rental placement so I can verify the file and prepare the correct locator paperwork with the property.",
    '',
    `Client: ${v.clientName || '-'}`,
    `Property / Community: ${v.propertyName || '-'}`,
    `Property Address: ${v.propertyAddress || '-'}`,
    `Unit: ${v.unitNumber || '-'}`,
    '',
    `Confirm your rental details: ${url}`,
    '',
    'If you do not want to open the form, reply to this email with any corrections or missing details.',
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
  if (!recipient) return res.status(400).json({ success: false, error: 'Client email is required' });

  const result = await withDB((db) => {
    const v = db.verifications[id];
    if (!v) return null;
    if (!v.clientLink) v.clientLink = makeLinkRecord().record;
    v.updatedAt = new Date().toISOString();
    v.clientEmail = {
      to: recipient,
      lastAttemptedAt: v.updatedAt,
      lastSentAt: v.clientEmail?.lastSentAt || null,
    };
    logEvent(v, AUDIT_EVENTS.SENT, { actor: 'admin', role: 'client', detail: `Client verification email prepared for ${recipient}` });
    return { verification: v, url: linkUrl(req, v.clientLink) };
  });

  if (!result) return res.status(404).json({ success: false, error: 'Not found' });
  if (!result.url) return res.status(500).json({ success: false, error: 'Could not generate client link' });

  const emailResult = await sendEmail({
    to: recipient,
    subject: `Rental placement verification${result.verification.propertyName ? ` - ${result.verification.propertyName}` : ''}`,
    html: emailHtml(result.verification, result.url),
    text: emailText(result.verification, result.url),
  });

  if (emailResult.sent) {
    await withDB((db) => {
      const v = db.verifications[id];
      if (!v) return;
      if (!v.clientEmail) v.clientEmail = { to: recipient };
      v.clientEmail.to = recipient;
      v.clientEmail.lastSentAt = new Date().toISOString();
      v.updatedAt = v.clientEmail.lastSentAt;
      logEvent(v, AUDIT_EVENTS.SENT, { actor: 'admin', role: 'client', detail: `Client verification email sent to ${recipient}` });
    });
  }

  return res.status(200).json({
    success: true,
    emailed: emailResult.sent,
    reason: emailResult.reason || null,
    url: result.url,
  });
}
