# Award Journey Cinematic Rebuild — Phase 2: Contact & Disclosures

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Preferred Contact and Best Time genuinely multi-select (both in the UI and in the data actually sent to the CRM), and replace the trunk step's disclosure/representation handling with real inline modals — viewing, downloading, and acknowledging a disclosure are three separate actions, and existing representation gets a proper acknowledgment dialog instead of a static paragraph — using the real `assets/docs/iabs.pdf` and `assets/docs/cpn.pdf`.

**Architecture:** Same static, classic-script production site Phase 1 left in place. This phase touches `index.html` (contact + trunk sections, plus two new `<dialog>` elements), `assets/css/form.css` (new disclosure/modal styles, in the same file that already owns trunk/contact styling — this is functional UI, not motion, so it does not belong in `journey-motion.css`), `assets/js/state.js` (formalizes the contact-method/best-time data model), `assets/js/steps.js` (contact/trunk interaction handlers), and `assets/js/app.js` (one validation-gate line). `journey-motion.js` is untouched — Phase 2 has no new motion, only functional/data-model corrections and a real disclosure UI.

**Tech Stack:** Static HTML5 (native `<dialog>` element for modals — free focus-trap and Escape-to-close), CSS matching the existing design tokens in `assets/css/tokens.css`, classic browser JavaScript, `tests/verify.mjs` (Playwright) as the behavioral regression gate — there is no dedicated structural test file for this phase's scope (unlike Phase 1's `journey-motion.test.mjs`), so `npm run verify` is this phase's primary automated gate.

**Why this phase exists, concretely:** Production's `assets/js/steps.js:selectInline` is single-select today (`contact_method`/`best_time` are scalars), and — independently of the multi-select gap — those two fields are **never actually included in `FormLogic.buildSubmissionObject()` or `buildEnhancedSubmission()`**, so today's partial and final CRM submissions silently omit them even though the UI requires selecting one of each to proceed. This phase fixes both problems together, since converting the storage shape and wiring it into the payload touch the same code. Separately, `assets/js/steps.js:toggleAck`'s clickable area today wraps both the acknowledgment control and the link to the PDF (`index.html`'s `.ack-band` contains a nested `.ack-link` inside the same `onclick` region), so viewing a disclosure and acknowledging it are not actually independent actions — this phase separates them into three explicit controls (View → modal, Download → real file download, Acknowledge → its own button), matching the requirement that acknowledgment stay separate from opening/downloading a disclosure.

## Global Constraints

