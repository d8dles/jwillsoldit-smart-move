# Award Journey Cinematic Rebuild — Phase 1: Motion Engine & DOM Contract Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rejected branch's thin motion layer with a real single-protagonist motion engine and the full DOM/CSS/JS contract `tests/journey-motion.test.mjs` requires — hero automatic fall, route-reveal ribbon draw, Start Over, a map-locator cursor, and reusable scene-transition primitives — without touching `FormLogic`, route logic, submission payloads, or any currently-passing behavior in `tests/verify.mjs`.

**Architecture:** This is Phase 1 of a 7-phase rebuild (see `CLAUDE.md` and the handoff brief for full scope). Production stays the existing static, classic-script, 8-`<section>` funnel (`state.js → config.js → steps.js → validation.js → submit.js → app.js → journey-motion.js`, in that load order — do not change it). This phase only touches `index.html` structure, `assets/css/journey-motion.css`, `assets/js/journey-motion.js`, and two narrow, additive hooks in `assets/js/app.js`. Later phases (contact/disclosures, budget choreography, Houston map/refinement, route-question motion variety, final-brief arrival, responsive+a11y+browser QA) build on the anchors and engine functions this phase establishes, and will be written as separate plan documents once this phase's actual markup exists to build on.

**Tech Stack:** Static HTML5, CSS custom properties/animations, classic (non-module) browser JavaScript, Web Animations API (`element.animate()`), `node --test` for the structural test suite, Playwright (`tests/verify.mjs`) for behavioral regression.

**Why Phase 1 is scoped this way:** The previously-rejected branch (`feature/award-journey-motion`, `0defdb5`) failed because its plan (`docs/superpowers/plans/2026-07-22-award-journey.md`, Task 1–2) described animation work in prose ("Use physical easing, two rebounds maximum") instead of real keyframes, so the executor filled the gap with a minimal stub that satisfied the tests but not the brief. Every animation step below ships complete, working WAAPI keyframe code adapted from the approved prototype (`award-journey-scroll-v7.html`), not a description of one.

## Global Constraints

- Preserve `FormLogic`, `SECTIONS`, `goTo`, `PATH_MAP`, all six route keys, partial-lead capture (`sendPartialLead`), final submission (`sendSmartMoveBrief`/`buildSmartMovePayload`), and every existing payload shape. Do not modify `assets/js/state.js`, `assets/js/steps.js` (except the one additive hook in Task 4), `assets/js/validation.js`, or `assets/js/submit.js` in this phase.
- Keep classic global scripts, existing `<script>` load order, no bundler/framework/module conversion.
- Exactly one animated protagonist: `#story-dot`. Any other SVG circle or dot element added in this phase must be either a static path marker (no independent `requestAnimationFrame`/`.animate()` loop of its own) or fully inert/hidden until a later phase wires it.
- Respect `prefers-reduced-motion: reduce` everywhere: every new animation must no-op (or reduce to an instant, accessible state) when `matchMedia('(prefers-reduced-motion: reduce)').matches` is true.
- Maintain ≤1px horizontal overflow at 360/390/430/820/1440px (per `CLAUDE.md` known sharp edge) — do not introduce fixed-width elements that can overflow small viewports.
- Never let a native pointer disappear without the red map-locator cursor visibly taking its place, and never hide the native cursor before the replacement is confirmed active.
- `npm run verify` (Playwright harness) must still pass after every task. If the sandboxed environment blocks `127.0.0.1` listen, record that limitation explicitly rather than skipping the check silently.
- Do not deploy, push, or merge without explicit user approval — this phase ends in a local commit only.

---

### Task 1: Hero, ribbon, and Start Over DOM contract

**Files:**
- Modify: `index.html`
- Test: `tests/journey-motion.test.mjs` (no edits — this is the target)

**Interfaces:**
- Consumes: existing `#story-dot`, `.brand-dot`, `#section-open`, `#section-path .path-bands`, `#section-budget`, `#section-details .route-detail-body`.
- Produces: `#hero-handoff`, `#handoff-ribbon-path` (`.handoff-ribbon`), `[data-motion-anchor="hero-period"]` / `#hero-dot-target`, `[data-motion-anchor="route-landing"]`, `#ribbon-journey` / `#journey-path` / `#journey-dot`, `#start-over`, `#map-cursor`, three inert `.journey-scene` scaffolds for Task-6-and-later route-question motion.

- [ ] **Step 1: Run the target test and record the baseline failures**

