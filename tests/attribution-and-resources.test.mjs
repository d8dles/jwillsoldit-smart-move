import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTrackingProperties } from '../api/smart-move.js';

test('maps browser attribution into visible HubSpot contact properties', () => {
  assert.deepEqual(buildTrackingProperties({ metadata: { tracking: {
    utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'renters',
    utm_content: 'checklist', utm_term: 'houston apartment', fbclid: 'fb-123'
  } } }), {
    smart_move_utm_source: 'google',
    smart_move_utm_medium: 'cpc',
    smart_move_utm_campaign: 'renters',
    smart_move_utm_content: 'checklist',
    smart_move_utm_term: 'houston apartment',
    smart_move_fbclid: 'fb-123'
  });
});

test('renter brief offers the renter checklist and next steps after the lease', () => {
  const source = readFileSync(new URL('../assets/js/submit.js', import.meta.url), 'utf8');
  assert.match(source, /houston-renter-checklist/);
  assert.match(source, /Next steps after the lease/);
  assert.match(source, /first-time-homebuyer/);
});

test('guide recommendations unlock only after the brief is saved', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../assets/js/app.js', import.meta.url), 'utf8');
  assert.match(html, /id="brief-resources"[^>]*hidden/);
  assert.match(html, /id="brief-send-dialog"/);
  assert.match(app, /IntersectionObserver/);
  assert.match(app, /resources\.removeAttribute\('hidden'\)/);
  assert.match(app, /Sent\. I have your answers and will follow up soon/);
  assert.match(html, /Your answers are ready/);
  assert.match(html, /brief-contact-actions[^>]*hidden/);
  assert.match(html, /brief-sticky-send[^>]*hidden/);
  assert.match(app, /showBriefSuccess/);
  assert.match(app, /Your answers are saved/);
});

test('contact consent pauses for an explicit continue action', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const steps = readFileSync(new URL('../assets/js/steps.js', import.meta.url), 'utf8');
  assert.match(html, /id="contact-btn" disabled/);
  assert.match(html, /Review your choices, then select Continue when you’re ready/);
  assert.doesNotMatch(steps, /scheduleAutoAdvance\('contact'/);
  assert.match(steps, /button\.disabled = !ready/);
  const app = readFileSync(new URL('../assets/js/app.js', import.meta.url), 'utf8');
  assert.match(app, /currentStep === 2 \|\| currentStep >= 7/);
});

test('hub intent links use the same path-selection behavior as a click', () => {
  const app = readFileSync(new URL('../assets/js/app.js', import.meta.url), 'utf8');
  for (const intent of ['rent', 'buy', 'sell', 'sell-buy', 'commercial', 'not-sure', 'relocate', 'houston-relocation']) {
    assert.match(app, new RegExp(`['\"]?${intent.replace('-', '\\-')}['\"]?\\s*:`));
  }
  assert.match(app, /selectPath\(band\)/);
  assert.match(app, /PATH_LABELS\.notsure = 'Relocate'/);
});
