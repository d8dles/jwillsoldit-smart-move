const HUBSPOT_API = 'https://api.hubapi.com';

// Escape user-controlled values before interpolating into the alert email's HTML
// body. Covers the five HTML-significant characters so injected markup renders as
// inert text. The plain-text part of the email needs no escaping.
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Cached across warm invocations: once the HubSpot custom properties have been
// ensured successfully, skip repeated schema fetch/create round-trips entirely.
let customPropertiesEnsured = false;

const CUSTOM_PROPERTIES = [
  { name: 'smart_move_brief',         label: 'Smart Move Brief',         fieldType: 'textarea',  type: 'string' },
  { name: 'smart_move_route',         label: 'Smart Move Route',         fieldType: 'text',      type: 'string' },
  { name: 'smart_move_timeline',      label: 'Smart Move Timeline',      fieldType: 'text',      type: 'string' },
  { name: 'smart_move_budget',        label: 'Smart Move Budget',        fieldType: 'text',      type: 'string' },
  { name: 'smart_move_readiness',     label: 'Smart Move Readiness',     fieldType: 'text',      type: 'string' },
  { name: 'smart_move_areas',         label: 'Smart Move Areas',         fieldType: 'text',      type: 'string' },
  { name: 'smart_move_criteria',      label: 'Smart Move Criteria',      fieldType: 'textarea',  type: 'string' },
  { name: 'smart_move_submission_id', label: 'Smart Move Submission ID', fieldType: 'text',      type: 'string' },
  { name: 'smart_move_submitted_at',  label: 'Smart Move Submitted At',  fieldType: 'text',      type: 'string' },
  { name: 'smart_move_referral_name', label: 'Smart Move Referral Name', fieldType: 'text',      type: 'string' },
  { name: 'smart_move_referral_phone', label: 'Smart Move Referral Phone', fieldType: 'phonenumber', type: 'string' },
  { name: 'smart_move_preferred_contact', label: 'Smart Move Preferred Contact', fieldType: 'text', type: 'string' },
  { name: 'smart_move_best_contact_time', label: 'Smart Move Best Contact Time', fieldType: 'text', type: 'string' },
  { name: 'smart_move_contact_consent', label: 'Smart Move Contact Consent', fieldType: 'text', type: 'string' },
  { name: 'smart_move_marketing_consent', label: 'Smart Move Marketing Consent', fieldType: 'text', type: 'string' },
  { name: 'smart_move_consent_version', label: 'Smart Move Consent Version', fieldType: 'text', type: 'string' },
  { name: 'smart_move_consent_at', label: 'Smart Move Consent At', fieldType: 'text', type: 'string' },
  { name: 'smart_move_utm_source', label: 'Smart Move UTM Source', fieldType: 'text', type: 'string' },
  { name: 'smart_move_utm_medium', label: 'Smart Move UTM Medium', fieldType: 'text', type: 'string' },
  { name: 'smart_move_utm_campaign', label: 'Smart Move UTM Campaign', fieldType: 'text', type: 'string' },
  { name: 'smart_move_utm_content', label: 'Smart Move UTM Content', fieldType: 'text', type: 'string' },
  { name: 'smart_move_utm_term', label: 'Smart Move UTM Term', fieldType: 'text', type: 'string' },
  { name: 'smart_move_fbclid', label: 'Smart Move Facebook Click ID', fieldType: 'text', type: 'string' },
];

export function buildTrackingProperties(payload) {
  const tracking = payload?.metadata?.tracking || {};
  return {
    smart_move_utm_source: tracking.utm_source || '',
    smart_move_utm_medium: tracking.utm_medium || '',
    smart_move_utm_campaign: tracking.utm_campaign || '',
    smart_move_utm_content: tracking.utm_content || '',
    smart_move_utm_term: tracking.utm_term || '',
    smart_move_fbclid: tracking.fbclid || '',
  };
}

