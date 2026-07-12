import { applyCors, handlePreflight, parseJsonBody } from '../http.js';
import { requireAdmin } from '../auth.js';
import { withDB } from '../store.js';
import { ensureListings, newListing, toListingSummary, LISTING_TYPES } from '../listing.js';
import { logEvent, AUDIT_EVENTS } from '../audit.js';

export default async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (!(await requireAdmin(req, res))) return;

  if (req.method === 'GET') {
    const result = await withDB((db) => {
      return Object.values(ensureListings(db))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(toListingSummary);
    });
    return res.status(200).json({ success: true, listings: result });
  }

  if (req.method === 'POST') {
    const body = parseJsonBody(req);
    if (body == null) return res.status(400).json({ success: false, error: 'Invalid JSON' });

    const listingType = String(body.listingType || '').trim();
    const clientName = String(body.clientName || '').trim();
    const propertyAddress = String(body.propertyAddress || '').trim();

    if (!LISTING_TYPES.includes(listingType)) {
      return res.status(400).json({ success: false, error: 'listingType must be "sale" or "lease"' });
    }
    if (!clientName || !propertyAddress) {
      return res.status(400).json({ success: false, error: 'clientName and propertyAddress are required' });
    }

    const listing = newListing({
      listingType,
      clientName,
      clientEmail: body.clientEmail,
      propertyAddress,
      unitNumber: body.unitNumber,
      targetGoLiveDate: body.targetGoLiveDate,
      notes: body.notes,
    });
    logEvent(listing, AUDIT_EVENTS.CREATED, { actor: 'admin', detail: `Listing intake file created (${listingType})` });

    await withDB((db) => {
      ensureListings(db)[listing.id] = listing;
    });

    return res.status(201).json({ success: true, listing: toListingSummary(listing) });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