- Preserve `FormLogic`, `SECTIONS`, `goTo`, `PATH_MAP`, all six route keys, and every existing submission field this phase doesn't explicitly touch. Do not modify `assets/js/validation.js`, `assets/js/submit.js`, or `assets/js/journey-motion.js` in this phase.
- Do not change the trunk step's manual-Continue safety net (`submitTrunk()`) or auto-advance timing behavior beyond what's explicitly described below — `CLAUDE.md`'s C1 regression (`tests/verify.mjs`'s `runRegression`) must keep passing unmodified.
- `tests/verify.mjs` is not modified by this phase. Its existing selectors (`#pref-contact .inline-opt[data-val="call"]`, `#best-time .inline-opt[data-val="morning"]`, `#trunk-agent .budget-band[data-val="no"]`, `#ack-iabs`, `#ack-cpn`) must keep working exactly as they do today — this constrains every markup change below to keep those exact ids/selectors alive.
- Never let acknowledging a disclosure happen as a side effect of viewing or downloading it, and never let viewing/downloading a disclosure navigate away from the page.
- Use the real files at `assets/docs/iabs.pdf` and `assets/docs/cpn.pdf` — do not invent placeholder documents.
- Spell out "Information About Brokerage Services" and "Consumer Protection Notice" in all customer-facing UI, including the footers — no unexplained "IABS"/"CPN" abbreviations.
- `npm run verify` must pass after every task, run twice if any check looks flaky (per Phase 1's own precedent — one failure that didn't reproduce turned out to be a one-off, but don't assume that without a second run).
- Do not deploy, push, or merge without explicit user approval — this phase ends in local commits only.

---

### Task 1: Multi-select contact method & best time, wired into the real payload

**Files:**
- Modify: `index.html`
- Modify: `assets/js/state.js`
- Modify: `assets/js/steps.js`
- Modify: `assets/js/app.js`

**Interfaces:**
- Consumes: existing `FormLogic.formData.contact` object, `FormLogic.buildSubmissionObject()`, `maybeAutoContact()`/`submitContact()`/`sendPartialLead()` call chain.
- Produces: `FormLogic.formData.contact.methods` (array), `FormLogic.formData.contact.bestTimes` (array), a `toggleInline(el, groupId, field)` function replacing `selectInline`.

- [ ] **Step 1: Formalize the contact-method/best-time fields in `FormLogic`**

In `assets/js/state.js`, in the `formData` object literal (the block starting `contact: { name: null, email: null, phone: null }`), change it to:

```js
    contact: {
      name: null,
      email: null,
      phone: null,
      methods: [],   // ["call","text","email"] — multi-select, choose any
      bestTimes: []  // ["morning","afternoon","evening","anytime"] — multi-select, choose any
    },
```

Make the identical change in `getInitialState()`'s `contact: { ... }` block (the second occurrence of the same shape, further down in the file).

In `buildSubmissionObject()`, change:

```js
      // Contact info
      contact: {
        name: this.formData.contact.name,
        email: this.formData.contact.email,
        phone: this.formData.contact.phone
      },
```

to:

```js
      // Contact info
      contact: {
        name: this.formData.contact.name,
        email: this.formData.contact.email,
        phone: this.formData.contact.phone,
        methods: this.formData.contact.methods,
        bestTimes: this.formData.contact.bestTimes
      },
```

This is the fix for the payload gap: both `sendPartialLead()` (steps.js) and `sendSmartMoveBrief()`/`buildSmartMovePayload()` (app.js) call `FormLogic.buildSubmissionObject()` as their base, so this one change makes the fields reach both the partial and the final CRM submission.

- [ ] **Step 2: Update the contact section markup**

In `index.html`'s `#section-contact`, change:

```html
    <div class="contact-row">
      <label class="contact-label">Preferred Contact</label>
      <div class="contact-inline-opts" id="pref-contact">
        <button class="inline-opt" data-val="call" onclick="selectInline(this,'pref-contact','contact_method')">Call</button>
        <button class="inline-opt" data-val="text" onclick="selectInline(this,'pref-contact','contact_method')">Text</button>
        <button class="inline-opt" data-val="email" onclick="selectInline(this,'pref-contact','contact_method')">Email</button>
      </div>
      <div class="contact-error" id="err-pref"></div>
    </div>
    <div class="contact-row">
      <label class="contact-label">Best Time to Reach You</label>
      <div class="contact-inline-opts" id="best-time">
        <button class="inline-opt" data-val="morning" onclick="selectInline(this,'best-time','best_time')">Morning</button>
        <button class="inline-opt" data-val="afternoon" onclick="selectInline(this,'best-time','best_time')">Afternoon</button>
        <button class="inline-opt" data-val="evening" onclick="selectInline(this,'best-time','best_time')">Evening</button>
        <button class="inline-opt" data-val="anytime" onclick="selectInline(this,'best-time','best_time')">Anytime</button>
      </div>
      <div class="contact-error" id="err-time"></div>
    </div>
```

to:

```html
    <div class="contact-row">
      <label class="contact-label">Preferred Contact &middot; choose any</label>
      <div class="contact-inline-opts" id="pref-contact">
        <button class="inline-opt" data-val="call" onclick="toggleInline(this,'pref-contact','methods')">Call</button>
        <button class="inline-opt" data-val="text" onclick="toggleInline(this,'pref-contact','methods')">Text</button>
        <button class="inline-opt" data-val="email" onclick="toggleInline(this,'pref-contact','methods')">Email</button>
      </div>
      <div class="contact-error" id="err-pref"></div>
    </div>
    <div class="contact-row">
      <label class="contact-label">Best Time to Reach You &middot; choose any</label>
      <div class="contact-inline-opts" id="best-time">
        <button class="inline-opt" data-val="morning" onclick="toggleInline(this,'best-time','bestTimes')">Morning</button>
        <button class="inline-opt" data-val="afternoon" onclick="toggleInline(this,'best-time','bestTimes')">Afternoon</button>
        <button class="inline-opt" data-val="evening" onclick="toggleInline(this,'best-time','bestTimes')">Evening</button>
        <button class="inline-opt" data-val="anytime" onclick="toggleInline(this,'best-time','bestTimes')">Anytime</button>
      </div>
      <div class="contact-error" id="err-time"></div>
    </div>
```

The ids (`pref-contact`, `best-time`) and each button's `data-val` are unchanged — `tests/verify.mjs`'s `fillContact()` selectors keep working.

- [ ] **Step 3: Replace `selectInline` with a multi-select `toggleInline`, and update validation**

In `assets/js/steps.js`, replace:

```js
  // ── INLINE OPTION BUTTONS (contact method / best time) ──
  function selectInline(el, groupId, field) {
    document.querySelectorAll(`#${groupId} .inline-opt`).forEach(b => b.classList.remove('selected'));
    el.classList.add('selected');
    FormLogic.formData[field] = el.dataset.val;
    maybeAutoContact();
  }