function buildBriefText(payload) {
  const p = payload;
  const lines = [
    `Smart Move Brief — ${p.routeLabel || p.path || 'Unknown route'}`,
    `Submitted: ${p.metadata?.submittedAt || new Date().toISOString()}`,
    `Submission ID: ${p.metadata?.submissionId || '—'}`,
    '',
    `Name: ${p.contact?.name || '—'}`,
    `Email: ${p.contact?.email || '—'}`,
    `Phone: ${p.contact?.phone || '—'}`,
    `Referral Name: ${p.contact?.referralName || '—'}`,
    `Referral Phone: ${p.contact?.referralPhone || '—'}`,
    `Preferred Contact: ${p.contact?.preferredContact || '—'}`,
    `Best Contact Time: ${p.contact?.bestContactTime || '—'}`,
    `Contact Consent: ${p.contact?.contactConsent ? 'Yes' : 'No'}`,
    `Marketing Consent: ${p.contact?.marketingConsent ? 'Yes' : 'No'}`,
    `Consent Version: ${p.contact?.consentVersion || '—'}`,
    `Consent At: ${p.contact?.consentAt || '—'}`,
    '',
    `Route: ${p.routeLabel || '—'}`,
    `Timeline: ${p.timelineLabel || '—'}`,
    `Budget: ${p.budgetLabel || '—'}`,
    `Readiness: ${p.readinessLabel || '—'}`,
    `Areas: ${p.areasLabel || '—'}`,
    `Criteria: ${p.criteriaLabel || '—'}`,
  ];

  if (Array.isArray(p.selectedDetails) && p.selectedDetails.length) {
    lines.push('', 'Selected Details:');
    p.selectedDetails.forEach(d => {
      const label = typeof d === 'object' ? d.label : d;
      const value = typeof d === 'object' ? d.value : '';
      lines.push(value ? `  • ${label}: ${value}` : `  • ${label}`);
    });
  }

  if (p.fullPathData && Object.keys(p.fullPathData).length) {
    lines.push('', 'Path Data:');
    Object.entries(p.fullPathData).forEach(([k, v]) => {
      const val = Array.isArray(v) ? v.join(', ') : String(v ?? '');
      if (val) lines.push(`  ${k}: ${val}`);
    });
  }

  if (p.fullTrunk && Object.keys(p.fullTrunk).length) {
    lines.push('', 'Trunk Data:');
    Object.entries(p.fullTrunk).forEach(([k, v]) => {
      const val = Array.isArray(v) ? v.join(', ') : String(v ?? '');
      if (val) lines.push(`  ${k}: ${val}`);
    });
  }

  const tracking = p.metadata?.tracking || {};
  lines.push(
    '',
    'Attribution:',
    `  UTM Source: ${tracking.utm_source || '—'}`,
    `  UTM Medium: ${tracking.utm_medium || '—'}`,
    `  UTM Campaign: ${tracking.utm_campaign || '—'}`,
    `  UTM Content: ${tracking.utm_content || '—'}`,
    `  UTM Term: ${tracking.utm_term || '—'}`,
    `  Facebook Click ID: ${tracking.fbclid || '—'}`,
    '',
    `Device: ${p.metadata?.deviceType || '—'}`,
  );
  return lines.join('\n');
}

async function ensureCustomProperties(token) {
  // Fetch existing property names
  const res = await fetch(
    `${HUBSPOT_API}/crm/v3/properties/contacts?dataSensitivity=non_sensitive`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  if (!res.ok) {
    console.warn('[smart-move] Could not fetch existing properties, skipping ensure step');
    return false;
  }
  const data = await res.json();
  const existing = new Set((data.results || []).map(p => p.name));

  let allOk = true;
  for (const prop of CUSTOM_PROPERTIES) {
    if (existing.has(prop.name)) continue;
    const createRes = await fetch(`${HUBSPOT_API}/crm/v3/properties/contacts`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: prop.name,
        label: prop.label,
        groupName: 'contactinformation',
        fieldType: prop.fieldType,
        type: prop.type,
      }),
    });
    if (!createRes.ok) {
      const err = await createRes.text();
      console.warn(`[smart-move] Could not create property ${prop.name}: ${err}`);
      allOk = false;
    } else {
      console.log(`[smart-move] Created property: ${prop.name}`);
    }
  }
  // Only report success when every property is present — a partial failure lets
  // a later request retry the ensure step (graceful fall-through, as before).
  return allOk;
}

