import { applyCors, handlePreflight, parseJsonBody, escapeHtml, getClientIp } from '../http.js';
import { withDB } from '../store.js';
import { findListingByToken, isLinkValid } from '../tokens.js';
import {
  submissionFieldsFor, applicableItems, computeOutstandingItems,
  computeListingFlags,
} from '../listing.js';
import { logEvent, AUDIT_EVENTS } from '../audit.js';
import { sendEmail, fieldRows } from '../email.js';
import { validateUploadDataUrl, UPLOAD_REJECTED_MESSAGE } from '../uploads.js';
import { checkRateLimit } from '../rate-limit.js';

// Same per-file cap as the verification form (see submit-client.js). The
// whole module lives in one JSON document, so uploads are also capped in
// count — one slot per applicable doc item.
const MAX_UPLOAD_DATA_URL_LENGTH = 4_500_000; // ~3.3MB binary after base64 overhead

function sanitizeUpload(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const dataUrl = String(raw.dataUrl || '');
  if (!dataUrl) return null;
  if (dataUrl.length > MAX_UPLOAD_DATA_URL_LENGTH) return { tooLarge: true };
  // Length is checked first (above) so this never runs a regex over an
  // unbounded string. Anything that isn't a base64 image/PDF data: URL is
  // rejected here rather than stored — see uploads.js for why.
  if (!validateUploadDataUrl(dataUrl).ok) return { invalid: true };
  return {
    name: String(raw.name || 'upload').slice(0, 200),
    type: String(raw.type || '').slice(0, 100),
    size: Number(raw.size) || 0,
    dataUrl,
  };
}

function outstandingHtml(items) {
  if (!items.length) return '<p><strong>Nothing outstanding — your checklist is complete.</strong></p>';
  return `
  <p><strong>Still needed from you:</strong></p>
  <ul style="margin:12px 0;padding-left:20px;">
    ${items.map((i) => `<li style="margin-bottom:4px;">${escapeHtml(i.label)}</li>`).join('')}
  </ul>
  <p>You can reply to this email, or call/text Joey, to get these over.</p>`;
}

async function sendClientConfirmation(listing, submission, outstanding) {
  const address = listing.propertyAddress || 'your property';
  const typeLabel = listing.listingType === 'lease' ? 'lease' : 'sale';
  const rows = fieldRows([
    ['Property', address],
    ['Unit', listing.unitNumber],
    ['Listing type', typeLabel === 'lease' ? 'For lease' : 'For sale'],
    ['Target go-live', submission.targetGoLiveDate || listing.targetGoLiveDate],
  ]);
  const html = `
<div style="font-family:Arial,sans-serif;line-height:1.55;color:#111;">
  <h2 style="margin:0 0 12px;">Got it — your listing checklist is in</h2>
  <p>Hi ${escapeHtml(submission.clientLegalName || 'there')},</p>
  <p>Thanks — I received your listing details for ${escapeHtml(address)}. Here's where we stand:</p>
  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:14px 0;">${rows}</table>
  ${outstandingHtml(outstanding)}
  <p>I'll review everything and follow up with next steps.</p>
  <p style="margin-top:18px;">Joey Williams<br>JWILLSOLDIT / Christin Rachelle Group</p>
</div>`.trim();

  const textLines = [
    `Hi ${submission.clientLegalName || 'there'},`,
    '',
    `Thanks — I received your listing details for ${address}.`,
    '',
  ];
  if (outstanding.length) {
    textLines.push('Still needed from you:');
    outstanding.forEach((i) => textLines.push(`  • ${i.label}`));
    textLines.push('', 'You can reply to this email, or call/text Joey, to get these over.');
  } else {
    textLines.push('Nothing outstanding — your checklist is complete.');
  }
  textLines.push('', "I'll review everything and follow up with next steps.", '', 'Joey Williams', 'JWILLSOLDIT / Christin Rachelle Group');

  return sendEmail({
    to: submission.email,
    subject: `Listing checklist received - ${address}`,
    html,
    text: textLines.join('\n'),
  });
}