```

with:

```js
  // ── INLINE OPTION BUTTONS (contact method / best time) ──
  // Both are multi-select: choose any combination.
  function toggleInline(el, groupId, field) {
    el.classList.toggle('selected');
    const wrap = document.getElementById(groupId);
    const values = [...wrap.querySelectorAll('.inline-opt.selected')].map(b => b.dataset.val);
    FormLogic.formData.contact[field] = values;
    maybeAutoContact();
  }
```

Then update the two functions that read the old scalar fields. Change:

```js
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
```

to:

```js
  function maybeAutoContact() {
    const name  = document.getElementById('c-name')?.value.trim() || '';
    const email = document.getElementById('c-email')?.value.trim() || '';
    const phone = document.getElementById('c-phone')?.value.trim() || '';
    const methods   = FormLogic.formData.contact.methods;
    const bestTimes = FormLogic.formData.contact.bestTimes;
    const ready = FormLogic.validateField('name', name).valid &&
                  FormLogic.validateField('email', email).valid &&
                  FormLogic.validateField('phone', phone).valid &&
                  methods.length > 0 && bestTimes.length > 0;
    if (ready) scheduleAutoAdvance('contact', submitContact, 550);
  }
```

And change:

```js
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
```

to (only the `method`/`time` lines and their two checks change; everything else is byte-identical):

```js
  function submitContact() {
    const name  = document.getElementById('c-name').value.trim();
    const email = document.getElementById('c-email').value.trim();
    const phone = document.getElementById('c-phone').value.trim();
    const methods   = FormLogic.formData.contact.methods;
    const bestTimes = FormLogic.formData.contact.bestTimes;

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

    methods.length   ? clrErr('err-pref') : setErr('err-pref', 'Select at least one preferred contact method');
    bestTimes.length ? clrErr('err-time') : setErr('err-time', 'Select at least one good time to reach you');

    if (!valid) return;

    FormLogic.updateContactField('name',  name);
    FormLogic.updateContactField('email', email);
    FormLogic.updateContactField('phone', phone);

    sendPartialLead(); // fire-and-forget: capture the lead even if they never finish

    goTo(3); // → trunk
  }
```

- [ ] **Step 4: Update the one remaining reader of the old scalar fields**

In `assets/js/app.js`'s `isStepReady(step)`, change:

```js
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
```

to:

```js
    if (step === 2) {
      const name  = document.getElementById('c-name')?.value.trim() || '';
      const email = document.getElementById('c-email')?.value.trim() || '';
      const phone = document.getElementById('c-phone')?.value.trim() || '';
      return FormLogic.validateField('name', name).valid &&
             FormLogic.validateField('email', email).valid &&
             FormLogic.validateField('phone', phone).valid &&
             FormLogic.formData.contact.methods.length > 0 &&
             FormLogic.formData.contact.bestTimes.length > 0;
    }
