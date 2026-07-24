# Award Journey Cinematic Rebuild — Phase 5: Route-Specific Question Motion Variety

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activate the three inert scene-transition containers Phase 1 scaffolded inside `#section-details` (`#detail-scene-zoom`, `#detail-scene-origami`, `#detail-scene-page-turn`, still `hidden` and empty today) by routing each route's real question fields into the correct one based on what kind of question it is — housing/property type (zoom), amenities and lifestyle preferences (origami), required route-specific qualifying information (page turn) — with everything else falling back to the existing plain `#route-detail-fields` container (ordinary scroll reveal, the fourth motion type the brief names). All three containers render together on the same screen; there is no new transition screen between questions.

**Architecture:** No new DOM, no new CSS. `index.html` already has the four containers (three from Phase 1, plus the original `#route-detail-fields`), and `assets/css/journey-motion.css` already has the three `scene-*-enter` keyframe animations and their `prefers-reduced-motion` override, both from Phase 1. This phase is a single, self-contained rewrite of one function — `assets/js/validation.js`'s `renderRouteDetails()` — plus one new lookup table in the same file. Because each container starts `hidden` (`display:none` by the browser's default UA stylesheet) and CSS animations do not play on elements that aren't rendered, simply setting `container.hidden = false` the first time a route puts real content into a previously-empty container is enough to trigger that container's `scene-*-enter` animation exactly once — no `JourneyMotion.applySceneEnter()` call is needed, and no `journey-motion.js` change is needed either. Subsequent same-session re-renders (the user toggling a checkbox, which already re-calls `renderRouteDetails()` today to handle conditional `when` fields) update the containers' contents without re-triggering their entrance animation, since `hidden` was already `false` and setting it to the same value is a no-op.

**Tech Stack:** Classic browser JavaScript, CSS animations (already built in Phase 1), `tests/verify.mjs` as the regression gate — it already calls `getCurrentDetailFields()`/`fieldHasValue()` (both operate on the static field-definition array, never the DOM) and drives every visible `.detail-field`/`.detail-option`/etc. via `document.querySelector`, which is not scoped to any one container, so it is unaffected by which of the four containers a field physically renders inside.

## Global Constraints

- Do not modify `index.html`, any CSS file, `assets/js/state.js`, `assets/js/steps.js`, `assets/js/submit.js`, `assets/js/app.js`, or `assets/js/journey-motion.js`. This phase touches `assets/js/validation.js` only.
- `tests/verify.mjs` is not modified and must keep passing exactly as-is.
- Preserve every route's full question set exactly as it exists today — every field, every option, every `required`/`when` condition. This phase changes WHERE each field's rendered HTML is appended (which container), never WHAT is rendered (`renderField()` itself is untouched) or whether a field appears (`detailVisible()` is untouched).
- Preserve every field's exact `store` path — "similar-looking answers in different routes must still write to their correct route-specific production fields" is already true today (each field's `store` is already route-specific and this phase does not touch `store` values), and this phase must not break it.
- Multi-select fields must remain multi-select (`type:'multi'`) exactly as defined today — this phase does not change any field's `type`.
- Do not insert a new transition screen between questions — all three motion containers plus the plain-scroll container render together, on the same `#section-details` screen, in the same visit; the "variety" comes from each container's own entrance treatment, not from separate steps.
- `npm run verify` must pass after every task; re-run once if anything looks flaky.
- Do not deploy, push, or merge without explicit user approval.

---

### Task 1: Categorize every field by motion type and route rendering into the correct container

**Files:**
- Modify: `assets/js/validation.js`

**Interfaces:**
- Consumes: existing `SHARED_DETAIL_FIELDS`, `PATH_DETAIL_FIELDS`, `detailVisible(field)`, `renderField(field, idx)`, `document.getElementById('detail-scene-zoom'|'detail-scene-origami'|'detail-scene-page-turn'|'route-detail-fields'|'detail-error')` (all pre-existing, the last four already present in `index.html` from Phase 1).
- Produces: `FIELD_MOTION` lookup table, a rewritten `renderRouteDetails()`.

- [ ] **Step 1: Add the field-to-motion lookup table**

In `assets/js/validation.js`, add this new constant immediately after the `PATH_DETAIL_FIELDS.sellbuy = [...]` assignment (i.e., right before `function renderField(field, idx) {`):

