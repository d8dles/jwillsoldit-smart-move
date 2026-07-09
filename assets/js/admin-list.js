(async function () {
  const ok = await AdminShell.requireSession();
  if (!ok) return;

  const STATUS_LABELS = {
    new: 'New',
    client_submitted: 'Client Submitted',
    pm_submitted: 'PM Submitted',
    both_submitted: 'Both Submitted',
    verified: 'Verified',
    invoiced: 'Invoice Prepared',
  };

  try {
    const data = await AdminShell.api('/api/admin/verifications');
    const rows = data.verifications || [];
    document.getElementById('list-loading').style.display = 'none';

    if (!rows.length) {
      document.getElementById('list-empty').style.display = 'block';
      return;
    }

    const tbody = document.getElementById('list-body');
    tbody.innerHTML = rows.map((v) => `
      <tr class="clickable" data-href="/admin/verifications/${v.id}">
        <td>${AdminShell.escapeHtml(v.clientName || '—')}</td>
        <td>${AdminShell.escapeHtml(v.propertyName || '—')}${v.unitNumber ? ' · Unit ' + AdminShell.escapeHtml(v.unitNumber) : ''}</td>
        <td><span class="badge status-${v.status}">${STATUS_LABELS[v.status] || v.status}</span></td>
        <td class="muted">${v.hasClientLink ? 'Client ✓' : 'Client —'} · ${v.hasPmLink ? 'PM ✓' : 'PM —'}</td>
        <td class="muted">${AdminShell.formatDate(v.updatedAt)}</td>
      </tr>
    `).join('');

    tbody.querySelectorAll('tr[data-href]').forEach((tr) => {
      tr.addEventListener('click', () => { window.location.href = tr.dataset.href; });
    });

    document.getElementById('list-table').style.display = 'table';
  } catch (err) {
    document.getElementById('list-loading').textContent = 'Could not load verification files: ' + err.message;
  }
})();
