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

    const RESOURCE_ROUTES = {
      renter: {
        title: 'Your Houston renter checklist',
        text: 'Prepare the documents, utilities, lease questions, insurance, maintenance plan, and move-in records you will need.',
        primary: ['Open the renter checklist', 'https://www.jwillsoldit.com/houston/guides/houston-renter-checklist'],
        secondary: ['Next steps after the lease', 'https://www.jwillsoldit.com/houston/guides/first-time-homebuyer']
      },
      buyer: {
        title: 'Prepare for the purchase',
        text: 'Review financing questions and the address-level Houston costs that deserve verification before you decide.',
        primary: ['Open the first-time buyer guide', 'https://www.jwillsoldit.com/houston/guides/first-time-homebuyer'],
        secondary: ['Understand property taxes', 'https://www.jwillsoldit.com/houston/guides/property-taxes']
      },
      sellbuy: {
        title: 'Plan the next address',
        text: 'Use the Houston guides to evaluate recurring costs and property-specific risks while Joey coordinates both sides.',
        primary: ['Understand property taxes', 'https://www.jwillsoldit.com/houston/guides/property-taxes'],
        secondary: ['Check flood risk and insurance', 'https://www.jwillsoldit.com/houston/guides/flood-risk-and-insurance']
      },
      seller: {
        title: 'Know what buyers will verify',
        text: 'Review the Houston property questions that can surface during a sale and prepare your records before the consultation.',
        primary: ['Review Houston property guides', 'https://www.jwillsoldit.com/houston/guides'],
        secondary: ['Understand property taxes', 'https://www.jwillsoldit.com/houston/guides/property-taxes']
      },
      commercial: {
        title: 'Map the Houston context',
        text: 'Explore how the region is organized while Joey reviews the property and business requirements in your brief.',
        primary: ['How Houston is organized', 'https://www.jwillsoldit.com/houston/guides/how-houston-is-organized'],
        secondary: ['Explore Houston areas', 'https://www.jwillsoldit.com/houston']
      },
      notsure: {
        title: 'Explore before the call',
        text: 'Start with the guide library. Joey will use your brief to narrow the next useful step.',
        primary: ['Explore Houston guides', 'https://www.jwillsoldit.com/houston/guides'],
        secondary: ['See the Houston map', 'https://www.jwillsoldit.com/houston']
      }
    };
    const resource = RESOURCE_ROUTES[path] || RESOURCE_ROUTES.notsure;
    const resourceTitle = document.getElementById('brief-resource-title');
    const resourceText = document.getElementById('brief-resource-text');
    const resourcePrimary = document.getElementById('brief-resource-primary');
    const resourceSecondary = document.getElementById('brief-resource-secondary');
    if (resourceTitle) resourceTitle.textContent = resource.title;
    if (resourceText) resourceText.textContent = resource.text;
    if (resourcePrimary) {
      resourcePrimary.textContent = resource.primary[0];
      resourcePrimary.href = resource.primary[1];
    }
    if (resourceSecondary) {
      resourceSecondary.textContent = resource.secondary[0];
      resourceSecondary.href = resource.secondary[1];
    }

    // Build and log submission object
    const submission = buildEnhancedSubmission(FormLogic.buildSubmissionObject());
    console.log('[SmartMove] Submission JSON:', JSON.stringify(submission, null, 2));
  }
