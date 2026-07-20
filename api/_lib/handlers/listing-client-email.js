import { applyCors, handlePreflight, parseJsonBody, escapeHtml } from '../http.js';
import { requireAdmin } from '../auth.js';
import { withDB, getRecord } from '../store.js';
import { makeLinkRecord } from '../tokens.js';
import { decryptToken } from '../crypto.js';
import { ensureListings } from '../listing.js';
import { logEvent, AUDIT_EVENTS } from '../audit.js';
import { fieldRows, sendEmail } from '../email.js';

function baseUrl(req) {
  return process.env.ALLOWED_ORIGIN || `https://${req.headers.host}`;
}

function linkUrl(req, link) {
  const raw = decryptToken(link.encryptedToken);
  return raw ? `${baseUrl(req)}/forms/listing-intake/${raw}` : null;
}

function typeLabel(l) {
  return l.listingType === 'lease' ? 'lease' : 'sale';
}

function emailHtml(l, url) {
  const rows = fieldRows([
    ['Client', l.clientName],
    ['Property', l.propertyAddress],
    ['Unit', l.unitNumber],
    ['Listing type', typeLabel(l) === 'lease' ? 'For lease' : 'For sale'],
    ['Target go-live', l.targetGoLiveDate],
  ]);
  return `
<div style="font-family:Arial,sans-serif;line-height:1.55;color:#111;">
  <h2 style="margin:0 0 12px;">Let's get your listing live</h2>
  <p>Hi ${escapeHtml(l.clientName || 'there')},</p>
  <p>To get your property listed for ${typeLabel(l)}, I need a few details and documents from you. The checklist below takes about 10 minutes and tells you exactly what I still need.</p>
  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:14px 0;">${rows}</table>
  <p><a href="${escapeHtml(url)}" style="display:inline-block;background:#1c3b2e;color:#fff;padding:11px 16px;text-decoration:none;border-radius:6px;">Complete your listing checklist</a></p>
  <p>If you do not want to open the form, reply to this email and we can handle it over the phone instead.</p>
  <p>If anything looks suspicious, call or text Joey Williams at the number you already have before opening anything.</p>
  <p style="margin-top:18px;">Joey Williams<br>JWILLSOLDIT / Christin Rachelle Group</p>
</div>`.trim();
}

function emailText(l, url) {
  return [
    `Hi ${l.clientName || 'there'},`,
    '',
    `To get your property listed for ${typeLabel(l)}, I need a few details and documents from you. The checklist takes about 10 minutes and tells you exactly what I still need.`,
    '',
    `Client: ${l.clientName || '-'}`,
    `Property: ${l.propertyAddress || '-'}`,
    `Unit: ${l.unitNumber || '-'}`,
    `Listing type: ${typeLabel(l) === 'lease' ? 'For lease' : 'For sale'}`,
    `Target go-live: ${l.targetGoLiveDate || '-'}`,
    '',
    `Complete your listing checklist: ${url}`,
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
  if (!recipient) return res.status(400).json({ success: false, error: 'Client email is required' });

  const result = await withDB((db) => {
    const l = getRecord(ensureListings(db), id);
    if (!l) return null;
    if (!l.clientLink) l.clientLink = makeLinkRecord().record;
    l.clientEmail = recipient;
    l.updatedAt = new Date().toISOString();
    logEvent(l, AUDIT_EVENTS.SENT, { actor: 'admin', role: 'client', detail: `Listing checklist email prepared for ${recipient}` });
    return { listing: l, url: linkUrl(req, l.clientLink) };
  });

  if (!result) return res.status(404).json({ success: false, error: 'Not found' });
  if (!result.url) return res.status(500).json({ success: false, error: 'Could not generate listing link' });

  const emailResult = await sendEmail({
    to: recipient,
    subject: `Your listing checklist${result.listing.propertyAddress ? ` - ${result.listing.propertyAddress}` : ''}`,
    html: emailHtml(result.listing, result.url),
    text: emailText(result.listing, result.url),
  });

  if (emailResult.sent) {
    await withDB((db) => {
      const l = getRecord(ensureListings(db), id);
      if (!l) return;
      l.updatedAt = new Date().toISOString();
      logEvent(l, AUDIT_EVENTS.SENT, { actor: 'admin', role: 'client', detail: `Listing checklist email sent to ${recipient}` });
    });
  }

  return res.status(200).json({
    success: true,
    emailed: emailResult.sent,
    reason: emailResult.reason || null,
    url: result.url,
  });
}
