// submit.js — route-details submit, enhanced submission builder, brief builder. Extracted (src 5425-5501). Load 5/6.
  function submitRouteDetails() {
    const fields = getCurrentDetailFields();
    const missing = fields.filter(f => !fieldHasValue(f));
    document.querySelectorAll('.detail-field-error').forEach(el => el.textContent = '');
    if (missing.length) {
      missing.forEach(f => {
        const node = document.querySelector(`.detail-field[data-field="${CSS.escape(f.store)}"] .detail-field-error`);
        if (node) node.textContent = 'Required';
      });
      document.getElementById('detail-error').textContent = 'Complete the required route details.';
      return;
    }

    // Mirror global existing-agent answer into buyer/sellbuy path data for schema readability.
    if (FormLogic.formData.path === 'buyer' || FormLogic.formData.path === 'sellbuy') {
      FormLogic.formData.pathData.buyer_has_agent = FormLogic.formData.trunk.existing_agent_status || null;
    }

    goTo(7);
  }

  function buildEnhancedSubmission(base) {
    return {
      ...base,
      honeypot: document.getElementById('c-company-website')?.value || '',
      metadata: {
        submissionId: `SM-${Date.now()}`,
        submittedAt: new Date().toISOString(),
        submissionType: 'final',
        formVersion: FormLogic.formData.formVersion || '1.0',
        deviceType: window.innerWidth < 768 ? 'mobile' : 'desktop',
        userAgent: navigator.userAgent,
        tracking: TRACKING_PARAMS
      },
      fullTrunk: FormLogic.formData.trunk,
      fullPathData: FormLogic.formData.pathData,
      additionalIntake: FormLogic.formData.additionalIntake || {}
    };
  }


  // ── BUILD BRIEF ─────────────────────────────────────────
  function buildBrief() {
    const path   = FormLogic.getPath();
    const budget = FormLogic.formData.trunk.Q4_budget;
    const areas  = FormLogic.formData.trunk.Q5_areas;
    const c      = FormLogic.formData.contact;

    document.getElementById('brief-path').textContent   = PATH_LABELS[path] || path || '—';
    document.getElementById('brief-budget').textContent = BUDGET_LABELS[budget] || budget || '—';

    const areasEl = document.getElementById('brief-areas');
    areasEl.innerHTML = areas.length
      ? areas.map(a => `<strong>${a}</strong>`).join(' &middot; ')
      : 'No preference specified';

    // Inject contact row into brief if element exists
    const briefName = document.getElementById('brief-name');
    if (briefName) briefName.textContent = c.name || '—';

    // Recommended next step — path-specific copy
    const NEXT_STEP = {
      renter:     'Joey will review your criteria and follow up with realistic rental matches and next steps. Have your ID and pay stubs ready for applications.',
      buyer:      'Joey will schedule a no-pressure buyer consultation to walk through the market, your budget, and a competitive offer strategy.',
      seller:     'Joey will prepare a Comparative Market Analysis for your property and reach out to schedule a listing consultation.',
      sellbuy:    'Joey will map a coordinated sell-and-buy timeline so the order of operations makes sense before you make your next move.',
      commercial: 'Joey will review your commercial criteria and follow up directly to map the next step for your lease, purchase, sale, or investment need.',
      notsure:    'No pressure — Joey will reach out for a quick 15-minute call to help you figure out the right move and the right timing.'
    };
    const nextEl = document.getElementById('brief-next-text');
    if (nextEl) nextEl.textContent = NEXT_STEP[path] || 'I will reach out to confirm the details and talk through the next step.';

    // Build and log submission object
    const submission = buildEnhancedSubmission(FormLogic.buildSubmissionObject());
    console.log('[SmartMove] Submission JSON:', JSON.stringify(submission, null, 2));
  }
