(async function () {
  const ok = await AdminShell.requireSession();
  if (!ok) return;

  const id = window.location.pathname.split('/').filter(Boolean).pop();

  const STATUS_LABELS = {
    new: 'New', client_submitted: 'Client Submitted', pm_submitted: 'PM Submitted',
    both_submitted: 'Both Submitted', verified: 'Verified', invoiced: 'Invoice Prepared',
  };

  const CLIENT_LABELS = {
    clientLegalName: 'Client Legal Name', preferredName: 'Preferred Name', email: 'Email', phone: 'Phone',
    propertyName: 'Property/Community Name', propertyAddress: 'Property Address', unitNumber: 'Unit Number',
    pmContactName: 'Property Manager / Leasing Contact', pmEmail: 'Property Manager Email',
    dateToured: 'Date Toured / Applied', applicationDate: 'Application Date', moveInDate: 'Move-In Date',
    leaseStartDate: 'Lease Start Date', leaseTerm: 'Lease Term', monthlyRent: 'Monthly Rent',
    concession: 'Concession (if any)', firstContactMethod: 'How They First Contacted the Property',
    listedReferral: 'Listed Joey Williams / JWILLSOLDIT / CRG?',
  };

  const PM_LABELS = {
    communityName: 'Community Name', managementCompany: 'Property Management Company',
    communityAddress: 'Community Address', pmContactName: 'PM / Leasing Contact Name', pmEmail: 'PM Email',
    clientName: 'Client Name', unitNumber: 'Unit Number', applicationDate: 'Application Date',
    moveInDate: 'Move-In Date', leaseStartDate: 'Lease Start Date', leaseTerm: 'Lease Term',
    monthlyRent: 'Monthly Rent', commissionOffered: 'Commission Offered', commissionBasis: 'Commission Basis',
    invoiceMethod: 'Invoice Submission Method', invoiceAttentionLine: 'Required Invoice Attention Line',
    requiredVendorDocs: 'Required Vendor Documents', paymentTimeline: 'Payment Timeline', notes: 'Notes',
  };

  function fieldGrid(submission, labels) {
    if (!submission) return '<p class="admin-card-note" style="margin:0;">Not submitted yet.</p>';
    const rows = Object.entries(labels).map(([key, label]) => {
      const value = submission[key];
      if (value === undefined) return '';
      return `<div class="field-value"><span class="field-label-inline">${AdminShell.escapeHtml(label)}</span><span>${AdminShell.escapeHtml(value) || '—'}</span></div>`;
    }).join('');

    let uploadRow = '';
    if (submission.upload && submission.upload.dataUrl) {
      uploadRow = `<div class="field-value" style="grid-column:1/-1;"><span class="field-label-inline">Supporting Document</span>
        <a href="${submission.upload.dataUrl}" target="_blank" rel="noopener" download="${AdminShell.escapeHtml(submission.upload.name || 'upload')}">
          ${AdminShell.escapeHtml(submission.upload.name || 'View file')}
        </a></div>`;
    }

    const certRow = `<div class="field-value" style="grid-column:1/-1;"><span class="field-label-inline">${submission.consent !== undefined ? 'Consent' : 'Certification'}</span>
      <span>${(submission.consent || submission.certification) ? 'Confirmed' : 'Not confirmed'} — ${AdminShell.formatDate(submission.consentAt || submission.certifiedAt)}</span></div>`;

    return `<div class="admin-grid-2">${rows}${uploadRow}${certRow}</div>`;
  }

  function linkBox(link, statusEl, boxEl, kind) {
    if (!link || !link.url) {
      statusEl.textContent = 'No link generated yet.';
      boxEl.innerHTML = '';
      return;
    }
    const state = !link.valid ? (link.revoked ? 'Revoked' : 'Expired') : 'Active';
    statusEl.innerHTML = `<span class="badge ${link.valid ? 'match' : 'mismatch'}">${state}</span>
      &nbsp;Expires ${AdminShell.formatDate(link.expiresAt)} · Viewed ${link.viewCount || 0}×${link.lastViewedAt ? ' (last ' + AdminShell.formatDate(link.lastViewedAt) + ')' : ''}`;
    boxEl.innerHTML = `<div class="link-box">
      <input type="text" readonly value="${AdminShell.escapeHtml(link.url)}" id="${kind}-link-input">
      <button class="admin-btn small" type="button" id="${kind}-copy-btn">Copy</button>
    </div>`;
    document.getElementById(`${kind}-copy-btn`).addEventListener('click', async () => {
      const success = await AdminShell.copyToClipboard(link.url);
      AdminShell.toast(success ? 'Link copied' : 'Could not copy — select and copy manually', { error: !success });
    });
  }

  let current = null;

  async function load() {
    try {
      const data = await AdminShell.api(`/api/admin/verifications/${id}`);
      current = data.verification;
      const comparison = data.comparison || [];

      document.getElementById('detail-loading').style.display = 'none';
      document.getElementById('detail-content').style.display = 'block';

      document.getElementById('d-client-name').textContent = current.clientName || 'Untitled Client';
      document.getElementById('d-property-line').textContent =
        [current.propertyName, current.unitNumber ? `Unit ${current.unitNumber}` : ''].filter(Boolean).join(' · ') || 'No property on file yet';
      const badge = document.getElementById('d-status-badge');
      badge.textContent = STATUS_LABELS[current.status] || current.status;
      badge.className = `badge status-${current.status}`;

      document.getElementById('v-clientName').textContent = current.clientName || '—';
      document.getElementById('v-propertyName').textContent = current.propertyName || '—';
      document.getElementById('v-propertyAddress').textContent = current.propertyAddress || '—';
      document.getElementById('v-unitNumber').textContent = current.unitNumber || '—';
      document.getElementById('v-notes').textContent = current.notes || '—';

      linkBox(current.clientLink, document.getElementById('client-link-status'), document.getElementById('client-link-box'), 'client');
      linkBox(current.pmLink, document.getElementById('pm-link-status'), document.getElementById('pm-link-box'), 'pm');

      document.getElementById('client-submission').innerHTML = fieldGrid(current.clientSubmission, CLIENT_LABELS);
      document.getElementById('pm-submission').innerHTML = fieldGrid(current.pmSubmission, PM_LABELS);

      const compCard = document.getElementById('comparison-card');
      if (comparison.length) {
        compCard.style.display = 'block';
        document.getElementById('comparison-body').innerHTML = comparison.map((row) => `
          <tr class="${row.mismatch ? 'mismatch' : ''}">
            <td>${AdminShell.escapeHtml(row.label)}</td>
            <td>${AdminShell.escapeHtml(row.clientValue) || '—'}</td>
            <td>${AdminShell.escapeHtml(row.pmValue) || '—'}</td>
            <td>${row.mismatch ? '<span class="badge mismatch">Mismatch</span>' : (row.clientValue && row.pmValue ? '<span class="badge match">Match</span>' : '')}</td>
          </tr>
        `).join('');
      } else {
        compCard.style.display = 'none';
      }

      const verifyBtn = document.getElementById('mark-verified');
      const verifiedNote = document.getElementById('verified-note');
      if (current.manuallyVerified) {
        verifyBtn.textContent = 'Already Verified';
        verifyBtn.disabled = true;
        verifiedNote.style.display = 'block';
        verifiedNote.textContent = `Marked verified on ${AdminShell.formatDate(current.manuallyVerifiedAt)}.`;
      } else {
        verifyBtn.textContent = 'Mark Manually Verified';
        verifyBtn.disabled = false;
        verifiedNote.style.display = 'none';
      }

      const invoiceBtn = document.getElementById('prepare-invoice');
      const viewInvoiceLink = document.getElementById('view-invoice');
      if (current.invoiceId) {
        invoiceBtn.style.display = 'none';
        viewInvoiceLink.style.display = 'inline-flex';
        viewInvoiceLink.href = `/admin/invoices/${current.invoiceId}`;
        viewInvoiceLink.textContent = 'View Invoice';
      } else {
        invoiceBtn.style.display = 'inline-flex';
        viewInvoiceLink.style.display = 'none';
      }

      const auditEl = document.getElementById('audit-log');
      const log = (current.auditLog || []).slice().reverse();
      auditEl.innerHTML = log.length
        ? log.map((e) => `<li><time>${AdminShell.formatDate(e.at)}</time><span>${AdminShell.escapeHtml(e.detail || e.type)}</span></li>`).join('')
        : '<li>No activity yet.</li>';
    } catch (err) {
      document.getElementById('detail-loading').textContent = 'Could not load this file: ' + err.message;
    }
  }

  document.getElementById('gen-client-link').addEventListener('click', async (e) => {
    const btn = e.target;
    btn.disabled = true;
    try {
      await AdminShell.api(`/api/admin/verifications/${id}/client-link`, { method: 'POST', body: '{}' });
      AdminShell.toast('Client link generated');
      await load();
    } catch (err) {
      AdminShell.toast(err.message, { error: true });
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('gen-pm-link').addEventListener('click', async (e) => {
    const btn = e.target;
    btn.disabled = true;
    try {
      await AdminShell.api(`/api/admin/verifications/${id}/pm-link`, { method: 'POST', body: '{}' });
      AdminShell.toast('PM link generated');
      await load();
    } catch (err) {
      AdminShell.toast(err.message, { error: true });
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('mark-verified').addEventListener('click', async (e) => {
    if (!confirm('Mark this file as manually verified? Do this once you’ve reviewed both submissions.')) return;
    const btn = e.target;
    btn.disabled = true;
    try {
      await AdminShell.api(`/api/admin/verifications/${id}/verify`, { method: 'POST', body: '{}' });
      AdminShell.toast('Marked manually verified');
      await load();
    } catch (err) {
      AdminShell.toast(err.message, { error: true });
      btn.disabled = false;
    }
  });

  document.getElementById('prepare-invoice').addEventListener('click', async (e) => {
    const btn = e.target;
    btn.disabled = true;
    btn.textContent = 'Preparing…';
    try {
      const data = await AdminShell.api(`/api/admin/verifications/${id}/prepare-invoice`, { method: 'POST', body: '{}' });
      window.location.href = `/admin/invoices/${data.invoice.id}`;
    } catch (err) {
      AdminShell.toast(err.message, { error: true });
      btn.disabled = false;
      btn.textContent = 'Prepare Invoice';
    }
  });

  document.getElementById('edit-toggle').addEventListener('click', () => {
    document.getElementById('d-fields-view').style.display = 'none';
    document.getElementById('d-fields-form').style.display = 'block';
    document.getElementById('edit-toggle').style.display = 'none';
    document.getElementById('f-clientName').value = current.clientName || '';
    document.getElementById('f-propertyName').value = current.propertyName || '';
    document.getElementById('f-propertyAddress').value = current.propertyAddress || '';
    document.getElementById('f-unitNumber').value = current.unitNumber || '';
    document.getElementById('f-notes').value = current.notes || '';
  });

  document.getElementById('edit-cancel').addEventListener('click', () => {
    document.getElementById('d-fields-view').style.display = 'grid';
    document.getElementById('d-fields-form').style.display = 'none';
    document.getElementById('edit-toggle').style.display = 'inline-flex';
  });

  document.getElementById('d-fields-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await AdminShell.api(`/api/admin/verifications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          clientName: document.getElementById('f-clientName').value.trim(),
          propertyName: document.getElementById('f-propertyName').value.trim(),
          propertyAddress: document.getElementById('f-propertyAddress').value.trim(),
          unitNumber: document.getElementById('f-unitNumber').value.trim(),
          notes: document.getElementById('f-notes').value.trim(),
        }),
      });
      document.getElementById('d-fields-view').style.display = 'grid';
      document.getElementById('d-fields-form').style.display = 'none';
      document.getElementById('edit-toggle').style.display = 'inline-flex';
      AdminShell.toast('Saved');
      await load();
    } catch (err) {
      AdminShell.toast(err.message, { error: true });
    }
  });

  load();
})();
