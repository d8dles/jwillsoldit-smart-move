# Award Journey Cinematic Rebuild — Phase 6: Final Brief

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**A correction made before execution began, after research but before any code was written:** the brief's stated Phase 6 requirement ("Final brief" — red-ball fall onto a real Texas outline, shrink, glow/pulse, exactly three actions Submit/Download Form/Share This Form, real `sendSmartMoveBrief` flow, print excludes footer/actions) turns out to be almost entirely already built by earlier phases: `index.html`'s `#section-brief` already has the `smart-route-card`, the `.brief-map-beacon.texas-arrival` block with a real CC0 Wikimedia Texas outline `<img>`, a `.houston-beacon[data-motion-anchor="houston"]`, and a `.brief-actions` block with exactly the three required buttons; `assets/js/journey-motion.js`'s bottom `goTo` wrapper already sends the dot to `houston` with `dramatic:true` on step 7; `assets/css/journey-motion.css` already has `.houston-beacon.is-landed`'s `finalBeacon` glow/pulse keyframes and a `@media print` block that hides `.brief-actions`/`.brief-submit-status`/`.brief-footer-strip`/`#global-footer` while keeping `#section-brief` itself. `tests/journey-motion.test.mjs` (a pre-existing structural test, distinct from `tests/verify.mjs`) already asserts most of this structurally and passes. **However, live Playwright verification (driving the real page, not just reading the code) found a real, previously-undetected bug that breaks the brief's single most important requirement — "land on Houston" — and does so for every `JourneyMotion.travel()` call in the whole site, not just the brief.** That bug, and four more issues the user found by testing the live preview on a real device (reported mid-session, folded into this same plan by the controlling session since no commits existed yet to conflict with), are this phase's actual scope. There is very little brand-new "final brief scene" work here — this phase is almost entirely bug fixes to an already-correct design.

