(async function () {
  const ok = await AdminShell.requireSession();
  if (!ok) return;

  document.getElementById('new-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('new-submit');
    const errorBox = document.getElementById('new-error');
    errorBox.classList.remove('show');

    const clientName = document.getElementById('clientName').value.trim();
    if (!clientName) return;

    btn.disabled = true;
    btn.textContent = 'Creating…';
    try {
      const data = await AdminShell.api('/api/admin/verifications', {
        method: 'POST',
        body: JSON.stringify({
          clientName,
          propertyName: document.getElementById('propertyName').value.trim(),
          propertyAddress: document.getElementById('propertyAddress').value.trim(),
          unitNumber: document.getElementById('unitNumber').value.trim(),
          notes: document.getElementById('notes').value.trim(),
        }),
      });
      window.location.href = `/admin/verifications/${data.verification.id}`;
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.add('show');
      btn.disabled = false;
      btn.textContent = 'Create Verification File';
    }
  });
})();
