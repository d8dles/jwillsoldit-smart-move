import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkRateLimit } from '../api/_lib/rate-limit.js';
import { MAX_SMART_MOVE_BODY_BYTES, SMART_MOVE_RATE_LIMIT } from '../api/smart-move.js';

test('Smart Move accepts ordinary form payloads but caps oversized requests', () => {
  assert.equal(MAX_SMART_MOVE_BODY_BYTES, 100_000);
  assert.deepEqual(SMART_MOVE_RATE_LIMIT, {
    max: 8,
    windowMs: 10 * 60 * 1000,
    lockoutMs: 15 * 60 * 1000,
  });
});

test('Smart Move submission policy locks a noisy caller after eight attempts', () => {
  const db = {};
  for (let attempt = 0; attempt < SMART_MOVE_RATE_LIMIT.max; attempt += 1) {
    assert.equal(checkRateLimit(db, 'smart-move:203.0.113.8', SMART_MOVE_RATE_LIMIT).allowed, true);
  }
  const blocked = checkRateLimit(db, 'smart-move:203.0.113.8', SMART_MOVE_RATE_LIMIT);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 15 * 60);
});

test('Smart Move handler applies the public-intake limiter before delivery', () => {
  const source = readFileSync(new URL('../api/smart-move.js', import.meta.url), 'utf8');
  assert.match(source, /checkRateLimit\(db, `smart-move:\$\{getClientIp\(req\)\}`, SMART_MOVE_RATE_LIMIT\)/);
  assert.match(source, /return res\.status\(429\)\.json/);
  assert.match(source, /return res\.status\(413\)\.json/);
});
