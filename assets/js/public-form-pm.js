(async function () {
  const result = await PublicForm.verifyToken('pm');
  if (!result) return;

  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('form-state').style.display = 'block';

  if (result.propertyName) {
    document.getElementById('communityName').value = result.propertyName;
  }
  if (result.unitNumber) {
    document.getElementById('unitNumber').value = result.unitNumber;
  }
  if (result.clientName) {
    document.getElementById('clientName').value = result.clientName;
    document.getElementById('form-context').textContent =
      `Joey Williams (JWillSoldIt / Christin Rachelle Group) is requesting confirmation of ${result.clientName}'s rental placement for locator commission invoicing.`;
  }
  if (result.alreadySubmitted) {
    document.getElementById('already-note').style.display = 'block';
  }

  document.getElementById('pm-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    PublicForm.setFormError('');

    const certification = document.getElementById('certification').checked;
    if (!certification) {
      PublicForm.setFormError('Please check the certification box to submit.');
      return;
    }

    const btn = document.getElementById('pm-submit');
    btn.disabled = true;
    btn.textContent = 'Submitting…';

    try {
      const payload = {
        token: result.token,
        communityName: document.getElementById('communityName').value.trim(),
        managementCompany: document.getElementById('managementCompany').value.trim(),
        communityAddress: document.getElementById('communityAddress').value.trim(),
        pmContactName: document.getElementById('pmContactName').value.trim(),
        pmEmail: document.getElementById('pmEmail').value.trim(),
        clientName: document.getElementById('clientName').value.trim(),
        unitNumber: document.getElementById('unitNumber').value.trim(),
        applicationDate: document.getElementById('applicationDate').value,
        moveInDate: document.getElementById('moveInDate').value,
        leaseStartDate: document.getElementById('leaseStartDate').value,
        leaseTerm: document.getElementById('leaseTerm').value.trim(),
        monthlyRent: document.getElementById('monthlyRent').value.trim(),
        commissionOffered: document.getElementById('commissionOffered').value.trim(),
        commissionBasis: document.getElementById('commissionBasis').value,
        invoiceMethod: document.getElementById('invoiceMethod').value,
        invoiceAttentionLine: document.getElementById('invoiceAttentionLine').value.trim(),
        requiredVendorDocs: document.getElementById('requiredVendorDocs').value.trim(),
        paymentTimeline: document.getElementById('paymentTimeline').value.trim(),
        notes: document.getElementById('notes').value.trim(),
        certification: true,
      };

      const res = await fetch('/api/forms/submit-pm', {
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
      btn.textContent = 'Submit Confirmation';
    }
  });
})();
