(async function () {
  const ok = await AdminShell.requireSession();
  if (!ok) return;

  const STATUS_LABELS = { draft: 'Draft', approved: 'Approved', sent: 'Sent', paid: 'Paid' };
  const STATUS_BADGE_CLASS = { draft: 'new', approved: 'both_submitted', sent: 'both_submitted', paid: 'invoiced' };

  function formatMoney(value) {
    const num = parseFloat(String(value ?? '').replace(/[^0-9.]/g, ''));
    if (isNaN(num)) return '—';
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  async function load() {
    const showArchived = document.getElementById('show-archived').checked;
    const loading = document.getElementById('list-loading');
    const table = document.getElementById('list-table');
    const empty = document.getElementById('list-empty');

    loading.style.display = 'block';
    loading.textContent = 'Loading invoices…';
    table.style.display = 'none';
    empty.style.display = 'none';

    try {
      const data = await AdminShell.api(`/api/admin/invoices${showArchived ? '?archived=1' : ''}`);
      const rows = data.invoices || [];
      loading.style.display = 'none';

      if (!rows.length) {
        empty.style.display = 'block';
        return;
      }

      const tbody = document.getElementById('list-body');
      tbody.innerHTML = rows.map((inv) => `
        <tr class="clickable" data-href="/admin/invoices/${inv.id}">
          <td>${AdminShell.escapeHtml(inv.invoiceNumber)}${inv.archived ? ' <span class="badge" style="background:var(--mid);color:var(--pure);">Archived</span>' : ''}</td>
          <td>${AdminShell.escapeHtml(inv.client || '—')}</td>
          <td>${AdminShell.escapeHtml(inv.community || '—')}</td>
          <td><span class="badge status-${STATUS_BADGE_CLASS[inv.status] || 'new'}">${STATUS_LABELS[inv.status] || inv.status}</span></td>
          <td class="muted">${formatMoney(inv.balanceDue)}</td>
          <td class="muted">${AdminShell.formatDate(inv.createdAt)}</td>
        </tr>
      `).join('');

      tbody.querySelectorAll('tr[data-href]').forEach((tr) => {
        tr.addEventListener('click', () => { window.location.href = tr.dataset.href; });
      });

      table.style.display = 'table';
    } catch (err) {
      loading.textContent = 'Could not load invoices: ' + err.message;
    }
  }

  document.getElementById('show-archived').addEventListener('change', load);
  load();
})();
