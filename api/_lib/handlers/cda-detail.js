import { applyCors, handlePreflight, parseJsonBody } from '../http.js';
import { requireAdmin } from '../auth.js';
import { withDB, readDB, getRecord } from '../store.js';
import { ensureCdas, deriveCdaStatus, REQUIRED_ITEMS, computeOutstandingItems } from '../cda.js';
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
    url: raw ? `${baseUrl(req)}/forms/cda/${raw}` : null,
  };
}

function detailView(c, req) {
  const items = REQUIRED_ITEMS.map((item) => ({
    key: item.key,
    label: item.label,
    doc: !!item.doc,
    received: !!(c.itemsReceived && c.itemsReceived[item.key]),
    uploaded: !!(c.clientSubmission?.uploads && c.clientSubmission.uploads[item.key]),
  }));
  return {
    ...c,
    clientLink: linkView(c.clientLink, req),
    status: deriveCdaStatus(c),
    checklist: items,
    outstanding: computeOutstandingItems(c),
  };
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (!(await requireAdmin(req, res))) return;

  const { id } = req.query;

  if (req.method === 'GET') {
    const db = await readDB();
    const c = getRecord(ensureCdas(db), id);
    if (!c) return res.status(404).json({ success: false, error: 'Not found' });
    return res.status(200).json({ success: true, cda: detailView(c, req) });
  }

  if (req.method === 'PATCH') {
    const body = parseJsonBody(req);
    if (body == null) return res.status(400).json({ success: false, error: 'Invalid JSON' });

    const editable = [
      'clientName', 'propertyAddress', 'unitNumber', 'community', 'closingDate',
      'transactionValue', 'totalCommission', 'commissionBasis',
      'payeeName', 'payeeCompany', 'payeeEmail', 'payeeAmount', 'notes',
    ];
    const result = await withDB((db) => {
      const c = getRecord(ensureCdas(db), id);
      if (!c) return null;

      for (const key of editable) {
        if (Object.prototype.hasOwnProperty.call(body, key)) {
          c[key] = String(body[key] ?? '');
        }
      }

      // Toggle checklist items received outside the form:
      // { itemsReceived: { signed_cda: true, w9: false } }
      if (body.itemsReceived && typeof body.itemsReceived === 'object') {
        if (!c.itemsReceived) c.itemsReceived = {};
        for (const [key, val] of Object.entries(body.itemsReceived)) {
          if (val) {
            c.itemsReceived[key] = { receivedAt: new Date().toISOString(), via: 'admin' };
          } else {
            delete c.itemsReceived[key];
          }
        }
      }

      if (body.markDisbursed === true && !c.disbursedAt) c.disbursedAt = new Date().toISOString();
      if (body.markDisbursed === false) c.disbursedAt = null;

      c.updatedAt = new Date().toISOString();
      return c;
    });

    if (!result) return res.status(404).json({ success: false, error: 'Not found' });
    return res.status(200).json({ success: true, cda: detailView(result, req) });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
