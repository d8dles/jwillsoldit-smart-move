(async function () {
  const ok = await AdminShell.requireSession();
  if (!ok) return;

  const id = window.location.pathname.split('/').filter(Boolean).pop();

  const FIELD_ORDER = [
    'attention', 'communityName', 'managementCompany', 'communityAddress', 'date', 'invoiceNumber',
    'agent', 'trecNumber', 'client', 'commissionDescription', 'leaseTerm', 'unitSuite',
    'applicationDate', 'moveInDate', 'offeredCommissionFeePct', 'monthlyRent', 'balanceDue',
    'paymentInstructions', 'brokerW9Note',
  ];
  const LABELS = {
    attention: 'Attention', communityName: 'Community Name', managementCompany: 'Property Management Company',
    communityAddress: 'Community Address', date: 'Date', invoiceNumber: 'Invoice Number', agent: 'Agent',
    trecNumber: 'TREC #', client: 'Client', commissionDescription: 'Commission Description',
    leaseTerm: 'Lease Term', unitSuite: 'Unit/Suite', applicationDate: 'Application Date',
    moveInDate: 'Move In Date', offeredCommissionFeePct: 'Offered Commission Fee %', monthlyRent: 'Monthly Rent',
    balanceDue: 'Balance Due', paymentInstructions: 'Payment Instructions', brokerW9Note: 'Broker W9 Note',
  };
  const WIDE = new Set(['commissionDescription', 'paymentInstructions', 'brokerW9Note']);

  const STATUS_LABELS = { draft: 'Draft', approved: 'Approved', sent: 'Sent', paid: 'Paid' };

  let invoice = null;

  async function load() {
    try {
      const data = await AdminShell.api(`/api/admin/invoices/${id}`);
      invoice = data.invoice;
      const verification = data.verification;

      document.getElementById('inv-loading').style.display = 'none';
      document.getElementById('inv-content').style.display = 'block';

      document.getElementById('inv-number').textContent = invoice.fields.invoiceNumber || invoice.id;
      document.getElementById('inv-sub').textContent = verification
        ? `${verification.clientName || 'Client'} · ${verification.propertyName || 'Property'}`
        : '';
      if (verification) {
        const back = document.getElementById('inv-back');
        back.innerHTML = `<a href="/admin/verifications/${verification.id}" style="color:inherit;text-decoration:none;">&larr; Back to Verification File</a>`;
      }

      const badge = document.getElementById('inv-status-badge');
      badge.textContent = STATUS_LABELS[invoice.status] || invoice.status;
      badge.className = `badge status-${invoice.status === 'paid' ? 'invoiced' : invoice.status === 'draft' ? 'new' : 'both_submitted'}`;

      const isDraft = invoice.status === 'draft';
      document.getElementById('inv-lock-note').textContent = isDraft
        ? 'Editable while in draft.'
        : 'Locked — approved invoices can no longer be edited here.';
      document.getElementById('inv-save').style.display = isDraft ? 'inline-flex' : 'none';

      const grid = document.getElementById('inv-fields');
      grid.innerHTML = FIELD_ORDER.map((key) => `
        <div class="admin-field" style="${WIDE.has(key) ? 'grid-column:1/-1;' : ''}">
          <label>${AdminShell.escapeHtml(LABELS[key])}</label>
          ${WIDE.has(key)
            ? `<textarea data-field="${key}" ${isDraft ? '' : 'disabled'}>${AdminShell.escapeHtml(invoice.fields[key])}</textarea>`
            : `<input type="text" data-field="${key}" value="${AdminShell.escapeHtml(invoice.fields[key])}" ${isDraft ? '' : 'disabled'}>`}
        </div>
      `).join('');

      document.getElementById('btn-approve').disabled = invoice.status !== 'draft';
      document.getElementById('btn-send').disabled = invoice.status !== 'approved';
      document.getElementById('btn-paid').disabled = invoice.status !== 'sent';
      document.getElementById('btn-export').href = `/api/admin/invoices/${id}/export`;

      const auditList = (verification?.auditLog || [])
        .filter((e) => ['invoice_generated', 'invoice_sent', 'paid'].includes(e.type))
        .reverse();
      document.getElementById('inv-audit').innerHTML = auditList.length
        ? auditList.map((e) => `<li><time>${AdminShell.formatDate(e.at)}</time><span>${AdminShell.escapeHtml(e.detail || e.type)}</span></li>`).join('')
        : '<li>No invoice activity yet.</li>';
    } catch (err) {
      document.getElementById('inv-loading').textContent = 'Could not load this invoice: ' + err.message;
    }
  }

  document.getElementById('inv-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fields = {};
    document.querySelectorAll('[data-field]').forEach((el) => { fields[el.dataset.field] = el.value; });
    try {
      await AdminShell.api(`/api/admin/invoices/${id}`, { method: 'PATCH', body: JSON.stringify({ fields }) });
      AdminShell.toast('Draft saved');
      await load();
    } catch (err) {
      AdminShell.toast(err.message, { error: true });
    }
  });

  document.getElementById('btn-approve').addEventListener('click', async () => {
    if (!confirm('Approve this invoice? Approved invoices are locked from further editing.')) return;
    try {
      await AdminShell.api(`/api/admin/invoices/${id}/approve`, { method: 'POST', body: '{}' });
      AdminShell.toast('Invoice approved');
      await load();
    } catch (err) {
      AdminShell.toast(err.message, { error: true });
    }
  });

  document.getElementById('btn-send').addEventListener('click', async () => {
    if (!confirm('Send this invoice now? This is the only step that can email the property manager.')) return;
    try {
      const data = await AdminShell.api(`/api/admin/invoices/${id}/send`, { method: 'POST', body: '{}' });
      AdminShell.toast(data.emailed ? 'Invoice emailed to the property manager' : 'Invoice marked sent');
      await load();
    } catch (err) {
      AdminShell.toast(err.message, { error: true });
    }
  });

  document.getElementById('btn-paid').addEventListener('click', async () => {
    try {
      await AdminShell.api(`/api/admin/invoices/${id}/paid`, { method: 'POST', body: '{}' });
      AdminShell.toast('Invoice marked paid');
      await load();
    } catch (err) {
      AdminShell.toast(err.message, { error: true });
    }
  });

  load();
})();
