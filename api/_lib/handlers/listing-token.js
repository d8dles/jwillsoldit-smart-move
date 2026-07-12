import { applyCors, handlePreflight } from '../http.js';
import { withDB } from '../store.js';
import { findListingByToken, isLinkValid } from '../tokens.js';
import { logEvent, AUDIT_EVENTS } from '../audit.js';

export default async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const token = typeof req.query.token === 'string' ? req.query.token : '';
  if (!token) return res.status(400).json({ success: false, error: 'token is required' });

  const result = await withDB((db) => {
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

  if (!result.valid) {
    return res.status(200).json({ success: true, valid: false, reason: result.reason });
  }
  return res.status(200).json({ success: true, ...result });
}
