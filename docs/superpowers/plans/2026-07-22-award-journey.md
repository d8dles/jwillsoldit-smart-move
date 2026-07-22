# Smart Move Award Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the approved award-journey presentation and single-period motion system into the production Smart Move funnel without changing its routes, validation, attribution, or submission contracts.

**Architecture:** Keep the current static `index.html` and classic-script architecture. Add focused `journey-motion.css` and `journey-motion.js` files loaded last, use the existing navigation functions as stable integration points, and retain `FormLogic` as the only form-state authority. Replace the area presentation with semantic region controls that write through the existing area-selection functions.

**Tech Stack:** HTML5, CSS custom properties/animations, classic browser JavaScript, Web Animations API, Playwright verification, Vercel static hosting/functions.

## Global Constraints

- Preserve all six production route keys and every existing `FormLogic` field.
- Preserve partial-contact and final-submission payloads and attribution.
- Keep classic scripts and the existing load order; no framework, bundler, or module conversion.
- Use exactly one persistent story-dot element for cross-section motion.
- Preserve visible Continue controls and C1 scroll-up recovery.
- Respect `prefers-reduced-motion`, keyboard focus, and ≤1px responsive overflow.
- Do not deploy or merge without explicit approval.

---

### Task 1: Lock the DOM and motion contracts

**Files:**
- Modify: `index.html`
- Create: `assets/css/journey-motion.css`
- Create: `assets/js/journey-motion.js`
- Test: `tests/journey-motion.test.mjs`

**Interfaces:**
- Consumes: global `goTo(step, options)`, `currentStep`, `SECTIONS`, and `FormLogic`.
- Produces: `window.JourneyMotion`, `#story-dot`, `data-motion-anchor` attributes, and `journey:arrived` events.

- [ ] **Step 1: Write a failing structural test**

```js
test('journey motion assets and single story dot are mounted', async () => {
  const html = await readFile('index.html', 'utf8');
  assert.match(html, /assets\/css\/journey-motion\.css/);
  assert.match(html, /id="story-dot"/);
  assert.equal((html.match(/id="story-dot"/g) || []).length, 1);
  assert.match(html, /assets\/js\/journey-motion\.js/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test tests/journey-motion.test.mjs`
Expected: FAIL because the assets and story dot do not exist.

- [ ] **Step 3: Add the motion assets and semantic anchors**

Add `journey-motion.css` after `responsive.css`, add one `<div id="story-dot" aria-hidden="true"></div>` after the progress navigation, and load `journey-motion.js` after `app.js`. Add stable `data-motion-anchor` attributes to the hero period, budget route start, details title punctuation, and Houston target.

- [ ] **Step 4: Implement the controller shell**

```js
window.JourneyMotion = (() => {
  const dot = document.getElementById('story-dot');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let active = null;
  function cancel() { active?.cancel(); active = null; dot.classList.remove('is-traveling'); }
  function anchor(name) { return document.querySelector(`[data-motion-anchor="${name}"]`); }
  return { dot, reduced, anchor, cancel };
})();
```

- [ ] **Step 5: Run the focused test and commit**

Run: `node --test tests/journey-motion.test.mjs`
Expected: PASS.

```bash
git add index.html assets/css/journey-motion.css assets/js/journey-motion.js tests/journey-motion.test.mjs
git commit -m "feat: establish Smart Move journey motion contracts"
```

### Task 2: Build the single-period navigation engine

**Files:**
- Modify: `assets/js/journey-motion.js`
- Modify: `assets/js/steps.js`
- Modify: `assets/css/journey-motion.css`
- Test: `tests/journey-motion.test.mjs`

**Interfaces:**
- Consumes: `JourneyMotion.anchor(name)` and existing `goTo`.
- Produces: `JourneyMotion.travel({ from, to, step, mode })` returning `Promise<void>`.

- [ ] **Step 1: Add tests for one-dot ownership, cancellation, reduced motion, and unlocked-step preservation**

Assert the controller exposes `travel`, cancels an active animation before another, skips animation under reduced motion, and calls the original `goTo` exactly once without modifying `unlockedStep` directly.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `node --test tests/journey-motion.test.mjs`
Expected: FAIL because `travel` is absent.

