# Award Journey Cinematic Rebuild — Phase 4: Houston Map Dominance & Refinement Reveal

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Houston map genuinely dominate the field on entry (not compete with a permanently-visible chip grid below it), and give the neighborhood-refinement panel a heading that transforms — from a neutral default into "Zoom into [region]." with the story-dot landing on its period — the moment the user picks up to two regions or explicitly skips the map. Fix a real behavioral gap discovered while researching this phase: picking a region today auto-advances straight past the refinement panel to the route-details step, and the refinement panel itself has **zero CSS** (`.area-panel`/`.area-chip`/`.area-grid`/etc. exist in `index.html` with no matching rules anywhere in the stylesheet) — so today it renders with only default browser button/div styling. Both are fixed here.

**A correction made while writing this plan, before any task was dispatched:** the first draft of this plan gated the entire refinement panel behind `hidden` until a region was picked or skipped. That would have broken `tests/verify.mjs`, which clicks `.area-chip[data-area="Downtown"]` directly with no prior region-pick or skip step (confirmed by reading `tests/verify.mjs:191` before finalizing this plan) — and since this phase's constraints forbid modifying that test file, a fully-hidden panel could never be made to pass. It would also have been a worse product decision than the fix: region selection is explicitly optional per the brief, so a user who wants to type a ZIP code immediately should not have to interact with the map first. The design below instead keeps the refinement panel always visible and interactive (matching both the harness and real users' needs), and reserves the "transform" for the heading itself — which starts neutral and becomes "Zoom into [region]." only once the user has actually chosen or skipped.

