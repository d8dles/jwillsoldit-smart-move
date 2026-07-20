(async function () {
  const ok = await AdminShell.requireSession();
  if (!ok) return;

  const labels = {
    draft: 'Draft', coming_soon: 'Coming Soon', available: 'Available', pending: 'Pending',
    rented: 'Rented', booked: 'Booked', sold: 'Sold', off_market: 'Off Market',
  };
  const types = { sale: 'Sale', rental: 'Rental', stay: 'Short-term stay' };

  async function load() {
    const includeArchived = document.getElementById('include-archived').checked;
    const loading = document.getElementById('inventory-loading');
    const table = document.getElementById('inventory-table');
    const empty = document.getElementById('inventory-empty');
    loading.style.display = 'block';
    table.style.display = 'none';
    empty.style.display = 'none';
    try {
      const data = await AdminShell.api(`/api/admin/inventory${includeArchived ? '?includeArchived=true' : ''}`);
      const rows = data.inventory || [];
      loading.style.display = 'none';
      if (!rows.length) {
        empty.style.display = 'block';
        return;
      }
      document.getElementById('inventory-body').innerHTML = rows.map((record) => `
        <tr class="clickable" data-href="/admin/inventory/${encodeURIComponent(record.id)}">
          <td><strong>${AdminShell.escapeHtml(record.addressLine || record.title || record.slug)}</strong><br><span class="muted">${AdminShell.escapeHtml(record.slug)}</span></td>
          <td>${types[record.offeringType] || AdminShell.escapeHtml(record.offeringType)}</td>
          <td><span class="badge status-${AdminShell.escapeHtml(record.publicStatus)}">${labels[record.publicStatus] || AdminShell.escapeHtml(record.publicStatus)}</span></td>
          <td>${record.published ? 'Yes' : 'No'}</td>
          <td class="muted">${AdminShell.formatDate(record.updatedAt)}</td>
          <td>${record.archivedAt ? '<span class="badge">Archived</span>' : '—'}</td>
        </tr>
      `).join('');
      document.querySelectorAll('#inventory-body tr[data-href]').forEach((row) => {
        row.addEventListener('click', () => { window.location.href = row.dataset.href; });
      });
      table.style.display = 'table';
    } catch (err) {
      loading.textContent = `Could not load public inventory: ${err.message}`;
    }
  }

  document.getElementById('include-archived').addEventListener('change', load);
  document.getElementById('refresh-inventory').addEventListener('click', load);
  await load();
})();
