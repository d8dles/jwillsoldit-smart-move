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
      document.getElementById('detail-error').textContent = 'A few required answers are still missing.';
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
      renter:     'I’ll review what you need and follow up with rental options that make sense for your budget, timing, and location. In the meantime, start gathering your ID, income documents, and rental history so an application doesn’t catch you off guard.',
      buyer:      'I’ll reach out to talk through your budget, timing, and what the current market looks like for the kind of home you want. Then we can decide what the first useful step should be.',
      seller:     'I’ll review the property and recent comparable sales, then reach out to discuss pricing, preparation, and the timing that makes sense for you.',
      sellbuy:    'I’ll help you sort out which move needs to happen first, where the timing can overlap, and what we should have ready before either side goes live.',
      commercial: 'I’ll review the property and business details, then contact you to narrow the search or plan the sale.',
      notsure:    'No pressure. I’ll reach out for a short call so we can sort through the options and decide what makes sense.'
    };
    const nextEl = document.getElementById('brief-next-text');
    if (nextEl) nextEl.textContent = NEXT_STEP[path] || 'I’ll reach out to confirm the details and talk through the next step.';

    const RESOURCE_ROUTES = {
      renter: {
        title: 'Your Houston renter checklist',
        text: 'Know what to gather, what to ask before signing, which utilities to arrange, and what to document on move-in day.',
        primary: ['Open the renter checklist', 'https://www.jwillsoldit.com/houston/guides/houston-renter-checklist'],
        secondary: ['Next steps after the lease', 'https://www.jwillsoldit.com/houston/guides/first-time-homebuyer']
      },
      buyer: {
        title: 'A clearer start to buying',
        text: 'Start with financing, then learn which taxes, flood questions, and recurring costs can change from one Houston address to the next.',
        primary: ['Open the first-time buyer guide', 'https://www.jwillsoldit.com/houston/guides/first-time-homebuyer'],
        secondary: ['Understand property taxes', 'https://www.jwillsoldit.com/houston/guides/property-taxes']
      },
      sellbuy: {
        title: 'Plan both sides of the move',
        text: 'Use the Houston guides to understand recurring costs and property-specific questions while we work out the timing between selling and buying.',
        primary: ['Understand property taxes', 'https://www.jwillsoldit.com/houston/guides/property-taxes'],
        secondary: ['Check flood risk and insurance', 'https://www.jwillsoldit.com/houston/guides/flood-risk-and-insurance']
      },
      seller: {
        title: 'Get ahead of the buyer’s questions',
        text: 'These guides cover the property details buyers often ask about, so we can gather the right records early.',
        primary: ['Review Houston property guides', 'https://www.jwillsoldit.com/houston/guides'],
        secondary: ['Understand property taxes', 'https://www.jwillsoldit.com/houston/guides/property-taxes']
      },
      commercial: {
        title: 'Understand the Houston market',
        text: 'Explore how the region is organized while I review what the property needs to do for your business.',
        primary: ['How Houston is organized', 'https://www.jwillsoldit.com/houston/guides/how-houston-is-organized'],
        secondary: ['Explore Houston areas', 'https://www.jwillsoldit.com/houston']
      },
      notsure: {
        title: 'Explore before the call',
        text: 'Start wherever you’re curious. I’ll use your answers to help narrow what comes next.',
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
