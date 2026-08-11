import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../api/smart-move.js';

function makeResponse() {
  const headers = new Map();
  return {
    headers,
    statusCode: null,
    setHeader(name, value) { headers.set(name, value); },
    status(code) { this.statusCode = code; return this; },
    end() { return this; },
    json(body) { this.body = body; return this; },
  };
}

test('allows the production hub to submit website questions', async () => {
  const res = makeResponse();
  await handler({ method: 'OPTIONS', headers: { origin: 'https://www.jwillsoldit.com' } }, res);
  assert.equal(res.statusCode, 204);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://www.jwillsoldit.com');
  assert.equal(res.headers.get('Vary'), 'Origin');
});

test('allows only the jwillsoldit hub preview family', async () => {
  const allowed = makeResponse();
  await handler({ method: 'OPTIONS', headers: { origin: 'https://jwillsoldit-hub-git-feature-123.vercel.app' } }, allowed);
  assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), 'https://jwillsoldit-hub-git-feature-123.vercel.app');

  const rejected = makeResponse();
  await handler({ method: 'OPTIONS', headers: { origin: 'https://unrelated-project.vercel.app' } }, rejected);
  assert.equal(rejected.headers.get('Access-Control-Allow-Origin'), 'https://move.jwillsoldit.com');
});
