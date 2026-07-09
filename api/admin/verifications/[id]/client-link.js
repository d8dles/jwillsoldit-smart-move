import { applyCors, handlePreflight, parseJsonBody } from '../../../_lib/http.js';
import { requireAdmin } from '../../../_lib/auth.js';
import { withDB } from '../../../_lib/store.js';
import { makeLinkRecord } from '../../../_lib/tokens.js';
import { logEvent, AUDIT_EVENTS } from '../../../_lib/audit.js';

function baseUrl(req) {
  return process.env.ALLOWED_ORIGIN || `https://${req.headers.host}`;
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { id } = req.query;
  const body = parseJsonBody(req) || {};
  const ttlDays = Number.isFinite(body.ttlDays) && body.ttlDays > 0 ? body.ttlDays : undefined;

  const { raw, record } = makeLinkRecord(ttlDays);

  const result = await withDB((db) => {
    const v = db.verifications[id];
    if (!v) return null;
    v.clientLink = record;
    v.updatedAt = new Date().toISOString();
    logEvent(v, AUDIT_EVENTS.SENT, { actor: 'admin', role: 'client', detail: 'Client verification link generated' });
    return v;
  });

  if (!result) return res.status(404).json({ success: false, error: 'Not found' });

  return res.status(200).json({
    success: true,
    url: `${baseUrl(req)}/forms/client-verification/${raw}`,
    expiresAt: record.expiresAt,
  });
}