```

Search the whole `assets/js/` directory for any other reference to `contact_method` or `best_time` (`grep -rn "contact_method\|best_time" assets/js/`) and confirm there are none left — if you find one this plan didn't anticipate, update it the same way (read from `FormLogic.formData.contact.methods`/`.bestTimes` as arrays) and note it in your report.

- [ ] **Step 5: Verify**

```bash
node --check assets/js/state.js
node --check assets/js/steps.js
node --check assets/js/app.js
npm run verify
```

Expected: all `node --check` silent; `npm run verify` PASS — `fillContact()` clicks exactly one `call` and one `morning` button each, which now populate one-element arrays, satisfying both the old scalar-truthy check's replacement (`.length > 0`) and the new payload wiring. Re-run `npm run verify` once more if anything looks flaky before concluding a failure is real.

- [ ] **Step 6: Commit**

```bash
git add index.html assets/js/state.js assets/js/steps.js assets/js/app.js
git commit -m "feat: make contact method and best time genuinely multi-select, wired into the CRM payload"
```

---

### Task 2: Real disclosure modal — view, download, and acknowledge as three separate actions

**Files:**
- Modify: `index.html`
- Modify: `assets/css/form.css`
- Modify: `assets/js/steps.js`

**Interfaces:**
- Consumes: `assets/docs/iabs.pdf`, `assets/docs/cpn.pdf` (already exist on disk).
- Produces: `#disclosure-modal` (`<dialog>`), `viewDisclosure(key, title)`.

- [ ] **Step 1: Restructure the disclosure rows**

In `index.html`'s `#section-trunk`, replace:

```html
    <div class="ack-band" id="ack-iabs" onclick="toggleAck(this,'compliance_iabs_acknowledged','ack-iabs','err-iabs')">
      <div class="ack-box"></div>
      <div class="ack-content">
        <div class="ack-text">I acknowledge that I have been provided access to the Texas Real Estate Commission <a href="assets/docs/iabs.pdf" target="_blank" rel="noopener" class="ack-link">Information About Brokerage Services</a> notice.</div>
      </div>
    </div>
    <div class="trunk-err" id="err-iabs"></div>
    <div class="ack-band" id="ack-cpn" onclick="toggleAck(this,'compliance_cpn_acknowledged','ack-cpn','err-cpn')">
      <div class="ack-box"></div>
      <div class="ack-content">
        <div class="ack-text">I acknowledge that I have been provided access to the Texas Real Estate Commission <a href="assets/docs/cpn.pdf" target="_blank" rel="noopener" class="ack-link">Consumer Protection Notice</a>.</div>
      </div>
    </div>
    <div class="trunk-err" id="err-cpn"></div>
```

with:

```html
    <div class="disclosure-row">
      <button type="button" class="disclosure-view" onclick="viewDisclosure('iabs','Information About Brokerage Services')">Information About Brokerage Services</button>
      <a class="disclosure-download" href="assets/docs/iabs.pdf" download>Download</a>
      <button type="button" class="ack-choice" id="ack-iabs" onclick="toggleAck(this,'compliance_iabs_acknowledged','ack-iabs','err-iabs')">Acknowledge</button>
    </div>
    <div class="trunk-err" id="err-iabs"></div>
    <div class="disclosure-row">
      <button type="button" class="disclosure-view" onclick="viewDisclosure('cpn','Consumer Protection Notice')">Consumer Protection Notice</button>
      <a class="disclosure-download" href="assets/docs/cpn.pdf" download>Download</a>
      <button type="button" class="ack-choice" id="ack-cpn" onclick="toggleAck(this,'compliance_cpn_acknowledged','ack-cpn','err-cpn')">Acknowledge</button>
    </div>
    <div class="trunk-err" id="err-cpn"></div>
```

`#ack-iabs`/`#ack-cpn` keep the exact same ids and the exact same `onclick="toggleAck(...)"` call — `assets/js/steps.js`'s `toggleAck()` function is unchanged by this task, and `tests/verify.mjs`'s `page.locator('#ack-iabs').click()` keeps working. The only behavioral change is that clicking "Information About Brokerage Services" no longer also (accidentally, via the old nested-anchor-in-clickable-div structure) toggles acknowledgment — it opens the modal instead, and acknowledgment is now its own explicit button.