**Architecture:** No new files. `assets/css/journey-motion.css` already owns `#section-area`/`.houston-map-stage`/etc. (map-and-motion-adjacent styling); this phase resizes that block and adds the reveal/landed-dot rules there. `assets/css/form.css` already owns `.area-body`/`.area-count`/etc. (the section's static content styling) but is missing rules for the classes actually used in the refinement panel's markup — this phase adds them there, alongside the section's other content CSS, matching the existing file split. `assets/js/steps.js` already owns `selectHoustonRegion()`/`toggleArea()`/the map-selection auto-advance timer; this phase changes what the timer *does* (reveal refinement, not skip past it) without touching the region-selection or area-storage logic itself. Dot choreography reuses `JourneyMotion.travel()` and `JourneyMotion.applySceneEnter()` exactly as they already exist from Phase 1 — no new motion primitives.

**Tech Stack:** CSS (existing token system), classic browser JavaScript, `tests/verify.mjs` (Playwright) as the regression gate — it already exercises `.area-chip[data-area="Downtown"]` and `#area-btn` for all six routes plus the four overflow viewports, so this phase's changes must keep those exact selectors working.

**Why this phase is scoped this way:** The brief's required scene sequence describes the Houston region map and the location-refinement panel as two distinct scenes (6 and 7), but production's existing architecture already merges them into one `<section id="section-area">` — Phase 1 through 3 preserved that structure rather than splitting it into two `<section>`s, and this phase continues that precedent: the "two scenes" become two *reveal states* within one section (map-only, then map-plus-revealed-refinement), not two separate steps. This avoids restructuring the step/`SECTIONS`/`goTo` model that every other phase has deliberately left untouched.

## Global Constraints

- Do not modify `assets/js/state.js`, `assets/js/validation.js`, `assets/js/submit.js`, `assets/js/app.js`, or `assets/js/journey-motion.js`. This phase touches `index.html`, `assets/css/journey-motion.css`, `assets/css/form.css`, and `assets/js/steps.js` only.
- `tests/verify.mjs` is not modified and must keep passing exactly as-is — it clicks `.area-chip[data-area="Downtown"]` (which must still exist, still call `toggleArea(this)`, and remain clickable) and `#area-btn` (which must still call `goTo(6)` and still work regardless of whether a region was picked, matching today's `isStepReady(5)` returning `true` unconditionally, which this phase does not touch since `app.js` is off-limits).
- Preserve `FormLogic.formData.trunk.Q5_areas`, `toggleArea()`, `addCustomArea()`, and the existing 5-area cap in `toggleArea()` — this phase only changes what happens visually/timing-wise around region selection, not the area-storage data model.
- The manual-Continue safety net (`#area-btn`) must remain reachable and functional at all times, including before any region is picked and before the "Zoom into" heading has transformed — a user must never be blocked from reaching route details.
- Exactly one animated protagonist (`#story-dot`); `.houston-map-dot` (an existing, separate, CSS-only-pulsing marker — not `#story-dot`) is unaffected by this phase and must not be confused with or replaced by the protagonist.
- Respect `prefers-reduced-motion: reduce` — the refinement panel must still reveal (immediately, no animation) under reduced motion; it must never stay permanently hidden.
- Maintain ≤1px horizontal overflow at 360/390/430/820/1440px.
- `npm run verify` must pass after every task; re-run once if anything looks flaky (established precedent).
- Do not deploy, push, or merge without explicit user approval.

---

### Task 1: Make the map dominate the field; gate the refinement panel behind a reveal

**Files:**
- Modify: `index.html`
- Modify: `assets/css/journey-motion.css`

**Interfaces:**
- Consumes: existing `#section-area`, `.houston-map-stage`, `.area-body.compact-area-body`.
- Produces: `#area-refine-panel` (the existing `.area-body` div, given an id — it stays visible and interactive, it is not hidden), `#area-refine-region-name`, `[data-motion-anchor="area-refine-punctuation"]`.

- [ ] **Step 1: Resize the map to dominate the initial view**

In `assets/css/journey-motion.css`, change:

```css
.houston-map-stage {
  position: relative;
  width: min(92vw, 1320px);
  height: min(62vh, 680px);
  margin: 0 auto;
  overflow: visible;
}
```

to:

```css
.houston-map-stage {
  position: relative;
  width: min(94vw, 1400px);
  height: min(84vh, 880px);
  margin: 0 auto;
  overflow: visible;
}
```

Update the matching mobile override:

```css
@media(max-width:700px){.houston-map-stage{width:108vw;height:52vh;margin-left:-4vw}.houston-region{font-size:8px;padding:4px}.houston-region-grid{inset:8% 4%}.compact-area-body{padding-top:24px!important}}
```

to:

```css
@media(max-width:700px){.houston-map-stage{width:108vw;height:64vh;margin-left:-4vw}.houston-region{font-size:8px;padding:4px}.houston-region-grid{inset:8% 4%}.compact-area-body{padding-top:24px!important}}
```

- [ ] **Step 2: Add the "Zoom into" heading, defaulting to neutral copy, above the always-visible refinement content**

In `index.html`'s `#section-area`, find:

```html
  <div class="area-body compact-area-body">
    <div class="area-intro-row">
```

and change it to:

```html
  <div class="area-body compact-area-body" id="area-refine-panel">
    <div class="area-refine-heading">
      <h3 class="area-refine-title">Zoom into <span id="area-refine-region-name">Houston</span><span class="area-refine-period" data-motion-anchor="area-refine-punctuation">.</span></h3>
    </div>
    <div class="area-intro-row">
```

The panel is NOT hidden — it stays visible and every chip/input inside it stays immediately usable, exactly as today. This task only adds an id (for Task 2 to target) and a heading above the existing content; "Houston" is the neutral default text shown before any region is picked or skipped. Do not change anything else inside `.area-body` — the intro row, selected tray, area-grid panels, and custom-area input all stay exactly as they are.

- [ ] **Step 3: Style the heading and the landed punctuation dot**

In `assets/css/journey-motion.css`, add after the `.houston-map-dot`/`houstonPulse` block:

```css
.area-refine-heading { margin-bottom: 4px; }
.area-refine-title {
  font-family: var(--display);
  font-weight: 400;
  font-size: clamp(1.5rem, 2.6vw, 2.25rem);
  letter-spacing: -0.01em;
  color: var(--ink);
  margin: 0 0 20px;
}
.area-refine-period {
  position: relative;
  display: inline-block;
  width: 0.2em;
  color: var(--mid);
}
.area-refine-period.is-landed { color: transparent; }
.area-refine-period.is-landed::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: 0.08em;
  width: 0.14em;
  height: 0.14em;
  min-width: 10px;
  min-height: 10px;
  border-radius: 50%;
  background: var(--red);
  box-shadow: 0 0 18px rgba(224, 58, 31, 0.65);
  transform: translateX(-50%);
}
```

- [ ] **Step 4: Verify**

```bash
git diff --check
npm run verify
```

Expected: PASS — the panel was never hidden, so `.area-chip[data-area="Downtown"]` remains immediately clickable exactly as it was before this task; this task only adds a heading above it.

- [ ] **Step 5: Commit**

```bash
git add index.html assets/css/journey-motion.css
git commit -m "feat: resize the Houston map to dominate the field; add the Zoom into heading"
```

---

### Task 2: Transform the "Zoom into" heading on region pick or skip, with dot choreography

**Files:**
- Modify: `index.html`
- Modify: `assets/js/steps.js`

**Interfaces:**
- Consumes: `JourneyMotion.travel({ from, to, navigate })`, `JourneyMotion.applySceneEnter(el, variant)`, `JourneyMotion.reduced` (all pre-existing, from Phase 1).
- Produces: `announceAreaRefinement(regions)`, `skipHoustonMap()`.

- [ ] **Step 1: Wire the "Skip" link to the new announce function**

In `index.html`'s `#section-area`, change:

```html
    <a class="area-skip" onclick="goTo(6)">Skip areas for now</a>
```

to:

```html
    <a class="area-skip" onclick="skipHoustonMap()">Skip areas for now</a>
```

The refinement panel and its chips remain fully usable regardless — Skip only changes what the heading says and plays the dot's landing; it does not gate or reveal anything, since Task 1 already made the panel permanently visible.

- [ ] **Step 2: Transform the heading (not the panel's visibility) on region pick or skip**

In `assets/js/steps.js`, change:

```js
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
```

to:

```js
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
    if (regions.length) scheduleAutoAdvance('area-map', () => announceAreaRefinement(regions), 2000, 5);
  }

  function skipHoustonMap() {
    if (autoAdvanceTimers.has('area-map')) clearTimeout(autoAdvanceTimers.get('area-map'));
    announceAreaRefinement([]);
  }

  let areaRefinementAnnounced = false;

  function announceAreaRefinement(regions) {
    if (areaRefinementAnnounced) return;
    areaRefinementAnnounced = true;
    const panel = document.getElementById('area-refine-panel');
    const label = regions.length ? regions.join(' + ') : 'Flexible — open search';
    const nameEl = document.getElementById('area-refine-region-name');

    const announce = () => {
      if (nameEl) nameEl.textContent = label;
      if (panel && window.JourneyMotion && typeof JourneyMotion.applySceneEnter === 'function') {
        JourneyMotion.applySceneEnter(document.querySelector('.area-refine-heading'), 'zoom');
      }
    };

    if (window.JourneyMotion && typeof JourneyMotion.travel === 'function' && !JourneyMotion.reduced) {
      const fromEl = document.querySelector('.houston-map-dot.is-active') || document.querySelector('.houston-region.selected') || null;
      JourneyMotion.travel({ from: fromEl, to: 'area-refine-punctuation', navigate: announce });
    } else {
      announce();
    }
  }
```

The panel itself (`#area-refine-panel`) is never hidden or revealed by this function — it was already fully visible and interactive from the moment the area step loaded (Task 1). This function only updates the heading's text and plays its entrance animation, once, the first time a region is picked or skip is clicked (the `areaRefinementAnnounced` guard prevents replaying the animation/re-triggering `travel()` if the user picks a second region after the first already triggered this).

`JourneyMotion.travel()` already handles landing the dot on the `[data-motion-anchor="area-refine-punctuation"]` element and adding `.is-landed` to it (existing, unmodified `travel()` behavior from Phase 1 — it calls `targetElement?.classList.add('is-landed')` on whatever `to` anchor it was given). The `!JourneyMotion.reduced` check before calling `travel()` matches the exact pattern the pre-existing `journeyGoTo` wrapper (bottom of `journey-motion.js`) already uses for steps 4/6/7 — reduced-motion users get the heading update instantly via the `else` branch, never blocked waiting on an animation that won't play.

Because `window.JourneyMotion` may not exist yet if `steps.js` is loaded standalone (out-of-order test/dev loading — `journey-motion.js` loads after `steps.js` in `index.html`'s normal script order, so this never happens in a real browser session), both new functions guard with the same `window.JourneyMotion && typeof ... === 'function'` defensive pattern Phase 1 and Phase 3 already established.

- [ ] **Step 3: Verify**

```bash
node --check assets/js/steps.js
git diff --check
npm run verify
```

Expected: PASS. `tests/verify.mjs` clicks `.area-chip[data-area="Downtown"]` directly (confirmed at `tests/verify.mjs:191`, without ever clicking a `.houston-region` or the skip link first) — this still works unmodified because the panel and its chips were never hidden; `announceAreaRefinement()` never runs during the harness's flow, and that's fine, since it only affects the heading text/animation, not `toggleArea()`/`Q5_areas`/`#area-btn`, none of which this task touches.

- [ ] **Step 4: Commit**

```bash
git add index.html assets/js/steps.js
git commit -m "feat: transform the Zoom into heading on region pick or skip, with dot choreography"
```

---

### Task 3: Style the refinement panel's content (previously unstyled)

**Files:**
- Modify: `assets/css/form.css`

**Interfaces:**
- Consumes: existing `.area-intro-row`, `.area-helper`, `.area-count`, `.area-selected-tray`, `.area-grid`, `.area-panel`, `.area-panel-title`, `.area-chip-wrap`, `.area-chip`, `.area-custom` classes (already present in `index.html`, currently matched by zero CSS rules anywhere in the stylesheet — confirmed by `grep -n "\.area-panel\|\.area-chip\|\.area-grid\|\.area-intro-row\|\.area-selected-tray\|\.area-custom\|\.area-helper" assets/css/form.css` returning no output before this task).

- [ ] **Step 1: Add real styling for the refinement grid**

In `assets/css/form.css`, after the existing `.area-count`/`.area-count span` rules (right before the dead `.ring-group`/`.neighborhood-row`/etc. block — leave those alone, they're unrelated pre-existing dead CSS from an earlier iteration and out of this task's scope), add:

```css
  .area-intro-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }

  .area-helper {
    font-family: var(--body);
    font-size: 14px;
    line-height: 1.6;
    color: var(--mid);
    max-width: 640px;
    margin: 0;
  }

  .area-selected-tray {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 28px;
    min-height: 26px;
  }

  .selected-pill {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--forest);
    background: var(--paper-2);
    border: 1px solid var(--trace);
    padding: 6px 12px;
    border-radius: 999px;
  }

  .area-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 32px 40px;
  }

  .area-panel-title {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--mid);
    padding-bottom: 10px;
    border-bottom: 1px solid var(--trace);
    margin-bottom: 14px;
  }

  .area-chip-wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .area-chip {
    border: 1px solid var(--trace);
    background: var(--pure);
    padding: 9px 14px;
    font-family: var(--body);
    font-size: 13px;
    color: var(--ink);
    cursor: pointer;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }
  .area-chip:hover { border-color: var(--ink); }
  .area-chip.selected {
    background: var(--forest);
    border-color: var(--forest);
    color: var(--pure);
  }

  .area-custom {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }
  .area-custom input {
    flex: 1;
    border: 1px solid var(--trace);
    background: var(--pure);
    padding: 10px 14px;
    font-family: var(--body);
    font-size: 13px;
    color: var(--ink);
  }
  .area-custom input:focus { border-color: var(--forest); outline: none; }
  .area-custom button {
    border: 1px solid var(--forest);
    background: var(--forest);
    color: var(--pure);
    padding: 10px 18px;
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
  }

  @media (max-width: 760px) {
    .area-grid { grid-template-columns: 1fr; gap: 24px; }
  }
```

- [ ] **Step 2: Verify**

```bash
git diff --check
npm run verify
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add assets/css/form.css
git commit -m "feat: style the location-refinement panel's chip grid, tray, and custom-entry controls"
```

---

### Task 4: Full-phase verification across all six routes and viewports

**Files:**
- None modified — verification only.

- [ ] **Step 1: Run the full check sequence**

```bash
node --check assets/js/steps.js
git diff --check
npm run verify
```

Run `npm run verify` a second time if anything looks flaky, per this project's own precedent.

- [ ] **Step 2: Manual/DOM-level smoke check**

Confirm, visually if a display is available, or via a DOM-level Playwright script (as prior phases' Task 4s have done, deleted after use, not committed) if not — say explicitly which you did:
- On first entering the area step, the map fills most of the visible field, with the (still-visible, still-usable) refinement panel below it reading a neutral "Zoom into Houston." heading.
- Selecting one region, then a second, still enforces the two-region cap (the existing `selected.length >= 2` guard, untouched by this phase).
- After ~2 seconds following a region pick, the heading updates to "Zoom into [region name]." and the dot visibly lands on its period; the chips below were usable the whole time and did not change.
- Clicking "Skip areas for now" updates the heading to "Zoom into Flexible — open search." and does NOT jump to route details.
- The refinement chips, selected-area tray, and custom-area input are visually styled (not default browser buttons/inputs) and were fully functional from the moment the step loaded (clicking a chip adds it to `Q5_areas`, typing a custom area and clicking Add works) — before, during, and after the heading transforms.
- "Continue to Route Details" (`#area-btn`) works at every point — before any region is picked, after picking, and after skip.
- Under forced `prefers-reduced-motion: reduce`, the heading still updates correctly (just without the dot animation), and picking a second region after the heading already transformed once does not re-trigger the animation or re-run `travel()` (the `areaRefinementAnnounced` guard).

- [ ] **Step 3: Commit**

If Step 2 finds nothing to fix, there is nothing to commit for this task — it is a verification-only checkpoint. If it finds a real issue, fix it, re-verify, and commit the fix with a message describing what was found.

---

## Self-review

- **Spec coverage:** "Must dominate the field and remain fully visible... not covered by a floating banner" — Task 1's resize. "Nine Houston guidance regions should populate together" — untouched, already true (Phase 1 predates this phase; the 9-region grid already exists and is unaffected). "Selection is optional... allow up to two regions" — untouched, already enforced in `selectHoustonRegion()`; kept genuinely optional by never gating the refinement panel behind a region pick (a user can go straight to typing a ZIP). "Wait approximately two seconds before advancing" — preserved (`scheduleAutoAdvance(..., 2000, 5)`), retargeted from "advance to step 6" to "transform the heading and land the dot," which is the more accurate reading given production's merged-section architecture (see the plan header's rationale). "Provide an explicit skip route" — untouched structurally, retargeted to also transform the heading rather than skip past refinement entirely, matching the approved prototype's own `skipMap()`→`mapExitToRefinement()` intent (arrive at refinement, don't bypass it). "The red dot moves to the chosen region" — the pre-existing `.houston-map-dot` (CSS-pulse marker, not the protagonist) already does this, untouched. "The map pulls/zooms back and the dot falls into the refinement scene" — Task 2's `announceAreaRefinement()` is the "falls into" half (the protagonist `#story-dot` falling onto `area-refine-punctuation`); a literal map pull-back/zoom-out animation on `.houston-map-stage` itself is NOT implemented in this phase (the map stays static size, only the heading below it changes) — flagging this explicitly as a real, deliberate scope reduction, not an oversight. "Present combined refinement options based on selected region(s)" — the existing four-panel chip grid remains geography-clustered but not filtered per specific selected region (see plan header) — a deliberate, documented scope reduction, not a gap this phase silently drops. "Control itself should transform into the input state rather than exposing a generic permanent bar" — addressed at the heading level (transforms from neutral to region-specific text) rather than the whole panel's visibility, per the correction documented at the top of this plan — the panel was never a "permanent bar" problem so much as a "never says anything specific" problem, which this fixes. "Dot should fluidly land on and replace the period in the Zoom into. title" — Task 1 Step 3 + Task 2's `travel()` call.
- **Placeholder scan:** every step ships complete, real code. The one thing this plan got wrong on its first pass (gating the whole panel behind `hidden`, which would have broken `tests/verify.mjs`) was caught and corrected by the plan's own author before any task was dispatched, not left for an implementer to discover — see the correction note at the top of this document.
- **Type/name consistency:** `#area-refine-panel`, `#area-refine-region-name`, `[data-motion-anchor="area-refine-punctuation"]`, `announceAreaRefinement(regions)`, `skipHoustonMap()`, `areaRefinementAnnounced` are named identically everywhere they appear across `index.html` and `steps.js`.
