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
  assert.match(app, /Saved\. Joey has your Smart Move Brief/);
  assert.match(html, /Brief ready to send/);
  assert.match(html, /brief-contact-actions[^>]*hidden/);
  assert.match(html, /brief-sticky-send[^>]*hidden/);
  assert.match(app, /showBriefSuccess/);
  assert.match(app, /Houston search details saved/);
});

test('contact consent pauses for an explicit continue action', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const steps = readFileSync(new URL('../assets/js/steps.js', import.meta.url), 'utf8');
  assert.match(html, /id="contact-btn" disabled/);
  assert.match(html, /This step will not move until you select Continue/);
  assert.doesNotMatch(steps, /scheduleAutoAdvance\('contact'/);
  assert.match(steps, /button\.disabled = !ready/);
  const app = readFileSync(new URL('../assets/js/app.js', import.meta.url), 'utf8');
  assert.match(app, /currentStep === 2 \|\| currentStep >= 7/);
});
