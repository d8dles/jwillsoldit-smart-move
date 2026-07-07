// Smart Move verification harness.
//
// Rebuilds the audit-session Playwright harness (whose only surviving output was
// docs/audit-evidence/after/verification-results.json). It:
//   1. serves index.html locally with a mock /api/smart-move (see mock-api.mjs)
//   2. drives all six paths end-to-end at 390px using only the visible buttons,
//      asserting each step transition, that the details step does NOT auto-advance,
//      and that the final submit succeeds
//   3. checks horizontal overflow at 360/390/430/820/1440 on every step
//   4. runs the C1 regression scenario (scroll up during the contact auto-advance
//      window and assert the flow recovers to the trunk section)
//   5. verifies UTM/fbclid tracking params reach the submitted payload
//   6. verifies partial-lead capture (submissionType 'partial_contact') after contact
//
// Results are written to tests/last-run.json and a pass/fail summary is printed.
// Exits non-zero on any failure.

import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { startServer } from './mock-api.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VIEWPORT_HEIGHT = 844;
const OVERFLOW_TOLERANCE = 1; // px; sub-pixel rounding is benign, real blowouts are large
const SAVED_TEXT = 'Saved. Joey has your Smart Move Brief in the CRM.';
const PATHS = ['rent', 'buy', 'sell', 'sell-buy', 'commercial', 'not-sure'];
const SECTION_IDS = ['section-open', 'section-path', 'section-contact', 'section-trunk', 'section-budget', 'section-area', 'section-details', 'section-brief'];
const TRACKING_QUERY = '?utm_source=facebook&utm_medium=paid&utm_campaign=smartmove-test&fbclid=fb.test.123';
const EXPECTED_TRACKING = { utm_source: 'facebook', utm_medium: 'paid', utm_campaign: 'smartmove-test', fbclid: 'fb.test.123' };

const CONTACT = { name: 'Fable Test Lead', email: 'fable-test@example.com', phone: '713-555-0100' };

const failures = [];
function check(cond, msg) {
  if (!cond) failures.push(msg);
  return cond;
}

// ── Low-level drivers ────────────────────────────────────────────────────

