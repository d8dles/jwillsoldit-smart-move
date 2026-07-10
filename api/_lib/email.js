import { escapeHtml } from './http.js';

export function outboundEmailConfigured() {
  return !!(process.env.RESEND_API_KEY && process.env.LEAD_ALERT_FROM);
}

export async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.LEAD_ALERT_FROM;
  if (!apiKey || !from || !to) {
    return { sent: false, reason: 'not_configured_or_no_recipient' };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.warn('[email] Resend delivery failed:', res.status, body);
    return { sent: false, reason: 'delivery_failed' };
  }

  return { sent: true };
}

export function fieldRows(rows) {
  return rows
    .filter(([, value]) => value)
    .map(([label, value]) => (
      `<tr><td style="font-weight:bold;padding:4px 16px 4px 0;">${escapeHtml(label)}</td>` +
      `<td style="padding:4px 0;">${escapeHtml(value)}</td></tr>`
    ))
    .join('');
}