async function upsertContact(token, payload) {
  const { email, name, phone } = payload.contact || {};
  const briefText = buildBriefText(payload);

  const properties = {
    email,
    smart_move_brief:         briefText,
    smart_move_route:         payload.routeLabel || payload.path || '',
    smart_move_timeline:      payload.timelineLabel || '',
    smart_move_budget:        payload.budgetLabel || '',
    smart_move_readiness:     payload.readinessLabel || '',
    smart_move_areas:         payload.areasLabel || '',
    smart_move_criteria:      payload.criteriaLabel || '',
    smart_move_submission_id: payload.metadata?.submissionId || '',
    smart_move_submitted_at:  payload.metadata?.submittedAt || new Date().toISOString(),
    smart_move_referral_name: payload.contact?.referralName || '',
    smart_move_referral_phone: payload.contact?.referralPhone || '',
    smart_move_preferred_contact: payload.contact?.preferredContact || '',
    smart_move_best_contact_time: payload.contact?.bestContactTime || '',
    smart_move_contact_consent: payload.contact?.contactConsent ? 'Yes' : 'No',
    smart_move_marketing_consent: payload.contact?.marketingConsent ? 'Yes' : 'No',
    smart_move_consent_version: payload.contact?.consentVersion || '',
    smart_move_consent_at: payload.contact?.consentAt || '',
    ...buildTrackingProperties(payload),
  };

  if (name) {
    properties.firstname = name.split(' ')[0] || name;
    if (name.includes(' ')) properties.lastname = name.split(' ').slice(1).join(' ');
  }
  if (phone) properties.phone = phone;

  // Search for existing contact
  const searchRes = await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts/search`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
      properties: ['id'],
      limit: 1,
    }),
  });

  if (!searchRes.ok) {
    const err = await searchRes.text();
    throw new Error(`HubSpot contact search failed: ${searchRes.status} ${err}`);
  }

  const searchData = await searchRes.json();

  if (searchData.total > 0) {
    const contactId = searchData.results[0].id;
    const updateRes = await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts/${contactId}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ properties }),
    });
    if (!updateRes.ok) {
      const err = await updateRes.text();
      throw new Error(`HubSpot contact update failed: ${updateRes.status} ${err}`);
    }
    return contactId;
  }

  const createRes = await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ properties }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`HubSpot contact create failed: ${createRes.status} ${err}`);
  }

  const created = await createRes.json();
  return created.id;
}

async function sendLeadAlert(payload, contactId) {
  const apiKey = process.env.RESEND_API_KEY;
  const to     = process.env.LEAD_ALERT_TO;
  const from   = process.env.LEAD_ALERT_FROM;

  if (!apiKey || !to || !from) {
    console.warn('[smart-move] Lead alert skipped: RESEND_API_KEY, LEAD_ALERT_TO, or LEAD_ALERT_FROM not set');
    return;
  }

  const { name, email, phone, referralName, referralPhone } = payload.contact || {};
  const route        = payload.routeLabel    || payload.path || '—';
  const timeline     = payload.timelineLabel || '—';
  const budget       = payload.budgetLabel   || '—';
  const readiness    = payload.readinessLabel|| '—';
  const areas        = payload.areasLabel    || '—';
  const criteria     = payload.criteriaLabel || '—';
  const submissionId = payload.metadata?.submissionId || '—';
  const submittedAt  = payload.metadata?.submittedAt  || '—';
  const brief        = buildBriefText(payload);
  const hubspotLink  = `https://app-na2.hubspot.com/contacts/246507261/contact/${contactId}`;

  const isPartial = payload.metadata?.submissionType === 'partial_contact';
  const isHubQuestion = payload.metadata?.submissionType === 'hub_question';
  const submissionTypeLabel = isHubQuestion
    ? 'Website Question'
    : isPartial
      ? 'Partial Contact'
      : 'Completed Brief';
  const subject = isHubQuestion
    ? `Website Question: ${name || '—'} — ${route}`
    : isPartial
      ? `Partial Smart Move Lead: ${name || '—'} — ${route}`
      : `Completed Smart Move Lead: ${name || '—'} — ${route} — ${budget}`;

  // Escape every user-controlled value before it lands in the HTML body so
  // injected markup renders as inert text. hubspotLink and submissionTypeLabel
  // are server-derived, not user input, but escaping them too is harmless.
  const html = `
<h2 style="font-family:sans-serif;margin-bottom:16px;">${escapeHtml(submissionTypeLabel)}</h2>
<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:14px;">
  <tr><td style="font-weight:bold;padding-right:16px;">Submission Type</td><td>${escapeHtml(submissionTypeLabel)}</td></tr>
  <tr><td style="font-weight:bold;padding-right:16px;">Name</td><td>${escapeHtml(name) || '—'}</td></tr>
  <tr><td style="font-weight:bold;padding-right:16px;">Email</td><td><a href="mailto:${escapeHtml(email)}">${escapeHtml(email) || '—'}</a></td></tr>
  <tr><td style="font-weight:bold;padding-right:16px;">Phone</td><td>${escapeHtml(phone) || '—'}</td></tr>
  <tr><td style="font-weight:bold;padding-right:16px;">Referral Name</td><td>${escapeHtml(referralName) || '—'}</td></tr>
  <tr><td style="font-weight:bold;padding-right:16px;">Referral Phone</td><td>${escapeHtml(referralPhone) || '—'}</td></tr>
  <tr><td style="font-weight:bold;padding-right:16px;">Route</td><td>${escapeHtml(route)}</td></tr>
  <tr><td style="font-weight:bold;padding-right:16px;">Timeline</td><td>${escapeHtml(timeline)}</td></tr>
  <tr><td style="font-weight:bold;padding-right:16px;">Budget</td><td>${escapeHtml(budget)}</td></tr>
  <tr><td style="font-weight:bold;padding-right:16px;">Readiness</td><td>${escapeHtml(readiness)}</td></tr>
  <tr><td style="font-weight:bold;padding-right:16px;">Areas</td><td>${escapeHtml(areas)}</td></tr>
  <tr><td style="font-weight:bold;padding-right:16px;">Criteria</td><td>${escapeHtml(criteria)}</td></tr>
  <tr><td style="font-weight:bold;padding-right:16px;">Submission ID</td><td>${escapeHtml(submissionId)}</td></tr>
  <tr><td style="font-weight:bold;padding-right:16px;">Submitted At</td><td>${escapeHtml(submittedAt)}</td></tr>
  <tr><td style="font-weight:bold;padding-right:16px;">HubSpot Contact</td><td><a href="${escapeHtml(hubspotLink)}">${escapeHtml(hubspotLink)}</a></td></tr>
</table>
<h3 style="font-family:sans-serif;margin-top:24px;">Smart Move Brief</h3>
<pre style="background:#f5f5f5;padding:12px;font-size:13px;white-space:pre-wrap;font-family:monospace;">${escapeHtml(brief)}</pre>
`.trim();

  const text = [
    subject,
    '',
    `Submission Type: ${submissionTypeLabel}`,
    `Name:          ${name || '—'}`,
    `Email:         ${email || '—'}`,
    `Phone:         ${phone || '—'}`,
    `Referral Name: ${referralName || '—'}`,
    `Referral Phone: ${referralPhone || '—'}`,
    `Route:         ${route}`,
    `Timeline:      ${timeline}`,
    `Budget:        ${budget}`,
    `Readiness:     ${readiness}`,
    `Areas:         ${areas}`,
    `Criteria:      ${criteria}`,
    `Submission ID: ${submissionId}`,
    `Submitted At:  ${submittedAt}`,
    `HubSpot:       ${hubspotLink}`,
    '',
    '--- Smart Move Brief ---',
    brief,
  ].join('\n');

  const alertRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  });

  if (!alertRes.ok) {
    const errBody = await alertRes.text();
    throw new Error(`Resend API ${alertRes.status}: ${errBody}`);
  }
}

