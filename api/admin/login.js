import { applyCors, handlePreflight, parseJsonBody } from '../_lib/http.js';
import { checkPassword, createAdminSession } from '../_lib/auth.js';

export default async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  if (!process.env.ADMIN_PASSWORD) {
    console.error('[admin/login] ADMIN_PASSWORD is not set');
    return res.status(500).json({ success: false, error: 'Server configuration error' });
  }

  const body = parseJsonBody(req);
  if (body == null) return res.status(400).json({ success: false, error: 'Invalid JSON' });

  if (!checkPassword(body.password)) {
    // Deliberately vague — don't confirm or deny anything about the credential.
    return res.status(401).json({ success: false, error: 'Incorrect password' });
  }

  await createAdminSession(req, res);
  return res.status(200).json({ success: true });
}
