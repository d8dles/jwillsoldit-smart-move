import { applyCors, handlePreflight } from '../_lib/http.js';
import { destroyAdminSession } from '../_lib/auth.js';

export default async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  await destroyAdminSession(req, res);
  return res.status(200).json({ success: true });
}
