// Catch-all router for every /api/forms/* endpoint. See the comment in
// api/admin/[...route].js for why the module routes through two catch-all
// functions instead of one file per endpoint.

import verifyTokenHandler from '../_lib/handlers/verify-token.js';
import submitClientHandler from '../_lib/handlers/submit-client.js';
import submitPmHandler from '../_lib/handlers/submit-pm.js';

// See api/admin/[...route].js for why this parses req.url directly instead
// of relying on Vercel to populate req.query from the filename.
function parseRequest(req) {
  const [pathname, qs = ''] = (req.url || '').split('?');
  const prefix = '/api/forms/';
  const seg = pathname.startsWith(prefix) ? pathname.slice(prefix.length).split('/').filter(Boolean) : [];
  const query = { ...(req.query || {}) };
  for (const [k, v] of new URLSearchParams(qs)) query[k] = v;
  return { seg, query };
}

export default async function handler(req, res) {
  const { seg, query } = parseRequest(req);
  req.query = query;
  const [a] = seg;

  if (seg.length === 1) {
    if (a === 'verify-token') return verifyTokenHandler(req, res);
    if (a === 'submit-client') return submitClientHandler(req, res);
    if (a === 'submit-pm') return submitPmHandler(req, res);
  }

  return res.status(404).json({ success: false, error: 'Unknown forms route' });
}
