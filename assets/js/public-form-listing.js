// public-form-listing.js — the tokenized listing-intake checklist (sale +
// lease branches). Uses PublicForm helpers from public-form-common.js but
// does its own token check against /api/forms/listing-token.

(async function () {
  // Mirrors the doc items in api/_lib/listing.js. `when` gates run against
  // current form values so slots appear/disappear as the client answers.
  var DOC_ITEMS = {
    sale: [
      { key: 'listing_agreement', label: 'Signed listing agreement' },
      { key: 'sellers_disclosure', label: "Seller's Disclosure Notice" },
      { key: 'survey_t47', label: 'Existing survey + T-47 affidavit' },
      { key: 'hoa_docs', label: 'HOA documents & transfer info', when: hasHoa },
      { key: 'lead_paint_disclosure', label: 'Lead-based paint disclosure (built before 1978)', when: pre1978 },
    ],
    lease: [
      { key: 'listing_agreement', label: 'Signed listing / management agreement' },
      { key: 'hoa_lease_approval', label: 'HOA lease approval / restrictions', when: hasHoa },
      { key: 'lead_paint_disclosure', label: 'Lead-based paint disclosure (built before 1978)', when: pre1978 },
    ],
  };

  function hasHoa() {
    return document.getElementById('hasHoa').value === 'yes';
  }
  function pre1978() {
    var year = parseInt(document.getElementById('yearBuilt').value, 10);
    return Number.isFinite(year) && year < 1978;
  }

  var token = PublicForm.getToken();
  if (!token) {
    PublicForm.showError('Link Not Found', 'This listing link is missing its access token.');
    return;
  }

  var check;
  try {
    var res = await fetch('/api/forms/listing-token?token=' + encodeURIComponent(token));
    check = await res.json();
  } catch (err) {
    PublicForm.showError('Something Went Wrong', 'Could not load your checklist. Please try again or contact Joey Williams.');
    return;
  }

  if (!check.valid) {
    var messages = {
      expired: 'This listing link has expired. Please contact Joey Williams for a new one.',
      revoked: 'This listing link is no longer active. Please contact Joey Williams for a new one.',
      not_found: 'This listing link isn’t recognized. Double-check the link or contact Joey Williams.',
    };
    PublicForm.showError('Link Not Valid', messages[check.reason] || 'This listing link could not be verified.');
    return;
  }
  if (check.locked) {
    PublicForm.showError('Already Approved', 'This listing has already been reviewed and approved. Contact Joey Williams directly if anything needs to change.');
    return;
  }

  var listingType = check.listingType === 'lease' ? 'lease' : 'sale';

  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('form-state').style.display = 'block';

  document.getElementById('type-pill').textContent =
    listingType === 'lease' ? 'Listing Checklist · For Lease' : 'Listing Checklist · For Sale';
  if (listingType === 'lease') {
    document.getElementById('ack-listing-label').textContent =
      'I acknowledge that I will be required to sign a listing / management agreement before any marketing of my property occurs.';
  }
  document.querySelectorAll('[data-branch]').forEach(function (el) {
    el.style.display = el.getAttribute('data-branch') === listingType ? 'block' : 'none';
  });

  if (check.clientName) document.getElementById('clientLegalName').value = check.clientName;
  if (check.propertyAddress) document.getElementById('propertyAddress').value = check.propertyAddress;
  if (check.unitNumber) document.getElementById('unitNumber').value = check.unitNumber;
  if (check.targetGoLiveDate) document.getElementById('targetGoLiveDate').value = check.targetGoLiveDate;
  if (check.alreadySubmitted) document.getElementById('already-note').style.display = 'block';

  // --- dynamic doc slots -------------------------------------------------
  var slotFiles = {}; // key -> File

  function renderDocSlots() {
    var container = document.getElementById('doc-slots');
    var items = DOC_ITEMS[listingType].filter(function (i) { return !i.when || i.when(); });
    container.innerHTML = items.map(function (i) {
      return (
        '<div class="admin-field" data-doc-slot="' + i.key + '">' +
        '<label>' + PublicForm.escapeHtml(i.label) + '</label>' +
        '<input type="file" data-doc-input="' + i.key + '" accept="image/*,.pdf">' +
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

    // Drop stale files for slots that disappeared (e.g. HOA switched to no).
    var liveKeys = items.map(function (i) { return i.key; });
    Object.keys(slotFiles).forEach(function (key) {
      if (liveKeys.indexOf(key) === -1) delete slotFiles[key];
    });
  }

  renderDocSlots();
  document.getElementById('hasHoa').addEventListener('change', function () {
    document.getElementById('hoa-details').style.display = hasHoa() ? 'block' : 'none';
    renderDocSlots();
  });
  document.getElementById('yearBuilt').addEventListener('change', renderDocSlots);

  var petsSelect = document.getElementById('petsAllowed');
  if (petsSelect) {
    petsSelect.addEventListener('change', function () {
      var show = petsSelect.value === 'yes' || petsSelect.value === 'case-by-case';
      document.getElementById('pet-policy-field').style.display = show ? 'block' : 'none';
    });
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? (el.value || '').trim() : '';
  }

  // --- submit -------------------------------------------------------------
  document.getElementById('listing-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    PublicForm.setFormError('');

    if (!document.getElementById('ackListingAgreement').checked || !document.getElementById('ackIabs').checked) {
      PublicForm.setFormError('Please check both acknowledgments to submit.');
      return;
    }

    var btn = document.getElementById('listing-submit');
    btn.disabled = true;
    btn.textContent = 'Submitting…';

    try {
      var uploads = {};
      for (var key in slotFiles) {
        if (slotFiles[key]) uploads[key] = await PublicForm.readFileAsDataUrl(slotFiles[key]);
      }

      var payload = {
        token: token,
        clientLegalName: val('clientLegalName'),
        email: val('email'),
        phone: val('phone'),
        propertyAddress: val('propertyAddress'),
        unitNumber: val('unitNumber'),
        propertyType: val('propertyType'),
        bedrooms: val('bedrooms'),
        bathrooms: val('bathrooms'),
        sqft: val('sqft'),
        yearBuilt: val('yearBuilt'),
        occupancy: val('occupancy'),
        accessNotes: val('accessNotes'),
        hasHoa: val('hasHoa'),
        hoaName: val('hoaName'),
        hoaDues: val('hoaDues'),
        hoaRestrictions: val('hoaRestrictions'),
        targetGoLiveDate: val('targetGoLiveDate'),
        notes: val('notes'),
        ackListingAgreement: true,
        ackIabs: true,
        uploads: uploads,
      };

      if (listingType === 'sale') {
        payload.mortgageStatus = val('mortgageStatus');
        payload.payoffEstimate = val('payoffEstimate');
        payload.priceExpectation = val('priceExpectation');
        payload.condition = val('condition');
        payload.motivation = val('motivation');
        payload.updatesRepairs = val('updatesRepairs');
        payload.knownIssues = val('knownIssues');
      } else {
        payload.askingRent = val('askingRent');
        payload.securityDeposit = val('securityDeposit');
        payload.availableDate = val('availableDate');
        payload.leaseTerms = val('leaseTerms');
        payload.petsAllowed = val('petsAllowed');
        payload.petPolicy = val('petPolicy');
        payload.smokingPolicy = val('smokingPolicy');
        payload.utilitiesIncluded = val('utilitiesIncluded');
        payload.appliancesIncluded = val('appliancesIncluded');
        payload.screeningCriteria = val('screeningCriteria');
        payload.makeReadyStatus = val('makeReadyStatus');
      }

      var res = await fetch('/api/forms/submit-listing', {
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
        box.innerHTML = '<p style="font-weight:600;">Your checklist is complete — nothing outstanding.</p>';
      }
    } catch (err) {
      PublicForm.setFormError(err.message);
      btn.disabled = false;
      btn.textContent = 'Submit Listing Checklist';
    }
  });
})();
