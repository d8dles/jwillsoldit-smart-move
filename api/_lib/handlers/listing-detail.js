import { applyCors, handlePreflight, parseJsonBody } from '../http.js';
import { requireAdmin } from '../auth.js';
import { withDB, readDB } from '../store.js';
import {
  ensureListings, deriveListingStatus, applicableItems,
  computeOutstandingItems, computeListingFlags,
} from '../listing.js';
import { decryptToken } from '../crypto.js';
import { isLinkValid } from '../tokens.js';

function baseUrl(req) {
  return process.env.ALLOWED_ORIGIN || `https://${req.headers.host}`;
}

function linkView(link, req) {
  if (!link) return null;
  const raw = decryptToken(link.encryptedToken);
  return {
    createdAt: link.createdAt,
    expiresAt: link.expiresAt,
    revoked: !!link.revoked,
    valid: isLinkValid(link),
    viewCount: link.viewCount || 0,
    lastViewedAt: link.lastViewedAt || null,
    url: raw ? `${baseUrl(req)}/forms/listing-intake/${raw}` : null,
  };
}

function detailView(l, req) {
  const items = applicableItems(l).map((item) => ({
    key: item.key,
    label: item.label,
    doc: !!item.doc,
    received: !!(l.itemsReceived && l.itemsReceived[item.key]),
    uploaded: !!(l.clientSubmission?.uploads && l.clientSubmission.uploads[item.key]),
  }));
  return {
    ...l,
    clientLink: linkView(l.clientLink, req),
    status: deriveListingStatus(l),
    checklist: items,
    outstanding: computeOutstandingItems(l),
    flags: computeListingFlags(l),
  };
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (!(await requireAdmin(req, res))) return;

  const { id } = req.query;

  if (req.method === 'GET') {
    const db = await readDB();
    const l = ensureListings(db)[id];
    if (!l) return res.status(404).json({ success: false, error: 'Not found' });
    return res.status(200).json({ success: true, listing: detailView(l, req) });
  }

  if (req.method === 'PATCH') {
    const body = parseJsonBody(req);
    if (body == null) return res.status(400).json({ success: false, error: 'Invalid JSON' });

    const editable = ['clientName', 'clientEmail', 'propertyAddress', 'unitNumber', 'targetGoLiveDate', 'notes'];
    const result = await withDB((db) => {
      const l = ensureListings(db)[id];
      if (!l) return null;

      for (const key of editable) {
        if (Object.prototype.hasOwnProperty.call(body, key)) {
          l[key] = String(body[key] ?? '');
        }
      }

      // Toggle checklist items received outside the form:
      // { itemsReceived: { survey_t47: true, keys_access: false } }
      if (body.itemsReceived && typeof body.itemsReceived === 'object') {
        if (!l.itemsReceived) l.itemsReceived = {};
        for (const [key, val] of Object.entries(body.itemsReceived)) {
          if (val) {
            l.itemsReceived[key] = { receivedAt: new Date().toISOString(), via: 'admin' };
          } else {
            delete l.itemsReceived[key];
          }
        }
      }

      if (body.markLive === true && !l.liveAt) l.liveAt = new Date().toISOString();
      if (body.markLive === false) l.liveAt = null;

      l.updatedAt = new Date().toISOString();
      return l;
    });

    if (!result) return res.status(404).json({ success: false, error: 'Not found' });
    return res.status(200).json({ success: true, listing: detailView(result, req) });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
