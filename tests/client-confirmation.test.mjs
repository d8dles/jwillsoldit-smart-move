import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildClientConfirmation } from '../api/smart-move.js';

test('builds a personalized client confirmation with the Houston guide invitation', () => {
  const message = buildClientConfirmation({
    contact: { name: 'Avery Client' },
    routeLabel: 'Buy',
  });

  assert.match(message.subject, /^Avery, I have your Smart Move details$/);
  assert.match(message.html, /I have your answers/i);
  assert.match(message.html, /https:\/\/www\.jwillsoldit\.com\/houston/);
  assert.match(message.text, /reach out shortly so we can talk through the next step/i);
  assert.match(message.text, /joey@jwillsoldit\.com/);
});

test('escapes client-controlled values in confirmation HTML', () => {
  const message = buildClientConfirmation({
    contact: { name: '<script>alert(1)</script>' },
    routeLabel: '<img src=x onerror=alert(1)>',
  });

  assert.doesNotMatch(message.html, /<script>|<img src=x/);
  assert.match(message.html, /&lt;script&gt;/);
});

test('sends confirmations only for final submissions with duplicate protection', () => {
  const source = readFileSync(new URL('../api/smart-move.js', import.meta.url), 'utf8');
  assert.match(source, /submissionType !== 'final'/);
  assert.match(source, /'Idempotency-Key': `smart-move-confirmation\/\$\{submissionId\}`/);
  assert.match(source, /reply_to: 'joey@jwillsoldit\.com'/);
});
