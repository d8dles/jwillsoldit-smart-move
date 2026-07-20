import { applyCors, handlePreflight, getClientIp } from '../http.js';
import { withDB } from '../store.js';
import { findListingByToken, isLinkValid } from '../tokens.js';
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
    const rl = checkRateLimit(db, `listing-token:${ip}`, { max: 30, windowMs: 5 * 60 * 1000, lockoutMs: 10 * 60 * 1000 });
    if (!rl.allowed) return { rateLimited: true, retryAfterSeconds: rl.retryAfterSeconds };

    const found = findListingByToken(db, token);
    if (!found) return { valid: false, reason: 'not_found' };

    const { listing, link } = found;
    if (!isLinkValid(link)) {
      return { valid: false, reason: link.revoked ? 'revoked' : 'expired' };
    }

    link.viewCount = (link.viewCount || 0) + 1;
    link.lastViewedAt = new Date().toISOString();
    logEvent(listing, AUDIT_EVENTS.VIEWED, { actor: 'client', role: 'client', detail: 'Client opened the listing checklist' });
    listing.updatedAt = link.lastViewedAt;

    return {
      valid: true,
      alreadySubmitted: !!listing.clientSubmission,
      locked: !!listing.approved,
      listingType: listing.listingType,
      clientName: listing.clientName || '',
      propertyAddress: listing.propertyAddress || '',
      unitNumber: listing.unitNumber || '',
      targetGoLiveDate: listing.targetGoLiveDate || '',
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