export function buildClientConfirmation(payload) {
  const fullName = payload.contact?.name?.trim() || '';
  const firstName = fullName.split(/\s+/)[0] || 'there';
  const route = payload.routeLabel || payload.path || 'your move';
  const subject = `${firstName}, your Smart Move brief is in`;
  const guidesUrl = 'https://www.jwillsoldit.com/houston';
  const phoneUrl = 'tel:+15616856566';
  const safeFirstName = escapeHtml(firstName);
  const safeRoute = escapeHtml(route);

  const html = `
<div style="margin:0;background:#f6f2e9;padding:32px 16px;color:#1c3b2e;font-family:Arial,sans-serif;">
  <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #ded8cc;padding:36px;">
    <p style="margin:0 0 22px;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#b05c2e;">JWILLSOLDIT · Smart Move</p>
    <h1 style="margin:0 0 20px;font-size:30px;font-weight:500;line-height:1.15;color:#1c3b2e;">Your Smart Move brief is in.</h1>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Hi ${safeFirstName},</p>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Thank you for trusting me with ${safeRoute}. I received your completed brief, and your move is a priority. I’ll review what you shared and be in contact shortly with the next steps.</p>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.7;">While I’m reviewing it, explore <strong>Houston, Handled.</strong> It covers the property taxes, flood questions, utility districts, commutes, and area details that can change a Houston move.</p>
    <p style="margin:0 0 28px;"><a href="${guidesUrl}" style="display:inline-block;background:#1c3b2e;color:#ffffff;text-decoration:none;padding:13px 18px;font-size:13px;font-weight:700;letter-spacing:0.05em;">Explore the Houston guides</a></p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">If anything changes before I reach out, reply directly to this email or <a href="${phoneUrl}" style="color:#b05c2e;">call or text me</a>.</p>
    <p style="margin:0;font-size:15px;line-height:1.6;"><strong>Joey Williams</strong><br>REALTOR® · Christin Rachelle Group<br><a href="${phoneUrl}" style="color:#b05c2e;">(561) 685-6566</a> · <a href="mailto:joey@jwillsoldit.com" style="color:#b05c2e;">joey@jwillsoldit.com</a></p>
  </div>
</div>`.trim();

  const text = [
    `Hi ${firstName},`,
    '',
    `Thank you for trusting me with ${route}. I received your completed brief, and your move is a priority. I’ll review what you shared and be in contact shortly with the next steps.`,
    '',
    'While I’m reviewing it, explore Houston, Handled. It covers the property taxes, flood questions, utility districts, commutes, and area details that can change a Houston move.',
    guidesUrl,
    '',
    'If anything changes before I reach out, reply directly to this email or call or text me.',
    '',
    'Joey Williams',
    'REALTOR® · Christin Rachelle Group',
    '(561) 685-6566 · joey@jwillsoldit.com',
  ].join('\n');

  return { subject, html, text };
}

