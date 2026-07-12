(async function () {
  const ok = await AdminShell.requireSession();
  if (!ok) return;

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
      const data = await AdminShell.api('/api/admin/listings', {
        method: 'POST',
        body: JSON.stringify({
          listingType: document.getElementById('listingType').value,
          clientName,
          clientEmail: document.getElementById('clientEmail').value.trim(),
          propertyAddress,
          unitNumber: document.getElementById('unitNumber').value.trim(),
          targetGoLiveDate: document.getElementById('targetGoLiveDate').value,
          notes: document.getElementById('notes').value.trim(),
        }),
      });
      window.location.href = `/admin/listings/${data.listing.id}`;
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.add('show');
      btn.disabled = false;
      btn.textContent = 'Create Listing File';
    }
  });
})();
