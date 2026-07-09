import { applyCors, handlePreflight, parseJsonBody } from '../http.js';
import { createAdminSession, verifyLoginChallenge } from '../auth.js';
import { withDB } from '../store.js';

const REASON_MESSAGES = {
  invalid: 'This sign-in attempt is no longer valid. Start over from the password step.',
  expired: 'That code has expired. Start over from the password step.',
  too_many_attempts: 'Too many wrong codes. Start over from the password step.',
  wrong_code: 'That code isn’t right. Check the email and try again.',
};

export default async function handler(req, res) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const body = parseJsonBody(req);
  if (body == null) return res.status(400).json({ success: false, error: 'Invalid JSON' });

  const challengeId = String(body.challengeId || '');
  const code = String(body.code || '');
  if (!challengeId || !code) {
    return res.status(400).json({ success: false, error: 'challengeId and code are required' });
  }

  const result = await withDB((db) => verifyLoginChallenge(db, challengeId, code));

  if (!result.ok) {
    return res.status(401).json({
      success: false,
      error: REASON_MESSAGES[result.reason] || 'Verification failed',
      restart: !!result.restart,
    });
  }

  await createAdminSession(req, res);
  return res.status(200).json({ success: true });
}
