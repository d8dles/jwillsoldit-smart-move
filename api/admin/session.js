import { applyCors, handlePreflight } from '../_lib/http.js';
import { isAdminAuthenticated } from '../_lib/auth.js';

export default async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const authenticated = await isAdminAuthenticated(req);
  return res.status(200).json({ success: true, authenticated });
}