Run: `node --test tests/journey-motion.test.mjs`
Expected: Several assertions FAIL (missing `hero-handoff`, `ribbon-journey`, `journey-path`, `journey-dot`, `start-over`, `hero-dot-target`, `data-motion-anchor="hero-period"`, `journey-scene`/`scene-zoom`/`scene-origami`/`scene-page-turn`/`handoff-ribbon` classes, and the JS-side assertions from Task 3). Note which ones are HTML-side (this task) vs. JS-side (Task 3).

- [ ] **Step 2: Add the cursor mount and Start Over link**

In `index.html`, immediately after the existing line:

```html
<div id="story-dot" aria-hidden="true"></div>
```

add:

```html
<div class="map-cursor" id="map-cursor" aria-hidden="true"></div>
<a href="#" class="start-over" id="start-over" onclick="return handleStartOver(event)">Start over</a>
```

- [ ] **Step 3: Turn the wordmark period into the hero anchor**

In the `#section-open` brand lockup, change:

```html
<a class="brand-name" href="https://www.jwillsoldit.com/" aria-label="JWILLSOLDIT home" data-text="JWillSoldIt">JWillSoldIt<span class="brand-dot" aria-hidden="true"></span></a>
```

to:

```html
<a class="brand-name" href="https://www.jwillsoldit.com/" aria-label="JWILLSOLDIT home" data-text="JWillSoldIt">JWillSoldIt<span class="brand-dot" id="hero-dot-target" data-motion-anchor="hero-period" aria-hidden="true"></span></a>
```

- [ ] **Step 4: Add the hero-handoff ribbon stage and the route-landing anchor**

Immediately before the closing `</section>` of `#section-open` (right after `.open-footer-strip` closes), add:

```html
<div id="hero-handoff" class="hero-handoff-stage" aria-hidden="true">
  <svg class="handoff-ribbon" viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden="true">
    <path id="handoff-ribbon-path" d="M1180 140 C980 300 860 90 700 280 S360 460 110 620"/>
  </svg>
</div>
```

In `#section-path`, right before `<div class="path-bands">`, add:

```html
<div class="route-landing" data-motion-anchor="route-landing" aria-hidden="true"></div>
```

- [ ] **Step 5: Add the budget-scene ribbon scaffold (geometry only — Phase 4 wires the animation)**

In `#section-budget`, as the first child right after `<section class="section" id="section-budget">`, add:

```html
<div id="ribbon-journey" class="ribbon-journey-stage" aria-hidden="true">
  <svg class="journey-ribbon" viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden="true">
    <path class="journey-ribbon-ghost" d="M60 700 C300 560 420 760 660 640 S980 480 1380 560"/>
    <path class="journey-ribbon-live" id="journey-path" d="M60 700 C300 560 420 760 660 640 S980 480 1380 560"/>
    <circle id="journey-dot" class="journey-ribbon-marker" r="7" cx="60" cy="700"/>
  </svg>
</div>
```

`#journey-dot` is a **static SVG marker**, not a second animated protagonist — it must never receive its own `.animate()`/rAF loop. Phase 4 will move it with a plain attribute set (`setAttribute('cx', ...)`) synced to `#story-dot`'s travel, the same way the approved prototype treats `#journeyDot`.

- [ ] **Step 6: Add the inert route-question motion scaffold**

