(async function () {
  const result = await PublicForm.verifyToken('client');
  if (!result) return;

  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('form-state').style.display = 'block';

  if (result.propertyName) {
    document.getElementById('propertyName').value = result.propertyName;
  }
  if (result.unitNumber) {
    document.getElementById('unitNumber').value = result.unitNumber;
  }
  if (result.alreadySubmitted) {
    document.getElementById('already-note').style.display = 'block';
  }

  document.getElementById('upload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    const preview = document.getElementById('upload-preview');
    preview.textContent = file ? `${file.name} (${Math.round(file.size / 1024)}KB)` : '';
  });

  document.getElementById('client-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    PublicForm.setFormError('');

    const consent = document.getElementById('consent').checked;
    if (!consent) {
      PublicForm.setFormError('Please check the consent box to submit.');
      return;
    }

    const btn = document.getElementById('client-submit');
    btn.disabled = true;
    btn.textContent = 'Submitting…';

    try {
      let upload = null;
      const file = document.getElementById('upload').files[0];
      if (file) upload = await PublicForm.readFileAsDataUrl(file);

      const payload = {
        token: result.token,
        clientLegalName: document.getElementById('clientLegalName').value.trim(),
        preferredName: document.getElementById('preferredName').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        propertyName: document.getElementById('propertyName').value.trim(),
        propertyAddress: document.getElementById('propertyAddress').value.trim(),
        unitNumber: document.getElementById('unitNumber').value.trim(),
        pmContactName: document.getElementById('pmContactName').value.trim(),
        pmEmail: document.getElementById('pmEmail').value.trim(),
        dateToured: document.getElementById('dateToured').value,
        applicationDate: document.getElementById('applicationDate').value,
        moveInDate: document.getElementById('moveInDate').value,
        leaseStartDate: document.getElementById('leaseStartDate').value,
        leaseTerm: document.getElementById('leaseTerm').value.trim(),
        monthlyRent: document.getElementById('monthlyRent').value.trim(),
        concession: document.getElementById('concession').value.trim(),
        firstContactMethod: document.getElementById('firstContactMethod').value,
        listedReferral: document.getElementById('listedReferral').value,
        consent: true,
        upload,
      };

      const res = await fetch('/api/forms/submit-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Submission failed');

      PublicForm.showSuccess();
    } catch (err) {
      PublicForm.setFormError(err.message);
      btn.disabled = false;
      btn.textContent = 'Submit Verification';
    }
  });
})();
