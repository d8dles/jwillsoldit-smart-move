import { applyCors, handlePreflight } from '../http.js';
import { withDB } from '../store.js';
import { findByToken, isLinkValid } from '../tokens.js';
import { logEvent, AUDIT_EVENTS } from '../audit.js';

export default async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const role = req.query.role === 'pm' ? 'pm' : req.query.role === 'client' ? 'client' : null;
  const token = typeof req.query.token === 'string' ? req.query.token : '';

  if (!role || !token) {
    return res.status(400).json({ success: false, error: 'role and token are required' });
  }

  const result = await withDB((db) => {
    const found = findByToken(db, token, role);
    if (!found) return { valid: false, reason: 'not_found' };

    const { verification, link } = found;
    if (!isLinkValid(link)) {
      return { valid: false, reason: link.revoked ? 'revoked' : 'expired' };
    }

    link.viewCount = (link.viewCount || 0) + 1;
    link.lastViewedAt = new Date().toISOString();
    logEvent(verification, AUDIT_EVENTS.VIEWED, { actor: role, role, detail: `${role === 'client' ? 'Client' : 'Property manager'} opened the verification form` });
    verification.updatedAt = link.lastViewedAt;

    const alreadySubmitted = role === 'client' ? !!verification.clientSubmission : !!verification.pmSubmission;

    return {
      valid: true,
      alreadySubmitted,
      locked: verification.manuallyVerified,
      propertyName: verification.propertyName || '',
      unitNumber: verification.unitNumber || '',
      clientName: role === 'pm' ? verification.clientName || '' : undefined,
    };
  });

  if (!result.valid) {
    return res.status(200).json({ success: true, valid: false, reason: result.reason });
  }
  return res.status(200).json({ success: true, ...result });
}
