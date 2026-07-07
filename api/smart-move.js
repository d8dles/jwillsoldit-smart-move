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
// ensured successfully, skip the 9-schema fetch/create round-trips entirely.
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
];

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

  lines.push('', `Device: ${p.metadata?.deviceType || '—'}`);
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

  const { name, email, phone } = payload.contact || {};
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
  const submissionTypeLabel = isPartial ? 'Partial Contact' : 'Completed Brief';
  const subject = isPartial
    ? `Partial Smart Move Lead: ${name || '—'} — ${route}`
    : `Completed Smart Move Lead: ${name || '—'} — ${route} — ${budget}`;

  // Escape every user-controlled value before it lands in the HTML body so
  // injected markup renders as inert text. hubspotLink and submissionTypeLabel
  // are server-derived, not user input, but escaping them too is harmless.
  const html = `
<h2 style="font-family:sans-serif;margin-bottom:16px;">${isPartial ? 'Partial' : 'Completed'} Smart Move Lead</h2>
<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:14px;">
  <tr><td style="font-weight:bold;padding-right:16px;">Submission Type</td><td>${escapeHtml(submissionTypeLabel)}</td></tr>
  <tr><td style="font-weight:bold;padding-right:16px;">Name</td><td>${escapeHtml(name) || '—'}</td></tr>
  <tr><td style="font-weight:bold;padding-right:16px;">Email</td><td><a href="mailto:${escapeHtml(email)}">${escapeHtml(email) || '—'}</a></td></tr>
  <tr><td style="font-weight:bold;padding-right:16px;">Phone</td><td>${escapeHtml(phone) || '—'}</td></tr>
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
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://move.jwillsoldit.com';

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
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

    return res.status(200).json({
      success: true,
      contactId,
      submissionId: payload?.metadata?.submissionId || null,
    });
  } catch (err) {
    console.error('[smart-move] HubSpot error:', err.message);
    return res.status(502).json({ success: false, error: 'CRM sync failed. Please try again.' });
  }
}