- [ ] **Step 2: Add the disclosure modal**

In `index.html`, immediately after the existing `<div id="story-dot" aria-hidden="true"></div>` line (same area Phase 1 added `#map-cursor`/`#start-over` to), add:

```html
<dialog class="disclosure-modal" id="disclosure-modal">
  <div class="disclosure-modal-inner">
    <div class="disclosure-modal-head">
      <span id="disclosure-modal-title">Texas disclosure</span>
      <button type="button" onclick="document.getElementById('disclosure-modal').close()">Close</button>
    </div>
    <iframe id="disclosure-modal-frame" title="Texas disclosure document"></iframe>
  </div>
</dialog>
```

- [ ] **Step 3: Add `viewDisclosure`**

In `assets/js/steps.js`, add near `toggleAck`:

```js
  // ── DISCLOSURE MODAL (view inline; acknowledgment is a separate control) ──
  function viewDisclosure(key, title) {
    const src = key === 'iabs' ? 'assets/docs/iabs.pdf' : key === 'cpn' ? 'assets/docs/cpn.pdf' : null;
    if (!src) return;
    document.getElementById('disclosure-modal-title').textContent = title;
    document.getElementById('disclosure-modal-frame').src = src;
    document.getElementById('disclosure-modal').showModal();
  }
```

- [ ] **Step 4: Style the new elements**

In `assets/css/form.css`, replace the existing `.ack-band`, `.ack-box`, `.ack-band.checked .ack-box`, `.ack-band.checked .ack-box::after`, `.ack-text`, `.ack-band.checked .ack-text`, `.ack-link`, `.ack-link:hover` rules (the block right after `.trunk-acks { padding-bottom: 0; }`) with:

```css
  .disclosure-row {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    padding: 16px 80px;
    border-top: 1px solid var(--trace);
    background: var(--pure);
  }

  .disclosure-view {
    flex: 1 1 240px;
    text-align: left;
    border: 0;
    background: transparent;
    padding: 10px 0;
    font-family: var(--body);
    font-size: 13px;
    font-weight: 500;
    color: var(--forest);
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;
  }
  .disclosure-view:hover { color: var(--ink); }

  .disclosure-download {
    border: 1px solid var(--trace);
    background: transparent;
    padding: 9px 14px;
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--mid);
    text-decoration: none;
    cursor: pointer;
    transition: color 0.12s, border-color 0.12s;
  }
  .disclosure-download:hover { color: var(--ink); border-color: var(--ink); }

  .ack-choice {
    border: 1px solid var(--trace);
    background: var(--pure);
    padding: 9px 14px;
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--mid);
    cursor: pointer;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }
  .ack-choice.checked {
    background: var(--forest);
    border-color: var(--forest);
    color: var(--pure);
  }

  .disclosure-modal {
    border: 0;
    padding: 0;
    width: min(920px, 94vw);
    height: min(760px, 92vh);
    background: var(--off-white);
    box-shadow: 0 28px 90px rgba(0, 0, 0, 0.35);
  }
  .disclosure-modal::backdrop {
    background: rgba(13, 13, 13, 0.72);
  }
  .disclosure-modal-inner {
    display: grid;
    grid-template-rows: auto 1fr;
    height: 100%;
  }
  .disclosure-modal-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 18px;
    border-bottom: 1px solid var(--trace);
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink);
  }
  .disclosure-modal-head button {
    border: 0;
    background: transparent;
    color: var(--red);
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
  }
  .disclosure-modal iframe {
    width: 100%;
    height: 100%;
    border: 0;
  }

  @media (max-width: 760px) {
    .disclosure-row { padding: 16px 24px; }
  }
```

`toggleAck()` in `assets/js/steps.js` already does `el.classList.toggle('checked')` — unchanged, and the new `.ack-choice.checked` rule above picks up the same class it already applies.

- [ ] **Step 5: Verify**

```bash
node --check assets/js/steps.js
git diff --check
npm run verify
```