- [ ] **Step 3: Implement FLIP-style handoffs**

Implement `measureAnchor`, `animateFrames`, `fallOut`, `fallIn`, `settle`, and `travel`. Keep the dot fixed to the viewport while the destination section scrolls behind it. Use physical easing, two rebounds maximum, and dispatch `journey:arrived` after settling.

- [ ] **Step 4: Integrate only the approved handoffs**

Wrap navigation for hero→path, trunk→budget, area→details, and details→brief. Contact→trunk remains a direct editorial camera settle. Generic navigation remains the existing `goTo` behavior.

- [ ] **Step 5: Run tests and commit**

Run: `node --test tests/journey-motion.test.mjs`
Expected: PASS.

```bash
git add assets/js/journey-motion.js assets/js/steps.js assets/css/journey-motion.css tests/journey-motion.test.mjs
git commit -m "feat: add single-period section handoffs"
```

### Task 3: Replace the area grid with the full-field Houston map

**Files:**
- Modify: `index.html`
- Modify: `assets/css/journey-motion.css`
- Modify: `assets/css/responsive.css`
- Modify: `assets/js/steps.js`
- Test: `tests/journey-motion.test.mjs`
- Test: `tests/verify.mjs`

**Interfaces:**
- Consumes: existing `toggleArea`, `addCustomArea`, `FormLogic.formData.areas`, and `goTo(6)`.
- Produces: `.houston-region[data-areas]`, maximum-two region state, optional skip, and combined area selections.

- [ ] **Step 1: Add failing map-contract tests**

Assert nine semantic region buttons exist, the section exposes `aria-label="Houston region map"`, the selection limit is two, and the custom-area controls remain present.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test tests/journey-motion.test.mjs`
Expected: FAIL because the map does not exist.

- [ ] **Step 3: Add the full-field map markup and real Texas/Houston geometry asset**

Use a checked-in SVG with semantic region groups. Place the map as the full section field; layer a compact copy rail without reducing or clipping the SVG. Keep an optional skip and the custom area/ZIP/school-zone input.

- [ ] **Step 4: Map regions through existing area state**

Implement `selectHoustonRegion(button)` so selecting up to two regions toggles their constituent existing area values through `toggleArea`-compatible state updates. A 2-second auto-advance may run only after at least one selection; the visible Continue action remains available.

- [ ] **Step 5: Extend overflow and route verification, then commit**

Run: `node --test tests/journey-motion.test.mjs`
Run: `npm run verify`
Expected: structural tests PASS; browser harness PASS when local listen permission is available.

```bash
git add index.html assets/css/journey-motion.css assets/css/responsive.css assets/js/steps.js tests/journey-motion.test.mjs tests/verify.mjs
git commit -m "feat: add optional full-field Houston region map"
```

### Task 4: Preserve route logic while upgrading route-question presentation

**Files:**
- Modify: `assets/js/validation.js`
- Modify: `assets/css/journey-motion.css`
- Test: `tests/journey-motion.test.mjs`
- Test: `tests/verify.mjs`

**Interfaces:**
- Consumes: `getCurrentDetailFields`, `fieldHasValue`, `updateDetailInput`, and every field definition in `FormLogic`.
- Produces: `decorateQuestionTitle(title)` and `data-motion-anchor="route-punctuation"`.

- [ ] **Step 1: Add route-parity and punctuation-anchor tests**

Assert all six route keys still render their original required fields and that displayed question titles include one motion anchor without altering accessible text.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test tests/journey-motion.test.mjs`
Expected: FAIL because punctuation decoration is absent.

- [ ] **Step 3: Decorate titles without changing field data**

Wrap the `i` in “Which” when present; otherwise wrap the final `.`, `?`, or `!`. Keep the original title in `aria-label`. Do not modify option arrays, conditional rules, or store keys.

- [ ] **Step 4: Verify every route and commit**

Run: `node --test tests/journey-motion.test.mjs`
Run: `npm run verify`
Expected: all six routes preserve field parity and completion.

```bash
git add assets/js/validation.js assets/css/journey-motion.css tests/journey-motion.test.mjs tests/verify.mjs
git commit -m "feat: add route-aware punctuation arrivals"
```

