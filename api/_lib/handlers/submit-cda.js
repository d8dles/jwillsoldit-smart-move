import { applyCors, handlePreflight, parseJsonBody, escapeHtml, getClientIp } from '../http.js';
import { withDB } from '../store.js';
import { findCdaByToken, isLinkValid } from '../tokens.js';
import { SUBMISSION_FIELDS, REQUIRED_ITEMS, computeOutstandingItems } from '../cda.js';
import { logEvent, AUDIT_EVENTS } from '../audit.js';
import { sendEmail, fieldRows } from '../email.js';
import { validateUploadDataUrl, UPLOAD_REJECTED_MESSAGE } from '../uploads.js';
import { checkRateLimit } from '../rate-limit.js';

// Same per-file cap as submit-listing.js / submit-client.js.
const MAX_UPLOAD_DATA_URL_LENGTH = 4_500_000; // ~3.3MB binary after base64 overhead

function sanitizeUpload(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const dataUrl = String(raw.dataUrl || '');
  if (!dataUrl) return null;
  if (dataUrl.length > MAX_UPLOAD_DATA_URL_LENGTH) return { tooLarge: true };
  if (!validateUploadDataUrl(dataUrl).ok) return { invalid: true };
  return {
    name: String(raw.name || 'upload').slice(0, 200),
    type: String(raw.type || '').slice(0, 100),
    size: Number(raw.size) || 0,
    dataUrl,
  };
}

function outstandingHtml(items) {
  if (!items.length) return '<p><strong>Nothing outstanding — your file is complete.</strong></p>';
  return `
  <p><strong>Still needed from you:</strong></p>
  <ul style="margin:12px 0;padding-left:20px;">
    ${items.map((i) => `<li style="margin-bottom:4px;">${escapeHtml(i.label)}</li>`).join('')}
  </ul>
  <p>You can reply to this email, or call/text Joey, to get these over.</p>`;
}

async function sendPayeeConfirmation(cda, submission, outstanding) {
  const address = cda.propertyAddress || 'this transaction';
  const rows = fieldRows([
    ['Property', address],
    ['Commission', cda.payeeAmount ? `$${cda.payeeAmount}` : ''],
    ['Payment method', submission.paymentMethod],
  ]);
  const html = `
<div style="font-family:Arial,sans-serif;line-height:1.55;color:#111;">
  <h2 style="margin:0 0 12px;">Got it — your CDA confirmation is in</h2>
  <p>Hi ${escapeHtml(submission.payeeLegalName || 'there')},</p>
  <p>Thanks — I received your commission disbursement confirmation for ${escapeHtml(address)}. Here's where we stand:</p>
  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:14px 0;">${rows}</table>
  ${outstandingHtml(outstanding)}
  <p>I'll review everything and follow up once disbursement is processed.</p>
  <p style="margin-top:18px;">Joey Williams<br>JWILLSOLDIT / Christin Rachelle Group</p>
</div>`.trim();

  const textLines = [
    `Hi ${submission.payeeLegalName || 'there'},`,
    '',
    `Thanks — I received your commission disbursement confirmation for ${address}.`,
    '',
  ];
  if (outstanding.length) {
    textLines.push('Still needed from you:');
    outstanding.forEach((i) => textLines.push(`  • ${i.label}`));
    textLines.push('', 'You can reply to this email, or call/text Joey, to get these over.');
  } else {
    textLines.push('Nothing outstanding — your file is complete.');
  }
  textLines.push('', "I'll review everything and follow up once disbursement is processed.", '', 'Joey Williams', 'JWILLSOLDIT / Christin Rachelle Group');

  return sendEmail({
    to: submission.email,
    subject: `CDA confirmation received - ${address}`,
    html,
    text: textLines.join('\n'),
  });
}