```js
  // Every question field is categorized into one of the brief's three named
  // motion types by its `store` path (unique per field across the whole
  // schema, unlike `group`, which several fields of different motion types
  // can share — e.g. the renter path's "Rental needs" group spans property
  // type (zoom), amenities (origami), and lease term (page-turn)). Fields
  // with no entry here fall back to the plain scroll-reveal container,
  // which is itself one of the brief's four listed motion types.
  const FIELD_MOTION = {
    // Housing / property type
    'trunk.Q3_propertyTypes': 'zoom',
    'pathData.renter_property_type': 'zoom',
    'pathData.Q9_bedroomsBathrooms': 'zoom',
    'pathData.Q12_newResale': 'zoom',
    'pathData.Q13_bedsBaths': 'zoom',
    'pathData.seller_property_type': 'zoom',
    'pathData.Q8_commercialType': 'zoom',
    'pathData.Q9_squareFootage': 'zoom',

    // Amenities and lifestyle preferences
    'pathData.non_negotiables': 'origami',
    'pathData.location_anchors': 'origami',
    'pathData.school_zoning_factor': 'origami',
    'pathData.school_district_preference': 'origami',
    'pathData.school_anchor_distance': 'origami',
    'pathData.commute_time_preference': 'origami',
    'pathData.Q10_rentalAmenities': 'origami',
    'pathData.Q14_mustHaves': 'origami',
    // The Schools & Commute disclaimer (a plain notice, store:'') reads as
    // part of that same group visually, so it travels with its siblings
    // rather than falling back to the plain-scroll container on its own.
    '': 'origami',

    // Required route-specific qualifying information
    'pathData.Q12_leaseTerm': 'pageturn',
    'pathData.Q14_employment': 'pageturn',
    'pathData.renter_background_eviction_consent': 'pageturn',
    'pathData.renter_credit_report_consent': 'pageturn',
    'pathData.renter_history_note': 'pageturn',
    'trunk.Q7_pets': 'pageturn',
    'trunk.Q7_petTypes': 'pageturn',
    'pathData.renter_pet_breed': 'pageturn',
    'pathData.renter_pet_weight': 'pageturn',
    'trunk.Q7_petOther': 'pageturn',
    'pathData.target_date_precision': 'pageturn',
    'pathData.target_date_input': 'pageturn',
    'pathData.Q8_preApproval': 'pageturn',
    'pathData.Q8_approvalAmount': 'pageturn',
    'pathData.Q9_lenderLinkClicked': 'pageturn',
    'pathData.Q15_buyerAgreed': 'pageturn',
    'pathData.seller_property_address': 'pageturn',
    'pathData.Q8_propertyCondition': 'pageturn',
    'pathData.seller_mortgage_status': 'pageturn',
    'pathData.seller_mortgage_balance': 'pageturn',
    'pathData.Q10_sellReason': 'pageturn',
    'pathData.Q9_motivatedTimeline': 'pageturn',
    'pathData.Q11_listingHistory': 'pageturn',
    'pathData.Q12_openHouseWilling': 'pageturn',
    'pathData.Q13_virtualTourWilling': 'pageturn',
    'pathData.Q14_agentPreference': 'pageturn',
    'pathData.Q10_leasePurchase': 'pageturn',
    'pathData.Q12_businessType': 'pageturn',
    'pathData.Q13_ownershipStructure': 'pageturn',
    'pathData.Q14_financialQualification': 'pageturn',
    'pathData.sellbuy_using_sale_proceeds': 'pageturn',
    'pathData.Q8_questionCategory': 'pageturn',
    'pathData.Q9_questionDetails': 'pageturn',
    'pathData.Q10_callback': 'pageturn'
  };
```

