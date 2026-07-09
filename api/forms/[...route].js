// Catch-all router for every /api/forms/* endpoint. See the comment in
// api/admin/[...route].js for why the module routes through two catch-all
// functions instead of one file per endpoint.

import verifyTokenHandler from '../_lib/handlers/verify-token.js';
import submitClientHandler from '../_lib/handlers/submit-client.js';
import submitPmHandler from '../_lib/handlers/submit-pm.js';

export default async function handler(req, res) {
  const raw = req.query.route;
  const seg = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const [a] = seg;

  if (seg.length === 1) {
    if (a === 'verify-token') return verifyTokenHandler(req, res);
    if (a === 'submit-client') return submitClientHandler(req, res);
    if (a === 'submit-pm') return submitPmHandler(req, res);
  }

  return res.status(404).json({ success: false, error: 'Unknown forms route' });
}
