import { applyCors, handlePreflight, getClientIp } from '../http.js';
import { withDB } from '../store.js';
import { findCdaByToken, isLinkValid } from '../tokens.js';
import { logEvent, AUDIT_EVENTS } from '../audit.js';
import { checkRateLimit } from '../rate-limit.js';

export default async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const token = typeof req.query.token === 'string' ? req.query.token : '';
  if (!token) return res.status(400).json({ success: false, error: 'token is required' });

  const ip = getClientIp(req);

  const result = await withDB((db) => {
    const rl = checkRateLimit(db, `cda-token:${ip}`, { max: 30, windowMs: 5 * 60 * 1000, lockoutMs: 10 * 60 * 1000 });
    if (!rl.allowed) return { rateLimited: true, retryAfterSeconds: rl.retryAfterSeconds };

    const found = findCdaByToken(db, token);
    if (!found) return { valid: false, reason: 'not_found' };

    const { cda, link } = found;
    if (!isLinkValid(link)) {
      return { valid: false, reason: link.revoked ? 'revoked' : 'expired' };
    }

    link.viewCount = (link.viewCount || 0) + 1;
    link.lastViewedAt = new Date().toISOString();
    logEvent(cda, AUDIT_EVENTS.VIEWED, { actor: 'client', role: 'client', detail: 'Payee opened the CDA form' });
    cda.updatedAt = link.lastViewedAt;

    return {
      valid: true,
      alreadySubmitted: !!cda.clientSubmission,
      locked: !!cda.approved,
      propertyAddress: cda.propertyAddress || '',
      clientName: cda.clientName || '',
      community: cda.community || '',
      closingDate: cda.closingDate || '',
      totalCommission: cda.totalCommission || '',
      commissionBasis: cda.commissionBasis || 'percentage',
      payeeName: cda.payeeName || '',
      payeeCompany: cda.payeeCompany || '',
      payeeAmount: cda.payeeAmount || '',
    };
  });

  if (result.rateLimited) {
    const minutes = Math.max(1, Math.ceil(result.retryAfterSeconds / 60));
    return res.status(429).json({ success: false, error: `Too many requests. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.` });
  }

  if (!result.valid) {
    return res.status(200).json({ success: true, valid: false, reason: result.reason });
  }
  return res.status(200).json({ success: true, ...result });
}
