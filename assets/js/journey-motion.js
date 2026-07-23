// One red period owns every major Smart Move handoff.
window.JourneyMotion = (() => {
  const dot = document.getElementById('story-dot');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let activeAnimation = null;
  let pointer = { x: window.innerWidth * 0.5 - 9, y: window.innerHeight * 0.42 };
  document.addEventListener('pointermove', (event) => {
    pointer = { x: event.clientX - 9, y: event.clientY - 9 };
  }, { passive: true });

  const mix = (a, b, t) => a + (b - a) * t;
  let heroPlayed = false;

  function rectAnchor(name, fallback) {
    const el = anchor(name);
    if (!el) return fallback || { ...pointer };
    return point(el);
  }

  function anchor(name) {
    return document.querySelector(`[data-motion-anchor="${name}"]`);
  }

  function point(element) {
    if (!element) return { x: window.innerWidth * 0.5 - 9, y: window.innerHeight * 0.42 };
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2 - 9, y: rect.top + rect.height / 2 - 9 };
  }

  function cancel() {
    if (activeAnimation) activeAnimation.cancel();
    activeAnimation = null;
    heroPlayed = false;
    dot.classList.remove('is-traveling', 'is-hero-active');
    document.body.classList.remove('journey-traveling');
    document.getElementById('hero-handoff')?.classList.remove('is-active');
    document.querySelectorAll('.is-landed').forEach((el) => el.classList.remove('is-landed'));
    const heroSection = document.getElementById('section-open');
    if (heroSection) heroSection.style.transform = '';
  }

  async function animate(frames, options) {
    if (reduced) return;
    if (activeAnimation) activeAnimation.cancel();
    dot.classList.add('is-traveling');
    activeAnimation = dot.animate(frames, { fill: 'forwards', ...options });
    try { await activeAnimation.finished; } catch (_) { return; }
    const last = frames[frames.length - 1];
    if (last.transform) dot.style.transform = last.transform;
    activeAnimation.cancel();
    activeAnimation = null;
  }

  async function fallIn(target, dramatic = false) {
    const duration = dramatic ? 1500 : 1050;
    await animate([
      { transform: `translate(${target.x}px,-42px) scale(.76,1.28)`, opacity: 1 },
      { transform: `translate(${target.x}px,${target.y + 7}px) scale(1.34,.66)`, offset: .58 },
      { transform: `translate(${target.x}px,${target.y - 42}px) scale(.82,1.16)`, offset: .73 },
      { transform: `translate(${target.x}px,${target.y + 3}px) scale(1.14,.78)`, offset: .87 },
      { transform: `translate(${target.x}px,${target.y}px) scale(.62)`, opacity: 1 }
    ], { duration, easing: 'cubic-bezier(.25,.02,.18,1)' });
  }

  async function depart(from = pointer) {
    await animate([
      { transform: `translate(${from.x}px,${from.y}px) scale(1)`, opacity: 1 },
      { transform: `translate(${from.x}px,${from.y - 14}px) scale(.9,1.12)`, offset: .2 },
      { transform: `translate(${from.x}px,${window.innerHeight + 32}px) scale(.72,1.34)` }
    ], { duration: 500, easing: 'cubic-bezier(.46,0,.7,.42)' });
  }

  async function travel({ from, to, navigate, dramatic = false } = {}) {
    if (reduced) return;
    await depart(from ? point(from) : pointer);
    if (typeof navigate === 'function') navigate();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const targetElement = typeof to === 'string' ? anchor(to) : to;
    const target = point(targetElement);
    await fallIn(target, dramatic);
    targetElement?.classList.add('is-landed');
    dot.animate([
      { boxShadow: '0 0 0 0 rgba(224,58,31,.55)' },
      { boxShadow: '0 0 0 34px rgba(224,58,31,0)' }
    ], { duration: 460, easing: 'ease-out' });
    setTimeout(() => dot.classList.remove('is-traveling'), 220);
    document.dispatchEvent(new CustomEvent('journey:arrived', { detail: { to } }));
  }

  async function playHeroHandoff({ navigate } = {}) {
    const heroSection = document.getElementById('section-open');
    const heroStage = document.getElementById('hero-handoff');
    if (reduced || !heroSection || heroPlayed) {
      if (typeof navigate === 'function') navigate();
      return;
    }
    heroPlayed = true;
    document.body.classList.add('journey-traveling');
    heroStage?.classList.add('is-active');

    const start = rectAnchor('hero-period', { x: window.innerWidth * 0.5, y: 110 });
    const end = rectAnchor('route-landing', { x: window.innerWidth * 0.12, y: 150 });

    dot.style.opacity = '1';
    dot.classList.add('is-hero-active', 'is-traveling');
    if (activeAnimation) activeAnimation.cancel();

    const fall = dot.animate([
      { transform: `translate(${start.x}px,${start.y}px) scale(1)` },
      { transform: `translate(${start.x}px,${start.y - 10}px) scale(1.1,.86)`, offset: 0.12 },
      { transform: `translate(${mix(start.x, end.x, 0.55)}px,${mix(start.y, end.y, 0.42)}px) scale(.8,1.25)`, offset: 0.5 },
      { transform: `translate(${end.x}px,${end.y + 9}px) scale(1.32,.68)`, offset: 0.74 },
      { transform: `translate(${end.x}px,${end.y - 26}px) scale(.88,1.14)`, offset: 0.87 },
      { transform: `translate(${end.x}px,${end.y + 3}px) scale(1.1,.82)`, offset: 0.95 },
      { transform: `translate(${end.x}px,${end.y}px) scale(.6)`, offset: 1 }
    ], { duration: 1300, easing: 'cubic-bezier(.24,.02,.2,1)', fill: 'forwards' });
    activeAnimation = fall;

    const ribbonPromise = drawRibbonJourney('handoff-ribbon-path', { duration: 900, delay: 650 });

    // The hero "sheet" lifts upward, revealing the route selector beneath it
    // like a window opening — synced to the fall, not an abrupt scroll-jump.
    const lift = heroSection.animate([
      { transform: 'translate3d(0,0,0)', filter: 'brightness(1)' },
      { transform: 'translate3d(0,-6vh,0)', filter: 'brightness(1)', offset: 0.35 },
      { transform: 'translate3d(0,-108vh,0)', filter: 'brightness(.94)' }
    ], { duration: 1300, easing: 'cubic-bezier(.22,.78,.2,1)', fill: 'forwards' });

    try { await fall.finished; } catch (_) { /* cancelled */ }
    dot.animate([
      { boxShadow: '0 0 0 0 rgba(224,58,31,.55)' },
      { boxShadow: '0 0 0 30px rgba(224,58,31,0)' }
    ], { duration: 460, easing: 'ease-out' });
    document.querySelector('[data-motion-anchor="route-landing"]')?.classList.add('is-landed');

    try { await Promise.all([lift.finished, ribbonPromise]); } catch (_) { /* cancelled */ }

    if (typeof navigate === 'function') navigate();

    heroSection.style.transform = 'translate3d(0,-108vh,0)';
    lift.cancel();
    fall.cancel();
    activeAnimation = null;
    heroStage?.classList.remove('is-active');
    dot.classList.remove('is-traveling');
    document.body.classList.remove('journey-traveling');
  }

  async function drawRibbonJourney(pathId, { duration = 1100, delay = 0, stagger = true } = {}) {
    const path = document.getElementById(pathId);
    if (!path) return;
    const length = path.getTotalLength();
    path.style.strokeDasharray = String(length);
    if (reduced) {
      path.style.strokeDashoffset = '0';
      if (stagger) document.querySelectorAll('.path-band').forEach((band) => { band.style.opacity = '1'; band.style.transform = 'none'; });
      return;
    }
    path.style.strokeDashoffset = String(length);

    const bands = stagger ? [...document.querySelectorAll('.path-band')] : [];
    bands.forEach((band) => {
      band.style.opacity = '0';
      band.style.transform = 'translateY(12px)';
      band.style.pointerEvents = 'none';
    });

    await new Promise((resolve) => setTimeout(resolve, delay));

    return new Promise((resolve) => {
      const start = performance.now();
      function frame(now) {
        const raw = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - raw, 3);
        path.style.strokeDashoffset = String(length * (1 - eased));
        bands.forEach((band, i) => {
          const reveal = Math.min(1, Math.max(0, (eased - i * 0.11) / 0.4));
          band.style.opacity = String(reveal);
          band.style.transform = `translateY(${(1 - reveal) * 12}px)`;
          if (reveal > 0.92) band.style.pointerEvents = 'auto';
        });
        if (raw < 1) {
          requestAnimationFrame(frame);
        } else {
          bands.forEach((band) => { band.style.opacity = '1'; band.style.transform = 'none'; band.style.pointerEvents = 'auto'; });
          resolve();
        }
      }
      requestAnimationFrame(frame);
    });
  }

  const SCENE_CLASSES = ['scene-zoom-enter', 'scene-origami-enter', 'scene-page-turn-enter'];

  function applySceneEnter(el, variant) {
    if (!el) return;
    const className = `scene-${variant}-enter`;
    if (!SCENE_CLASSES.includes(className)) {
      console.warn(`[JourneyMotion] Unknown scene variant: ${variant}`);
      return;
    }
    SCENE_CLASSES.forEach((c) => el.classList.remove(c));
    if (reduced) return;
    // Force reflow so re-adding the same class replays the animation.
    void el.offsetWidth;
    el.classList.add(className);
  }

  (function initMapCursor() {
    const cursorEl = document.getElementById('map-cursor');
    if (!cursorEl) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let curX = targetX;
    let curY = targetY;
    let seen = false;

    function tick() {
      curX = mix(curX, targetX, 0.24);
      curY = mix(curY, targetY, 0.24);
      cursorEl.style.left = `${curX}px`;
      cursorEl.style.top = `${curY}px`;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    window.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch') return;
      targetX = event.clientX;
      targetY = event.clientY;
      if (!seen) {
        seen = true;
        cursorEl.classList.add('visible');
        document.body.classList.add('map-cursor-on');
      }
      const overInteractive = !!event.target.closest('button, a, input, .path-band, .budget-band, .houston-region');
      cursorEl.classList.toggle('over', overInteractive);
    }, { passive: true });
    window.addEventListener('pointerdown', () => cursorEl.classList.add('down'), { passive: true });
    window.addEventListener('pointerup', () => cursorEl.classList.remove('down'), { passive: true });
    window.addEventListener('mouseout', (event) => {
      if (!event.relatedTarget) {
        cursorEl.classList.remove('visible');
        document.body.classList.remove('map-cursor-on');
      }
    });
  })();

  return { dot, reduced, anchor, point, cancel, depart, travel, playHeroHandoff, drawRibbonJourney, applySceneEnter };
})();