async function sendClientConfirmation(payload) {
  if (payload.metadata?.submissionType !== 'final') return false;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CLIENT_CONFIRMATION_FROM || process.env.LEAD_ALERT_FROM;
  const to = payload.contact?.email?.trim();
  if (!apiKey || !from || !to) {
    console.warn('[smart-move] Client confirmation skipped: RESEND_API_KEY, sender, or client email not set');
    return false;
  }

  const message = buildClientConfirmation(payload);
  const submissionId = payload.metadata?.submissionId || `contact-${to}`;
  const confirmationRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `smart-move-confirmation/${submissionId}`,
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: 'joey@jwillsoldit.com',
      ...message,
    }),
  });

  if (!confirmationRes.ok) {
    const errBody = await confirmationRes.text();
    throw new Error(`Resend confirmation API ${confirmationRes.status}: ${errBody}`);
  }
  return true;
}

async function tryAttachNote(token, contactId, noteText) {
  try {
    const createNoteRes = await fetch(`${HUBSPOT_API}/crm/v3/objects/notes`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        properties: {
          hs_note_body: noteText,
          hs_timestamp: Date.now().toString(),
        },
      }),
    });
    if (!createNoteRes.ok) return;
    const note = await createNoteRes.json();
    await fetch(
      `${HUBSPOT_API}/crm/v3/objects/notes/${note.id}/associations/contacts/${contactId}/note_to_contact`,
      { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } }
    );
  } catch (err) {
    console.warn('[smart-move] Note creation skipped (optional):', err.message);
  }
}

