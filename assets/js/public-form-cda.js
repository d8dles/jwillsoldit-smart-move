// public-form-cda.js — the tokenized CDA (Commission Disbursement
// Authorization) confirmation form. Uses PublicForm helpers from
// public-form-common.js but does its own token check against
// /api/forms/cda-token.

(async function () {
  var DOC_ITEMS = [
    { key: 'signed_cda', label: 'Signed Commission Disbursement Authorization' },
    { key: 'w9', label: 'Completed IRS Form W-9' },
  ];

  var token = PublicForm.getToken();
  if (!token) {
    PublicForm.showError('Link Not Found', 'This CDA link is missing its access token.');
    return;
  }

  var check;
  try {
    var res = await fetch('/api/forms/cda-token?token=' + encodeURIComponent(token));
    check = await res.json();
  } catch (err) {
    PublicForm.showError('Something Went Wrong', 'Could not load your CDA. Please try again or contact Joey Williams.');
    return;
  }

  if (!check.valid) {
    var messages = {
      expired: 'This CDA link has expired. Please contact Joey Williams for a new one.',
      revoked: 'This CDA link is no longer active. Please contact Joey Williams for a new one.',
      not_found: 'This CDA link isn’t recognized. Double-check the link or contact Joey Williams.',
    };
    PublicForm.showError('Link Not Valid', messages[check.reason] || 'This CDA link could not be verified.');
    return;
  }
  if (check.locked) {
    PublicForm.showError('Already Approved', 'This CDA has already been reviewed and approved. Contact Joey Williams directly if anything needs to change.');
    return;
  }

  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('form-state').style.display = 'block';

  function row(label, value) {
    if (!value) return '';
    return '<tr><td style="font-weight:600;padding:4px 16px 4px 0;white-space:nowrap;">' +
      PublicForm.escapeHtml(label) + '</td><td style="padding:4px 0;">' + PublicForm.escapeHtml(value) + '</td></tr>';
  }
  document.getElementById('deal-summary').innerHTML =
    row('Property', check.propertyAddress) +
    row('Client', check.clientName) +
    row('Community', check.community) +
    row('Closing date', check.closingDate) +
    row('Total commission', check.totalCommission ? '$' + check.totalCommission : '') +
    row('Your amount', check.payeeAmount ? '$' + check.payeeAmount : '');

  if (check.payeeName) document.getElementById('payeeLegalName').value = check.payeeName;
  if (check.payeeCompany) document.getElementById('payeeCompany').value = check.payeeCompany;
  if (check.alreadySubmitted) document.getElementById('already-note').style.display = 'block';

  // --- doc slots -----------------------------------------------------------
  var slotFiles = {}; // key -> File

  function renderDocSlots() {
    var container = document.getElementById('doc-slots');
    container.innerHTML = DOC_ITEMS.map(function (i) {
      return (
        '<div class="admin-field" data-doc-slot="' + i.key + '">' +
        '<label>' + PublicForm.escapeHtml(i.label) + ' *</label>' +
        '<input type="file" data-doc-input="' + i.key + '" accept="image/*,.pdf" required>' +
        '<div class="file-preview" data-doc-preview="' + i.key + '"></div>' +
        '</div>'
      );
    }).join('');

    container.querySelectorAll('[data-doc-input]').forEach(function (input) {
      var key = input.getAttribute('data-doc-input');
      input.addEventListener('change', function (e) {
        var file = e.target.files[0];
        slotFiles[key] = file || null;
        var preview = container.querySelector('[data-doc-preview="' + key + '"]');
        preview.textContent = file ? file.name + ' (' + Math.round(file.size / 1024) + 'KB)' : '';
      });
    });
  }

  renderDocSlots();

  function val(id) {
    var el = document.getElementById(id);
    return el ? (el.value || '').trim() : '';
  }

  // --- submit ----------------------------------------------------------------
  document.getElementById('cda-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    PublicForm.setFormError('');

    if (!document.getElementById('ackDisbursement').checked) {
      PublicForm.setFormError('Please check the acknowledgment to submit.');
      return;
    }

    var btn = document.getElementById('cda-submit');
    btn.disabled = true;
    btn.textContent = 'Submitting…';

    try {
      var uploads = {};
      for (var key in slotFiles) {
        if (slotFiles[key]) uploads[key] = await PublicForm.readFileAsDataUrl(slotFiles[key]);
      }

      var payload = {
        token: token,
        payeeLegalName: val('payeeLegalName'),
        email: val('email'),
        phone: val('phone'),
        payeeCompany: val('payeeCompany'),
        trecLicense: val('trecLicense'),
        mailingAddress: val('mailingAddress'),
        paymentMethod: val('paymentMethod'),
        ackDisbursement: true,
        uploads: uploads,
      };

      var res = await fetch('/api/forms/submit-cda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      var data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Submission failed');

      PublicForm.showSuccess();
      var outstanding = data.outstanding || [];
      var box = document.getElementById('success-outstanding');
      if (outstanding.length) {
        box.innerHTML =
          '<p style="font-weight:600;margin-bottom:8px;">Still needed from you:</p><ul style="padding-left:20px;">' +
          outstanding.map(function (i) { return '<li style="margin-bottom:4px;">' + PublicForm.escapeHtml(i.label) + '</li>'; }).join('') +
          '</ul><p style="margin-top:10px;">You can reply to your confirmation email or call/text Joey to get these over.</p>';
      } else {
        box.innerHTML = '<p style="font-weight:600;">Your file is complete — nothing outstanding.</p>';
      }
    } catch (err) {
      PublicForm.setFormError(err.message);
      btn.disabled = false;
      btn.textContent = 'Confirm & Submit';
    }
  });
})();