Expected: `npm run verify` PASS — `fillTrunk()` clicks `#ack-iabs`/`#ack-cpn` directly by id, which still exist and still toggle `.checked` via the unchanged `toggleAck` function; it never clicks `.disclosure-view`, so the modal is never opened during the automated flow.

- [ ] **Step 6: Commit**

```bash
git add index.html assets/css/form.css assets/js/steps.js
git commit -m "feat: real inline disclosure modal — view, download, and acknowledge as separate actions"
```

---

### Task 3: Existing-representation acknowledgment modal

**Files:**
- Modify: `index.html`
- Modify: `assets/css/form.css`
- Modify: `assets/js/steps.js`

**Interfaces:**
- Consumes: `#trunk-agent`'s existing `trunkAgent(el)` handler, `maybeAutoTrunk()`.
- Produces: `#representation-modal` (`<dialog>`), `acknowledgeRepresentation()`.

- [ ] **Step 1: Replace the static notice with a modal**

In `index.html`'s `#section-trunk`, remove:

```html
    <div class="agent-yes-notice" id="agent-yes-notice" style="display:none;">
      <p>Thanks for letting me know. If you're already represented by another agent, I may not be able to assist with the same move until that relationship is resolved. Please review any buyer, tenant, or representation agreement you may have and confirm whether it needs to be ended before moving forward with our brokerage. I'm happy to help once you're clear to proceed.</p>
    </div>
```

(This is the whole `.agent-yes-notice` block — its parent `.trunk-block` and everything else around it stays.)

Then, in the same place `disclosure-modal` was added in Task 2 (right after it, still inside `<body>`, still before the first `<section>`), add:

```html
<dialog class="disclosure-modal" id="representation-modal">
  <div class="disclosure-modal-inner representation-modal-inner">
    <div class="disclosure-modal-head">
      <span>Existing representation</span>
      <button type="button" onclick="document.getElementById('representation-modal').close()">Close</button>
    </div>
    <p class="representation-copy">Thanks for letting me know. If you're already represented by another agent, I may not be able to assist with the same move until that relationship is resolved. Please review any buyer, tenant, or representation agreement you may have and confirm whether it needs to be ended before moving forward with our brokerage. I'm happy to help once you're clear to proceed.</p>
    <button type="button" class="btn-continue" id="representation-understand" onclick="acknowledgeRepresentation()">I understand</button>
  </div>
</dialog>
```

- [ ] **Step 2: Rewire `trunkAgent` to show the modal, and gate progress on dismissal**

In `assets/js/steps.js`, change:

```js
  function trunkAgent(el) {
    document.querySelectorAll('#trunk-agent .budget-band').forEach(b => b.classList.remove('selected'));
    el.classList.add('selected');
    FormLogic.formData.trunk.existing_agent_status = el.dataset.val;
    document.getElementById('agent-yes-notice').style.display = el.dataset.val === 'yes' ? 'block' : 'none';
    maybeAutoTrunk();
  }
```

to:

```js
  function trunkAgent(el) {
    document.querySelectorAll('#trunk-agent .budget-band').forEach(b => b.classList.remove('selected'));
    el.classList.add('selected');
    FormLogic.formData.trunk.existing_agent_status = el.dataset.val;
    if (el.dataset.val === 'yes') {
      document.getElementById('representation-modal').showModal();
    } else {
      maybeAutoTrunk();
    }
  }

  function acknowledgeRepresentation() {
    document.getElementById('representation-modal').close();
    maybeAutoTrunk();
  }
```

`submitTrunk()` (the manual-Continue safety net) is unchanged by this task — it still only checks `FormLogic.formData.trunk.existing_agent_status` is truthy, so a user who dismisses the modal and then uses the manual Continue button (rather than waiting for auto-advance) is unaffected.

- [ ] **Step 3: Remove the now-dead `.agent-yes-notice` CSS**

