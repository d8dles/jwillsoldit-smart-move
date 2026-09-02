import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkRateLimit } from '../api/_lib/rate-limit.js';
import handler, {
  checkSmartMoveRateLimit,
  MAX_SMART_MOVE_BODY_BYTES,
  SMART_MOVE_RATE_LIMIT,
} from '../api/smart-move.js';

function makeResponse() {
  return {
    headers: new Map(),
    statusCode: null,
    setHeader(name, value) { this.headers.set(name, value); },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; },
  };
}

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; },
    async text() { return JSON.stringify(body); },
  };
}

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

test('Smart Move falls back locally when the durable rate-limit store is unavailable', async () => {
  const result = await checkSmartMoveRateLimit(
    'smart-move:198.51.100.24',
    async () => { throw new Error('fetch failed'); },
  );
  assert.equal(result.allowed, true);
});

test('a durable-store outage does not stop a valid lead from reaching HubSpot', async () => {
  const originalFetch = global.fetch;
  const originalEnv = {
    HUBSPOT_ACCESS_TOKEN: process.env.HUBSPOT_ACCESS_TOKEN,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
  };
  let hubspotContactCreated = false;

  process.env.HUBSPOT_ACCESS_TOKEN = 'test-token';
  process.env.SUPABASE_URL = 'https://store.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  delete process.env.RESEND_API_KEY;

  global.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.startsWith('https://store.invalid/')) throw new TypeError('fetch failed');
    if (target.endsWith('/crm/v3/properties/contacts?dataSensitivity=non_sensitive')) {
      return jsonResponse({ results: [] });
    }
    if (target.endsWith('/crm/v3/properties/contacts')) return jsonResponse({});
    if (target.endsWith('/crm/v3/objects/contacts/search')) {
      return jsonResponse({ total: 0, results: [] });
    }
    if (target.endsWith('/crm/v3/objects/contacts')) {
      hubspotContactCreated = options.method === 'POST';
      return jsonResponse({ id: 'contact-123' });
    }
    if (target.endsWith('/crm/v3/objects/notes')) return jsonResponse({ id: 'note-123' });
    if (target.includes('/associations/contacts/')) return jsonResponse({});
    throw new Error(`Unexpected fetch: ${target}`);
  };

  try {
    const res = makeResponse();
    await handler({
      method: 'POST',
      headers: { origin: 'https://move.jwillsoldit.com', 'x-forwarded-for': '198.51.100.88' },
      body: {
        contact: { name: 'Reliability Test', email: 'reliability@example.com', contactConsent: true },
        metadata: { submissionId: 'SM-RELIABILITY', submissionType: 'partial_contact' },
      },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.contactId, 'contact-123');
    assert.equal(hubspotContactCreated, true);
  } finally {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('Smart Move handler applies a non-blocking public-intake limiter before delivery', () => {
  const source = readFileSync(new URL('../api/smart-move.js', import.meta.url), 'utf8');
  assert.match(source, /checkSmartMoveRateLimit\(`smart-move:\$\{getClientIp\(req\)\}`\)/);
  assert.match(source, /Durable rate-limit store unavailable; using local fallback/);
  assert.doesNotMatch(source, /Rate-limit check failed/);
  assert.match(source, /return res\.status\(429\)\.json/);
  assert.match(source, /return res\.status\(413\)\.json/);
});
