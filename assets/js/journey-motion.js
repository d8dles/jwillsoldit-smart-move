// One red period owns every major Smart Move handoff.
window.JourneyMotion = (() => {
  const dot = document.getElementById('story-dot');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let activeAnimation = null;
  let pointer = { x: window.innerWidth * 0.5 - 9, y: window.innerHeight * 0.42 };
  document.addEventListener('pointermove', (event) => {
    pointer = { x: event.clientX - 9, y: event.clientY - 9 };
  }, { passive: true });

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
    dot.classList.remove('is-traveling');
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

  return { dot, reduced, anchor, point, cancel, depart, travel };
})();

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
