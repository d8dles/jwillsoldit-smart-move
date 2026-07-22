// steps.js — step navigation, plotline, auto-advance, scroll sync, path/contact/trunk/budget/area selection handlers. Extracted (src 4519-4913). Load 3/6.
  function updateHeaderVisibility() {
    const y = window.scrollY || 0;
    const hide = currentStep === 0 && y < 28;
    document.body.classList.toggle('hero-idle', hide);
  }

  function syncHeaderVisibility() {
    const isOpening = currentStep === 0 || document.getElementById('section-open')?.classList.contains('active-section');
    const barelyScrolled = window.scrollY < 90;
    document.body.classList.toggle('hero-idle', isOpening && barelyScrolled);
  }

  window.addEventListener('scroll', syncHeaderVisibility, { passive: true });
  window.addEventListener('load', syncHeaderVisibility);
  syncHeaderVisibility();

  function updatePlotline(step) {
    document.querySelectorAll('.plotline-step').forEach((el, i) => {
      el.classList.remove('active', 'done');
      if (i < step) el.classList.add('done');
      if (i === step) el.classList.add('active');
    });
    updateHeaderVisibility();
  }

  function scrollToSection(step, behavior = 'smooth') {
    const target = document.getElementById(SECTIONS[step]);
    if (!target) return;
    programmaticScroll = true;
    target.scrollIntoView({ behavior, block: 'start' });
    setTimeout(() => { programmaticScroll = false; }, behavior === 'auto' ? 120 : 720);
  }

  function goTo(step, options = {}) {
    const shouldScroll = options.scroll !== false;
    const reset = options.reset === true;
    if (reset) unlockedStep = step;
    else unlockedStep = Math.max(unlockedStep, step);

    SECTIONS.forEach((id, i) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle('visible', i <= unlockedStep);
      el.classList.toggle('active-section', i === step);
    });

    updatePlotline(step);
    currentStep = step;
    document.documentElement.classList.add('auto-scroll-ready');

    const hero = document.getElementById('section-open');
    if (hero && step !== 0) {
      hero.style.setProperty('--intro-progress', '1');
      hero.style.setProperty('--blueprint-alpha', '1');
    }
    if (step === 4) prepareBudgetScreen();
    if (step === 6) renderRouteDetails();
    if (step === 7) buildBrief();

    if (shouldScroll) {
      setTimeout(() => scrollToSection(step, options.behavior || 'smooth'), 40);
    }
  }

  function goHome(event) {
    if (event) event.preventDefault();
    resetSmartMoveState({ keepBrief: false });
  }

  function scheduleAutoAdvance(key, callback, delay = 500, fromStep = currentStep) {
    if (autoAdvanceTimers.has(key)) clearTimeout(autoAdvanceTimers.get(key));
    const timer = setTimeout(() => {
      autoAdvanceTimers.delete(key);
      // If the user navigated to a different step, let the visible buttons take over.
      if (currentStep !== fromStep) return;
      // Do not yank users forward while they are scrolling back to change an answer —
      // retry shortly instead of dropping the advance entirely.
      if (Date.now() - lastUpScrollAt < 950 || document.body.classList.contains('rewinding')) {
        scheduleAutoAdvance(key, callback, 700, fromStep);
        return;
      }
      callback();
    }, delay);
    autoAdvanceTimers.set(key, timer);
  }

  function syncActiveStepFromScroll() {
    const visible = SECTIONS
      .map((id, i) => ({ el: document.getElementById(id), i }))
      .filter(item => item.el && item.el.classList.contains('visible'));
    if (!visible.length) return;

    const anchor = window.innerHeight * 0.36;
    let best = visible[0];
    let bestDist = Infinity;
    visible.forEach(item => {
      const rect = item.el.getBoundingClientRect();
      const dist = Math.abs(rect.top - anchor);
      if (rect.bottom > 80 && dist < bestDist) {
        best = item;
        bestDist = dist;
      }
    });

    if (best.i !== currentStep) {
      const previousStep = currentStep;
      currentStep = best.i;
      updatePlotline(best.i);
      if (best.i < previousStep) triggerBlueprintRewind();
    }
  }

  window.addEventListener('scroll', () => {
    syncActiveStepFromScroll();
    updateHeaderVisibility();
  }, { passive: true });
  window.addEventListener('resize', () => {
    syncActiveStepFromScroll();
    updateHeaderVisibility();
  });
  document.addEventListener('DOMContentLoaded', updateHeaderVisibility);

  window.addEventListener('scroll', () => {
    if (programmaticScroll) {
      lastScrollY = window.scrollY || 0;
      return;
    }
    const y = window.scrollY || 0;
    if (y < lastScrollY - 8) {
      lastUpScrollAt = Date.now();
      document.body.classList.add('user-scrolling-back');
      // Uses its own timer: sharing one with triggerBlueprintRewind() cancelled the
      // 'rewinding' cleanup and could disable auto-advance permanently.
      clearTimeout(scrollBackTimer);
      scrollBackTimer = setTimeout(() => document.body.classList.remove('user-scrolling-back'), 900);
    }
    lastScrollY = y;
  }, { passive: true });

  function triggerBlueprintRewind() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.body.classList.add('rewinding');
    clearTimeout(rewindTimer);
    rewindTimer = setTimeout(() => document.body.classList.remove('rewinding'), 900);
  }

  // ── PATH SELECTION ──────────────────────────────────────
  function selectPath(el) {
    document.querySelectorAll('.path-band').forEach(b => b.classList.remove('selected'));
    el.classList.add('selected');
    const logicKey = PATH_MAP[el.dataset.path] || el.dataset.path;
    FormLogic.setPath(logicKey);
    document.getElementById('path-btn').disabled = false;

    // Path selection is the one place where the user has made an explicit route choice,
    // so advance without waiting for the generic scroll-safety timer.
    if (autoAdvanceTimers.has('path')) clearTimeout(autoAdvanceTimers.get('path'));
    autoAdvanceTimers.set('path', setTimeout(() => {
      autoAdvanceTimers.delete('path');
      goTo(2);
    }, 260));
  }

  // ── INLINE OPTION BUTTONS (contact method / best time) ──
  function selectInline(el, groupId, field) {
    document.querySelectorAll(`#${groupId} .inline-opt`).forEach(b => b.classList.remove('selected'));
    el.classList.add('selected');
    FormLogic.formData[field] = el.dataset.val;
    maybeAutoContact();
  }

  // ── CONTACT VALIDATION + SAVE ───────────────────────────
  function maybeAutoContact() {
    const name  = document.getElementById('c-name')?.value.trim() || '';
    const email = document.getElementById('c-email')?.value.trim() || '';
    const phone = document.getElementById('c-phone')?.value.trim() || '';
    const method = FormLogic.formData['contact_method'] || null;
    const time   = FormLogic.formData['best_time'] || null;
    const ready = FormLogic.validateField('name', name).valid &&
                  FormLogic.validateField('email', email).valid &&
                  FormLogic.validateField('phone', phone).valid &&
                  method && time;
    if (ready) scheduleAutoAdvance('contact', submitContact, 550);
  }

  ['c-name','c-email','c-phone'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', maybeAutoContact);
  });

  function submitContact() {
    const name  = document.getElementById('c-name').value.trim();
    const email = document.getElementById('c-email').value.trim();
    const phone = document.getElementById('c-phone').value.trim();
    const method = FormLogic.formData['contact_method'] || null;
    const time   = FormLogic.formData['best_time'] || null;

    let valid = true;

    const setErr = (id, msg) => {
      document.getElementById(id).textContent = msg;
      valid = false;
    };
    const clrErr = (id) => { document.getElementById(id).textContent = ''; };

    const vName = FormLogic.validateField('name', name);
    vName.valid ? clrErr('err-name') : setErr('err-name', vName.error);
    document.getElementById('c-name').classList.toggle('invalid', !vName.valid);

    const vEmail = FormLogic.validateField('email', email);
    vEmail.valid ? clrErr('err-email') : setErr('err-email', vEmail.error);
    document.getElementById('c-email').classList.toggle('invalid', !vEmail.valid);

    const vPhone = FormLogic.validateField('phone', phone);
    vPhone.valid ? clrErr('err-phone') : setErr('err-phone', vPhone.error);
    document.getElementById('c-phone').classList.toggle('invalid', !vPhone.valid);

    method ? clrErr('err-pref') : setErr('err-pref', 'Select a preferred contact method');
    time   ? clrErr('err-time') : setErr('err-time', 'Select the best time to reach you');

    if (!valid) return;

    FormLogic.updateContactField('name',  name);
    FormLogic.updateContactField('email', email);
    FormLogic.updateContactField('phone', phone);

    sendPartialLead(); // fire-and-forget: capture the lead even if they never finish

    goTo(3); // → trunk
  }

  // ── PARTIAL LEAD CAPTURE ────────────────────────────────
  // Once contact info is valid, send it to the CRM immediately so an
  // abandoned form is still a lead. Never blocks or surfaces errors to
  // the user; the final submission upserts the same contact by email.
  let partialLeadSent = false;

  async function sendPartialLead() {
    if (partialLeadSent || !SMART_MOVE_ENDPOINT) return;
    partialLeadSent = true;
    try {
      const path = FormLogic.getPath();
      const payload = buildEnhancedSubmission({
        ...FormLogic.buildSubmissionObject(),
        routeLabel: PATH_LABELS[path] || path || 'Route pending',
        readinessLabel: 'Partial lead — contact captured, form in progress',
        contactLinks: { callText: '561-685-6566', email: 'jwillsoldit@icloud.com' }
      });
      payload.metadata.submissionType = 'partial_contact';
      const res = await fetch(SMART_MOVE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`Endpoint responded ${res.status}`);
      console.log('[SmartMove] Partial lead captured');
    } catch (err) {
      partialLeadSent = false; // allow a retry if the user edits contact info
      console.warn('[SmartMove] Partial lead send failed (non-blocking):', err);
    }
  }

  // ── TRUNK SCREEN ────────────────────────────────────────
  function trunkTimeline(el) {
    document.querySelectorAll('#trunk-timeline .budget-band').forEach(b => b.classList.remove('selected'));
    el.classList.add('selected');
    FormLogic.updateTrunkField('Q2_timeline', el.dataset.val);
    maybeAutoTrunk();
  }

  function trunkAgent(el) {
    document.querySelectorAll('#trunk-agent .budget-band').forEach(b => b.classList.remove('selected'));
    el.classList.add('selected');
    FormLogic.formData.trunk.existing_agent_status = el.dataset.val;
    document.getElementById('agent-yes-notice').style.display = el.dataset.val === 'yes' ? 'block' : 'none';
    maybeAutoTrunk();
  }

  function toggleAck(el, field, elId, errId) {
    el.classList.toggle('checked');
    FormLogic.formData[field] = el.classList.contains('checked');
    document.getElementById(errId).textContent = '';
    maybeAutoTrunk();
  }

  function maybeAutoTrunk() {
    const ready = FormLogic.formData.trunk.Q2_timeline &&
                  FormLogic.formData.trunk.existing_agent_status &&
                  FormLogic.formData.compliance_iabs_acknowledged &&
                  FormLogic.formData.compliance_cpn_acknowledged;
    if (ready) {
      const delay = FormLogic.formData.trunk.existing_agent_status === 'yes' ? 950 : 600;
      scheduleAutoAdvance('trunk', submitTrunk, delay);
    }
  }

  function submitTrunk() {
    let valid = true;
    const setErr = (id, msg) => { document.getElementById(id).textContent = msg; valid = false; };
    const clrErr = (id) => { document.getElementById(id).textContent = ''; };

    FormLogic.formData.trunk.Q2_timeline
      ? clrErr('err-timeline')
      : setErr('err-timeline', 'Select a timeline to continue');

    FormLogic.formData.trunk.existing_agent_status
      ? clrErr('err-agent')
      : setErr('err-agent', 'Select an option to continue');

    FormLogic.formData.compliance_iabs_acknowledged
      ? clrErr('err-iabs')
      : setErr('err-iabs', 'Acknowledgment required');

    FormLogic.formData.compliance_cpn_acknowledged
      ? clrErr('err-cpn')
      : setErr('err-cpn', 'Acknowledgment required');

    if (!valid) return;
    goTo(4); // → budget
  }

  // ── BUDGET SELECTION ────────────────────────────────────
  function selectBudget(el) {
    document.querySelectorAll('#section-budget .budget-band').forEach(b => b.classList.remove('selected'));
    el.classList.add('selected');
    const target = document.getElementById('budget-bands')?.dataset.target || 'trunk.Q4_budget';
    const value = el.dataset.budget;
    setStoredValue(target, value);
    if (target !== 'trunk.Q4_budget') FormLogic.updateTrunkField('Q4_budget', value);
    document.getElementById('budget-btn').disabled = false;
    refreshBriefIfUnlocked();
    scheduleAutoAdvance('budget', () => goTo(5), 450);
  }

  // ── AREA SELECTION ──────────────────────────────────────
  function updateAreaSelectionUI() {
    const areas = FormLogic.formData.trunk.Q5_areas || [];
    const countEl = document.getElementById('area-count-num');
    const tray = document.getElementById('area-selected-tray');
    if (countEl) countEl.textContent = areas.length;
    document.querySelectorAll('[data-area]').forEach(el => {
      el.classList.toggle('selected', areas.includes(el.dataset.area));
    });
    if (tray) {
      tray.innerHTML = areas.length
        ? areas.map(a => `<span class="selected-pill">${a}</span>`).join('')
        : `<span class="selected-pill" style="opacity:.45;">No areas selected yet</span>`;
    }
  }

  function toggleArea(el) {
    const area = el.dataset.area;
    if (!area) return;
    const current = Array.isArray(FormLogic.formData.trunk.Q5_areas) ? [...FormLogic.formData.trunk.Q5_areas] : [];
    const exists = current.includes(area);

    if (exists) {
      FormLogic.formData.trunk.Q5_areas = current.filter(a => a !== area);
    } else {
      if (current.length >= 5 && area !== 'Flexible') {
        const tray = document.getElementById('area-selected-tray');
        if (tray) tray.innerHTML = `<span class="selected-pill">Keep it tight: remove one area before adding more.</span>`;
        return;
      }
      current.push(area);
      FormLogic.formData.trunk.Q5_areas = current;
    }

    updateAreaSelectionUI();
    refreshBriefIfUnlocked();
    // Area selection should not auto-scroll while the user is choosing multiple areas.
    if (autoAdvanceTimers.has('area')) {
      clearTimeout(autoAdvanceTimers.get('area'));
      autoAdvanceTimers.delete('area');
    }
    updateRouteCue();
  }

  function addCustomArea() {
    const input = document.getElementById('custom-area-input');
    if (!input) return;
    const value = input.value.trim();
    if (!value) return;
    const faux = { dataset: { area: value } };
    toggleArea(faux);
    input.value = '';
  }

  function selectHoustonRegion(el) {
    const selected = [...document.querySelectorAll('.houston-region.selected')];
    if (!el.classList.contains('selected') && selected.length >= 2) {
      const tray = document.getElementById('area-selected-tray');
      if (tray) tray.innerHTML = '<span class="selected-pill">Choose up to two regions.</span>';
      return;
    }
    toggleArea(el);
    const regions = [...document.querySelectorAll('.houston-region.selected')];
    const dot = document.querySelector('.houston-map-dot');
    if (dot) {
      const rect = el.getBoundingClientRect();
      const stage = el.closest('.houston-map-stage').getBoundingClientRect();
      dot.style.left = `${rect.left - stage.left + rect.width / 2}px`;
      dot.style.top = `${rect.top - stage.top + rect.height / 2}px`;
      dot.classList.toggle('is-active', regions.length > 0);
    }
    if (autoAdvanceTimers.has('area-map')) clearTimeout(autoAdvanceTimers.get('area-map'));
    if (regions.length) scheduleAutoAdvance('area-map', () => goTo(6), 2000, 5);
  }

