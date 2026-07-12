(async function () {
  const ok = await AdminShell.requireSession();
  if (!ok) return;

  const id = window.location.pathname.split('/').filter(Boolean).pop();
  const api = (path, options) => AdminShell.api(`/api/admin/listings/${id}${path || ''}`, options);

  const STATUS_LABELS = {
    new: 'New',
    sent: 'Link Sent',
    client_submitted: 'Client Submitted',
    approved: 'Approved',
    live: 'Live',
  };

  // Field labels for rendering the raw client submission.
  const SUBMISSION_LABELS = {
    clientLegalName: 'Legal Name', email: 'Email', phone: 'Phone',
    propertyAddress: 'Property Address', unitNumber: 'Unit / Suite', propertyType: 'Property Type',
    bedrooms: 'Bedrooms', bathrooms: 'Bathrooms', sqft: 'Sq Ft', yearBuilt: 'Year Built',
    occupancy: 'Occupancy', accessNotes: 'Access Notes',
    hasHoa: 'HOA?', hoaName: 'HOA Name', hoaDues: 'HOA Dues', hoaRestrictions: 'HOA Restrictions',
    targetGoLiveDate: 'Target Go-Live', notes: 'Notes',
    mortgageStatus: 'Mortgage Status', payoffEstimate: 'Payoff Estimate', priceExpectation: 'Price Expectation',
    condition: 'Condition', motivation: 'Motivation', updatesRepairs: 'Updates & Repairs', knownIssues: 'Known Issues',
    askingRent: 'Asking Rent', securityDeposit: 'Security Deposit', availableDate: 'Available Date',
    leaseTerms: 'Lease Terms', petsAllowed: 'Pets Allowed', petPolicy: 'Pet Policy', smokingPolicy: 'Smoking Policy',
    utilitiesIncluded: 'Utilities Included', appliancesIncluded: 'Appliances', screeningCriteria: 'Screening Criteria',
    makeReadyStatus: 'Make-Ready Status', ackAt: 'Acknowledged At',
  };

  let listing = null;

  function render() {
    const l = listing;
    document.getElementById('detail-loading').style.display = 'none';
    document.getElementById('detail-state').style.display = 'block';

    document.getElementById('detail-kicker').textContent =
      l.listingType === 'lease' ? 'Listing Intake · For Lease' : 'Listing Intake · For Sale';
    document.getElementById('detail-title').textContent = l.propertyAddress || 'Listing File';
    document.getElementById('detail-sub').textContent =
      `${l.clientName || '—'}${l.unitNumber ? ' · Unit ' + l.unitNumber : ''} · created ${AdminShell.formatDate(l.createdAt)}`;

    const statusEl = document.getElementById('detail-status');
    statusEl.textContent = STATUS_LABELS[l.status] || l.status;
    statusEl.className = `badge status-${l.status}`;

    document.getElementById('detail-flags').innerHTML = (l.flags || [])
      .map((f) => `<span class="badge" style="margin-right:6px;">${AdminShell.escapeHtml(f)}</span>`)
      .join('');

    // Link block
    const linkInfo = document.getElementById('link-info');
    const copyBtn = document.getElementById('btn-copy-link');
    if (l.clientLink && l.clientLink.url) {
      linkInfo.textContent = `${l.clientLink.valid ? 'Active' : (l.clientLink.revoked ? 'Revoked' : 'Expired')} · expires ${AdminShell.formatDate(l.clientLink.expiresAt)} · viewed ${l.clientLink.viewCount || 0}×`;
      copyBtn.style.display = 'inline-block';
      copyBtn.dataset.url = l.clientLink.url;
    } else {
      linkInfo.textContent = 'No link generated yet.';
      copyBtn.style.display = 'none';
    }
    if (l.clientEmail) document.getElementById('send-email').value = l.clientEmail;

    // Checklist
    document.getElementById('checklist-items').innerHTML = (l.checklist || []).map((item) => {
      const done = item.received || item.uploaded;
      const via = item.uploaded ? 'uploaded by client' : item.received ? 'marked received' : 'outstanding';
      return `
      <div class="admin-checkbox-row" style="align-items:center;">
        <input type="checkbox" data-item-key="${item.key}" ${item.received ? 'checked' : ''} ${item.uploaded ? 'disabled checked' : ''}>
        <label style="${done ? '' : 'font-weight:600;'}">${AdminShell.escapeHtml(item.label)} <span class="muted" style="font-weight:400;">— ${via}</span></label>
      </div>`;
    }).join('');
    document.querySelectorAll('#checklist-items input[data-item-key]').forEach((cb) => {
      cb.addEventListener('change', async () => {
        try {
          const data = await api('', {
            method: 'PATCH',
            body: JSON.stringify({ itemsReceived: { [cb.dataset.itemKey]: cb.checked } }),
          });
          listing = data.listing;
          render();
          AdminShell.toast(cb.checked ? 'Marked received' : 'Marked outstanding');
        } catch (err) {
          AdminShell.toast(err.message, { error: true });
        }
      });
    });

    // Buttons that depend on state
    document.getElementById('btn-approve').disabled = !!l.approved;
    document.getElementById('btn-approve').textContent = l.approved ? 'Approved ✓' : 'Approve Listing';
    document.getElementById('btn-live').textContent = l.liveAt ? 'Live ✓ (click to undo)' : 'Mark Live';

    // Editable fields
    document.getElementById('f-clientName').value = l.clientName || '';
    document.getElementById('f-clientEmail').value = l.clientEmail || '';
    document.getElementById('f-propertyAddress').value = l.propertyAddress || '';
    document.getElementById('f-unitNumber').value = l.unitNumber || '';
    document.getElementById('f-targetGoLiveDate').value = l.targetGoLiveDate || '';
    document.getElementById('f-notes').value = l.notes || '';

    // Submission
    const card = document.getElementById('submission-card');
    if (l.clientSubmission) {
      card.style.display = 'block';
      const s = l.clientSubmission;
      const rows = Object.entries(SUBMISSION_LABELS)
        .filter(([key]) => s[key])
        .map(([key, label]) => `
          <tr>
            <td style="font-weight:600;padding:4px 16px 4px 0;white-space:nowrap;vertical-align:top;">${label}</td>
            <td style="padding:4px 0;">${AdminShell.escapeHtml(s[key])}</td>
          </tr>`)
        .join('');
      const uploads = Object.entries(s.uploads || {}).map(([key, u]) => `
        <li style="margin-bottom:4px;">
          <a href="${u.dataUrl}" download="${AdminShell.escapeHtml(u.name)}">${AdminShell.escapeHtml(u.name)}</a>
          <span class="muted">(${Math.round((u.size || 0) / 1024)}KB · ${AdminShell.escapeHtml(key)})</span>
        </li>`).join('');
      card.querySelector('#submission-body').innerHTML = `
        <table style="border-collapse:collapse;width:100%;">${rows}</table>
        ${uploads ? `<p style="font-weight:600;margin:14px 0 6px;">Uploaded documents</p><ul style="padding-left:20px;">${uploads}</ul>` : ''}
        <p class="muted" style="margin-top:12px;">Submitted ${AdminShell.formatDate(l.clientSubmittedAt)}</p>`;
    } else {
      card.style.display = 'none';
    }

    // Audit log
    document.getElementById('audit-log').innerHTML = (l.auditLog || []).slice().reverse().map((e) => `
      <div style="padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.06);">
        <strong>${AdminShell.escapeHtml(e.type)}</strong> · ${AdminShell.escapeHtml(e.detail || '')}
        <span class="muted">— ${AdminShell.formatDate(e.at)}</span>
      </div>`).join('') || 'No activity yet.';
  }

  async function load() {
    try {
      const data = await api('');
      listing = data.listing;
      render();
    } catch (err) {
      document.getElementById('detail-loading').textContent = 'Could not load listing file: ' + err.message;
    }
  }

  // --- actions ---------------------------------------------------------
  document.getElementById('btn-gen-link').addEventListener('click', async () => {
    try {
      const data = await api('/client-link', { method: 'POST', body: JSON.stringify({}) });
      const copied = await AdminShell.copyToClipboard(data.url);
      AdminShell.toast(copied ? 'Link generated & copied' : 'Link generated');
      await load();
    } catch (err) {
      AdminShell.toast(err.message, { error: true });
    }
  });

  document.getElementById('btn-copy-link').addEventListener('click', async (e) => {
    const copied = await AdminShell.copyToClipboard(e.target.dataset.url);
    AdminShell.toast(copied ? 'Link copied' : 'Could not copy — long-press the link instead', { error: !copied });
  });

  document.getElementById('btn-send-email').addEventListener('click', async () => {
    const email = document.getElementById('send-email').value.trim();
    if (!email) {
      AdminShell.toast('Enter the client email first', { error: true });
      return;
    }
    try {
      const data = await api('/client-email', { method: 'POST', body: JSON.stringify({ email }) });
      AdminShell.toast(data.emailed ? 'Checklist email sent' : `Email not sent (${data.reason || 'not configured'}) — link ready to copy`, { error: !data.emailed });
      await load();
    } catch (err) {
      AdminShell.toast(err.message, { error: true });
    }
  });

  document.getElementById('btn-reminder').addEventListener('click', async () => {
    try {
      const data = await api('/reminder', { method: 'POST', body: JSON.stringify({}) });
      AdminShell.toast(data.emailed ? `Reminder sent (${data.outstanding.length} items)` : `Reminder not sent (${data.reason || 'not configured'})`, { error: !data.emailed });
      await load();
    } catch (err) {
      AdminShell.toast(err.message, { error: true });
    }
  });

  document.getElementById('btn-approve').addEventListener('click', async () => {
    try {
      await api('/approve', { method: 'POST', body: JSON.stringify({}) });
      AdminShell.toast('Listing approved');
      await load();
    } catch (err) {
      AdminShell.toast(err.message, { error: true });
    }
  });

  document.getElementById('btn-live').addEventListener('click', async () => {
    try {
      const data = await api('', { method: 'PATCH', body: JSON.stringify({ markLive: !listing.liveAt }) });
      listing = data.listing;
      render();
      AdminShell.toast(listing.liveAt ? 'Marked live' : 'Live status removed');
    } catch (err) {
      AdminShell.toast(err.message, { error: true });
    }
  });

  document.getElementById('btn-save').addEventListener('click', async () => {
    const errorBox = document.getElementById('detail-error');
    errorBox.classList.remove('show');
    try {
      const data = await api('', {
        method: 'PATCH',
        body: JSON.stringify({
          clientName: document.getElementById('f-clientName').value.trim(),
          clientEmail: document.getElementById('f-clientEmail').value.trim(),
          propertyAddress: document.getElementById('f-propertyAddress').value.trim(),
          unitNumber: document.getElementById('f-unitNumber').value.trim(),
          targetGoLiveDate: document.getElementById('f-targetGoLiveDate').value,
          notes: document.getElementById('f-notes').value.trim(),
        }),
      });
      listing = data.listing;
      render();
      AdminShell.toast('Saved');
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.add('show');
    }
  });

  await load();
})();
