// app.js — hero/trail/route-cue experience engines, route cue, payload/reset/populate brief, bootstrap init. Extracted (src 5502-5948). Load 6/6.
  // ── SCROLL-DRIVEN HERO TRANSITION ──────────────────────
  (function () {
    const hero = document.getElementById('section-open');
    if (!hero) return;

    let autoAdvanced = false;
    let heroSnapTimer = null;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

    function completeHeroHandoff(reason = 'scroll') {
      if (autoAdvanced || currentStep !== 0) return;
      autoAdvanced = true;
      document.body.classList.remove('hero-ready-to-snap');
      hero.style.setProperty('--intro-progress', '1');
      hero.style.setProperty('--blueprint-alpha', '1');
      goTo(1, { behavior: 'smooth' });
      setTimeout(() => { autoAdvanced = false; }, 700);
    }

    function updateHeroProgress() {
      if (!hero.classList.contains('visible') || currentStep !== 0) return;

      if (reduceMotion) {
        hero.style.setProperty('--intro-progress', '0');
        hero.style.setProperty('--blueprint-alpha', '0');
        return;
      }

      const maxScroll = Math.max(1, hero.offsetHeight - window.innerHeight);
      // Finish the visual transformation before the physical end of the hero runway.
      // This avoids the awkward dead zone where the screen looks done but does not advance.
      const raw = window.scrollY / maxScroll;
      const p = clamp(raw / 0.72, 0, 1);
      const blueprint = clamp((p - 0.12) / 0.48, 0, 1);

      hero.style.setProperty('--intro-progress', p.toFixed(3));
      hero.style.setProperty('--blueprint-alpha', blueprint.toFixed(3));
      document.body.classList.toggle('hero-ready-to-snap', p >= 0.48 && p < 0.9);

      clearTimeout(heroSnapTimer);
      if (p >= 0.48 && !programmaticScroll && !document.body.classList.contains('user-scrolling-back')) {
        // If the user pauses mid-transition, finish the handoff for them.
        heroSnapTimer = setTimeout(() => completeHeroHandoff('idle-snap'), 380);
      }

      if (p >= 0.68) {
        completeHeroHandoff('threshold');
      }
    }

    const cue = hero.querySelector('.scroll-cue');
    if (cue) {
      cue.style.pointerEvents = 'auto';
      cue.style.cursor = 'pointer';
      cue.addEventListener('click', () => completeHeroHandoff('cue-click'));
    }

    window.addEventListener('scroll', updateHeroProgress, { passive: true });
    window.addEventListener('resize', updateHeroProgress);
    updateHeroProgress();
  }());

  // ── TRAIL + PARALLAX ENGINE ─────────────────────────────
  (function () {
    const WORDS = ['RENT','BUY','SELL','COMMERCIAL','HOUSTON','SMART ROUTE',
                   'MOVE DATE','AREA','BUDGET','TOUR','CMA','KEYS'];
    const MAX_CARDS = 7;
    const MIN_DIST  = 68;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isSmallScreen = window.matchMedia('(max-width: 767px)').matches;
    const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
    if (prefersReduced || isSmallScreen || isCoarsePointer) return;

    let wordIdx = 0, liveCards = 0;
    let lastX = 0, lastY = 0;
    let targetMX = 0, targetMY = 0;
    let curMX = 0, curMY = 0;

    function lerp(a, b, t) { return a + (b - a) * t; }

    function tick() {
      curMX = lerp(curMX, targetMX, 0.055);
      curMY = lerp(curMY, targetMY, 0.055);
      const vis = document.querySelector('.section.visible');
      if (vis) {
        vis.style.setProperty('--mx', curMX.toFixed(4));
        vis.style.setProperty('--my', curMY.toFixed(4));
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    function spawnCard(x, y, layer) {
      if (liveCards >= MAX_CARDS) return;
      const card = document.createElement('div');
      card.className = 'trail-card';
      card.textContent = WORDS[wordIdx++ % WORDS.length];
      const rot = (Math.random() - 0.5) * 15;
      card.style.left = x + 'px';
      card.style.top  = y + 'px';
      card.style.setProperty('--rot', rot + 'deg');
      layer.appendChild(card);
      liveCards++;
      setTimeout(() => {
        card.classList.add('trail-out');
        card.addEventListener('animationend', () => { card.remove(); liveCards--; }, { once: true });
      }, 850);
    }

    document.addEventListener('pointermove', function (e) {
      targetMX = (e.clientX / window.innerWidth  - 0.5);
      targetMY = (e.clientY / window.innerHeight - 0.5);

      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      if (Math.sqrt(dx * dx + dy * dy) < MIN_DIST) return;
      lastX = e.clientX; lastY = e.clientY;

      const active = document.querySelector('#section-open.visible, #section-path.visible');
      if (!active) return;
      const layer = active.querySelector('.trail-layer');
      if (!layer) return;
      const r = layer.getBoundingClientRect();
      spawnCard(e.clientX - r.left, e.clientY - r.top, layer);
    });
  }());

  // ── V9 ROUTE CUE + FINAL BRIEF PAYOFF ───────────────────
  (function () {
    const cue = document.createElement('button');
    cue.type = 'button';
    cue.id = 'route-cue';
    cue.className = 'route-cue is-hidden';
    cue.textContent = 'Next route point';
    cue.addEventListener('click', manualNextRoute);
    document.body.appendChild(cue);

    const originalGoTo = goTo;
    goTo = function(step, options = {}) {
      originalGoTo(step, options);
      setTimeout(updateRouteCue, 70);
    };

    const originalBuildBrief = buildBrief;
    buildBrief = function() {
      originalBuildBrief();
      populateSmartBrief();
      setTimeout(updateRouteCue, 70);
    };

    window.addEventListener('scroll', updateRouteCue, { passive: true });
    window.addEventListener('resize', updateRouteCue);
    document.addEventListener('DOMContentLoaded', updateRouteCue);
    setTimeout(updateRouteCue, 250);
  }());

  function isStepReady(step) {
    if (step === 1) return !!FormLogic.getPath();
    if (step === 2) {
      const name  = document.getElementById('c-name')?.value.trim() || '';
      const email = document.getElementById('c-email')?.value.trim() || '';
      const phone = document.getElementById('c-phone')?.value.trim() || '';
      return FormLogic.validateField('name', name).valid &&
             FormLogic.validateField('email', email).valid &&
             FormLogic.validateField('phone', phone).valid &&
             !!FormLogic.formData.contact_method &&
             !!FormLogic.formData.best_time;
    }
    if (step === 3) {
      return !!FormLogic.formData.trunk.Q2_timeline &&
             !!FormLogic.formData.trunk.existing_agent_status &&
             !!FormLogic.formData.compliance_iabs_acknowledged &&
             !!FormLogic.formData.compliance_cpn_acknowledged;
    }
    if (step === 4) return !!getStoredValue(document.getElementById('budget-bands')?.dataset.target || 'trunk.Q4_budget');
    if (step === 5) return true;
    if (step === 6) return getCurrentDetailFields().every(fieldHasValue);
    return false;
  }

  function updateRouteCue() {
    const cue = document.getElementById('route-cue');
    if (!cue) return;
    const hidden = currentStep === 0 || currentStep >= 7;
    cue.classList.toggle('is-hidden', hidden);
    cue.style.display = hidden ? 'none' : 'flex';
    cue.classList.toggle('is-dark', currentStep === 1);

    const ready = isStepReady(currentStep);
    const labels = {
      1: ready ? 'Next route point' : 'Choose a route',
      2: ready ? 'Next route point' : 'Complete contact',
      3: ready ? 'Next route point' : 'Confirm disclosures',
      4: ready ? 'Next route point' : 'Choose a range',
      5: 'Next route point',
      6: ready ? 'Generate route brief' : 'Complete route details'
    };
    cue.textContent = labels[currentStep] || 'Next route point';
  }

  function manualNextRoute() {
    if (currentStep === 1) {
      if (FormLogic.getPath()) goTo(2);
      return;
    }
    if (currentStep === 2) return submitContact();
    if (currentStep === 3) return submitTrunk();
    if (currentStep === 4) {
      if (isStepReady(4)) goTo(5);
      return;
    }
    if (currentStep === 5) return goTo(6);
    if (currentStep === 6) return submitRouteDetails();
  }

  function labelFromOptions(fields, store, raw) {
    const field = fields.find(f => f.store === store);
    if (!field || !field.options) return raw;
    const values = Array.isArray(raw) ? raw : [raw];
    return values.filter(Boolean).map(v => {
      const found = field.options.find(o => o[0] === v);
      return found ? found[1] : v;
    }).join(' · ');
  }

  function refreshBriefIfUnlocked() {
    if (unlockedStep >= 7 || document.getElementById('section-brief')?.classList.contains('visible')) {
      populateSmartBrief();
    }
  }

  function summarizeSelectedDetails(fields) {
    const rows = [];
    fields.forEach(field => {
      const raw = getStoredValue(field.store);
      if (raw === null || raw === undefined || raw === '' || raw === false) return;
      if (Array.isArray(raw) && !raw.length) return;
      if (field.type === 'link') return;
      let value = labelFromOptions(fields, field.store, raw);
      if (field.type === 'ack' && raw) value = 'Acknowledged';
      if (!value) return;
      rows.push({ label: field.label, value });
    });
    return rows;
  }

  function buildSmartMovePayload() {
    const path = FormLogic.getPath();
    const fields = getCurrentDetailFields();
    const selections = summarizeSelectedDetails(fields);
    const base = FormLogic.buildSubmissionObject ? FormLogic.buildSubmissionObject() : {};
    return buildEnhancedSubmission({
      ...base,
      routeLabel: PATH_LABELS[path] || path || '',
      budgetLabel: document.getElementById('brief-budget')?.textContent || '',
      timelineLabel: document.getElementById('brief-timeline')?.textContent || '',
      readinessLabel: document.getElementById('brief-readiness')?.textContent || '',
      areasLabel: (FormLogic.formData.trunk.Q5_areas || []).join(', ') || 'No preference specified',
      criteriaLabel: document.getElementById('brief-criteria')?.textContent || '',
      selectedDetails: selections,
      contactLinks: {
        callText: '561-685-6566',
        email: 'jwillsoldit@icloud.com'
      }
    });
  }

  function resetSmartMoveState({ keepBrief = false } = {}) {
    autoAdvanceTimers.forEach(timer => clearTimeout(timer));
    autoAdvanceTimers.clear();
    partialLeadSent = false;
    FormLogic.init();

    document.querySelectorAll('.selected, .checked, .invalid').forEach(el => el.classList.remove('selected', 'checked', 'invalid'));
    document.querySelectorAll('input, textarea').forEach(el => {
      if (el.type === 'checkbox' || el.type === 'radio') el.checked = false;
      else el.value = '';
    });
    document.querySelectorAll('select').forEach(el => { el.selectedIndex = 0; });
    document.querySelectorAll('.contact-error, .trunk-err, .detail-error, .detail-field-error').forEach(el => { el.textContent = ''; });

    const pathBtn = document.getElementById('path-btn');
    if (pathBtn) pathBtn.disabled = true;
    const budgetBtn = document.getElementById('budget-btn');
    if (budgetBtn) budgetBtn.disabled = true;
    const agentNotice = document.getElementById('agent-yes-notice');
    if (agentNotice) agentNotice.style.display = 'none';
    const routeFields = document.getElementById('route-detail-fields');
    if (routeFields && !keepBrief) routeFields.innerHTML = '';
    if (typeof updateAreaSelectionUI === 'function') updateAreaSelectionUI();

    if (!keepBrief) {
      unlockedStep = 0;
      currentStep = 0;
      goTo(0, { reset: true, behavior: 'smooth' });
    }
    updateRouteCue();
  }

  async function sendSmartMoveBrief(event) {
    if (event) event.preventDefault();
    const btn = document.getElementById('brief-send-link');
    const status = document.getElementById('brief-submit-status');
    const payload = buildSmartMovePayload();
    console.log('[SmartMove] Submission payload:', payload);

    if (status) {
      status.classList.remove('error');
      status.textContent = SMART_MOVE_ENDPOINT ? 'Sending route brief…' : 'Connection not active yet. Payload logged in console.';
    }

    if (!SMART_MOVE_ENDPOINT) {
      if (status) status.textContent = 'Brief captured locally. Connection is not active yet, and the form has been reset.';
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Brief captured';
      }
      resetSmartMoveState({ keepBrief: true });
      return;
    }

    const originalText = btn ? btn.textContent : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Sending…';
    }

    try {
      const res = await fetch(SMART_MOVE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`Endpoint responded ${res.status}`);
      if (status) status.textContent = 'Saved. Joey has your Smart Move Brief in the CRM.';
      if (btn) btn.textContent = 'Brief sent';
      resetSmartMoveState({ keepBrief: true });
    } catch (err) {
      console.error('[SmartMove] Send failed:', err);
      if (status) {
        status.classList.add('error');
        status.textContent = 'Send failed. Check the endpoint connection.';
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalText || 'Send My Smart Move Brief';
      }
    }
  }

  function populateSmartBrief() {
    const path = FormLogic.getPath();
    const fields = getCurrentDetailFields();
    const timelineMap = {
      within_month: 'Within the next month',
      '1-3_months': '1–3 months',
      '3-6_months': '3–6 months',
      exploring: 'Just exploring'
    };
    const timelineEl = document.getElementById('brief-timeline');
    const readinessEl = document.getElementById('brief-readiness');
    const criteriaEl = document.getElementById('brief-criteria');
    const sendLink = document.getElementById('brief-send-link');

    if (timelineEl) timelineEl.textContent = timelineMap[FormLogic.formData.trunk.Q2_timeline] || 'Not specified';

    let readiness = 'Needs follow-up';
    if (path === 'buyer') {
      const pre = FormLogic.formData.pathData.Q8_preApproval;
      readiness = pre === 'pre-approved' ? 'Pre-approved buyer' : pre === 'cash' ? 'Cash buyer' : 'Lender intro may help';
    } else if (path === 'renter') {
      readiness = FormLogic.formData.pathData.Q14_employment ? 'Rental criteria captured' : 'Needs rental qualification';
    } else if (path === 'seller') {
      readiness = FormLogic.formData.pathData.seller_mortgage_status === 'yes' ? 'Payoff info needed / captured' : 'Listing consult ready';
    } else if (path === 'sellbuy') {
      readiness = 'Coordinated sell + buy strategy';
    } else if (path === 'commercial') {
      readiness = 'Commercial criteria captured';
    } else if (path === 'notsure') {
      readiness = 'Needs direction call';
    }
    if (readinessEl) readinessEl.textContent = readiness;

    const criteria = [];
    const add = (store) => {
      const raw = getStoredValue(store);
      if (Array.isArray(raw) && !raw.length) return;
      if (raw === null || raw === undefined || raw === '') return;
      const label = labelFromOptions(fields, store, raw);
      if (label) criteria.push(label);
    };
    if (path === 'renter') {
      add('pathData.renter_property_type');
      add('pathData.Q9_bedroomsBathrooms');
      add('pathData.Q10_rentalAmenities');
      add('pathData.Q12_leaseTerm');
      add('trunk.Q7_pets');
      add('trunk.Q7_petTypes');
      add('pathData.renter_pet_breed');
      add('pathData.renter_pet_weight');
    } else if (path === 'buyer') {
      add('pathData.Q12_newResale');
      add('pathData.Q13_bedsBaths');
      add('pathData.Q14_mustHaves');
    } else if (path === 'seller') {
      add('pathData.seller_property_type');
      add('pathData.Q8_propertyCondition');
      add('pathData.Q10_sellReason');
      add('pathData.Q9_motivatedTimeline');
    } else if (path === 'commercial') {
      add('pathData.Q8_commercialType');
      add('pathData.Q10_leasePurchase');
      add('pathData.Q9_squareFootage');
    } else if (path === 'sellbuy') {
      add('pathData.sellbuy_using_sale_proceeds');
      add('pathData.seller_property_type');
      add('pathData.Q8_propertyCondition');
      add('pathData.Q13_bedsBaths');
    } else {
      add('pathData.Q8_questionCategory');
    }
    if (criteriaEl) criteriaEl.textContent = criteria.length ? criteria.slice(0, 8).join(' · ') : 'Criteria captured';

    const summaryEl = document.getElementById('brief-all-selections');
    if (summaryEl) {
      const selections = summarizeSelectedDetails(fields);
      summaryEl.innerHTML = selections.length
        ? selections.map(item => `<div class="brief-summary-item"><small>${item.label}</small><span>${item.value}</span></div>`).join('')
        : '<div class="brief-summary-item"><small>Details</small><span>Route details captured.</span></div>';
    }

    if (sendLink) {
      sendLink.removeAttribute('href');
      sendLink.removeAttribute('disabled');
      sendLink.disabled = false;
      sendLink.textContent = 'Send My Smart Move Brief';
      sendLink.setAttribute('aria-label', 'Send Smart Move Brief to Joey');
    }
  }

  // Keep the selected-area tray in sync on first render.
  setTimeout(() => {
    if (typeof updateAreaSelectionUI === 'function') updateAreaSelectionUI();
  }, 300);

