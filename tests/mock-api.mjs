// Local static server + mock /api/smart-move endpoint for the verification harness.
//
// Serves index.html and its sibling assets from the repo root, and replicates
// the Vercel serverless contract of api/smart-move.js closely enough to drive
// the front end end-to-end:
//   - POST /api/smart-move validates contact.name + contact.email (400 otherwise)
//   - on success returns { success, contactId, submissionId } — the exact shape
//     index.html checks for (it only inspects res.ok)
//   - every accepted submission payload is recorded so the harness can assert
//     partial-vs-final counts and tracking metadata.
//
// The server runs in the same Node process as verify.mjs, so the recorded
// `submissions` array is read directly by the harness (no extra IPC).

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => resolve(''));
  });
}

export async function startServer() {
  const submissions = [];

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const pathname = decodeURIComponent(url.pathname);

    // ── Mock API endpoint ──────────────────────────────────────────────
    if (pathname === '/api/smart-move') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
      }
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
      }

      const raw = await readBody(req);
      let payload;
      try {
        payload = JSON.parse(raw);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
      }

      const email = payload?.contact?.email?.trim();
      const name = payload?.contact?.name?.trim();
      if (!email || !name) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'name and email are required' }));
      }

      const id = submissions.length + 1;
      submissions.push({
        type: payload?.metadata?.submissionType || 'final',
        routeLabel: payload?.routeLabel || payload?.path || null,
        receivedAt: new Date().toISOString(),
        payload,
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: true,
        contactId: `mock-${id}`,
        submissionId: payload?.metadata?.submissionId || null,
      }));
    }

    // ── Static files ───────────────────────────────────────────────────
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405);
      return res.end('Method not allowed');
    }

    let rel = pathname === '/' ? '/index.html' : pathname;
    const filePath = path.normalize(path.join(ROOT, rel));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    try {
      const data = await readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream' });
      return res.end(req.method === 'HEAD' ? undefined : data);
    } catch {
      // Missing assets (blocked fonts, favicon, etc.) 404 harmlessly — the
      // flow does not depend on them.
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}`;

  return {
    server,
    url,
    submissions,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