async function sendAdminAlert(listing, submission, outstanding, flags) {
  const to = process.env.LEAD_ALERT_TO;
  if (!to) return { sent: false, reason: 'not_configured_or_no_recipient' };
  const address = listing.propertyAddress || '—';
  const typeLabel = listing.listingType === 'lease' ? 'Lease' : 'Sale';
  const rows = fieldRows([
    ['Client', submission.clientLegalName],
    ['Email', submission.email],
    ['Phone', submission.phone],
    ['Property', address],
    ['Unit', listing.unitNumber],
    ['Type', typeLabel],
    ['Go-live target', submission.targetGoLiveDate || listing.targetGoLiveDate],
    ['Flags', flags.join(', ')],
    ['Outstanding', outstanding.length ? outstanding.map((i) => i.label).join('; ') : 'None — complete'],
  ]);
  const html = `
<div style="font-family:Arial,sans-serif;line-height:1.55;color:#111;">
  <h2 style="margin:0 0 12px;">Listing intake submitted: ${escapeHtml(address)} — ${typeLabel}</h2>
  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:14px 0;">${rows}</table>
  <p>Open the file: ${escapeHtml((process.env.ALLOWED_ORIGIN || 'https://move.jwillsoldit.com'))}/admin/listings/${escapeHtml(listing.id)}</p>
</div>`.trim();

  return sendEmail({
    to,
    subject: `Listing intake: ${address} — ${typeLabel}${flags.includes('urgent') ? ' — URGENT' : ''}`,
    html,
    text: `Listing intake submitted: ${address} — ${typeLabel}\nClient: ${submission.clientLegalName} / ${submission.email} / ${submission.phone}\nFlags: ${flags.join(', ') || '—'}\nOutstanding: ${outstanding.map((i) => i.label).join('; ') || 'None'}\nFile: /admin/listings/${listing.id}`,
  });
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const body = parseJsonBody(req);
  if (body == null) return res.status(400).json({ success: false, error: 'Invalid JSON' });

  const token = String(body.token || '');
  if (!token) return res.status(400).json({ success: false, error: 'token is required' });

  const clientLegalName = String(body.clientLegalName || '').trim();
  const email = String(body.email || '').trim();
  const phone = String(body.phone || '').trim();

  if (!clientLegalName || !email || !phone) {
    return res.status(400).json({ success: false, error: 'clientLegalName, email, and phone are required' });
  }
  // TREC acknowledgments — both required, wording lives in the form.
  if (body.ackListingAgreement !== true || body.ackIabs !== true) {
    return res.status(400).json({ success: false, error: 'Both acknowledgments are required to submit this form' });
  }

  const ip = getClientIp(req);

  const result = await withDB((db) => {
    const rl = checkRateLimit(db, `submit-listing:${ip}`, { max: 8, windowMs: 10 * 60 * 1000, lockoutMs: 15 * 60 * 1000 });
    if (!rl.allowed) return { error: 'rate_limited', retryAfterSeconds: rl.retryAfterSeconds };

    const found = findListingByToken(db, token);
    if (!found) return { error: 'invalid' };
    const { listing, link } = found;
    if (!isLinkValid(link)) return { error: link.revoked ? 'revoked' : 'expired' };
    if (listing.approved) return { error: 'locked' };

    const submission = { clientLegalName, email, phone };
    for (const key of submissionFieldsFor(listing.listingType)) {
      if (!(key in submission) && key in body) submission[key] = String(body[key] ?? '').trim();
    }
    submission.ackListingAgreement = true;
    submission.ackIabs = true;
    submission.ackAt = new Date().toISOString();

    // One upload slot per applicable doc item; unknown keys are dropped.
    const uploads = {};
    if (body.uploads && typeof body.uploads === 'object') {
      const docKeys = new Set(
        applicableItems({ ...listing, clientSubmission: submission })
          .filter((i) => i.doc)
          .map((i) => i.key)
      );
      for (const [key, raw] of Object.entries(body.uploads)) {
        if (!docKeys.has(key)) continue;
        const upload = sanitizeUpload(raw);
        if (upload?.tooLarge) return { error: 'too_large', key };
        if (upload?.invalid) return { error: 'invalid_upload', key };
        if (upload) uploads[key] = upload;
      }
    }
    submission.uploads = uploads;

    listing.clientSubmission = submission;
    listing.clientSubmittedAt = submission.ackAt;
    if (!listing.clientEmail) listing.clientEmail = email;
    if (!listing.clientName) listing.clientName = clientLegalName;
    if (body.targetGoLiveDate && !listing.targetGoLiveDate) {
      listing.targetGoLiveDate = String(body.targetGoLiveDate).trim();
    }
    listing.updatedAt = submission.ackAt;

    logEvent(listing, AUDIT_EVENTS.SUBMITTED, { actor: 'client', role: 'client', detail: 'Listing checklist submitted' });

    return {
      ok: true,
      listing,
      submission,
      outstanding: computeOutstandingItems(listing),
      flags: computeListingFlags(listing),
    };
  });

  if (result.error === 'rate_limited') {
    const minutes = Math.max(1, Math.ceil(result.retryAfterSeconds / 60));
    return res.status(429).json({ success: false, error: `Too many attempts. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.` });
  }
  if (result.error === 'invalid') return res.status(404).json({ success: false, error: 'This link is not valid' });
  if (result.error === 'revoked' || result.error === 'expired') {
    return res.status(410).json({ success: false, error: 'This link has expired. Please contact Joey Williams for a new one.' });
  }
  if (result.error === 'locked') {
    return res.status(409).json({ success: false, error: 'This listing has already been approved. Contact Joey Williams directly for changes.' });
  }
  if (result.error === 'too_large') {
    return res.status(413).json({ success: false, error: 'One of the uploaded files is too large (max ~3MB each)' });
  }
  if (result.error === 'invalid_upload') {
    return res.status(400).json({ success: false, error: UPLOAD_REJECTED_MESSAGE });
  }

  // Emails are soft-fail — the store write above is the source of truth.
  try {
    await sendClientConfirmation(result.listing, result.submission, result.outstanding);
  } catch (err) {
    console.warn('[listing] Client confirmation email failed:', err.message);
  }
  try {
    await sendAdminAlert(result.listing, result.submission, result.outstanding, result.flags);
  } catch (err) {
    console.warn('[listing] Admin alert email failed:', err.message);
  }

  return res.status(200).json({ success: true, outstanding: result.outstanding });
}
