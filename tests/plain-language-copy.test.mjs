import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('public Smart Move copy does not expose implementation language', () => {
  const publicCopy = [
    read('../index.html'),
    read('../assets/js/app.js'),
    read('../assets/js/validation.js'),
    read('../assets/js/public-form-pm.js'),
  ].join('\n');

  for (const phrase of [
    'Full map verification can be connected',
    'Places API key',
    'Check the endpoint connection',
    'in the CRM',
    'Mark lender intro needed / clicked',
    'Plot Line Active',
    'Complete the required route details',
  ]) {
    assert.doesNotMatch(publicCopy, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }
});

test('summary and send states speak directly to the client', () => {
  const html = read('../index.html');
  const app = read('../assets/js/app.js');

  assert.match(html, /Here’s what<br>you shared/);
  assert.match(html, /Send My Answers to Joey/);
  assert.match(html, /I have what you shared and will follow up/);
  assert.match(app, /Your answers are still here—please try again/);
});

test('public verification forms use plain-language headings and actions', () => {
  assert.match(read('../forms/client-verification.html'), /Quick Check on Your New Rental/);
  assert.match(read('../forms/client-verification.html'), /Confirm My Rental Details/);
  assert.match(read('../forms/property-verification.html'), /Confirm Rental Placement and Commission/);
  assert.match(read('../forms/listing-intake.html'), /Send My Listing Details/);
});
