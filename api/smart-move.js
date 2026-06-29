const HUBSPOT_API = 'https://api.hubapi.com';

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
    return;
  }
  const data = await res.json();
  const existing = new Set((data.results || []).map(p => p.name));

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
    } else {
      console.log(`[smart-move] Created property: ${prop.name}`);
    }
  }
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

  const email = payload?.contact?.email?.trim();
  const name  = payload?.contact?.name?.trim();

  if (!email || !name) {
    return res.status(400).json({ success: false, error: 'name and email are required' });
  }

  try {
    await ensureCustomProperties(token);
    const contactId = await upsertContact(token, payload);
    const briefText = buildBriefText(payload);
    await tryAttachNote(token, contactId, briefText);

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