**The `travel()` staleness bug, in detail:** `journey-motion.js`'s `travel({ from, to, navigate, dramatic })` calls `navigate()` (which is always `() => originalGoTo(step, {...options, behavior:'auto'})`, from the bottom-of-file `goTo` wrapper), waits exactly **2 `requestAnimationFrame` ticks**, then computes `const target = point(targetElement)` — i.e., it reads the anchor element's `getBoundingClientRect()` at that moment and bakes it into the fixed set of WAAPI keyframes `fallIn()` will animate toward. The problem: `originalGoTo()` (`steps.js`'s `goTo()`) does **not** scroll synchronously. It sets `currentStep`, toggles section visibility classes, and then does `setTimeout(() => scrollToSection(step, options.behavior || 'smooth'), 40)` — the actual `element.scrollIntoView(...)` call is deferred 40ms. Two `requestAnimationFrame` ticks (≈16–33ms at 60Hz) is **less than** that 40ms delay, so `point(targetElement)` samples the anchor's position **before the page has scrolled to the new section at all** — using the *old* scroll offset. The subsequent real scroll (which does happen, just slightly later) then moves the anchor to its correct on-screen position, but the dot's already-baked fall target does not update: the dot animates to, and stops at, the *stale* pre-scroll coordinate.

Live measurement (Playwright, `getAnimations()`/keyframe inspection compared against the anchor's actual settled `getBoundingClientRect()` once scroll finishes) confirmed this is not theoretical and not small:

| `travel()` call | anchor | baked-in target Y | actual settled Y | discrepancy |
|---|---|---|---|---|
| step 4 → budget | `[data-motion-anchor="budget"]` | 1068.75 | 238.23 | **830px** |
| step 6 → route-punctuation | `[data-motion-anchor="route-punctuation"]` | 832.91 | 253.91 | **579px** |
| step 7 → houston (dramatic) | `[data-motion-anchor="houston"]` | 3355.79 | 2372 | **987px** |

X-coordinates matched almost exactly in every case (horizontal scroll never happens on this single-column page, so `point()`'s X reading was never stale — only Y, which is entirely scroll-position-dependent, was wrong). This means **the red dot has never actually landed on its intended anchor for any of the three `travel()`-driven handoffs**, including — critically for this phase — never landing on Houston. It falls, and stops, roughly 1000px below the Texas outline on the final brief. This is exactly the class of bug this project's own retrospective already warned about: invisible to `tests/verify.mjs` (which checks `active-section` classes and overflow, never the dot's landed pixel position) and to static code review (the code reads correctly — `navigate()` then wait then measure — the bug is a *timing* mismatch between two files' internal contracts, not a logic error visible in either file alone).

**Four more issues, found by the user driving the live preview on a real device and confirmed independently against the actual DOM/CSS by this plan's research (not taken on faith):**
1. Start Over leaves `#section-open`'s scroll-driven hero decoration (`--intro-progress`/`--blueprint-alpha`, owned by a closure-scoped IIFE in `app.js` with no external reset hook) stuck at its fully-scrolled-through values, overlapping the wordmark/headline until the user scrolls again.
2. The fixed-position `.start-over` link overlaps the plotline bar's last (8th, "Brief") step-number box at real mobile widths. Measured live: 22px × ~11px of real overlap at 320/390/430px alike (not just very narrow viewports).
3. `toggleArea()`'s combined area cap (`current.length >= 5`) is shared between the 2-region Houston map picker and the up-to-5-chip refinement tray, so 2 map picks + 3 chips already hits the cap the user expected to allow 5 *additional* chips after the map picks.
4. On the final brief, `.brief-actions` (Submit/Download/Share) renders *after* the Texas map/Houston beacon block in the DOM, below it visually — a user who sees "● Route generated" near the top and doesn't scroll past the map may reasonably believe the brief is already submitted without ever reaching Submit.

**Architecture:** No new DOM sections, no new scenes, no new CSS animation types. This phase is a set of five surgical, independently-verifiable fixes: (1) `journey-motion.js`'s `travel()` gains a scroll-settle wait before sampling the anchor's position — the actual Phase 6 landing-accuracy fix; (2) `app.js`'s hero IIFE exposes a reset hook, called from `resetSmartMoveState()`; (3) `.start-over` moves from an independent `position:fixed` overlay to a real flex child of `.plotline-bar` (already a flex container), eliminating the overlap by construction instead of by fragile per-breakpoint padding math; (4) `steps.js`'s `toggleArea()` cap changes from `5` to `7`; (5) `index.html` reorders two sibling blocks inside `.route-card-right` (no CSS or JS changes needed — nothing depends on their order).

**Tech Stack:** Classic browser JavaScript, CSS (flexbox re-layout for the start-over fix), `tests/verify.mjs` and `tests/journey-motion.test.mjs` as the two existing automated regression gates (neither is modified), plus live Playwright-driven DOM/CSS/animation inspection (this project's own retrospective is explicit that static review and the harness alone have both already missed real bugs this session) as the actual verification method for the choreography and layout fixes, since none of the five issues here are the kind a class-name or overflow-number assertion would catch.

## Global Constraints

- `tests/verify.mjs` is not modified and must keep passing exactly as-is. Re-run it (and, on any signal of flakiness, run it a second time) after every task.
- `tests/journey-motion.test.mjs` is not modified and must keep passing (`node --test tests/journey-motion.test.mjs`) — none of these five fixes touch anything it asserts about (element IDs, class names, `@media print` rule presence, structural counts), so it should be untouched by construction, but re-run it to confirm.
- Preserve `FormLogic`, `SECTIONS`, `goTo`, all six route keys, partial-lead capture, and the real `sendSmartMoveBrief`/`buildSmartMovePayload`/`populateSmartBrief` flow — none of these five fixes touch submission logic; `sendSmartMoveBrief` continues to be called exactly as `#brief-send-link`'s `onclick` today.
- Do not rename, reorder, or change the `onclick` handlers of the three brief actions (Submit/Download Form/Share This Form) — Task 5 moves the whole `.brief-actions` block as one unit, unchanged internally.
- Single animated protagonist (`#story-dot`) — Task 1 does not add any new animated element; it only changes *when* the existing single dot's existing fall target is computed.
- Respect `prefers-reduced-motion: reduce` — none of these fixes touch the reduced-motion code paths (all guarded by the pre-existing `reduced`/`reduceMotion` checks, untouched here), but Task 1 and 2's live verification must still confirm reduced-motion behavior is unaffected.
- Maintain ≤1px horizontal overflow at 360/390/430/820/1440px. Task 3 changes `.start-over` from `position:fixed` to a flex child, which can plausibly affect layout width — verify overflow live at all five widths after that task specifically, not just via `npm run verify`'s own overflow check (which drives the full flow and would catch a *width* regression, but the flow doesn't scroll-idle on step 0 during most of the run, so it's worth confirming directly too).
- Do NOT push or deploy. Commit locally only, in coherent checkpoints, with clear messages. The controlling session will review the diff and push after.
- Do not merge to main.
- Any temporary Playwright verification script written for live DOM/CSS inspection must live under `tests/_*-tmp.mjs` (or similar, clearly temporary) and must be deleted before the final commit of each task — it is a verification aid, not part of the shipped product, and must never be committed.

---

### Task 1: Fix `travel()`'s stale scroll-target bug (the actual Phase 6 landing-accuracy defect)

**Files:**
- Modify: `assets/js/journey-motion.js`

**Interfaces:**
- Consumes: the existing shared global `programmaticScroll` (declared with `let` at top level of `assets/js/config.js`; classic, non-module `<script>` tags loaded in sequence share one top-level lexical scope, so every later script — `steps.js`, `validation.js`, `submit.js`, `app.js`, `journey-motion.js` — can already read/write it by bare name with no `window.` prefix; `app.js` already does this today for the same "is a programmatic scroll in flight" purpose). Consumes the existing `anchor()`/`point()`/`fallIn()` — unchanged.
- Produces: a new `waitForScrollSettle()` helper; a one-line change inside `travel()` to call it instead of the current fixed 2-`requestAnimationFrame` wait.

- [ ] **Step 1: Add `waitForScrollSettle()`**

In `assets/js/journey-motion.js`, add this function immediately before `async function travel(...)`:

```js
  // goTo() (steps.js) sets `programmaticScroll = true` synchronously, then
  // defers the actual `scrollIntoView()` call by 40ms (`setTimeout(...,40)`
  // inside goTo()) before scrollToSection() runs and eventually clears the
  // flag again. travel() used to wait only 2 requestAnimationFrame ticks
  // (~16-33ms) after calling navigate() before reading the target anchor's
  // getBoundingClientRect() — less time than the 40ms scroll is delayed by,
  // so it read the anchor's PRE-scroll position and baked that stale
  // coordinate into the dot's fall animation. The dot then fell to, and
  // stopped at, a point roughly matching how far the page still had left
  // to scroll — measured live at 830px off for the budget travel, 579px
  // for route-punctuation, and 987px for the Houston arrival specifically.
  // Waiting for `programmaticScroll` to clear ties this wait to the real
  // signal instead of a second guessed timing constant.
  function waitForScrollSettle(maxWaitMs = 600) {
    return new Promise((resolve) => {
      const deadline = performance.now() + maxWaitMs;
      function poll() {
        if (typeof programmaticScroll === 'undefined' || !programmaticScroll) return resolve();
        if (performance.now() >= deadline) return resolve();
        requestAnimationFrame(poll);
      }
      requestAnimationFrame(poll);
    });
  }
```

- [ ] **Step 2: Use it in `travel()`**

Replace:

```js
  async function travel({ from, to, navigate, dramatic = false } = {}) {
    if (reduced) return;
    await depart(from ? point(from) : pointer);
    if (typeof navigate === 'function') navigate();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const targetElement = typeof to === 'string' ? anchor(to) : to;
    const target = point(targetElement);
    await fallIn(target, dramatic);
```

with:

```js
  async function travel({ from, to, navigate, dramatic = false } = {}) {
    if (reduced) return;
    await depart(from ? point(from) : pointer);
    if (typeof navigate === 'function') navigate();
    await waitForScrollSettle();
    const targetElement = typeof to === 'string' ? anchor(to) : to;
    const target = point(targetElement);
    await fallIn(target, dramatic);
```

(Everything else in `travel()` — `targetElement?.classList.add('is-landed')`, the shadow-pulse `dot.animate(...)`, the `setTimeout` removing `is-traveling`, the `journey:arrived` event — is unchanged.)

- [ ] **Step 3: Verify with `node --check` and the two existing test suites**

```bash
node --check assets/js/journey-motion.js
git diff --check
node --test tests/journey-motion.test.mjs
npm run verify
```

Expected: all PASS. Neither existing suite asserts anything about `travel()`'s internal timing, so this should be fully transparent to both. Re-run `npm run verify` a second time if anything looks flaky.

- [ ] **Step 4: Live Playwright verification — the real point of this task**

Reuse the pattern from this plan's own research (a temporary script under `tests/_*-tmp.mjs`, deleted after use): drive the real page via `tests/mock-api.mjs`'s server through to each of the three `travel()`-driven steps (4/budget, 6/route-punctuation, 7/houston) for at least two different routes, and for each:
- Monkey-patch `dot.animate` (before triggering the travel) to capture the final keyframe's `transform` of the `fallIn` call (identifiable as the frame containing `scale(.62...)`), giving the baked-in fall target.
- Wait for the travel to fully settle (`is-traveling` class removed / a couple of seconds of `waitForTimeout`).
- Read the anchor element's actual `getBoundingClientRect()` center at that point.
- Assert the baked-in target and the actual anchor center now agree within a few pixels (not the ~580–990px discrepancies measured pre-fix).
- For step 7 specifically: also confirm `[data-motion-anchor="houston"]` gets `.is-landed` added, that `getComputedStyle(beacon).animationName` becomes `finalBeacon`, and that the dot itself (`#story-dot`) fades back to `opacity:0` and loses `.is-traveling` shortly after landing (this was fixed in an earlier commit this session — confirm it's still correct with this task's change, since `waitForScrollSettle()` changes the overall timing the earlier fix has to work within).

Delete the temporary script once verification is complete.

- [ ] **Step 5: Commit**

```bash
git add assets/js/journey-motion.js
git commit -m "fix: wait for the deferred section scroll to actually settle before computing a travel()'s fall target, so the story dot lands on its real anchor instead of a stale pre-scroll position"
```

---

### Task 2: Fix Start Over leaving the hero's scroll-driven decoration stuck at its "fully scrolled" state

**Files:**
- Modify: `assets/js/app.js`

**Interfaces:**
- Consumes: the existing hero IIFE's closure-scoped `displayP`/`targetP`/`displayBlueprint`/`targetBlueprint`/`heroRunning`/`heroSnapTimer`/`autoAdvanced`/`applyHeroProgress()` (all pre-existing, all private to that IIFE today).
- Produces: a new `window.resetHeroScrollProgress` function, exposed the same way `JourneyMotion` exposes its public surface (a plain property assignment, since this IIFE currently returns nothing / assigns nothing to `window`). Consumed by `resetSmartMoveState()` in the same file.

- [ ] **Step 1: Expose a reset hook from the hero IIFE**

In `assets/js/app.js`, inside the `// ── SCROLL-DRIVEN HERO TRANSITION ──────────────────────` IIFE, immediately after the existing `function applyHeroProgress() { ... }` block, add:

```js
    function applyHeroProgress() {
      hero.style.setProperty('--intro-progress', displayP.toFixed(3));
      hero.style.setProperty('--blueprint-alpha', displayBlueprint.toFixed(3));
    }

    // Start Over (resetSmartMoveState()) already resets JourneyMotion's own
    // hero stage (transform / hero-handoff class) but has no way to reach
    // this IIFE's own closure-scoped scroll-progress state — so
    // --intro-progress/--blueprint-alpha stayed stuck at whatever the user
    // had last scrolled to, rendering the reset-to-top hero with its
    // decorative lines still in their fully-revealed position, overlapping
    // the wordmark/headline, until the user scrolled again. Exposed here so
    // resetSmartMoveState() can call it directly.
    window.resetHeroScrollProgress = function resetHeroScrollProgress() {
      clearTimeout(heroSnapTimer);
      autoAdvanced = false;
      heroRunning = false;
      displayP = targetP = 0;
      displayBlueprint = targetBlueprint = 0;
      applyHeroProgress();
      document.body.classList.remove('hero-ready-to-snap');
    };
```

- [ ] **Step 2: Call it from `resetSmartMoveState()`**

Replace:

```js
  function resetSmartMoveState({ keepBrief = false } = {}) {
    if (window.JourneyMotion && typeof JourneyMotion.resetHeroStage === 'function') {
      JourneyMotion.resetHeroStage();
    }
```

with:

```js
  function resetSmartMoveState({ keepBrief = false } = {}) {
    if (window.JourneyMotion && typeof JourneyMotion.resetHeroStage === 'function') {
      JourneyMotion.resetHeroStage();
    }
    if (typeof resetHeroScrollProgress === 'function') {
      resetHeroScrollProgress();
    }
```

- [ ] **Step 3: Verify**

```bash
node --check assets/js/app.js
git diff --check
node --test tests/journey-motion.test.mjs
npm run verify
```

- [ ] **Step 4: Live Playwright verification**

Drive the page (any route) past the hero (so `--intro-progress`/`--blueprint-alpha` reach 1), advance a few more steps, click Start Over (`#start-over`), and immediately (no further scroll) read `getComputedStyle(document.getElementById('section-open')).getPropertyValue('--intro-progress')` and `--blueprint-alpha` — both must read `0` (or the CSS default), not `1` or any stale intermediate value. Confirm visually/via computed style that this holds with no further scroll event needed.

- [ ] **Step 5: Commit**

```bash
git add assets/js/app.js
git commit -m "fix: reset the hero's scroll-driven decoration state on Start Over, not just JourneyMotion's own hero stage"
```

---

### Task 3: Fix `.start-over` overlapping the plotline bar's last step at mobile widths

**Files:**
- Modify: `index.html`, `assets/css/journey-motion.css`

**Interfaces:**
- Consumes: the existing `.plotline-bar` (`display:flex; align-items:center`, in `assets/css/progress.css`) and its 8 `.plotline-step` children (each `flex:1`).
- Produces: `.start-over` moved from a `<body>`-level sibling of `.plotline-bar` to the last child inside `<nav class="plotline-bar">`; `.start-over`'s CSS changed from an independent `position:fixed` overlay to a normal flex item.

Live-measured overlap before this fix (390/320/430px, plotline bar scrolled into its visible state): the last step-num box and `.start-over` overlapped by 22px horizontally × ~11px vertically at all three widths — the full width of the step box, not a sliver.

- [ ] **Step 1: Move `.start-over` inside `.plotline-bar` in `index.html`**

Replace:

```html
  <div class="plotline-step" data-step="7">
    <div class="step-num">8</div>
    <div class="step-label">Brief</div>
  </div>
</nav>
<div id="story-dot" aria-hidden="true"></div>
```

with:

```html
  <div class="plotline-step" data-step="7">
    <div class="step-num">8</div>
    <div class="step-label">Brief</div>
  </div>
  <a href="#" class="start-over" id="start-over" onclick="return handleStartOver(event)">Start over</a>
</nav>
<div id="story-dot" aria-hidden="true"></div>
```

And remove the old standalone instance:

```html
<div class="map-cursor" id="map-cursor" aria-hidden="true"></div>
<a href="#" class="start-over" id="start-over" onclick="return handleStartOver(event)">Start over</a>
```

becomes:

```html
<div class="map-cursor" id="map-cursor" aria-hidden="true"></div>
```

(`id="start-over"` stays a single element on the page — moved, not duplicated. `tests/journey-motion.test.mjs`'s `assert.match(html, /id="start-over"/)` and any `#start-over` selector in JS are unaffected by *where* in the DOM the element lives.)

- [ ] **Step 2: Rewrite `.start-over`'s CSS as a flex item instead of a fixed overlay**

In `assets/css/journey-motion.css`, replace:

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

with:

```css
/* A flex child of .plotline-bar (itself position:fixed) rather than an
   independent position:fixed overlay — this was overlapping the bar's
   last ("Brief") step-number box by a full 22px x 11px at every mobile
   width measured (320/390/430px), because a fixed-position element laid
   on top of a flex row doesn't participate in that row's own layout math.
   As an ordinary flex item after the 8 flex:1 .plotline-step children,
   the browser's own flex algorithm gives every step slightly less space
   to make room for this item's content width, which prevents the overlap
   by construction at any viewport width instead of by a hand-tuned
   padding number that would need re-deriving per breakpoint. */
.start-over {
  flex: 0 0 auto;
  margin-left: 14px;
  white-space: nowrap;
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
  .start-over { font-size: 10px; margin-left: 8px; }
}
```

(`.plotline-bar` is already `position:fixed`, so `.start-over` remains visually pinned to the top of the viewport while scrolling, exactly as before — it now inherits that from its parent instead of declaring it independently. It also now shares the bar's own show/hide behavior — hidden together during `body.hero-idle`, exactly like the step boxes already are — which is a minor, intentional behavior change: there is nothing to "start over" from on the bare landing screen before the user has scrolled at all, so this is more correct, not less.)

- [ ] **Step 3: Verify**

```bash
git diff --check
node --test tests/journey-motion.test.mjs
npm run verify
```

- [ ] **Step 4: Live Playwright verification — overlap and overflow, at all five required widths**

At 360/390/430/820/1440px: scroll a little (so `body.hero-idle` clears and the plotline bar is visible), then read `getBoundingClientRect()` for `#start-over` and the 8th `.plotline-step .step-num`, and assert their rectangles do not intersect (0px overlap in both axes). Separately, at the same five widths, confirm `document.documentElement.scrollWidth - document.documentElement.clientWidth <= 1` (this project's standing overflow tolerance) on at least the open/path steps, since this task changes `.plotline-bar`'s child layout and is exactly the kind of change that could introduce new overflow.

- [ ] **Step 5: Commit**

```bash
git add index.html assets/css/journey-motion.css
git commit -m "fix: lay Start Over out as a flex child of the plotline bar instead of a fixed overlay, so it never overlaps the last step number on mobile"
```

---

### Task 4: Raise the combined area-selection cap from 5 to 7

**Files:**
- Modify: `assets/js/steps.js`

**Interfaces:**
- Consumes/modifies: the existing `toggleArea()`'s cap check. No other function references this number (confirmed by search — `selectHoustonRegion()`'s own separate 2-region cap, and `announceAreaRefinement`/`updateAreaSelectionUI`, are untouched).

- [ ] **Step 1: Change the cap**

Replace:

```js
      if (current.length >= 5 && area !== 'Flexible') {
        const tray = document.getElementById('area-selected-tray');
        if (tray) tray.innerHTML = `<span class="selected-pill">Keep it tight: remove one area before adding more.</span>`;
        return;
      }
```

with:

```js
      if (current.length >= 7 && area !== 'Flexible') {
        const tray = document.getElementById('area-selected-tray');
        if (tray) tray.innerHTML = `<span class="selected-pill">Keep it tight: remove one area before adding more.</span>`;
        return;
      }
```

(7 = the Houston map's own 2-region cap, enforced separately by `selectHoustonRegion()`, plus the 5 chip refinements the user expected to still have available afterward. The "Keep it tight…" copy doesn't reference a number, so no copy change is needed.)

- [ ] **Step 2: Verify**

```bash
node --check assets/js/steps.js
git diff --check
node --test tests/journey-motion.test.mjs
npm run verify
```

- [ ] **Step 3: Live Playwright verification**

Drive to the area step, select 2 Houston map regions, then add 5 more chip areas (7 total) via `toggleArea`/the real chip click handlers — confirm all 7 land in `FormLogic.formData.trunk.Q5_areas` and the UI never shows the "Keep it tight" message until an 8th is attempted. Confirm the Houston map's own "Choose up to two regions" cap still fires correctly on a 3rd region attempt (unrelated, unchanged code path — confirm it wasn't accidentally affected).

- [ ] **Step 4: Commit**

```bash
git add assets/js/steps.js
git commit -m "fix: raise the combined area-selection cap from 5 to 7 so two Houston map picks don't eat into the five chip refinements"
```

---

### Task 5: Move the final brief's action buttons above the Texas map

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes/reorders: the existing `.brief-map-beacon.texas-arrival` block and `.brief-actions` + `.brief-submit-status` block, both already children of `.route-card-right`. No CSS changes needed (confirmed no adjacent-sibling combinators or `:nth-child` selectors depend on their current order — checked `assets/css/form.css` and `assets/css/responsive.css` directly). No JS changes needed — `JourneyMotion.travel()`'s `anchor()`/`point()` look up `[data-motion-anchor="houston"]` via `getBoundingClientRect()` at animation time, which reflects wherever the element currently renders regardless of its position in the DOM tree — but this must still be confirmed live, not assumed, per this plan's own Task 1 finding that this exact code path had a real, non-obvious bug.

- [ ] **Step 1: Reorder the two blocks in `index.html`**

Replace:

```html
          <div class="brief-map-beacon texas-arrival" aria-label="Texas map with Houston arrival">
            <div class="texas-map-frame">
              <!-- CC0 geographic outline: Wikimedia Commons, Outline of Texas (simplified).svg -->
              <img class="texas-outline" src="https://upload.wikimedia.org/wikipedia/commons/b/bc/Outline_of_Texas_%28simplified%29.svg" alt="Outline map of Texas">
              <span class="houston-ring houston-ring-inner" aria-hidden="true"></span>
              <span class="houston-ring houston-ring-outer" aria-hidden="true"></span>
              <span class="houston-beacon" data-motion-anchor="houston" aria-hidden="true"></span>
            </div>
            <div class="map-beacon-label">Move signal locked</div>
            <div class="map-beacon-address">Houston, Texas · route mapped</div>
          </div>

          <div class="brief-actions">
            <button id="brief-send-link" class="brief-action primary" type="button" onclick="sendSmartMoveBrief(event)">Submit</button>
            <button class="brief-action" type="button" onclick="downloadVisualBrief()">Download Form</button>
            <button class="brief-action" type="button" onclick="shareSmartMoveBrief()">Share This Form</button>
          </div>
          <div class="brief-submit-status" id="brief-submit-status" aria-live="polite"></div>
        </div>
```

with:

```html
          <div class="brief-actions">
            <button id="brief-send-link" class="brief-action primary" type="button" onclick="sendSmartMoveBrief(event)">Submit</button>
            <button class="brief-action" type="button" onclick="downloadVisualBrief()">Download Form</button>
            <button class="brief-action" type="button" onclick="shareSmartMoveBrief()">Share This Form</button>
          </div>
          <div class="brief-submit-status" id="brief-submit-status" aria-live="polite"></div>

          <div class="brief-map-beacon texas-arrival" aria-label="Texas map with Houston arrival">
            <div class="texas-map-frame">
              <!-- CC0 geographic outline: Wikimedia Commons, Outline of Texas (simplified).svg -->
              <img class="texas-outline" src="https://upload.wikimedia.org/wikipedia/commons/b/bc/Outline_of_Texas_%28simplified%29.svg" alt="Outline map of Texas">
              <span class="houston-ring houston-ring-inner" aria-hidden="true"></span>
              <span class="houston-ring houston-ring-outer" aria-hidden="true"></span>
              <span class="houston-beacon" data-motion-anchor="houston" aria-hidden="true"></span>
            </div>
            <div class="map-beacon-label">Move signal locked</div>
            <div class="map-beacon-address">Houston, Texas · route mapped</div>
          </div>
        </div>
```

- [ ] **Step 2: Verify**

```bash
git diff --check
node --test tests/journey-motion.test.mjs
npm run verify
```

`tests/verify.mjs` clicks `#brief-send-link` and waits for the submit-status text regardless of its position on the page, so this reorder should be fully transparent to it.

- [ ] **Step 3: Live Playwright verification**

For at least two routes: drive to the brief step and confirm (a) `.brief-actions` now appears before `.brief-map-beacon.texas-arrival` in DOM order (`compareDocumentPosition` or simple `querySelectorAll` index comparison) and visually above it on screen (`getBoundingClientRect().top` comparison); (b) the Task 1 fix still lands the dot correctly on `[data-motion-anchor="houston"]` now that the map block is later in the DOM — re-run the same baked-target-vs-actual-position check from Task 1 Step 4 against this reordered layout to make sure moving the map didn't reintroduce or change the landing accuracy.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "fix: move the brief's Submit/Download/Share actions above the Texas map so they're not missed by users who don't scroll past the map"
```

---

### Task 6: Full-phase regression pass

**Files:**
- None modified — verification only, unless a real issue surfaces.

- [ ] **Step 1: Full check sequence**

```bash
node --check assets/js/journey-motion.js assets/js/app.js assets/js/steps.js
git diff --check
node --test tests/journey-motion.test.mjs
npm run verify
npm run verify   # second run, since the project's own history shows flakiness is worth ruling out twice
```

- [ ] **Step 2: End-to-end live verification across at least two routes, covering all five fixes together**

Drive two different routes (e.g. `rent` and `sell`, matching this plan's own research script) fully to the brief step and confirm, in one continuous live session per route:
- The dot visibly falls and lands with pixel-accurate agreement on `budget`, `route-punctuation`, and `houston` anchors (Task 1).
- Start Over from a mid-journey step returns `--intro-progress`/`--blueprint-alpha` to 0 immediately (Task 2).
- `.start-over` and the plotline bar's last step never overlap at 360/390/430/820/1440px (Task 3).
- 2 map regions + 5 chips (7 total) are all selectable without hitting the cap early (Task 4).
- `.brief-actions` renders above `.brief-map-beacon` (Task 5).
- Everything this phase's original brief already required and this plan's research confirmed pre-existing still holds: exactly three actions with the exact labels Submit/Download Form/Share This Form; `sendSmartMoveBrief` still calls the real endpoint and updates `#brief-submit-status`/`#brief-send-link` correctly; `downloadVisualBrief()` still calls `window.print()` and the print media query still hides `.brief-actions`/`.brief-submit-status`/`.brief-footer-strip`/`#global-footer` while showing `#section-brief`; `shareSmartMoveBrief()` still calls `navigator.share` when available and falls back to `navigator.clipboard.writeText` otherwise; the Texas outline image is still the real Wikimedia asset (not hand-drawn); the houston-beacon still gets `.is-landed` with the `finalBeacon` glow/pulse animation running.

- [ ] **Step 3: If Step 2 finds a real issue, fix it**

Fix, re-verify with the full check sequence, and commit with a message describing what was found and fixed. If Step 2 finds nothing, there is nothing to commit for this task.

- [ ] **Step 4: Delete any remaining temporary verification scripts**

Confirm no `tests/_*.mjs` (or similarly-named ad hoc) scripts remain in the working tree — `git status` should show a clean tree relative to the commits made in Tasks 1–5 (plus any fix from Task 6 Step 3).

---

## Self-review

- **Spec coverage — Phase 6's original brief:** "Show the red ball visibly falling into the final scene" — pre-existing (`fallIn()`, `dramatic:true` for step 7), unchanged by this phase except that Task 1 now makes it fall to the *correct* place. "Land on Houston on a real Texas geographic outline" — the outline asset was already real (Wikimedia CC0 SVG, confirmed by direct fetch of the `<img src>` and `naturalWidth` check during research); the *landing* was broken (987px stale-target bug) and is the actual subject of Task 1. "Shrink" / "Glow/pulse subtly" — both already implemented (`fallIn()`'s final `scale(.62)` frame; `.houston-beacon.is-landed`'s `finalBeacon` keyframes), confirmed live via `getComputedStyle().animationName === 'finalBeacon'` during research; untouched by this phase. "Exactly Submit, Download Form, Share This Form" — already exactly this in `index.html`, confirmed by direct read; Task 5 moves this block's position but changes nothing inside it. "Submit calls the real `sendSmartMoveBrief` flow" — confirmed already true by reading `app.js` directly (`buildSmartMovePayload`/`sendSmartMoveBrief`/`populateSmartBrief`, all real, all untouched by every task in this phase). "Download produces the full designed visual brief as print-to-PDF, not a plain text dump" — confirmed already true: `downloadVisualBrief()` calls `window.print()` against the same fully-styled `.smart-route-card`/`.brief-map-beacon` DOM the user already sees (not a separate plain-text render), and the print CSS keeps that styling (`background`/`print-color-adjust:exact` etc.) rather than stripping it. "Share uses `navigator.share` with a graceful copy fallback" — confirmed already true and tested both branches live during research (native call receives the expected payload; fallback path writes to `navigator.clipboard` and updates `#brief-submit-status`). "Standard production footer appears after the final brief, but not inside the download" — confirmed already true (`#global-footer` renders after `#section-brief` in the page and is explicitly hidden by the same `@media print` rule that hides `.brief-footer-strip`). "Real Texas outline asset, not hand-drawn" — confirmed by inspecting the actual `src` attribute and successfully loading it (`naturalWidth: 1162`) live.
- **Spec coverage — the four user-reported issues:** each was independently reproduced against the real DOM/CSS during research (measured pixel overlap for the start-over issue; read the actual `>= 5` cap and confirmed no other hardcoded "5" exists for this cap; confirmed the hero IIFE's reset gap by reading `resetSmartMoveState()` and `resetHeroStage()` side by side; confirmed no CSS order-dependency before reordering the brief blocks) before any fix was written, per this project's standing "research the actual code first" rule.
- **Placeholder scan:** every code block in every task above is the complete, real diff — no "add appropriate logic here" prose, no elided animation frames. Task 1's `waitForScrollSettle()` is a complete function with an explicit safety-cap fallback (so a future change elsewhere that stops clearing `programmaticScroll` correctly can't hang `travel()` forever) rather than an open-ended wait.
- **Type/name consistency:** `waitForScrollSettle` (journey-motion.js) reads the existing bare-name global `programmaticScroll` (config.js) exactly the way `app.js` already does elsewhere in the same shared classic-script scope — no new global is introduced, no `window.` prefix needed or used, matching the existing convention. `window.resetHeroScrollProgress` (app.js) follows the same "attach a plain function to `window`, guard the call site with `typeof ... === 'function'`" pattern `JourneyMotion.resetHeroStage` already established for exactly this cross-file-reset purpose. `.start-over`'s CSS keeps its existing class name, existing `:hover`/`:focus-visible` rules, and existing `id="start-over"` — only its positioning strategy and DOM parent change.
- **Global Constraints check:** `tests/verify.mjs` untouched (all six tasks confirm this in their own Step 2/3). `tests/journey-motion.test.mjs` untouched, re-run after every task. No new animated protagonist. Reduced-motion paths untouched (none of the five fixes are inside a `reduced`/`reduceMotion` guard's branch, except Task 1's `waitForScrollSettle` — but that call site is already unreachable when `reduced` is true, since `travel()`'s very first line is `if (reduced) return;`, before `waitForScrollSettle()` is ever called — reduced-motion users never hit this code path at all, exactly as before). Overflow re-verified live at all five standard widths specifically for Task 3, the one task that changes a layout's flex composition. No push, no merge to main, commits kept as coherent per-task checkpoints matching this project's established style.