In `#section-details`, right after `<div id="route-detail-fields"></div>` (do **not** modify that element — `validation.js`'s `renderRouteDetails()` still owns it and must keep working unchanged in this phase), add:

```html
<!-- Reserved for Phase 6 (route-specific question motion variety). Populated and
     wired by a later phase once every route's field schema has been categorized
     into property / preferences / qualifying groups. Inert until then. -->
<div class="journey-scene scene-zoom-enter" id="detail-scene-zoom" data-detail-slot="property" hidden></div>
<div class="journey-scene scene-origami-enter" id="detail-scene-origami" data-detail-slot="preferences" hidden></div>
<div class="journey-scene scene-page-turn-enter" id="detail-scene-page-turn" data-detail-slot="qualifying" hidden></div>
```

These are `hidden` and outside `#route-detail-fields`, so they have zero effect on `renderRouteDetails()`, `getCurrentDetailFields()`, `submitRouteDetails()`, or `npm run verify` — they exist only to make the `journey-scene`/`scene-zoom`/`scene-origami`/`scene-page-turn` classes real, and to give Phase 6 a documented, pre-agreed home.

- [ ] **Step 7: Re-run the test and confirm all HTML-side assertions pass**

Run: `node --test tests/journey-motion.test.mjs`
Expected: The `index.html`-only assertions (story-dot count, `hero-handoff`, `ribbon-journey`, `journey-path`, `journey-dot`, `start-over`, `hero-dot-target`, `data-motion-anchor="hero-period"`, the four class-regex assertions) PASS. The `journey-motion.js`-side assertions (`playHeroHandoff`, `drawRibbonJourney`, `scene-*-enter` string references) and the CSS-side assertion (`#story-dot.is-hero-active`, `#section-open ... hero`) still FAIL — that's expected until Tasks 2–3.

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "feat: add hero, ribbon, and start-over DOM contract for the cinematic journey"
```

---

### Task 2: Motion CSS contract

**Files:**
- Modify: `assets/css/journey-motion.css`
- Test: `tests/journey-motion.test.mjs`

**Interfaces:**
- Consumes: `#story-dot`, `#hero-handoff`, `#map-cursor`, `#start-over`, `.journey-scene` variants added in Task 1.
- Produces: `#story-dot.is-hero-active`, cursor visuals, Start Over styling, the three scene-enter keyframe animations, reduced-motion overrides for all of the above.

- [ ] **Step 1: Add the hero-active dot state and hero-handoff stage styling**

Append to `assets/css/journey-motion.css`:

```css
#story-dot.is-hero-active { opacity: 1; }

#section-open { position: relative; }

#section-open #hero-handoff {
  position: fixed;
  inset: 0;
  z-index: 850;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.18s ease-out;
}
#section-open #hero-handoff.is-active { opacity: 1; }
#section-open #hero-handoff .handoff-ribbon {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}
#section-open #hero-handoff .handoff-ribbon path {
  fill: none;
  stroke: var(--red);
  stroke-width: 3;
  stroke-linecap: round;
  filter: drop-shadow(0 3px 6px rgba(224, 58, 31, 0.28));
}

[data-motion-anchor="route-landing"] {
  position: absolute;
  top: -1px;
  left: 0;
  width: 1px;
  height: 1px;
}
#section-path { position: relative; }
```

- [ ] **Step 2: Add the budget-ribbon scaffold styling**

```css
#ribbon-journey {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: visible;
}
.journey-ribbon { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.journey-ribbon-ghost { fill: none; stroke: rgba(250, 247, 242, 0.08); stroke-width: 2; }
.journey-ribbon-live {
  fill: none;
  stroke: var(--red);
  stroke-width: 4;
  stroke-linecap: round;
  filter: drop-shadow(0 4px 7px rgba(224, 58, 31, 0.28));
}
.journey-ribbon-marker { fill: var(--red); filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.25)); }
#section-budget { position: relative; }
#section-budget > *:not(#ribbon-journey) { position: relative; z-index: 1; }
```

- [ ] **Step 3: Add the map-locator cursor**

```css
.map-cursor {
  position: fixed;
  z-index: 1300;
  left: 50%;
  top: 50%;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--red);
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, -50%);
  box-shadow: 0 2px 8px rgba(224, 58, 31, 0.42);
  will-change: left, top, transform;
  transition: opacity 0.18s;
}
.map-cursor::before,
.map-cursor::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.map-cursor::before {
  width: 30px;
  height: 30px;
  border: 1px solid rgba(224, 58, 31, 0.42);
  background: rgba(224, 58, 31, 0.035);
  transition: width 0.24s, height 0.24s, border-color 0.24s;
}
.map-cursor::after {
  width: 50px;
  height: 50px;
  border: 1px solid rgba(224, 58, 31, 0.14);
  animation: cursorLocator 2.1s ease-out infinite;
}
.map-cursor.visible { opacity: 1; }
.map-cursor.over::before { width: 44px; height: 44px; border-color: rgba(224, 58, 31, 0.72); }
.map-cursor.down { transform: translate(-50%, -50%) scale(0.68); }
@keyframes cursorLocator {
  0% { transform: translate(-50%, -50%) scale(0.45); opacity: 0.8; }
  100% { transform: translate(-50%, -50%) scale(1.2); opacity: 0; }
}

/* Native cursor is hidden only once JS confirms a fine pointer is tracked and
   the replacement dot is already visible — never before, so the cursor can
   never appear to vanish. See journey-motion.js's pointermove handler. */
body.map-cursor-on,
body.map-cursor-on button,
body.map-cursor-on a,
body.map-cursor-on input,
body.map-cursor-on .path-band,
body.map-cursor-on .budget-band,
body.map-cursor-on .houston-region {
  cursor: none;
}

@media (pointer: coarse) {
  .map-cursor { display: none !important; }
}
@media (prefers-reduced-motion: reduce) {
  .map-cursor::after { animation: none; display: none; }
}
```

- [ ] **Step 4: Style Start Over consistently with the "Plot Line — Step N" labels**

```css
.start-over {
  position: fixed;
  z-index: 950;
  top: 20px;
  right: 24px;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ember);
  text-decoration: underline;
  text-underline-offset: 4px;
  background: transparent;
  border: 0;
  cursor: pointer;
}
.start-over:hover { color: var(--red); }
.start-over:focus-visible { outline: 2px solid var(--red); outline-offset: 3px; }
@media (max-width: 480px) {
  .start-over { top: 12px; right: 12px; font-size: 10px; }
}
```

- [ ] **Step 5: Add the three scene-transition variants (ported from the approved prototype)**

```css
.journey-scene { position: relative; }

.scene-zoom-enter {
  transform-origin: 50% 50%;
  animation: sceneZoomIn 0.72s cubic-bezier(0.18, 0.82, 0.2, 1) both;
}
.scene-origami-enter {
  transform-origin: 50% 0;
  animation: sceneOrigamiIn 0.76s cubic-bezier(0.18, 0.78, 0.2, 1) both;
}
.scene-page-turn-enter {
  transform-origin: 100% 50%;
  animation: scenePageTurn 1.05s cubic-bezier(0.16, 0.84, 0.2, 1) both;
}
.scene-page-turn-enter::after {
  content: "";
  position: absolute;
  z-index: 8;
  inset: -15%;
  pointer-events: none;
  background: linear-gradient(108deg, transparent 47.8%, rgba(224, 58, 31, 0.94) 48.1% 48.45%, rgba(255, 255, 255, 0.78) 48.7%, transparent 50%);
  animation: pageTurnCrease 1.05s cubic-bezier(0.16, 0.84, 0.2, 1) both;
}
@keyframes sceneZoomIn {
  from { opacity: 0; transform: scale(0.968); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes sceneOrigamiIn {
  0% { opacity: 0.2; clip-path: inset(0 0 96% 0); transform: perspective(1600px) rotateX(-3deg); }
  100% { opacity: 1; clip-path: inset(0); transform: none; }
}
@keyframes scenePageTurn {
  0% { opacity: 0.35; clip-path: polygon(100% 0, 100% 0, 100% 100%, 100% 100%); transform: perspective(1800px) rotateY(-7deg) scale(1.025); }
  55% { opacity: 1; clip-path: polygon(18% 0, 100% 0, 100% 100%, 7% 100%); }
  100% { opacity: 1; clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); transform: none; }
}
@keyframes pageTurnCrease {
  0% { transform: translateX(64%); opacity: 0; }
  16% { opacity: 1; }
  82% { opacity: 0.8; }
  100% { transform: translateX(-68%); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .scene-zoom-enter,
  .scene-origami-enter,
  .scene-page-turn-enter { animation: none !important; opacity: 1 !important; clip-path: none !important; transform: none !important; }
  .scene-page-turn-enter::after { animation: none !important; content: none; }
}
```

- [ ] **Step 6: Re-run the test**

Run: `node --test tests/journey-motion.test.mjs`
Expected: The CSS-side assertion (`#story-dot\.is-hero-active` and `#section-open[\s\S]*hero`) now PASSES. JS-side assertions from Task 3 still FAIL.

- [ ] **Step 7: Commit**

```bash
git add assets/css/journey-motion.css
git commit -m "feat: add motion CSS contract — cursor, hero stage, scene-transition keyframes"
```

---

### Task 3: JourneyMotion engine — hero fall, ribbon draw, scene helper, cursor

**Files:**
- Modify: `assets/js/journey-motion.js`
- Test: `tests/journey-motion.test.mjs`

**Interfaces:**
- Consumes: `JourneyMotion.anchor(name)`, `JourneyMotion.point(el)`, `JourneyMotion.dot`, `JourneyMotion.reduced` (all already exist in this file).
- Produces: `JourneyMotion.playHeroHandoff({ navigate })`, `JourneyMotion.drawRibbonJourney(pathId, { onProgress })`, `JourneyMotion.applySceneEnter(el, variant)`, `handleStartOver(event)`, the map-cursor tracking loop.

- [ ] **Step 1: Add the reusable easing helpers and hero-fall function**

Inside the existing `window.JourneyMotion = (() => { ... })();` IIFE in `assets/js/journey-motion.js`, add these helpers near the top (after the existing `pointer` tracking block, before `function cancel()`):

```js
  const mix = (a, b, t) => a + (b - a) * t;
  let heroPlayed = false;

  function rectAnchor(name, fallback) {
    const el = anchor(name);
    if (!el) return fallback || { ...pointer };
    return point(el);
  }
```

Then add, after the existing `travel()` function and before the `return { ... }` statement:

```js
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
```

- [ ] **Step 2: Add `drawRibbonJourney` and the `.path-band` stagger reveal**

```js
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
```

- [ ] **Step 3: Add the reusable scene-transition helper**

```js
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
```

- [ ] **Step 4: Add the map-locator cursor engine**

```js
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
```

- [ ] **Step 5: Wire Start Over and reset the engine's own state**

Extend the existing `cancel()` function and add `handleStartOver`:

```js
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
```

(This replaces the prior body of `cancel()` — keep it as the single definition inside the IIFE.)

At the bottom of the file, before the existing `(() => { const originalGoTo = window.goTo; ... })();` block, add:

```js
function handleStartOver(event) {
  if (event) event.preventDefault();
  JourneyMotion.cancel();
  if (typeof goHome === 'function') goHome(event);
  return false;
}
```

- [ ] **Step 6: Export the new methods from the `JourneyMotion` IIFE**

Change the existing return statement:

```js
  return { dot, reduced, anchor, point, cancel, depart, travel };
```

to:

```js
  return { dot, reduced, anchor, point, cancel, depart, travel, playHeroHandoff, drawRibbonJourney, applySceneEnter };
```

- [ ] **Step 7: Run the full test file and confirm it is fully green**

Run: `node --test tests/journey-motion.test.mjs`
Expected: PASS — all assertions (`playHeroHandoff`, `drawRibbonJourney`, `scene-zoom-enter`, `scene-origami-enter`, `scene-page-turn-enter`, `prefers-reduced-motion`, `activeAnimation`, plus every Task 1/2 assertion) now pass.

- [ ] **Step 8: Syntax-check and commit**

```bash
node --check assets/js/journey-motion.js
git add assets/js/journey-motion.js
git commit -m "feat: implement hero fall, ribbon draw, scene-transition, and cursor engines"
```

---

### Task 4: Wire the hero handoff into production, full verification, commit

**Files:**
- Modify: `assets/js/app.js`
- Test: `tests/journey-motion.test.mjs`, `tests/verify.mjs`

**Interfaces:**
- Consumes: `JourneyMotion.playHeroHandoff`, the existing `completeHeroHandoff(reason)` function in `app.js`'s scroll-driven hero IIFE.
- Produces: no new public interface — this task only sequences the existing hero-progress engine with the new fall animation so the dot's motion and the existing `--intro-progress`/`--blueprint-alpha` scroll engine complete together instead of the CSS transition happening invisibly underneath an un-animated page.

- [ ] **Step 1: Read the current hookup point**

`assets/js/app.js`'s `completeHeroHandoff(reason)` (inside the "SCROLL-DRIVEN HERO TRANSITION" IIFE) currently ends with:

```js
      goTo(1, { behavior: 'smooth' });
      setTimeout(() => { autoAdvanced = false; }, 700);
```

- [ ] **Step 2: Replace the direct `goTo` call with the motion-aware handoff**

Change that block to:

```js
      if (window.JourneyMotion && typeof JourneyMotion.playHeroHandoff === 'function') {
        JourneyMotion.playHeroHandoff({ navigate: () => goTo(1, { behavior: 'auto' }) });
      } else {
        goTo(1, { behavior: 'smooth' });
      }
      setTimeout(() => { autoAdvanced = false; }, 700);
```

`playHeroHandoff` calls `navigate()` (which calls the real `goTo(1, ...)`) partway through its own animation, once the fall visually reaches the route-landing anchor — so the section swap lands exactly when the dot arrives, instead of before or after. The `window.JourneyMotion` existence check keeps `app.js` safe to load standalone (matches this file's existing defensive style, e.g. `if (typeof originalGoTo !== 'function') return;` in `journey-motion.js`).

Because `journey-motion.js` loads after `app.js` in `index.html`'s script order, `JourneyMotion` is guaranteed to exist by the time a real user scroll triggers `completeHeroHandoff` — the guard above is only a defensive no-op for out-of-order test/dev loading, not a normal runtime path.

- [ ] **Step 3: Syntax-check**

```bash
node --check assets/js/app.js
```

Expected: no output (success).

- [ ] **Step 4: Re-run the structural suite**

Run: `node --test tests/journey-motion.test.mjs`
Expected: PASS (unchanged from Task 3 — this task doesn't add new assertions, it wires existing ones into the real navigation path).

- [ ] **Step 5: Run the remaining static checks from the handoff brief**

```bash
node --check assets/js/journey-motion.js
node --check assets/js/steps.js
node --check assets/js/validation.js
node --check assets/js/app.js
git diff --check
```

Expected: all silent/zero-exit.

- [ ] **Step 6: Run the full Playwright verification harness**

```bash
npm install   # first time only
npm run verify
```

Expected: all six routes, the C1 scroll-up regression, UTM/fbclid attribution, and 360/390/430/820/1440 overflow checks PASS. If the sandbox blocks a local `127.0.0.1` listener, record that explicitly (do not report success) and note that this must be re-run in an environment that allows it, or against the Vercel preview, before Phase 1 is considered verified.

- [ ] **Step 7: Manual smoke check (documented, not yet the full browser QA gate)**

This phase does not yet claim full browser-verified completion — that is Task-level QA for later phases once the remaining scenes exist. But before committing, at minimum load `index.html` locally (e.g. `npx http-server .` or equivalent) and confirm:
- The red dot is visible falling from the wordmark period toward the route selector on first scroll/wheel, and the hero visibly lifts away rather than jump-cutting.
- `#start-over` is visible, orange, top-right, and resets the form back to the opening section.
- The custom cursor appears near the real pointer on a fine-pointer device and does not appear on a touch/coarse-pointer emulation.
- With `prefers-reduced-motion: reduce` forced on (e.g. via DevTools rendering emulation), the hero handoff still completes (dot doesn't animate, but `goTo(1, ...)` still fires and the page still reaches the route selector).

Note any discrepancy found here as a blocker before commit — do not claim this task complete on the strength of the automated tests alone, per this repository's verification-before-completion norm.

- [ ] **Step 8: Commit**

```bash
git add assets/js/app.js
git commit -m "feat: sequence the hero fall with the existing scroll-driven handoff"
```

---

## Self-review

- **Spec coverage:** DOM/CSS/JS contract required by `tests/journey-motion.test.mjs` — Tasks 1–3. Hero automatic fall (required scene 1) — Task 3 Step 1 + Task 4. Route reveal ribbon draw, progressive not all-upfront (required scene 2) — Task 3 Step 2. Start Over resetting route/contact/disclosures/budget/regions/route-specific/motion state (spec's "Start over" section) — Task 3 Step 5 (`handleStartOver` + extended `cancel()`) composing with the already-correct `resetSmartMoveState`/`goHome` in `steps.js`/`app.js`. Cursor behavior (red map-locator dot, no unpredictable disappearance, coarse-pointer fallback, reduced-motion preserved) — Task 2 Step 3 + Task 3 Step 4. Reduced-motion honored across every new animation — present in every CSS/JS addition. Single protagonist constraint — explicitly called out for `#journey-dot` in Task 1 Step 5 and enforced structurally (no second `.animate()`/rAF loop introduced). Not covered by this phase (deferred to later phase plans, as agreed): contact/disclosure modals, budget scene choreography, Houston map/refinement, route-question motion population, final-brief Texas arrival, and the full responsive/a11y/browser-QA gate — each will get its own plan once this phase's real DOM exists to anchor against.
- **Placeholder scan:** every animation step ships complete, runnable WAAPI/CSS code, not prose describing one. The one intentionally inert piece (Task 1 Step 6's three `hidden` scene containers) is explicitly documented as scaffolding for a named future phase, not claimed as finished route-question motion — Task-level completion for this phase does not depend on it doing anything yet.
- **Type/name consistency:** `JourneyMotion.playHeroHandoff({ navigate })`, `JourneyMotion.drawRibbonJourney(pathId, { duration, delay, stagger })`, and `JourneyMotion.applySceneEnter(el, variant)` are named and shaped identically everywhere they're defined, exported, and (in Task 4) called. `data-motion-anchor="hero-period"` / `"route-landing"` match between the HTML anchors (Task 1) and the `rectAnchor()` lookups (Task 3). `#hero-handoff`, `#handoff-ribbon-path`, `#ribbon-journey`, `#journey-path`, `#journey-dot`, `#start-over`, `#map-cursor` are the same literal ids in the HTML, CSS, JS, and test file throughout.
