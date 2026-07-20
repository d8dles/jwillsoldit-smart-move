import { applyCors, handlePreflight, parseJsonBody, getClientIp } from '../http.js';
import {
  checkPassword,
  createAdminSession,
  isLoginLocked,
  recordLoginFailure,
  clearLoginFailures,
  is2faEnabled,
  createLoginChallenge,
} from '../auth.js';
import { withDB } from '../store.js';

async function email2faCode(code) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.LEAD_ALERT_FROM;
  const to = process.env.ADMIN_2FA_EMAIL;
  if (!apiKey || !from || !to) {
    throw new Error('2FA is enabled (ADMIN_2FA_EMAIL is set) but RESEND_API_KEY / LEAD_ALERT_FROM are not configured');
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `${code} — your JWillSoldIt admin sign-in code`,
      text:
        `Your JWillSoldIt admin sign-in code is: ${code}\n\n` +
        'It expires in 10 minutes. If you did not try to sign in, someone has your admin password — change it in the Vercel dashboard now.',
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Resend ${res.status}: ${errBody}`);
  }
}

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

  const ip = getClientIp(req);

  const result = await withDB((db) => {
    const lock = isLoginLocked(db, ip);
    if (lock.locked) return { locked: true, retryAfterSeconds: lock.retryAfterSeconds };

    if (!checkPassword(body.password)) {
      recordLoginFailure(db, ip);
      return { badPassword: true };
    }

    clearLoginFailures(db, ip);
    if (!is2faEnabled()) return { direct: true };
    return { challenge: createLoginChallenge(db) };
  });

  if (result.locked) {
    const minutes = Math.max(1, Math.ceil(result.retryAfterSeconds / 60));
    return res.status(429).json({
      success: false,
      error: `Too many failed sign-in attempts. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    });
  }

  if (result.badPassword) {
    // Deliberately vague — don't confirm or deny anything about the credential.
    return res.status(401).json({ success: false, error: 'Incorrect password' });
  }

  if (result.direct) {
    await createAdminSession(req, res);
    return res.status(200).json({ success: true });
  }

  // 2FA path: fail closed. If the code email can't be sent, no session is
  // issued — a misconfigured mailer must not silently disable 2FA.
  try {
    await email2faCode(result.challenge.code);
  } catch (err) {
    console.error('[admin/login] Could not send 2FA code:', err.message);
    return res.status(500).json({ success: false, error: 'Could not send the verification code email. Check the Resend configuration.' });
  }

  return res.status(200).json({ success: true, requires2fa: true, challengeId: result.challenge.id });
}