### Task 5: Build the Houston finale, native share, and visual PDF

**Files:**
- Modify: `index.html`
- Modify: `assets/js/app.js`
- Modify: `assets/css/journey-motion.css`
- Modify: `assets/css/responsive.css`
- Test: `tests/journey-motion.test.mjs`
- Test: `tests/verify.mjs`

**Interfaces:**
- Consumes: `populateSmartBrief`, `sendSmartMoveBrief`, current brief DOM values, and `navigator.share`.
- Produces: `downloadVisualBrief()`, `shareSmartMoveBrief()`, and `data-motion-anchor="houston"`.

- [ ] **Step 1: Add failing finale action tests**

Assert the brief exposes exactly Submit, Download Form, and Share This Form; the Texas SVG and Houston anchor exist; print CSS excludes actions and footer while retaining the brief.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test tests/journey-motion.test.mjs`
Expected: FAIL because current call/text/email actions and schematic beacon remain.

- [ ] **Step 3: Replace the schematic beacon with Texas/Houston arrival**

Use the checked-in Texas outline, place the Houston target accurately within the SVG viewBox, and let the shared story dot land there. Keep the brief sharp throughout; after landing, transfer the visible state to a small glowing beacon.

- [ ] **Step 4: Implement share and visual PDF behavior**

Use `navigator.share` when available with a copy-link fallback. Implement `downloadVisualBrief()` through print-specific CSS and `window.print()` so the designed brief—not a text-only generated PDF—is saved. Exclude the website footer and action buttons from print.

- [ ] **Step 5: Verify and commit**

Run: `node --test tests/journey-motion.test.mjs`
Run: `npm run verify`
Expected: action contract and all route submissions PASS.

```bash
git add index.html assets/js/app.js assets/css/journey-motion.css assets/css/responsive.css tests/journey-motion.test.mjs tests/verify.mjs
git commit -m "feat: complete Houston brief finale and sharing"
```

### Task 6: Accessibility, responsive polish, and delivery evidence

**Files:**
- Modify: `assets/css/journey-motion.css`
- Modify: `assets/css/responsive.css`
- Modify: `tests/verify.mjs`
- Create: `docs/verification/award-journey.md`

**Interfaces:**
- Consumes: the completed journey and existing verification harness.
- Produces: viewport screenshots, reduced-motion assertions, focus checks, and release notes.

- [ ] **Step 1: Extend the harness**

Add checks for one visible story dot, no simultaneous legacy dot animations, nine visible map regions, two-region maximum, manual Continue recovery, final Houston beacon, print action contract, native-share fallback, and reduced-motion completion.

- [ ] **Step 2: Run static and syntax checks**

Run: `node --test tests/journey-motion.test.mjs`
Run: `node --check assets/js/journey-motion.js`
Run: `node --check assets/js/steps.js`
Run: `node --check assets/js/validation.js`
Run: `node --check assets/js/app.js`
Expected: PASS.

- [ ] **Step 3: Run the full browser harness**

Run: `npm run verify`
Expected: six routes, C1 regression, attribution, submissions, and 360/390/430/820/1440 overflow checks PASS. If the environment blocks `127.0.0.1` listen, record that limitation and run the same harness against the Vercel preview before review.

- [ ] **Step 4: Review visual evidence**

Capture hero, prep, budget, desktop map, mobile map, route question, final brief, and print preview. Record URLs, viewport sizes, commit SHA, and any known limitation in `docs/verification/award-journey.md`.

- [ ] **Step 5: Commit delivery evidence**

```bash
git add assets/css/journey-motion.css assets/css/responsive.css tests/verify.mjs docs/verification/award-journey.md
git commit -m "test: verify Smart Move award journey"
```

## Self-review

- Spec coverage: every approved motion beat, form route, map requirement, disclosure, brief action, footer rule, and delivery gate maps to Tasks 1–6.
- Placeholder scan: no TBD/TODO or undefined implementation placeholder remains.
- Type consistency: `JourneyMotion.travel`, `data-motion-anchor`, region selection, and final actions use the same names throughout.
