# Award Journey Cinematic Rebuild — Phase 3: Animated Budget Scene

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the budget step from a static list into the designed motion scene the brief requires — the ribbon Phase 1 already scaffolded (`#ribbon-journey`/`#journey-path`/`#journey-dot`, currently inert) actually draws across the screen, and each route's budget bands enter with editorial staggered motion, while every route's correct budget choices keep rendering exactly as before.

**Architecture:** No new DOM. Phase 1 already added `#ribbon-journey`'s SVG scaffold as the first child of `#section-budget`, and already built a generic `JourneyMotion.drawRibbonJourney(pathId, opts)` used today for the hero→route ribbon. This phase generalizes that one function (it currently hardcodes `.path-band` as the thing it staggers, and doesn't move `#journey-dot` along the path — both were explicitly deferred to "whichever phase wires the budget ribbon" in Phase 1's plan) and calls it from `assets/js/validation.js`'s existing `prepareBudgetScreen()`, which already rebuilds `#budget-bands`' HTML on every entry to the budget step for every route. No CSS changes are needed — `.budget-band` already has its full visual styling; this phase only adds inline-style-driven entrance motion via JS, the same reduced-motion-safe pattern Phase 1 established for `.path-band`.

**Tech Stack:** Web Animations API / `requestAnimationFrame` (already the established pattern in `journey-motion.js`), classic browser JavaScript, `tests/verify.mjs` as the regression gate (it already exercises the budget step for the `rent` path at every viewport, and clicks `#budget-bands .budget-band` first-child for the four overflow-viewport runs).

## Global Constraints