export default async function handler(req, res) {
  const requestOrigin = req.headers.origin || '';
  const configuredOrigins = (process.env.ALLOWED_ORIGIN || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
  const fixedOrigins = [
    'https://move.jwillsoldit.com',
    'https://jwillsoldit.com',
    'https://www.jwillsoldit.com',
  ];
  const isHubPreview = /^https:\/\/jwillsoldit-hub-[a-z0-9-]+\.vercel\.app$/.test(requestOrigin);
  const allowedOrigin = [...fixedOrigins, ...configuredOrigins].includes(requestOrigin) || isHubPreview
    ? requestOrigin
    : 'https://move.jwillsoldit.com';

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    console.error('[smart-move] HUBSPOT_ACCESS_TOKEN is not set');
    return res.status(500).json({ success: false, error: 'Server configuration error' });
  }

  let payload;
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid JSON' });
  }

  // Honeypot: a hidden form field no human fills. If it carries a value the
  // request is almost certainly a bot — respond with the normal success shape
  // but silently drop it (no HubSpot, no Resend) so bots aren't tipped off.
  const honeypot = typeof payload?.honeypot === 'string' ? payload.honeypot.trim() : '';
  if (honeypot) {
    return res.status(200).json({
      success: true,
      contactId: null,
      submissionId: payload?.metadata?.submissionId || null,
    });
  }

  const email = payload?.contact?.email?.trim();
  const name  = payload?.contact?.name?.trim();

  if (!email || !name) {
    return res.status(400).json({ success: false, error: 'name and email are required' });
  }
  if (payload?.contact?.contactConsent !== true) {
    return res.status(400).json({ success: false, error: 'contact consent is required' });
  }

  try {
    if (!customPropertiesEnsured) {
      if (await ensureCustomProperties(token)) customPropertiesEnsured = true;
    }
    const contactId = await upsertContact(token, payload);
    const briefText = buildBriefText(payload);
    await tryAttachNote(token, contactId, briefText);

    try {
      await sendLeadAlert(payload, contactId);
    } catch (err) {
      console.warn('[smart-move] Lead alert email failed:', err.message);
    }

    let confirmationSent = false;
    try {
      confirmationSent = await sendClientConfirmation(payload);
    } catch (err) {
      console.warn('[smart-move] Client confirmation email failed:', err.message);
    }

    return res.status(200).json({
      success: true,
      contactId,
      submissionId: payload?.metadata?.submissionId || null,
      confirmationSent,
    });
  } catch (err) {
    console.error('[smart-move] HubSpot error:', err.message);
    return res.status(502).json({ success: false, error: 'CRM sync failed. Please try again.' });
  }
}
