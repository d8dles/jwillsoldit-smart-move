import { applyCors, handlePreflight, parseJsonBody, getClientIp } from '../http.js';
import { withDB } from '../store.js';
import { findByToken, isLinkValid } from '../tokens.js';
import { logEvent, AUDIT_EVENTS } from '../audit.js';
import { checkRateLimit } from '../rate-limit.js';

const FIELDS = [
  'communityName', 'managementCompany', 'communityAddress', 'pmContactName', 'pmEmail',
  'clientName', 'unitNumber', 'applicationDate', 'moveInDate', 'leaseStartDate', 'leaseTerm',
  'monthlyRent', 'commissionOffered', 'commissionBasis', 'invoiceMethod', 'invoiceAttentionLine',
  'requiredVendorDocs', 'paymentTimeline', 'notes',
];

const COMMISSION_BASES = new Set(['percentage', 'flat', 'other']);
const INVOICE_METHODS = new Set(['email', 'portal', 'ach', 'check']);

export default async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const body = parseJsonBody(req);
  if (body == null) return res.status(400).json({ success: false, error: 'Invalid JSON' });

  const token = String(body.token || '');
  if (!token) return res.status(400).json({ success: false, error: 'token is required' });

  const communityName = String(body.communityName || '').trim();
  const pmContactName = String(body.pmContactName || '').trim();
  const pmEmail = String(body.pmEmail || '').trim();
  const clientName = String(body.clientName || '').trim();
  const certification = body.certification === true;

  if (!communityName || !pmContactName || !pmEmail || !clientName) {
    return res.status(400).json({ success: false, error: 'communityName, pmContactName, pmEmail, and clientName are required' });
  }
  if (!certification) {
    return res.status(400).json({ success: false, error: 'Certification is required to submit this form' });
  }

  const commissionBasis = COMMISSION_BASES.has(body.commissionBasis) ? body.commissionBasis : '';
  const invoiceMethod = INVOICE_METHODS.has(body.invoiceMethod) ? body.invoiceMethod : '';

  const ip = getClientIp(req);

  const result = await withDB((db) => {
    const rl = checkRateLimit(db, `submit-pm:${ip}`, { max: 8, windowMs: 10 * 60 * 1000, lockoutMs: 15 * 60 * 1000 });
    if (!rl.allowed) return { error: 'rate_limited', retryAfterSeconds: rl.retryAfterSeconds };

    const found = findByToken(db, token, 'pm');
    if (!found) return { error: 'invalid' };
    const { verification, link } = found;
    if (!isLinkValid(link)) return { error: link.revoked ? 'revoked' : 'expired' };
    if (verification.manuallyVerified) return { error: 'locked' };

    const submission = { communityName, pmContactName, pmEmail, clientName, certification, commissionBasis, invoiceMethod };
    for (const key of FIELDS) {
      if (!(key in submission) && key in body) submission[key] = String(body[key] ?? '').trim();
    }
    submission.certifiedAt = new Date().toISOString();

    verification.pmSubmission = submission;
    verification.pmSubmittedAt = submission.certifiedAt;
    if (!verification.propertyName) verification.propertyName = communityName;
    if (!verification.propertyAddress && body.communityAddress) verification.propertyAddress = String(body.communityAddress).trim();
    if (!verification.unitNumber && body.unitNumber) verification.unitNumber = String(body.unitNumber).trim();
    verification.updatedAt = submission.certifiedAt;

    logEvent(verification, AUDIT_EVENTS.SUBMITTED, { actor: 'pm', role: 'pm', detail: 'Property manager verification form submitted' });

    return { ok: true };
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
    return res.status(409).json({ success: false, error: 'This file has already been verified. Contact Joey Williams directly for changes.' });
  }

  return res.status(200).json({ success: true });
}