- Do not modify `index.html`, any CSS file, `assets/js/state.js`, `assets/js/steps.js`, `assets/js/submit.js`, or `assets/js/app.js`. This phase touches `assets/js/journey-motion.js` and `assets/js/validation.js` only.
- `tests/verify.mjs` is not modified and must keep passing unmodified — it clicks `#budget-bands .budget-band` (first child, whichever route is active) and expects `#budget-btn` to become enabled and the step to advance; the entrance animation must never delay or block that click from working (bands must remain genuinely clickable throughout, not just visually present).
- Exactly one animated protagonist: `#story-dot`. `#journey-dot` remains a position-only marker — its `cx`/`cy` attributes may be set every animation frame (bookkeeping tied to the ribbon's own draw progress), but it must never receive its own `.animate()`/rAF loop independent of `drawRibbonJourney`'s existing one.
- Respect `prefers-reduced-motion: reduce` — under reduced motion, budget bands must render immediately at full opacity/normal position (no animation, no delay), exactly as `drawRibbonJourney` already does for `.path-band` today.
- Preserve every route's exact budget option set (`BUDGET_SETS` in `validation.js`) and the `data-budget`/`onclick="selectBudget(this)"` wiring on every band — this phase adds motion around the existing bands, it does not change what they say or how selecting one works.
- `npm run verify` must pass after every task; re-run once if anything looks flaky (established precedent from Phases 1–2).
- Do not deploy, push, or merge without explicit user approval — this phase ends in local commits only (the user will decide when to push, as they did for Phases 1–2).

---

### Task 1: Generalize `drawRibbonJourney` — configurable stagger target and a moving path marker

**Files:**
- Modify: `assets/js/journey-motion.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `drawRibbonJourney(pathId, { duration, delay, staggerSelector, markerId })` — two new, optional, backward-compatible options added to the existing signature.

- [ ] **Step 1: Generalize the stagger target and add marker-following**

Replace the current `drawRibbonJourney` function body:

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

with:

```js
  async function drawRibbonJourney(pathId, { duration = 1100, delay = 0, stagger = true, staggerSelector = '.path-band', markerId = null } = {}) {
    const path = document.getElementById(pathId);
    if (!path) return;
    const length = path.getTotalLength();
    path.style.strokeDasharray = String(length);
    const marker = markerId ? document.getElementById(markerId) : null;
    if (reduced) {
      path.style.strokeDashoffset = '0';
      if (stagger) document.querySelectorAll(staggerSelector).forEach((band) => { band.style.opacity = '1'; band.style.transform = 'none'; });
      if (marker) {
        const end = path.getPointAtLength(length);
        marker.setAttribute('cx', end.x);
        marker.setAttribute('cy', end.y);
      }
      return;
    }
    path.style.strokeDashoffset = String(length);

    const bands = stagger ? [...document.querySelectorAll(staggerSelector)] : [];
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
        if (marker) {
          const point = path.getPointAtLength(length * eased);
          marker.setAttribute('cx', point.x);
          marker.setAttribute('cy', point.y);
        }
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

The only behavioral changes for existing callers: `staggerSelector` defaults to `.path-band` (byte-identical behavior to before for the existing hero-handoff call site, which doesn't pass this option) and `markerId` defaults to `null` (no marker movement unless explicitly requested — also byte-identical for the existing call site).

- [ ] **Step 2: Verify no regression to the existing hero-handoff caller**

```bash
node --check assets/js/journey-motion.js
node --test tests/journey-motion.test.mjs
```

Expected: `node --check` silent; `node --test` still 7/7 (this test suite doesn't assert on `drawRibbonJourney`'s internals beyond the function name existing, which is unchanged).

- [ ] **Step 3: Commit**

```bash
git add assets/js/journey-motion.js
git commit -m "feat: generalize drawRibbonJourney for a configurable stagger target and a moving path marker"
```

---

### Task 2: Wire the budget scene's ribbon draw and staggered band entrance

**Files:**
- Modify: `assets/js/validation.js`

**Interfaces:**
- Consumes: `JourneyMotion.drawRibbonJourney('journey-path', { staggerSelector: '.budget-band', markerId: 'journey-dot' })`.
- Produces: nothing new — this task only adds a call inside the existing `prepareBudgetScreen()`.

- [ ] **Step 1: Call the ribbon draw after building each route's bands**

In `assets/js/validation.js`, change:

```js
  function prepareBudgetScreen() {
    const path = FormLogic.getPath() || 'renter';
    const set = BUDGET_SETS[path] || BUDGET_SETS.renter;
    const title = document.getElementById('budget-title');
    const wrap = document.getElementById('budget-bands');
    if (!title || !wrap) return;
    title.innerHTML = set.title;
    wrap.dataset.target = set.target;
    wrap.innerHTML = set.options.map(([value, range, label]) => `
      <div class="budget-band" data-budget="${value}" onclick="selectBudget(this)">
        <span class="budget-range">${range}</span>
        <span class="budget-label">${label}</span>
        <div class="budget-indicator"></div>
      </div>
    `).join('');
    document.getElementById('budget-btn').disabled = true;
  }
```

to:

```js
  function prepareBudgetScreen() {
    const path = FormLogic.getPath() || 'renter';
    const set = BUDGET_SETS[path] || BUDGET_SETS.renter;
    const title = document.getElementById('budget-title');
    const wrap = document.getElementById('budget-bands');
    if (!title || !wrap) return;
    title.innerHTML = set.title;
    wrap.dataset.target = set.target;
    wrap.innerHTML = set.options.map(([value, range, label]) => `
      <div class="budget-band" data-budget="${value}" onclick="selectBudget(this)">
        <span class="budget-range">${range}</span>
        <span class="budget-label">${label}</span>
        <div class="budget-indicator"></div>
      </div>
    `).join('');
    document.getElementById('budget-btn').disabled = true;
    if (window.JourneyMotion && typeof JourneyMotion.drawRibbonJourney === 'function') {
      JourneyMotion.drawRibbonJourney('journey-path', {
        duration: 900,
        delay: 150,
        staggerSelector: '.budget-band',
        markerId: 'journey-dot'
      });
    }
  }
```

`journey-motion.js` loads after `validation.js` in `index.html`'s script order (state → config → steps → validation → submit → app → journey-motion), so the `window.JourneyMotion` guard is a defensive no-op for out-of-order test/dev loading, not a normal runtime path — the same pattern Phase 1's `app.js` hook already established for exactly this reason.

The call is fire-and-forget (not awaited) — `prepareBudgetScreen()` stays synchronous, so `goTo(4)`'s existing behavior (scroll timing, plotline update, etc.) is completely unaffected by this addition.

- [ ] **Step 2: Verify every route's budget bands remain correct and clickable**

```bash
node --check assets/js/validation.js
git diff --check
npm run verify
```

Expected: PASS. `npm run verify` drives all six routes end-to-end (each hits a different `BUDGET_SETS` entry) and, separately, clicks `#budget-bands .budget-band` first-child for the `rent` path at four more viewports — confirm this still succeeds even though the band starts at `opacity:0` momentarily on entry (Playwright's click waits for actionability; the animation's `duration:900` + `delay:150` total ~1.05s ceiling is well under Playwright's default action timeout, and `pointer-events:auto` is restored per-band well before full opacity in the existing stagger logic's `reveal > 0.92` check — this already worked correctly for `.path-band` in Phase 1's harness runs, and the mechanism is unchanged). Re-run `npm run verify` a second time if anything looks flaky before concluding a failure is real.

- [ ] **Step 3: Commit**

```bash
git add assets/js/validation.js
git commit -m "feat: draw the budget-scene ribbon and stagger each route's budget bands on entry"
```

---

## Self-review

- **Spec coverage:** "The red ribbon draws through it" — Task 1 generalizes the drawing engine, Task 2 triggers it on every budget-step entry. "Budget bands enter with editorial staggered motion" — Task 2's `staggerSelector: '.budget-band'` reuses the exact staggered-reveal timing curve already proven in Phase 1's route-reveal. "Use the correct budget choices for the selected route" — untouched; `BUDGET_SETS`/`prepareBudgetScreen()`'s route-selection logic is not modified, only appended to. "Do not reuse a heart transition" — not applicable; no such pattern exists in this codebase.
- **Placeholder scan:** both tasks ship complete, working code — no prose descriptions of animation behavior.
- **Type/name consistency:** `drawRibbonJourney(pathId, { duration, delay, stagger, staggerSelector, markerId })`'s full option set is used identically in its Task 1 definition and its Task 2 call site (`'journey-path'`, `staggerSelector: '.budget-band'`, `markerId: 'journey-dot'`). `#journey-path`/`#journey-dot` ids match exactly what Phase 1 already put in `index.html` inside `#ribbon-journey`.
