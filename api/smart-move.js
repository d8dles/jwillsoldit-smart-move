const HUBSPOT_API = 'https://api.hubapi.com';

function noteBody(payload) {
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

  if (p.selectedDetails?.length) {
    lines.push('', 'Selected Details:');
    p.selectedDetails.forEach(d => lines.push(`  • ${d}`));
  }

  if (p.fullPathData && Object.keys(p.fullPathData).length) {
    lines.push('', 'Path Data:');
    Object.entries(p.fullPathData).forEach(([k, v]) => {
      const val = Array.isArray(v) ? v.join(', ') : v;
      if (val !== undefined && val !== null && val !== '') {
        lines.push(`  ${k}: ${val}`);
      }
    });
  }

  if (p.fullTrunk && Object.keys(p.fullTrunk).length) {
    lines.push('', 'Trunk Data:');
    Object.entries(p.fullTrunk).forEach(([k, v]) => {
      const val = Array.isArray(v) ? v.join(', ') : v;
      if (val !== undefined && val !== null && val !== '') {
        lines.push(`  ${k}: ${val}`);
      }
    });
  }

  lines.push('', `Device: ${p.metadata?.deviceType || '—'}`);

  return lines.join('\n');
}

async function upsertContact(token, email, name, phone) {
  const properties = { email };
  if (name) properties.firstname = name.split(' ')[0] || name;
  if (name && name.includes(' ')) properties.lastname = name.split(' ').slice(1).join(' ');
  if (phone) properties.phone = phone;

  // Search for existing contact
  const searchRes = await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
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
    // Update existing
    const contactId = searchData.results[0].id;
    const updateRes = await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts/${contactId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ properties }),
    });
    if (!updateRes.ok) {
      const err = await updateRes.text();
      throw new Error(`HubSpot contact update failed: ${updateRes.status} ${err}`);
    }
    return contactId;
  }

  // Create new
  const createRes = await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ properties }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`HubSpot contact create failed: ${createRes.status} ${err}`);
  }

  const created = await createRes.json();
  return created.id;
}

async function attachNote(token, contactId, noteText) {
  const createNoteRes = await fetch(`${HUBSPOT_API}/crm/v3/objects/notes`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        hs_note_body: noteText,
        hs_timestamp: Date.now().toString(),
      },
    }),
  });

  if (!createNoteRes.ok) {
    const err = await createNoteRes.text();
    throw new Error(`HubSpot note create failed: ${createNoteRes.status} ${err}`);
  }

  const note = await createNoteRes.json();

  // Associate note with contact
  const assocRes = await fetch(
    `${HUBSPOT_API}/crm/v3/objects/notes/${note.id}/associations/contacts/${contactId}/note_to_contact`,
    {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` },
    }
  );

  if (!assocRes.ok) {
    const err = await assocRes.text();
    throw new Error(`HubSpot note association failed: ${assocRes.status} ${err}`);
  }
}

export default async function handler(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://move.jwillsoldit.com';

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

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
  const name = payload?.contact?.name?.trim();
  const phone = payload?.contact?.phone?.trim();

  if (!email || !name) {
    return res.status(400).json({ success: false, error: 'name and email are required' });
  }

  try {
    const contactId = await upsertContact(token, email, name, phone);
    const noteText = noteBody(payload);
    await attachNote(token, contactId, noteText);

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
