(async function () {
  const ok = await AdminShell.requireSession();
  if (!ok) return;

  const id = window.location.pathname.split('/').filter(Boolean).pop();
  const api = (path, options) => AdminShell.api(`/api/admin/cdas/${id}${path || ''}`, options);

  const STATUS_LABELS = {
    new: 'New',
    sent: 'Link Sent',
    client_submitted: 'Payee Submitted',
    approved: 'Approved',
    disbursed: 'Disbursed',
  };

  const SUBMISSION_LABELS = {
    payeeLegalName: 'Legal Name', payeeCompany: 'Company', trecLicense: 'TREC License',
    email: 'Email', phone: 'Phone', mailingAddress: 'Mailing Address',
    paymentMethod: 'Payment Method', ackAt: 'Acknowledged At',
  };

  let cda = null;

  function render() {
    const c = cda;
    document.getElementById('detail-loading').style.display = 'none';
    document.getElementById('detail-state').style.display = 'block';

    document.getElementById('detail-title').textContent = c.propertyAddress || 'CDA File';
    document.getElementById('detail-sub').textContent =
      `${c.clientName || '—'}${c.payeeName ? ' · payee ' + c.payeeName : ''} · created ${AdminShell.formatDate(c.createdAt)}`;

    const statusEl = document.getElementById('detail-status');
    statusEl.textContent = STATUS_LABELS[c.status] || c.status;
    statusEl.className = `badge status-${c.status}`;

    // Link block
    const linkInfo = document.getElementById('link-info');
    const copyBtn = document.getElementById('btn-copy-link');
    if (c.clientLink && c.clientLink.url) {
      linkInfo.textContent = `${c.clientLink.valid ? 'Active' : (c.clientLink.revoked ? 'Revoked' : 'Expired')} · expires ${AdminShell.formatDate(c.clientLink.expiresAt)} · viewed ${c.clientLink.viewCount || 0}×`;
      copyBtn.style.display = 'inline-block';
      copyBtn.dataset.url = c.clientLink.url;
    } else {
      linkInfo.textContent = 'No link generated yet.';
      copyBtn.style.display = 'none';
    }
    if (c.payeeEmail) document.getElementById('send-email').value = c.payeeEmail;

    // Checklist
    document.getElementById('checklist-items').innerHTML = (c.checklist || []).map((item) => {
      const done = item.received || item.uploaded;
      const via = item.uploaded ? 'uploaded by payee' : item.received ? 'marked received' : 'outstanding';
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
          cda = data.cda;
          render();
          AdminShell.toast(cb.checked ? 'Marked received' : 'Marked outstanding');
        } catch (err) {
          AdminShell.toast(err.message, { error: true });
        }
      });
    });

    // Buttons that depend on state
    document.getElementById('btn-approve').disabled = !!c.approved;
    document.getElementById('btn-approve').textContent = c.approved ? 'Approved ✓' : 'Approve CDA';
    document.getElementById('btn-disburse').textContent = c.disbursedAt ? 'Disbursed ✓ (click to undo)' : 'Mark Disbursed';

    // Editable fields
    document.getElementById('f-clientName').value = c.clientName || '';
    document.getElementById('f-propertyAddress').value = c.propertyAddress || '';
    document.getElementById('f-unitNumber').value = c.unitNumber || '';
    document.getElementById('f-community').value = c.community || '';
    document.getElementById('f-closingDate').value = c.closingDate || '';
    document.getElementById('f-totalCommission').value = c.totalCommission || '';
    document.getElementById('f-payeeName').value = c.payeeName || '';
    document.getElementById('f-payeeCompany').value = c.payeeCompany || '';
    document.getElementById('f-payeeEmail').value = c.payeeEmail || '';
    document.getElementById('f-payeeAmount').value = c.payeeAmount || '';
    document.getElementById('f-notes').value = c.notes || '';

    // Submission
    const card = document.getElementById('submission-card');
    if (c.clientSubmission) {
      card.style.display = 'block';
      const s = c.clientSubmission;
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
          <a href="${AdminShell.escapeHtml(u.dataUrl)}" download="${AdminShell.escapeHtml(u.name)}">${AdminShell.escapeHtml(u.name)}</a>
          <span class="muted">(${Math.round((u.size || 0) / 1024)}KB · ${AdminShell.escapeHtml(key)})</span>
        </li>`).join('');
      card.querySelector('#submission-body').innerHTML = `
        <table style="border-collapse:collapse;width:100%;">${rows}</table>
        ${uploads ? `<p style="font-weight:600;margin:14px 0 6px;">Uploaded documents</p><ul style="padding-left:20px;">${uploads}</ul>` : ''}
        <p class="muted" style="margin-top:12px;">Submitted ${AdminShell.formatDate(c.clientSubmittedAt)}</p>`;
    } else {
      card.style.display = 'none';
    }

    // Audit log
    document.getElementById('audit-log').innerHTML = (c.auditLog || []).slice().reverse().map((e) => `
      <div style="padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.06);">
        <strong>${AdminShell.escapeHtml(e.type)}</strong> · ${AdminShell.escapeHtml(e.detail || '')}
        <span class="muted">— ${AdminShell.formatDate(e.at)}</span>
      </div>`).join('') || 'No activity yet.';
  }

  async function load() {
    try {
      const data = await api('');
      cda = data.cda;
      render();
    } catch (err) {
      document.getElementById('detail-loading').textContent = 'Could not load CDA file: ' + err.message;
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
      AdminShell.toast('Enter the payee email first', { error: true });
      return;
    }
    try {
      const data = await api('/client-email', { method: 'POST', body: JSON.stringify({ email }) });
      AdminShell.toast(data.emailed ? 'CDA email sent' : `Email not sent (${data.reason || 'not configured'}) — link ready to copy`, { error: !data.emailed });
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
      AdminShell.toast('CDA approved');
      await load();
    } catch (err) {
      AdminShell.toast(err.message, { error: true });
    }
  });

  document.getElementById('btn-disburse').addEventListener('click', async () => {
    try {
      const data = await api('', { method: 'PATCH', body: JSON.stringify({ markDisbursed: !cda.disbursedAt }) });
      cda = data.cda;
      render();
      AdminShell.toast(cda.disbursedAt ? 'Marked disbursed' : 'Disbursed status removed');
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
          propertyAddress: document.getElementById('f-propertyAddress').value.trim(),
          unitNumber: document.getElementById('f-unitNumber').value.trim(),
          community: document.getElementById('f-community').value.trim(),
          closingDate: document.getElementById('f-closingDate').value,
          totalCommission: document.getElementById('f-totalCommission').value.trim(),
          payeeName: document.getElementById('f-payeeName').value.trim(),
          payeeCompany: document.getElementById('f-payeeCompany').value.trim(),
          payeeEmail: document.getElementById('f-payeeEmail').value.trim(),
          payeeAmount: document.getElementById('f-payeeAmount').value.trim(),
          notes: document.getElementById('f-notes').value.trim(),
        }),
      });
      cda = data.cda;
      render();
      AdminShell.toast('Saved');
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.add('show');
    }
  });

  await load();
})();
