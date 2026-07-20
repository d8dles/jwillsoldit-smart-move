import { applyCors, handlePreflight } from '../http.js';
import { requireAdmin } from '../auth.js';
import { withDB, getRecord } from '../store.js';
import { ensureListings, deriveListingStatus } from '../listing.js';
import { logEvent, AUDIT_EVENTS } from '../audit.js';

export default async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { id } = req.query;

  const result = await withDB((db) => {
    const l = getRecord(ensureListings(db), id);
    if (!l) return { error: 'not_found' };
    if (l.approved) return { error: 'bad_state', listing: l };

    l.approved = true;
    l.approvedAt = new Date().toISOString();
    l.updatedAt = l.approvedAt;
    logEvent(l, AUDIT_EVENTS.APPROVED, { actor: 'admin', detail: 'Listing intake approved by Joey' });
    return { listing: l };
  });

  if (result.error === 'not_found') return res.status(404).json({ success: false, error: 'Not found' });
  if (result.error === 'bad_state') {
    return res.status(409).json({ success: false, error: 'Listing is already approved' });
  }
  return res.status(200).json({
    success: true,
    listing: { ...result.listing, status: deriveListingStatus(result.listing) },
  });
}