function downloadVisualBrief() {
  window.print();
}

async function shareSmartMoveBrief() {
  const path = document.getElementById('brief-path')?.textContent || 'Smart Move';
  const areas = document.getElementById('brief-areas')?.textContent || 'Houston';
  const payload = {
    title: 'My JWILLSOLDIT Smart Move',
    text: `${path} · ${areas}`,
    url: 'https://move.jwillsoldit.com/'
  };
  if (navigator.share) {
    try { await navigator.share(payload); } catch (error) {
      if (error.name !== 'AbortError') console.warn('[SmartMove] Share failed', error);
    }
    return;
  }
  await navigator.clipboard.writeText(`${payload.text} ${payload.url}`);
  const status = document.getElementById('brief-submit-status');
  if (status) status.textContent = 'Share link copied.';
}

function handleStartOver(event) {
  if (event) event.preventDefault();
  JourneyMotion.cancel();
  if (typeof goHome === 'function') goHome(event);
  return false;
}

(() => {
  const originalGoTo = window.goTo;
  if (typeof originalGoTo !== 'function') return;
  window.goTo = function journeyGoTo(step, options = {}) {
    const target = step === 4 ? 'budget' : step === 6 ? 'route-punctuation' : step === 7 ? 'houston' : null;
    if (!target || JourneyMotion.reduced) return originalGoTo(step, options);
    JourneyMotion.travel({
      to: target,
      dramatic: step === 7,
      navigate: () => originalGoTo(step, { ...options, behavior: 'auto' })
    });
  };
})();
