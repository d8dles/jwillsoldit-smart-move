import { applyCors, handlePreflight, parseJsonBody } from '../http.js';
import { withDB } from '../store.js';
import { findByToken, isLinkValid } from '../tokens.js';
import { logEvent, AUDIT_EVENTS } from '../audit.js';
import { validateUploadDataUrl, UPLOAD_REJECTED_MESSAGE } from '../uploads.js';

const MAX_UPLOAD_DATA_URL_LENGTH = 4_500_000; // ~3.3MB binary after base64 overhead

const FIELDS = [
  'clientLegalName', 'preferredName', 'email', 'phone',
  'propertyName', 'propertyAddress', 'unitNumber',
  'pmContactName', 'pmEmail',
  'dateToured', 'applicationDate', 'moveInDate', 'leaseStartDate', 'leaseTerm',
  'monthlyRent', 'concession', 'firstContactMethod', 'listedReferral',
];

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
  const propertyName = String(body.propertyName || '').trim();
  const consent = body.consent === true;

  if (!clientLegalName || !email || !phone || !propertyName) {
    return res.status(400).json({ success: false, error: 'clientLegalName, email, phone, and propertyName are required' });
  }
  if (!consent) {
    return res.status(400).json({ success: false, error: 'Consent is required to submit this form' });
  }

  let upload = null;
  if (body.upload && typeof body.upload === 'object') {
    const dataUrl = String(body.upload.dataUrl || '');
    if (dataUrl.length > MAX_UPLOAD_DATA_URL_LENGTH) {
      return res.status(413).json({ success: false, error: 'Uploaded file is too large (max ~3MB)' });
    }
    const validated = validateUploadDataUrl(dataUrl);
    if (!validated.ok) {
      return res.status(400).json({ success: false, error: UPLOAD_REJECTED_MESSAGE });
    }
    upload = {
      name: String(body.upload.name || 'upload').slice(0, 200),
      type: String(body.upload.type || '').slice(0, 100),
      size: Number(body.upload.size) || 0,
      dataUrl,
    };
  }

  const result = await withDB((db) => {
    const found = findByToken(db, token, 'client');
    if (!found) return { error: 'invalid' };
    const { verification, link } = found;
    if (!isLinkValid(link)) return { error: link.revoked ? 'revoked' : 'expired' };
    if (verification.manuallyVerified) return { error: 'locked' };

    const submission = { clientLegalName, email, phone, propertyName, consent };
    for (const key of FIELDS) {
      if (!(key in submission) && key in body) submission[key] = String(body[key] ?? '').trim();
    }
    submission.upload = upload;
    submission.consentAt = new Date().toISOString();

    verification.clientSubmission = submission;
    verification.clientSubmittedAt = submission.consentAt;
    // Fill the admin's convenience fields if they were left blank at creation.
    if (!verification.clientName) verification.clientName = clientLegalName;
    if (!verification.propertyName) verification.propertyName = propertyName;
    if (!verification.propertyAddress && body.propertyAddress) verification.propertyAddress = String(body.propertyAddress).trim();
    if (!verification.unitNumber && body.unitNumber) verification.unitNumber = String(body.unitNumber).trim();
    verification.updatedAt = submission.consentAt;

    logEvent(verification, AUDIT_EVENTS.SUBMITTED, { actor: 'client', role: 'client', detail: 'Client verification form submitted' });

    return { ok: true };
  });

  if (result.error === 'invalid') return res.status(404).json({ success: false, error: 'This link is not valid' });
  if (result.error === 'revoked' || result.error === 'expired') {
    return res.status(410).json({ success: false, error: 'This link has expired. Please contact Joey Williams for a new one.' });
  }
  if (result.error === 'locked') {
    return res.status(409).json({ success: false, error: 'This file has already been verified. Contact Joey Williams directly for changes.' });
  }

  return res.status(200).json({ success: true });
}
