# Smart Move — Full Site Audit & Improvement Plan
**Site:** move.jwillsoldit.com · **Audited:** July 2026 · **Method:** Chromium/Playwright browser testing at 430px, 390px, 360px, 820px (tablet), 1440px (desktop), all six paths driven end-to-end, plus full code review of `index.html` and `api/smart-move.js`.

> **Status log**
> - **2026-07-02 — C2 RESOLVED** (commit `cb6c05a`): TREC IABS and CPN PDFs added at `assets/docs/iabs.pdf` / `assets/docs/cpn.pdf` (official forms, filled: CRG LLC lic. 9013823-BB, designated broker Christin Rachelle Hobbs, supervisor Joey Williams lic. 702090-SA). Global footer's merged "IABS Consumer Protection Notice" link split into two correct links. All six on-page disclosure references verified 200.
> - Evidence screenshots from the audit are preserved in [`docs/audit-evidence/`](audit-evidence/) — see Appendix A. They double as the visual baseline for regression-checking the upcoming fixes.

**Testing caveat:** this audit environment's network policy blocks outbound requests to `move.jwillsoldit.com`, so the exact production code (this repo's `index.html`, which is what Vercel serves) was tested via a local server with a mock `/api/smart-move` that replicates the Vercel function's contract. One mock submission was completed successfully (client showed success, endpoint returned 200, payload validated). **A single manual live submission on the production URL is still recommended** to confirm HubSpot/Resend wiring. iOS Safari/WebKit was not tested (Chromium mobile emulation only); custom fonts were blocked in the sandbox, so typography judgments are from code.

---

## 1. Executive summary

The concept is genuinely strong. The hero is premium and distinctive, the plotline metaphor is memorable, the path split is clear, the per-path budget screens are smart, and the final Brief screen is the best "form confirmation" I've seen on a solo-agent site. Nothing about this feels like a generic lead form. The brand direction is working.

The problem is that the machine underneath the experience drops users. The site's core interaction model — "answers auto-advance you; there are no buttons" — has **two confirmed bugs that silently strand users mid-form with no visible way to continue**, reproduced repeatedly in testing at phone sizes. The Areas screen breaks horizontal layout on phones. The route-details screen is 8–13 phone-screens tall depending on path. And the biggest lead-gen leak isn't a bug at all: **contact info is captured at step 3 but nothing is sent to the CRM until the user taps "Send My Smart Move Brief" on the very last screen** — every abandonment after step 3 is a fully-identified lead lost.

Fix the stranding bugs, add always-visible Continue buttons as a safety net, capture partial leads at the contact step, and repair the compliance links, and this site goes from "beautiful but leaky" to a serious converter. None of that requires redesigning anything.

---

## 2. Critical issues

### C1 — Users get stranded mid-form (two mechanisms, one outcome) — CONFIRMED IN TESTING
All Continue buttons are visually removed by `.auto-flow .btn-continue { width:1px; height:1px }` (index.html ~line 1063). The flow depends entirely on `scheduleAutoAdvance()`. Two defects kill it:

- **Stuck `rewinding` class (permanent):** the scroll-up handler and `triggerBlueprintRewind()` share one timer variable (`rewindTimer`, ~lines 4894 & 4904). If the user scrolls up within ~900ms of a rewind trigger, the timeout that removes the `rewinding` class is cleared and never re-armed. The class persists forever, and `scheduleAutoAdvance`'s callback refuses to run while it's present. **Every subsequent step is dead.** Reproduced: body stuck at `class="auto-flow rewinding"` on the contact step with all fields valid and zero error messages.
- **Dropped advance (per-step):** `scheduleAutoAdvance` *discards* the advance (doesn't reschedule) if the user scrolled up ≥8px in the last 950ms. Reviewing your answers right as you finish — the most natural mobile gesture there is — eats the transition. Reproduced twice more with a clean body class.

In both cases the only rescue is the small floating "Next route point" pill, which doesn't read as a primary button and overlaps the footer on mobile. This is very likely leaking real conversions on the live site today.

### C2 — Texas disclosure links 404 (compliance + trust) — ✅ RESOLVED 2026-07-02 (`cb6c05a`)
~~`assets/docs/iabs.pdf` and `assets/docs/cpn.pdf` do not exist in the repo~~ → both acknowledgment links on the required "Texas Disclosures" step returned 404, meaning users were asked to legally acknowledge documents they could not open (TREC IABS delivery expectation). The footer compounded it: one link labeled "IABS Consumer Protection Notice" merged two distinct TREC documents and also 404'd.
**Fix shipped:** both filled TREC PDFs now hosted at the linked paths (verified against the official forms — see `audit-evidence/15-iabs-pdf-verification.png`); footer split into separate IABS and CPN links. Deploys with the next merge to `main`.

### C3 — Privacy Policy links to `#`
The site collects name, email, and phone from paid social traffic with no privacy policy. Facebook ad policies expect one for lead capture, and it's a trust signal serious clients look for.

### C4 — Areas screen blows out horizontal layout on phones
`.auto-flow .area-continue::before` injects the caption "Pick areas, then keep scrolling" next to a `white-space: nowrap` "Skip areas for now" link. At 390px the row forces a ~485px layout → mobile browsers zoom the whole page out, the skip link sits clipped at the screen edge, and the footer/CRG tile render cut off. Measured: `window.innerWidth` 485 in a 390px viewport. Bonus defect: the caption says *keep scrolling*, but scrolling never advances (later sections are `display:none` until unlocked) — the instruction is false.

### C5 — Leads only reach the CRM on the final tap (not a bug — the biggest revenue leak)
Contact info is validated and stored in JS at step 3, but nothing is POSTed until "Send My Smart Move Brief" on the last screen. Anyone who gets stranded (C1), tires of the details wall, or simply closes the tab is a lost, fully-identified lead. The existing backend already upserts by email, so a minimal "partial lead" POST after the contact step would work **without touching any backend code**.

---

## 3. High-impact quick wins

| # | Win | Effort |
|---|-----|--------|
| Q1 | Separate the two shared timers + make dropped auto-advances reschedule (C1) | ~10 lines JS |
| Q2 | Restore real, always-visible Continue buttons at the bottom of each step (keep auto-advance as an accelerator, buttons as the guarantee) | CSS + minor markup |
| Q3 | Partial-lead POST after contact step (reuses existing endpoint as-is) | ~15 lines JS |
| Q4 | Fix Areas-screen overflow: let the row wrap, drop `nowrap`, correct the caption copy | CSS |
| Q5 | ~~Host the IABS + CPN PDFs and split the footer into two correct links~~ ✅ **Done** (`cb6c05a`) | content + links |
| Q6 | Add a real privacy policy page | one static page |
| Q7 | Add favicon + apple-touch-icon (currently 404s; generic tab icon when shared/bookmarked) | assets |
| Q8 | Set step expectations: "Step 2 of 8 · about 3 minutes" under section labels | copy |
| Q9 | Capture `utm_*` / `fbclid` into the submission metadata so Joey knows which ad produced which lead | ~10 lines JS |

---

## 4. Mobile UX fixes

1. **Stranding bugs + hidden buttons** — C1/Q1/Q2 above. This is 80% of the mobile problem.
2. **Areas screen overflow** — C4/Q4.
3. **Route-details height.** Measured at 390×844: Renter **8,305px (~10 screens)**, Buyer 7,143px (~8.5), Sell+Buy **11,291px (~13.4 screens, 23 fields, 17 required, 104 tap targets)**. Reorder so path-specific *required* groups come first and the optional shared groups (Schools/Commute, Non-Negotiables) come after — currently optional questions are the first thing users hit. Trim the Sell+Buy required set (≤10 required fields).
4. **Full re-render scroll jump.** Every option tap on the details screen re-renders the whole field list via `innerHTML`; measured a ~560px scroll displacement mid-form. Update only the affected field's DOM (or restore scroll position after render).
5. **Premature auto-advance off the details screen.** 1.2s after the last *required* field, the user is yanked to the Brief even if they're mid-way through optional fields (the lead-quality gold). Recommend: no auto-advance on the details step at all — end it with an explicit "Build My Brief" button.
6. **Tap targets.** Inline options (Call/Text/Email, Morning/…) are 29px tall; area chips 37px. iOS guideline is 44px. Path bands (108px) are great — make everything else follow.
7. **Post-send reset.** After a successful send, `resetSmartMoveState` wipes all answers while sections remain visible — scrolling up from the Brief shows an emptied form, which reads as "it broke and lost my data." Don't reset until the user navigates home.
8. **Floating cue overlaps the footer** (and the CRG tile at some widths). Give it clearance above the footer, or hide it while the footer is in view.
9. **Sticky bar overlap:** the first path band's label can sit half-hidden beneath the fixed plotline bar after the hero handoff.

---

## 5. Copy / marketing fixes

**As a cold Facebook visitor:**

- **What makes someone bounce:** the hero requires ~1.2 viewports of scrolling before you learn what this actually is or see a single action; there is no photo of Joey, no social proof, no results, no response-time promise anywhere; the details wall (see above).
- **What feels overwhelming:** Sell+Buy and Renter details; 26 amenity checkboxes; five required inputs on the contact step before any value is delivered.
- **What feels trustworthy:** the Brief summary card, the disclosure acknowledgments (once the PDFs work), the agent-representation question, the overall design restraint, the EHO mark.
- **What feels generic:** almost nothing — this is the site's superpower. Keep it.
- **What feels premium:** the hero, the dark climax Brief screen, the mono-type detail labels, the CRG tile treatment.
- **What feels confusing / too clever:** the metaphor stack — "Plot Line Active," "Next route point," "Move signal locked," "Route generated" — is charming once but costs clarity when it replaces instructions. "Pick areas, then keep scrolling" is literally false. The red "Route generated" status dot reads as an error state at a glance.
- **Too vague:** "Prep" as a step label; "A few things before we route your move" (this step is actually timeline + representation + legal acknowledgments — the heaviest-feeling step with the lightest-touch title).
- **Be more direct:** hero sub-line could state the promise plainly ("Tell me what you're trying to do. Joey maps the smartest way to do it — usually within a day."). Contact step should say *why*: "So Joey can send your plan — no spam, no list."
- **Where to add urgency/trust:** a one-line response commitment ("Briefs are reviewed same-day"); Joey's photo + license number + brokerage line near the contact step or footer; one short testimonial strip. An `@icloud.com` reply address undermines the premium frame — worth finishing the `leads@jwillsoldit.com` migration already planned in the README.
- **What helps a serious lead finish:** visible progress ("Step 6 of 8"), fewer required fields, always-working buttons, and knowing a human reviews it fast.
- **What filters window shoppers (already good, keep):** the representation-agreement question + notice, timeline options ("Just exploring" self-tags), budget bands, the acknowledgments, Non-Negotiables.

**Fair housing check:** the Schools/Commute/Location section is well-constructed — it asks for the *user's* stated preferences, never recommends or characterizes areas or districts, and carries an independent-verification disclaimer. Non-Negotiables are all property-feature based. Safe as designed; keep the user-driven framing when editing copy.

---

## 6. Lead-quality improvements

1. **Partial-lead capture (C5/Q3)** — the single biggest improvement available.
2. **UTM/fbclid capture (Q9)** — closes the loop on which campaigns produce serious leads.
3. **Fix the urgency-flag logic (currently cosmetic):** `detectSmartFlags()` references fields that no longer exist (e.g. `Q7_existingAgent` vs the real `existing_agent_status`; renter budget/pets stored in different keys), so flags like `existing-agent` never fire and `urgencyScore` is unreliable. Either wire flags to the real field names or drop the score from the payload so it can't mislead follow-up priority.
4. **Surface urgency in the alert email:** timeline + pre-approval status + budget band in the subject line ("Pre-approved · ASAP · $500–750k") so Joey can triage from his phone.
5. **Keep Non-Negotiables, move it after required fields** so more users reach it (see §4.3).
6. **Soften the required pre-approval amount** (exact dollar figure is a privacy flinch; make it optional or banded).
7. **"Not sure yet" path asks a required "what property type should I search for"** — premature for someone undecided; make it optional there.

---

## 7. Technical risks

1. **`api/smart-move.js` interpolates raw user input into the alert email HTML and HubSpot note** — a bot or prankster can inject HTML into Joey's inbox. There's also **no honeypot/rate limiting**, so the endpoint can be spammed into HubSpot. (API file — untouched unless you approve.)
2. **`ensureCustomProperties` runs on every submission** — extra HubSpot API round-trips per lead; harmless now, rate-limit exposure at scale. (API file.)
3. **CSS patch archaeology:** at least four labeled patch layers (V8, V9, V14, "CRG tile v2") fighting each other with `!important` — e.g. `#section-open` min-height is set to `162vh !important` then `124vh !important`; section bottom padding set three times. Any future edit risks surprise regressions; a consolidation pass is warranted *after* the functional fixes.
4. **~900 lines of dead legacy code** (`FormLogic` stub: unused `postToHubSpot`, `checkSellBuyAutoRoute`, "STUB/TODO: add HubSpot call here" console logs shipped to production). Noise, weight, and confusion for future edits.
5. **Accessibility:** 22 clickable `<div>`s with no `role`, no `tabindex` — keyboard/switch users cannot select a path at all (verified: Tab order skips every band). Low legal risk, real usability + Lighthouse/SEO cost.
6. **Asset weight:** CRG logo is a 228KB PNG rendered at ~92px (should be ~15KB); `social-card.png` (584KB) is unreferenced dead weight from the old setup; OG image is 612KB (LinkedIn/FB will accept it but it's slow to scrape).
7. **No analytics of any kind** — no Meta Pixel, no GA4. For a paid-social funnel this means no retargeting audience and no drop-off measurement.
8. **Housekeeping:** `CNAME` file is a GitHub Pages leftover (harmless on Vercel); no favicon (404s in console on every visit); no mixed-content issues found (the two `http://` strings are SVG namespaces — fine); OG/Twitter/JSON-LD metadata is correct and complete.

**Verified working (leave alone):** client → `/api/smart-move` POST contract and payload shape; success/error UI states; per-path budget swapping; agent-notice display; area chip add/remove/custom-input (5-area cap works); bed/bath steppers and presets; brief population; reduced-motion fallbacks; no horizontal overflow anywhere except the Areas screen; 360px plotline bar fits.

---

## 8. Conversion scorecard (1–10)

| Dimension | Score | Note |
|---|---|---|
| First impression | **8** | Distinctive, premium; slightly slow to state its purpose |
| Mobile usability | **4** | Stranding bugs, Areas overflow, re-render jumps, small tap targets |
| Lead quality | **7** | Excellent data *when* completed; no partial capture |
| Trust | **6** | Premium frame; 404'd disclosures, dead privacy link, iCloud email |
| Clarity | **6** | Path choice great; metaphor sometimes replaces instruction |
| Speed | **7** | 44KB gzipped HTML; heavy logo/OG assets; 3 font families |
| Visual polish | **8** desktop / **6** mobile | Overlaps and clipping on phones |
| Form completion likelihood | **4** | Details length + stranding + last-screen-only submit |
| Serious-client filtering | **8** | Representation gate, budgets, acks, non-negotiables |
| Brand memorability | **8** | "Smart Move plotline" sticks; no real-estate clichés |

---

## 9. Recommended implementation order & commit plan

**Phase 0 — protect leads & compliance (no visual change, lowest risk)**
1. `fix: separate rewind timers and reschedule dropped auto-advances` (C1 — ~10 lines)
2. `feat: submit partial lead after contact step` (C5 — reuses existing endpoint, no backend change)
3. ~~`fix: host TREC IABS and CPN PDFs and split footer disclosure links`~~ ✅ **Done** (`cb6c05a`, 2026-07-02)
4. `feat: add privacy policy page and link it` (needs Joey's approval on text)
5. `chore: add favicon and apple-touch-icon`

**Phase 1 — unbreak mobile flow**
6. `fix: restore visible continue buttons on every step (auto-advance becomes accelerator)`
7. `fix: area continue row overflow + truthful caption + tappable skip button`
8. `fix: details screen — targeted field updates instead of full re-render`
9. `fix: remove auto-advance from details step; explicit Build My Brief button`
10. `fix: 44px tap targets for inline options and area chips`
11. `fix: keep brief data until user leaves; float cue clear of footer`

**Phase 2 — conversion & copy**
12. `feat: step count + time expectation in section labels`
13. `refactor: reorder details — required path groups first, optional shared groups after; trim sell+buy required set`
14. `feat: trust strip (Joey photo, license, brokerage, response promise)` (needs photo/license from Joey)
15. `fix: brief summary polish (pets label, hide acknowledgment rows, red status dot → green)`

**Phase 3 — measurement & hardening (each gated on your explicit approval)**
16. `feat: capture utm/fbclid into submission metadata` (client-side only)
17. `feat: Meta Pixel + GA4` (needs your pixel/property IDs)
18. `fix(api): escape user input in alert email + honeypot field` (**touches api/smart-move.js — only with approval**)
19. `chore: compress CRG logo + OG image, delete unused social-card.png`
20. `chore: strip legacy FormLogic stubs and console noise` (optional; verify flags first per §6.3)
21. `refactor: consolidate V8/V9/V14 CSS patch layers` (optional, riskiest cosmetic change — do last, with screenshot diffing)

Keyboard accessibility (role/tabindex/Enter handling on the band and option elements) can ride along with commits 6–10 since those touch the same markup.

## 10. What I would NOT change

- The hero concept, dark palette, wordmark glow, and plotline/blueprint visual language — this is the brand.
- The six-path band selector (best screen on the site).
- Per-path dynamic budget screens.
- The Schools/Commute framing and disclaimer (fair-housing-safe as written).
- Non-Negotiables section (keep, just reposition).
- The representation-agreement question and notice.
- The Brief climax screen and Brief Sent state (minor polish only).
- The CRG footer tile placement (works on desktop and mobile once overflow is fixed).
- The backend architecture (`api/smart-move.js` upsert + note + Resend alert) — hardening only, no restructuring.
- The single-file, no-build-step setup — it's a feature for a site this size.

---

## Appendix A — Evidence screenshots (`docs/audit-evidence/`)

Captured with Playwright/Chromium during the audit (production code served locally; Google Fonts were blocked in the test sandbox, so type renders in fallback fonts — layout and geometry are accurate). These serve two purposes: **(1)** visual proof anchoring each finding, and **(2)** the *before* baseline for regression-checking every fix — each Phase 0–2 commit gets re-shot at the same viewports and diffed against these.

| File | Viewport | What it shows | Related finding |
|---|---|---|---|
| `01-hero-mobile-390.png` | 390 | First impression, mobile — premium, on-brand | §8 First impression |
| `02-hero-desktop-1440.png` | 1440 | Desktop hero + footer with CRG tile | §8, §10 |
| `03-path-selector-390-cue-overlaps-footer.png` | 390 | Path bands (good); floating cue pill overlapping footer text; first band label under sticky bar | §4.8, §4.9 |
| `04-contact-step-390.png` | 390 | Contact step; 29px inline option chips | §4.6 |
| `05-trunk-agent-yes-notice-390.png` | 390 | "Working with another agent = Yes" notice renders correctly | §7 verified-working |
| `06-budget-rent-variant-390.png` | 390 | Budget screen correctly swapped to monthly-rent bands on renter path | §7 verified-working |
| `07-areas-overflow-CRITICAL-390.png` | 390 | **C4**: layout blown out to ~485px, page zoomed, skip link clipped, footer/CRG tile cut | **C4** |
| `08-areas-selected-tray-390.png` | 390 | Area chips + custom ZIP added to tray (works) | §7 verified-working |
| `09-details-renter-390.png` | 390 | Renter details wall (8,305px / ~10 screens) | §4.3 |
| `10-details-sellbuy-390.png` | 390 | Sell+Buy details top — 23 fields / 17 required / 13.4 screens begins here | §4.3 |
| `11-details-buyer-desktop-1440.png` | 1440 | Desktop details — clean two-column layout (keep) | §10 |
| `12-brief-390.png` | 390 | Brief climax screen — the site's best moment | §10 |
| `13-brief-sent-390.png` | 390 | Post-submit state: "Brief Sent," red status dot, "Acknowledged" noise rows | §4.7, Phase 2 #15 |
| `14-budget-small-360.png` | 360 | 360px check — plotline bar and bands fit, no overflow | §7 verified-working |
| `15-iabs-pdf-verification.png` | — | Uploaded IABS PDF rendered and verified as the filled TREC form before hosting | **C2** fix |

Not preserved (available on request from test logs): per-step flow shots for buyer/seller/commercial/notsure detail screens (geometry captured in §4.3 measurements), and the stuck-state reproductions for C1, which are behavioral (documented via body-class logs in the audit notes rather than pixels).