In `assets/css/form.css`, delete the `.agent-yes-notice { ... }` rule block (the one immediately following the `.ack-link:hover` rule you already touched in Task 2 — confirm it's dead by checking `grep -n "agent-yes-notice" index.html assets/js/*.js` shows no remaining references after Step 1/2 above).

- [ ] **Step 4: Verify**

```bash
node --check assets/js/steps.js
git diff --check
npm run verify
```

Expected: `npm run verify` PASS — `fillTrunk()` clicks `data-val="no"`, which never opens `#representation-modal`, so the modal's existence doesn't affect the automated flow. `runRegression` (C1) doesn't touch the trunk step's agent field at all, so it's unaffected.

- [ ] **Step 5: Commit**

```bash
git add index.html assets/css/form.css assets/js/steps.js
git commit -m "feat: existing-representation acknowledgment as a real modal instead of a static notice"
```

---

### Task 4: Spell out disclosure names in both footers, full verification

**Files:**
- Modify: `index.html`

**Interfaces:**
- None new — this task only fixes remaining customer-facing abbreviations and runs the full verification gate for the phase.

- [ ] **Step 1: Fix the footer abbreviation**

In `index.html`, there are two footers, each with a legal-links block. In `.bf-legal` (inside `#section-brief`'s footer strip) and in `.gf-legal` (the `#global-footer`), find:

```html
      <a href="assets/docs/iabs.pdf" target="_blank" rel="noopener">IABS</a>
```

(it appears twice, once in each footer) and change the link text in both occurrences to:

```html
      <a href="assets/docs/iabs.pdf" target="_blank" rel="noopener">Information About Brokerage Services</a>
```

Leave the neighboring Consumer Protection Notice links (`Consumer Protection Notice`, already spelled out) untouched.

- [ ] **Step 2: Full-phase verification**

```bash
node --check assets/js/state.js
node --check assets/js/steps.js
node --check assets/js/app.js
git diff --check
npm run verify
```

Expected: all silent/PASS. Run `npm run verify` a second time if anything looks flaky, per this project's own precedent from Phase 1.

- [ ] **Step 3: Manual/DOM-level smoke check**

If a display is available, load `index.html` locally and confirm:
- Selecting more than one Preferred Contact option and more than one Best Time option keeps all of them visually selected (not just the last click).
- Clicking "Information About Brokerage Services" opens the modal with the real PDF rendered inline, without navigating away; clicking Download actually downloads `iabs.pdf`; clicking Acknowledge toggles independently of the modal being open or closed.
- Selecting "Yes" for existing representation opens the representation modal; clicking "I understand" closes it and the trunk step advances normally.
- Both footers now read "Information About Brokerage Services" in full.

If no display is available in this environment, substitute a DOM-level Playwright check (as Phase 1's Task 4 did) driving these same interactions and reading back computed state/text content, and say so explicitly in the report rather than claiming a visual check that didn't happen.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "fix: spell out Information About Brokerage Services in both footers"
```

---

## Self-review

- **Spec coverage:** Multi-select contact method/best-time, with the fields actually reaching both partial and final CRM submissions — Task 1. Disclosure viewing/downloading/acknowledging as three separate actions, using the real PDFs, without navigating away — Task 2. Existing-representation acknowledgment as a proper modal — Task 3. No unexplained "IABS"/"CPN" abbreviations anywhere customer-facing — Task 4 (the trunk section itself already spelled both names out before this phase; only the two footers had the abbreviation). Not covered by this phase (deferred, as previously scoped with the user): budget-scene choreography, Houston map/refinement, route-question motion variety, final-brief arrival — separate later-phase plans.
- **Placeholder scan:** every step ships complete, real code (or a real, minimal, verifiable deletion) — no prose descriptions of what to build.
- **Type/name consistency:** `FormLogic.formData.contact.methods`/`.bestTimes` are the same field names in `state.js` (declaration + submission builder), `steps.js` (`toggleInline`, `maybeAutoContact`, `submitContact`), and `app.js` (`isStepReady`). `viewDisclosure(key, title)` and `acknowledgeRepresentation()` are named and called identically between their `index.html` `onclick` attributes and their `steps.js` definitions. `#ack-iabs`/`#ack-cpn` ids are preserved unchanged from before this phase specifically so `tests/verify.mjs` keeps working without modification.