async function sendAdminAlert(cda, submission, outstanding) {
  const to = process.env.LEAD_ALERT_TO;
  if (!to) return { sent: false, reason: 'not_configured_or_no_recipient' };
  const address = cda.propertyAddress || '—';
  const rows = fieldRows([
    ['Payee', submission.payeeLegalName],
    ['Company', submission.payeeCompany],
    ['Email', submission.email],
    ['Phone', submission.phone],
    ['Property', address],
    ['Payment method', submission.paymentMethod],
    ['Outstanding', outstanding.length ? outstanding.map((i) => i.label).join('; ') : 'None — complete'],
  ]);
  const html = `
<div style="font-family:Arial,sans-serif;line-height:1.55;color:#111;">
  <h2 style="margin:0 0 12px;">CDA submitted: ${escapeHtml(address)}</h2>
  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:14px 0;">${rows}</table>
  <p>Open the file: ${escapeHtml((process.env.ALLOWED_ORIGIN || 'https://move.jwillsoldit.com'))}/admin/cdas/${escapeHtml(cda.id)}</p>
</div>`.trim();

  return sendEmail({
    to,
    subject: `CDA submitted: ${address}`,
    html,
    text: `CDA submitted: ${address}\nPayee: ${submission.payeeLegalName} / ${submission.email} / ${submission.phone}\nOutstanding: ${outstanding.map((i) => i.label).join('; ') || 'None'}\nFile: /admin/cdas/${cda.id}`,
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

  const payeeLegalName = String(body.payeeLegalName || '').trim();
  const email = String(body.email || '').trim();
  const phone = String(body.phone || '').trim();

  if (!payeeLegalName || !email || !phone) {
    return res.status(400).json({ success: false, error: 'payeeLegalName, email, and phone are required' });
  }
  if (body.ackDisbursement !== true) {
    return res.status(400).json({ success: false, error: 'The disbursement acknowledgment is required to submit this form' });
  }

  const ip = getClientIp(req);

  const result = await withDB((db) => {
    const rl = checkRateLimit(db, `submit-cda:${ip}`, { max: 8, windowMs: 10 * 60 * 1000, lockoutMs: 15 * 60 * 1000 });
    if (!rl.allowed) return { error: 'rate_limited', retryAfterSeconds: rl.retryAfterSeconds };

    const found = findCdaByToken(db, token);
    if (!found) return { error: 'invalid' };
    const { cda, link } = found;
    if (!isLinkValid(link)) return { error: link.revoked ? 'revoked' : 'expired' };
    if (cda.approved) return { error: 'locked' };

    const submission = { payeeLegalName, email, phone };
    for (const key of SUBMISSION_FIELDS) {
      if (!(key in submission) && key in body) submission[key] = String(body[key] ?? '').trim();
    }
    submission.ackDisbursement = true;
    submission.ackAt = new Date().toISOString();

    // One upload slot per required doc item; unknown keys are dropped.
    const uploads = {};
    if (body.uploads && typeof body.uploads === 'object') {
      const docKeys = new Set(REQUIRED_ITEMS.filter((i) => i.doc).map((i) => i.key));
      for (const [key, raw] of Object.entries(body.uploads)) {
        if (!docKeys.has(key)) continue;
        const upload = sanitizeUpload(raw);
        if (upload?.tooLarge) return { error: 'too_large', key };
        if (upload?.invalid) return { error: 'invalid_upload', key };
        if (upload) uploads[key] = upload;
      }
    }
    submission.uploads = uploads;

    cda.clientSubmission = submission;
    cda.clientSubmittedAt = submission.ackAt;
    if (!cda.payeeEmail) cda.payeeEmail = email;
    if (!cda.payeeName) cda.payeeName = payeeLegalName;
    cda.updatedAt = submission.ackAt;

    logEvent(cda, AUDIT_EVENTS.SUBMITTED, { actor: 'client', role: 'client', detail: 'CDA confirmation submitted by payee' });

    return {
      ok: true,
      cda,
      submission,
      outstanding: computeOutstandingItems(cda),
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
    return res.status(409).json({ success: false, error: 'This CDA has already been approved. Contact Joey Williams directly for changes.' });
  }
  if (result.error === 'too_large') {
    return res.status(413).json({ success: false, error: 'One of the uploaded files is too large (max ~3MB each)' });
  }
  if (result.error === 'invalid_upload') {
    return res.status(400).json({ success: false, error: UPLOAD_REJECTED_MESSAGE });
  }

  // Emails are soft-fail — the store write above is the source of truth.
  try {
    await sendPayeeConfirmation(result.cda, result.submission, result.outstanding);
  } catch (err) {
    console.warn('[cda] Payee confirmation email failed:', err.message);
  }
  try {
    await sendAdminAlert(result.cda, result.submission, result.outstanding);
  } catch (err) {
    console.warn('[cda] Admin alert email failed:', err.message);
  }

  return res.status(200).json({ success: true, outstanding: result.outstanding });
}