This table covers every `store` value that appears anywhere in `SHARED_DETAIL_FIELDS` or any `PATH_DETAIL_FIELDS` route array (including `sellbuy`, which reuses `seller`'s and `buyer`'s field objects by reference — those objects' `store` values are already covered by the buyer/seller entries above, so `sellbuy` needs no separate entries beyond its own `pathData.sellbuy_using_sale_proceeds`). Before moving to Step 2, cross-check this table against the actual field arrays one more time: every `store` string that appears in `SHARED_DETAIL_FIELDS` (8 fields, including the one empty-string disclaimer) and every route's `PATH_DETAIL_FIELDS` entry should have a matching key above, or a deliberate reason not to (there is no field in the current schema that should be deliberately excluded — this table is meant to be exhaustive). If you find a `store` value this table missed, add it with your best judgment of which of the three motion types fits (property type → `'zoom'`, amenities/lifestyle preference → `'origami'`, required qualifying info → `'pageturn'`), and note what you added and why in your report.

- [ ] **Step 2: Rewrite `renderRouteDetails()` to route fields into the four containers**

Replace:

```js
  function renderRouteDetails() {
    const path = FormLogic.getPath() || 'notsure';
    const fields = [...SHARED_DETAIL_FIELDS, ...(PATH_DETAIL_FIELDS[path] || [])];
    const wrap = document.getElementById('route-detail-fields');
    if (!wrap) return;

    let html = '';
    let lastGroup = '';
    fields.forEach((field, idx) => {
      if (!detailVisible(field)) return;
      if (field.group !== lastGroup) {
        if (lastGroup) html += '</div>';
        html += `<div class="detail-group"><div class="detail-group-title">${field.group}</div>`;
        lastGroup = field.group;
      }
      html += renderField(field, idx);
    });
    if (lastGroup) html += '</div>';
    wrap.innerHTML = html;
    document.getElementById('detail-error').textContent = '';
  }
```

with:

```js
  function renderRouteDetails() {
    const path = FormLogic.getPath() || 'notsure';
    const fields = [...SHARED_DETAIL_FIELDS, ...(PATH_DETAIL_FIELDS[path] || [])];
    const containers = {
      zoom: document.getElementById('detail-scene-zoom'),
      origami: document.getElementById('detail-scene-origami'),
      pageturn: document.getElementById('detail-scene-page-turn'),
      scroll: document.getElementById('route-detail-fields')
    };
    if (!containers.scroll) return;

    const html = { zoom: '', origami: '', pageturn: '', scroll: '' };
    const lastGroup = { zoom: '', origami: '', pageturn: '', scroll: '' };

    fields.forEach((field, idx) => {
      if (!detailVisible(field)) return;
      const bucket = Object.prototype.hasOwnProperty.call(FIELD_MOTION, field.store) ? FIELD_MOTION[field.store] : 'scroll';
      if (field.group !== lastGroup[bucket]) {
        if (lastGroup[bucket]) html[bucket] += '</div>';
        html[bucket] += `<div class="detail-group"><div class="detail-group-title">${field.group}</div>`;
        lastGroup[bucket] = field.group;
      }
      html[bucket] += renderField(field, idx);
    });

    Object.keys(html).forEach((bucket) => {
      if (lastGroup[bucket]) html[bucket] += '</div>';
      const el = containers[bucket];
      if (!el) return;
      el.innerHTML = html[bucket];
      el.hidden = !html[bucket];
    });

    document.getElementById('detail-error').textContent = '';
  }
```

Note `Object.prototype.hasOwnProperty.call(FIELD_MOTION, field.store)` rather than a plain `FIELD_MOTION[field.store] || 'scroll'` — this is deliberate: the empty-string key (`''`) maps to `'origami'` per Step 1, and a plain `||` fallback would work fine for that specific case too since `'origami'` is truthy, but using `hasOwnProperty` here is the more correct general pattern (it doesn't depend on every mapped value being truthy, and makes the "did this field get an explicit category, or did it fall through" distinction unambiguous for anyone reading this code later).

- [ ] **Step 3: Verify**

```bash
node --check assets/js/validation.js
git diff --check
npm run verify
```

Expected: PASS. `npm run verify`'s `fillDetails()` (called for all six routes) fills every visible `.detail-field` it finds via `document.querySelectorAll` regardless of which container each one physically lives in, and `getCurrentDetailFields()`/`fieldHasValue()` read from the field-definition array, not the DOM — so this restructuring should be fully transparent to the harness. Re-run `npm run verify` a second time if anything looks flaky before concluding a failure is real.

- [ ] **Step 4: Commit**

```bash
git add assets/js/validation.js
git commit -m "feat: route each route's question fields into zoom/origami/page-turn/scroll containers by question type"
```

---

### Task 2: Full-phase verification — every route, every field, every container, reduced motion

**Files:**
- None modified — verification only, unless Step 2 finds a real issue.

- [ ] **Step 1: Run the full check sequence**

```bash
node --check assets/js/validation.js
git diff --check
npm run verify
```

Run `npm run verify` a second time if anything looks flaky.

- [ ] **Step 2: DOM-level or visual verification of the field split**

For each of the six routes (rent, buy, sell, sell-buy, commercial, not-sure), confirm — visually if a display is available, or via a DOM-level Playwright script (as prior phases' final tasks have done: reuse `tests/mock-api.mjs`'s server, drive the real page, read back computed state, delete the script after use, never commit it) if not:
- Every field that `getCurrentDetailFields()` reports as visible for that route actually appears exactly once in the rendered page (not zero times — lost — and not twice — duplicated across two containers).
- `#detail-scene-zoom`/`#detail-scene-origami`/`#detail-scene-page-turn` are `hidden` (not rendered at all) for any route where that bucket genuinely has no fields for that route (for example, `seller` has no fields mapped to `'origami'` in this phase's `FIELD_MOTION` table — confirm `#detail-scene-origami` stays hidden for that route specifically, and that this doesn't leave a visible gap or broken layout).
- The three animated containers that DO have content play their `scene-zoom-enter`/`scene-origami-enter`/`scene-page-turn-enter` animation once when the details step is first reached, and do NOT replay it when a checkbox/option inside any container is toggled afterward (this is the single most important behavioral property this phase depends on — verify it directly, don't assume it from reading the code).
- Under forced `prefers-reduced-motion: reduce`, all fields in all containers are immediately visible with no animation, exactly as the existing Phase 1 CSS override already guarantees for these three classes.
- `submitRouteDetails()` (the "Build My Smart Move Brief" button) still correctly validates every required field regardless of which container it's in, and still correctly reports errors via `.detail-field-error` for whichever specific field(s) are missing.

- [ ] **Step 3: If Step 2 finds a real issue, fix it**

Fix, re-verify with the full check sequence from Step 1, and commit with a message describing what was found and fixed. If Step 2 finds nothing, there is nothing to commit for this task.

---

## Self-review

- **Spec coverage:** "Preserve every production route's full question logic" — `renderField()`/`detailVisible()`/every field's `store`/`type`/`options`/`when`/`paths` are completely untouched; only the routing of already-rendered HTML into one of four containers changes. "Selections that naturally allow multiple answers must be multi-select" — no field's `type` is touched by this phase; already correct today. "Separate: housing/property type; amenities and lifestyle preferences; required route-specific qualifying information" — Task 1's `FIELD_MOTION` table is exactly this categorization, applied per-field (not per-group, since groups can span categories). "Do not collapse or cheapen the production question set" — every field from every route's schema is accounted for in Task 1's cross-check instruction; nothing is removed, hidden permanently, or simplified. "Similar-looking answers in different routes must still write to their correct route-specific production fields" — untouched; each field's `store` is unchanged. "Use varied but coherent motion: scroll reveal, zoom, origami fold, page turn" — all four are used: zoom/origami/page-turn via the three already-built CSS animations, scroll reveal via the unanimated `#route-detail-fields` fallback container (the same container/behavior that already existed before this phase). "Do not insert a separate transition screen between every question" — all four containers render together on the single `#section-details` screen; this phase adds no new step, no new section, no new screen.
- **Placeholder scan:** the `FIELD_MOTION` table is a complete, real categorization of every field this plan's author could find in the schema, not a partial example — Task 1 Step 1 includes an explicit instruction to cross-check completeness rather than trust the table blindly, since a lookup table this size (~50 entries) authored by hand carries real risk of a missed key, and a missed key silently (not incorrectly) falls back to the scroll-reveal bucket, which is safe but should still be caught and reported if found.
- **Type/name consistency:** `FIELD_MOTION`, `renderRouteDetails()`'s `containers`/`html`/`lastGroup` bucket keys (`zoom`/`origami`/`pageturn`/`scroll`) are used consistently within the one function this phase rewrites. `containers.pageturn` maps to the DOM id `detail-scene-page-turn` (hyphenated, matching Phase 1's existing HTML) — the bucket *key* has no hyphen (`pageturn`, a valid unquoted JS object key) while the DOM *id* does; this asymmetry is intentional and doesn't need to be reconciled, since `containers.pageturn` is simply looked up once via `document.getElementById('detail-scene-page-turn')` and never referenced by string elsewhere.
