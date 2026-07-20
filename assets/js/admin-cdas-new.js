(async function () {
  const ok = await AdminShell.requireSession();
  if (!ok) return;

  const select = document.getElementById('sourceInvoiceId');
  try {
    const data = await AdminShell.api('/api/admin/invoices');
    (data.invoices || []).forEach((inv) => {
      const opt = document.createElement('option');
      opt.value = inv.id;
      opt.textContent = `${inv.invoiceNumber} — ${inv.client || 'no client'} — ${inv.community || 'no community'}${inv.balanceDue ? ` — $${inv.balanceDue}` : ''}`;
      select.appendChild(opt);
    });
  } catch (err) {
    // Non-fatal — the form still works with manual entry if invoices can't load.
  }

  // Prefilling client-side (rather than waiting on the create response) so
  // the admin sees exactly what will be sent before submitting.
  select.addEventListener('change', async () => {
    if (!select.value) return;
    try {
      const data = await AdminShell.api(`/api/admin/invoices/${select.value}`);
      const inv = data.invoice;
      if (!inv) return;
      document.getElementById('clientName').value = inv.fields?.client || '';
      document.getElementById('propertyAddress').value = inv.fields?.communityAddress || '';
      document.getElementById('unitNumber').value = inv.fields?.unitSuite || '';
      document.getElementById('community').value = inv.fields?.communityName || '';
      document.getElementById('totalCommission').value = inv.fields?.balanceDue || '';
      document.getElementById('payeeAmount').value = inv.fields?.balanceDue || '';
      document.getElementById('payeeName').value = inv.fields?.agent || 'Joey Williams';
      document.getElementById('payeeCompany').value = 'Christin Rachelle Group';
    } catch (err) {
      AdminShell.toast('Could not load that invoice: ' + err.message, { error: true });
    }
  });

  document.getElementById('new-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('new-submit');
    const errorBox = document.getElementById('new-error');
    errorBox.classList.remove('show');

    const clientName = document.getElementById('clientName').value.trim();
    const propertyAddress = document.getElementById('propertyAddress').value.trim();
    if (!clientName || !propertyAddress) return;

    btn.disabled = true;
    btn.textContent = 'Creating…';
    try {
      const data = await AdminShell.api('/api/admin/cdas', {
        method: 'POST',
        body: JSON.stringify({
          sourceInvoiceId: select.value || undefined,
          clientName,
          propertyAddress,
          unitNumber: document.getElementById('unitNumber').value.trim(),
          community: document.getElementById('community').value.trim(),
          closingDate: document.getElementById('closingDate').value,
          totalCommission: document.getElementById('totalCommission').value.trim(),
          payeeName: document.getElementById('payeeName').value.trim(),
          payeeCompany: document.getElementById('payeeCompany').value.trim(),
          payeeEmail: document.getElementById('payeeEmail').value.trim(),
          payeeAmount: document.getElementById('payeeAmount').value.trim(),
          notes: document.getElementById('notes').value.trim(),
        }),
      });
      window.location.href = `/admin/cdas/${data.cda.id}`;
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.add('show');
      btn.disabled = false;
      btn.textContent = 'Create CDA File';
    }
  });
})();
