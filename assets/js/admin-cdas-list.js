(async function () {
  const ok = await AdminShell.requireSession();
  if (!ok) return;

  const STATUS_LABELS = {
    new: 'New',
    sent: 'Link Sent',
    client_submitted: 'Payee Submitted',
    approved: 'Approved',
    disbursed: 'Disbursed',
  };

  try {
    const data = await AdminShell.api('/api/admin/cdas');
    const rows = data.cdas || [];
    document.getElementById('list-loading').style.display = 'none';

    if (!rows.length) {
      document.getElementById('list-empty').style.display = 'block';
      return;
    }

    const tbody = document.getElementById('list-body');
    tbody.innerHTML = rows.map((c) => `
      <tr class="clickable" data-href="/admin/cdas/${c.id}">
        <td>${AdminShell.escapeHtml(c.clientName || '—')}<br><span class="muted">${AdminShell.escapeHtml(c.propertyAddress || '')}</span></td>
        <td>${AdminShell.escapeHtml(c.payeeName || '—')}</td>
        <td>${c.payeeAmount ? '$' + AdminShell.escapeHtml(c.payeeAmount) : '—'}</td>
        <td><span class="badge status-${c.status}">${STATUS_LABELS[c.status] || c.status}</span></td>
        <td class="muted">${c.outstandingCount ? c.outstandingCount + ' outstanding' : 'Complete'}</td>
        <td class="muted">${AdminShell.formatDate(c.updatedAt)}</td>
      </tr>
    `).join('');

    tbody.querySelectorAll('tr[data-href]').forEach((tr) => {
      tr.addEventListener('click', () => { window.location.href = tr.dataset.href; });
    });

    document.getElementById('list-table').style.display = 'table';
  } catch (err) {
    document.getElementById('list-loading').textContent = 'Could not load CDA files: ' + err.message;
  }
})();
