import { applyCors, handlePreflight, parseJsonBody } from '../http.js';
import { requireAdmin } from '../auth.js';
import { withDB, readDB } from '../store.js';
import { deriveStatus } from '../verification.js';
import { compareSubmissions } from '../invoice.js';
import { decryptToken } from '../crypto.js';
import { isLinkValid } from '../tokens.js';

function baseUrl(req) {
  return process.env.ALLOWED_ORIGIN || `https://${req.headers.host}`;
}

function linkView(link, req, kind) {
  if (!link) return null;
  const raw = decryptToken(link.encryptedToken);
  const path = kind === 'client' ? 'client-verification' : 'property-verification';
  return {
    createdAt: link.createdAt,
    expiresAt: link.expiresAt,
    revoked: !!link.revoked,
    valid: isLinkValid(link),
    viewCount: link.viewCount || 0,
    lastViewedAt: link.lastViewedAt || null,
    url: raw ? `${baseUrl(req)}/forms/${path}/${raw}` : null,
  };
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (!(await requireAdmin(req, res))) return;

  const { id } = req.query;

  if (req.method === 'GET') {
    const db = await readDB();
    const v = db.verifications[id];
    if (!v) return res.status(404).json({ success: false, error: 'Not found' });

    return res.status(200).json({
      success: true,
      verification: {
        ...v,
        clientLink: linkView(v.clientLink, req, 'client'),
        pmLink: linkView(v.pmLink, req, 'pm'),
        status: deriveStatus(v),
      },
      comparison: compareSubmissions(v.clientSubmission, v.pmSubmission),
    });
  }

  if (req.method === 'PATCH') {
    const body = parseJsonBody(req);
    if (body == null) return res.status(400).json({ success: false, error: 'Invalid JSON' });

    const editable = ['clientName', 'propertyName', 'propertyAddress', 'unitNumber', 'notes'];
    const result = await withDB((db) => {
      const v = db.verifications[id];
      if (!v) return null;
      for (const key of editable) {
        if (Object.prototype.hasOwnProperty.call(body, key)) {
          v[key] = String(body[key] ?? '');
        }
      }
      v.updatedAt = new Date().toISOString();
      return v;
    });

    if (!result) return res.status(404).json({ success: false, error: 'Not found' });
    return res.status(200).json({ success: true, verification: { ...result, status: deriveStatus(result) } });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
