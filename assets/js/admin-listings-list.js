(async function () {
  const ok = await AdminShell.requireSession();
  if (!ok) return;

  const STATUS_LABELS = {
    new: 'New',
    sent: 'Link Sent',
    client_submitted: 'Client Submitted',
    approved: 'Approved',
    live: 'Live',
  };

  try {
    const data = await AdminShell.api('/api/admin/listings');
    const rows = data.listings || [];
    document.getElementById('list-loading').style.display = 'none';

    if (!rows.length) {
      document.getElementById('list-empty').style.display = 'block';
      return;
    }

    const tbody = document.getElementById('list-body');
    tbody.innerHTML = rows.map((l) => `
      <tr class="clickable" data-href="/admin/listings/${l.id}">
        <td>${AdminShell.escapeHtml(l.clientName || '—')}</td>
        <td>${AdminShell.escapeHtml(l.propertyAddress || '—')}${l.unitNumber ? ' · Unit ' + AdminShell.escapeHtml(l.unitNumber) : ''}</td>
        <td>${l.listingType === 'lease' ? 'Lease' : 'Sale'}</td>
        <td><span class="badge status-${l.status}">${STATUS_LABELS[l.status] || l.status}</span></td>
        <td class="muted">${l.outstandingCount ? l.outstandingCount + ' outstanding' : 'Complete'}</td>
        <td class="muted">${AdminShell.formatDate(l.updatedAt)}</td>
      </tr>
    `).join('');

    tbody.querySelectorAll('tr[data-href]').forEach((tr) => {
      tr.addEventListener('click', () => { window.location.href = tr.dataset.href; });
    });

    document.getElementById('list-table').style.display = 'table';
  } catch (err) {
    document.getElementById('list-loading').textContent = 'Could not load listing files: ' + err.message;
  }
})();