async function newFlowPage(browser, width, query = '') {
  const context = await browser.newContext({ viewport: { width, height: VIEWPORT_HEIGHT } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err && err.message ? err.message : err)));
  await page.goto(`${BASE_URL}/${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof currentStep !== 'undefined' && typeof FormLogic !== 'undefined');
  return { context, page, pageErrors };
}

const waitForStep = (page, n) => page.waitForFunction((s) => currentStep === s, n, { timeout: 12000 });

// Wait for any in-flight smooth scroll (goTo → scrollIntoView) to finish before
// measuring layout. Measuring mid-animation on the very tall sell-buy details
// section produced a spurious few-px reading; the settled layout is what matters.
async function settleScroll(page) {
  await page.waitForFunction(() => typeof programmaticScroll === 'undefined' || programmaticScroll === false, null, { timeout: 4000 }).catch(() => {});
  await page.evaluate(() => new Promise((resolve) => {
    let last = -1, stable = 0;
    const tick = () => {
      const y = Math.round(window.scrollY);
      if (y === last) { if (++stable >= 3) return resolve(); } else { stable = 0; }
      last = y;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
}

async function overflowAt(page) {
  await settleScroll(page);
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}
const sectionActive = (page, id) => page.evaluate((sid) => document.getElementById(sid)?.classList.contains('active-section'), id);

async function advanceHeroToPath(page) {
  // The hero hands off to the path selector via the "Scroll to plot your move"
  // cue (a real clickable element) — no bare-scroll dependency.
  const cue = page.locator('#section-open .scroll-cue');
  try {
    await cue.click({ timeout: 2000 });
  } catch {
    await page.evaluate(() => document.querySelector('#section-open .scroll-cue')?.click());
  }
  await waitForStep(page, 1);
}

async function selectPath(page, pathKey) {
  await page.locator(`.path-band[data-path="${pathKey}"]`).click();
  await waitForStep(page, 2); // selectPath auto-advances to the contact step
}

async function fillContact(page) {
  await page.fill('#c-name', CONTACT.name);
  await page.fill('#c-email', CONTACT.email);
  await page.fill('#c-phone', CONTACT.phone);
  await page.locator('#pref-contact .inline-opt[data-val="call"]').click();
  await page.locator('#best-time .inline-opt[data-val="morning"]').click();
}

async function fillTrunk(page) {
  await page.locator('#trunk-timeline .budget-band[data-val="within_month"]').click();
  await page.locator('#trunk-agent .budget-band[data-val="no"]').click();
  await page.locator('#ack-iabs').click();
  await page.locator('#ack-cpn').click();
}

// Fill every currently-required detail field, re-querying after each interaction
// because selecting an option re-renders the whole field list (innerHTML). Runs
// in-page so it clicks the real controls and dispatches the real events.
async function fillDetails(page) {
  return page.evaluate(() => {
    const wrap = document.getElementById('route-detail-fields');
    let guard = 0;
    while (guard++ < 400) {
      const fields = getCurrentDetailFields();
      const missing = fields.find((f) => !fieldHasValue(f));
      if (!missing) break;
      const els = [...wrap.querySelectorAll('.detail-field')];
      const el = els.find((e) => e.dataset.field === missing.store);
      if (!el) break; // required field not yet rendered — bail to avoid a spin
      const t = missing.type;
      if (t === 'single' || t === 'multi' || t === 'ack') {
        el.querySelector('.detail-option')?.click();
      } else if (t === 'select') {
        const sel = el.querySelector('select');
        const val = [...sel.options].map((o) => o.value).find((v) => v !== '');
        sel.value = val;
        updateDetailInput(sel);
      } else if (t === 'bedbath') {
        // First preset is "Flexible", which fieldHasValue accepts.
        el.querySelector('.bedbath-preset')?.click();
      } else if (t === 'number') {
        const inp = el.querySelector('input');
        inp.value = '450000';
        updateDetailInput(inp);
      } else if (t === 'address' || t === 'text') {
        const inp = el.querySelector('input');
        inp.value = 'Test Value 100';
        updateDetailInput(inp);
      } else if (t === 'textarea') {
        const ta = el.querySelector('textarea');
        ta.value = 'Verification harness details.';
        updateDetailInput(ta);
      } else {
        break;
      }
    }
    const fields = getCurrentDetailFields();
    return {
      allFilled: fields.every(fieldHasValue),
      selectedDetails: fields.filter((f) => fieldHasValue(f)).length,
    };
  });
}

// Run one full path. Measures overflow on every step; drives with visible buttons.
async function runPath(browser, pathKey, width, query = '') {
  const { context, page, pageErrors } = await newFlowPage(browser, width, query);
  const steps = [];
  let overflowMax = 0;
  const track = async (label, sid) => {
    const ok = await sectionActive(page, sid);
    check(ok, `[${pathKey}@${width}] expected ${sid} active at ${label}`);
    steps.push(`${label}→${sid}`);
    overflowMax = Math.max(overflowMax, await overflowAt(page));
  };

  await advanceHeroToPath(page);
  await track('01-path', 'section-path');

  await selectPath(page, pathKey);
  await fillContact(page);
  await track('02-contact', 'section-contact');
  await page.locator('#contact-btn').click();
  await waitForStep(page, 3);

  await fillTrunk(page);
  await track('03-trunk', 'section-trunk');
  await page.locator('#section-trunk .path-continue button').click();
  await waitForStep(page, 4);

  await page.locator('#budget-bands .budget-band').first().click();
  await track('04-budget', 'section-budget');
  await page.locator('#budget-btn').click();
  await waitForStep(page, 5);

  await page.locator('.area-chip[data-area="Downtown"]').click();
  await track('05-area', 'section-area');
  await page.locator('#area-btn').click();
  await waitForStep(page, 6);

  const details = await fillDetails(page);
  check(details.allFilled, `[${pathKey}@${width}] details not fully filled`);
  await track('06-details', 'section-details');

  // Details must NOT auto-advance: still on step 6 after a generous wait.
  const stepBefore = await page.evaluate(() => currentStep);
  await page.waitForTimeout(1500);
  const stepAfter = await page.evaluate(() => currentStep);
  const noAutoAdvance = stepBefore === 6 && stepAfter === 6;
  check(noAutoAdvance, `[${pathKey}@${width}] details step auto-advanced (${stepBefore}→${stepAfter})`);

  await page.locator('#section-details .detail-continue button').click();
  await waitForStep(page, 7);
  await track('07-brief', 'section-brief');

  await page.locator('#brief-send-link').click();
  await page.waitForFunction(
    (t) => document.getElementById('brief-submit-status')?.textContent === t,
    SAVED_TEXT,
    { timeout: 15000 },
  );
  const submitStatus = await page.evaluate(() => document.getElementById('brief-submit-status')?.textContent || '');
  const buttonState = await page.evaluate(() => document.getElementById('brief-send-link')?.textContent || '');

  await context.close();

  return {
    path: pathKey,
    width,
    steps,
    overflowMax,
    errors: pageErrors,
    detailsFilled: details.allFilled,
    detailCount: details.selectedDetails,
    noDetailsAutoAdvance: noAutoAdvance,
    submitStatus,
    buttonState,
  };
}

// C1 regression: finish the contact step, scroll up during the auto-advance
// window, and assert the flow still recovers to the trunk section (no stuck
// "rewinding" state, no dropped advance).
async function runRegression(browser) {
  const { context, page } = await newFlowPage(browser, 390);
  await advanceHeroToPath(page);
  await selectPath(page, 'rent');
  await fillContact(page); // completing the last field schedules the auto-advance
  // Small upward scroll: keeps the contact section active (so the advance is not
  // cancelled) while setting the scroll-back guard that used to strand users.
  await page.evaluate(() => window.scrollBy(0, -70));
  await page.waitForTimeout(120);
  await page.evaluate(() => window.scrollBy(0, -50));

  let advancedTo = null;
  try {
    await waitForStep(page, 3);
    advancedTo = SECTION_IDS[3];
  } catch {
    advancedTo = SECTION_IDS[await page.evaluate(() => currentStep)] || null;
  }
  const bodyClass = (await page.evaluate(() => document.body.className)).trim();
  const recovered = advancedTo === 'section-trunk' && !bodyClass.includes('rewinding');
  check(recovered, `regression did not recover (advancedTo=${advancedTo}, body="${bodyClass}")`);

  await context.close();
  return { advancedTo, bodyClass, recovered };
}

// ── Main ─────────────────────────────────────────────────────────────────

let BASE_URL;

async function main() {
  const srv = await startServer();
  BASE_URL = srv.url;

  let browser;
  try {
    browser = await chromium.launch();
  } catch {
    browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  }

  const results = { e2e: [], regression: null, viewports: [], tracking: null, submissions: null };

  try {
    // 1. Six paths end-to-end at 390. Load rent with tracking params so the
    //    tracking check rides the real flow.
    for (const p of PATHS) {
      const query = p === 'rent' ? TRACKING_QUERY : '';
      const r = await runPath(browser, p, 390, query);
      check(r.steps.length === 7, `[${p}] expected 7 steps, got ${r.steps.length}`);
      check(r.submitStatus === SAVED_TEXT, `[${p}] submit status was "${r.submitStatus}"`);
      check(r.buttonState.toLowerCase().includes('sent'), `[${p}] button state was "${r.buttonState}"`);
      // Tolerate <=1px: a benign sub-pixel rounding artifact the audit also
      // acknowledged. A real overflow regression (e.g. the historical 485px
      // Areas blowout) is orders of magnitude larger.
      check(r.overflowMax <= OVERFLOW_TOLERANCE, `[${p}] overflow ${r.overflowMax}px > ${OVERFLOW_TOLERANCE}px at 390`);
      check(r.errors.length === 0, `[${p}] page errors: ${r.errors.join('; ')}`);
      results.e2e.push({
        path: r.path,
        width: r.width,
        steps: r.steps,
        overflowMax: r.overflowMax,
        errors: r.errors,
        detailsFilled: r.detailsFilled,
        noDetailsAutoAdvance: r.noDetailsAutoAdvance,
        submitStatus: r.submitStatus,
        buttonState: r.buttonState,
        selectedDetails: r.detailCount,
      });

      if (p === 'rent') {
        const rentFinal = [...srv.submissions].reverse().find((s) => s.type === 'final' && s.routeLabel === 'Rent');
        results.tracking = rentFinal?.payload?.metadata?.tracking || {};
      }
    }

    // 2. Regression scenario.
    results.regression = await runRegression(browser);

    // 3. Overflow across viewports (full flow each). Allow <=1px at 1440.
    for (const width of [360, 430, 820, 1440]) {
      const r = await runPath(browser, 'rent', width);
      check(r.overflowMax <= OVERFLOW_TOLERANCE, `[viewport ${width}] overflow ${r.overflowMax}px > ${OVERFLOW_TOLERANCE}px`);
      check(r.submitStatus === SAVED_TEXT, `[viewport ${width}] submit status was "${r.submitStatus}"`);
      results.viewports.push({
        width,
        overflowMax: r.overflowMax,
        completed: r.submitStatus,
        errors: r.errors,
      });
    }

    // Tracking assertion.
    check(
      JSON.stringify(results.tracking) === JSON.stringify(EXPECTED_TRACKING),
      `tracking mismatch: ${JSON.stringify(results.tracking)}`,
    );

    // 4/6. Submission tallies + partial-capture check.
    const all = srv.submissions;
    const partials = all.filter((s) => s.type === 'partial_contact');
    const finals = all.filter((s) => s.type !== 'partial_contact');
    check(partials.length > 0, 'no partial_contact submissions were captured');
    check(partials.length === 11, `expected 11 partials, got ${partials.length}`);
    check(finals.length === 10, `expected 10 finals, got ${finals.length}`);

    const partialSample = partials[0]?.payload;
    const finalSample = finals[0]?.payload;
    results.submissions = {
      total: all.length,
      partials: partials.length,
      finals: finals.length,
      partialSample: partialSample && {
        route: partialSample.routeLabel,
        readiness: partialSample.readinessLabel,
        email: partialSample.contact?.email,
        name: partialSample.contact?.name,
        submissionType: partialSample.metadata?.submissionType,
      },
      finalSample: finalSample && {
        route: finalSample.routeLabel,
        budget: finalSample.budgetLabel,
        selectedDetails: Array.isArray(finalSample.selectedDetails) ? finalSample.selectedDetails.length : 0,
      },
    };
  } finally {
    if (browser) await browser.close();
    await srv.close();
  }

  results.pass = failures.length === 0;
  results.failures = failures;
  await writeFile(path.join(__dirname, 'last-run.json'), JSON.stringify(results, null, 1));

  printSummary(results);
  return results.pass;
}

function printSummary(r) {
  const line = '─'.repeat(58);
  console.log('\n' + line);
  console.log('SMART MOVE VERIFICATION — ' + (r.pass ? 'PASS ✅' : 'FAIL ❌'));
  console.log(line);

  console.log('\nEnd-to-end paths (390px):');
  for (const e of r.e2e) {
    console.log(
      `  ${e.path.padEnd(10)} steps=${e.steps.length}  overflow=${e.overflowMax}px  ` +
      `details=${e.selectedDetails}(filled=${e.detailsFilled}, noAutoAdvance=${e.noDetailsAutoAdvance})  ` +
      `submit="${e.submitStatus}"  btn="${e.buttonState}"  errors=${e.errors.length}`,
    );
  }

  console.log('\nRegression (C1 scroll-up recovery):');
  console.log(`  advancedTo=${r.regression.advancedTo}  bodyClass="${r.regression.bodyClass}"  recovered=${r.regression.recovered}`);

  console.log('\nOverflow by viewport (full flow):');
  for (const v of r.viewports) {
    console.log(`  ${String(v.width).padStart(4)}px  overflowMax=${v.overflowMax}px  completed="${v.completed}"  errors=${v.errors.length}`);
  }

  console.log('\nTracking params in submitted payload:');
  console.log('  ' + JSON.stringify(r.tracking));

  console.log('\nSubmissions captured by mock endpoint:');
  console.log(`  total=${r.submissions.total}  partials=${r.submissions.partials}  finals=${r.submissions.finals}`);
  console.log('  partialSample=' + JSON.stringify(r.submissions.partialSample));
  console.log('  finalSample=' + JSON.stringify(r.submissions.finalSample));

  if (!r.pass) {
    console.log('\nFailures:');
    for (const f of r.failures) console.log('  - ' + f);
  }
  console.log(line + '\n');
}

main()
  .then((pass) => process.exit(pass ? 0 : 1))
  .catch((err) => {
    console.error('Harness crashed:', err);
    process.exit(1);
  });
