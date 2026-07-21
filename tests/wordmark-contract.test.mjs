import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;

function htmlFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? htmlFiles(path) : entry.name.endsWith('.html') ? [path] : [];
  });
}

const wordmark = 'JWILLSOLDIT<span class="jw-logo__dot" aria-hidden="true">.</span>';
const files = htmlFiles(root).filter((path) => !path.includes('/node_modules/'));
let logoCount = 0;

for (const path of files) {
  const html = readFileSync(path, 'utf8');
  const logos = html.match(/<(?:a|span)\b[^>]*class="[^"]*\bjw-logo\b[^"]*"[^>]*>[\s\S]*?<\/(?:a|span)>/g) ?? [];

  for (const logo of logos) {
    logoCount += 1;
    assert.ok(logo.includes(wordmark), `${path}: visual wordmark must use the exact uppercase-plus-period markup`);
  }
}

assert.ok(logoCount >= 20, `expected the complete Smart Move wordmark inventory, found ${logoCount}`);

const home = readFileSync(join(root, 'index.html'), 'utf8');
assert.match(
  home,
  /class="brand-name"[^>]*data-text="JWILLSOLDIT"[^>]*>JWILLSOLDIT<span class="brand-dot jw-logo__dot" aria-hidden="true">\.<\/span>/,
  'hero must use uppercase source text and a literal period',
);

const baseCss = readFileSync(join(root, 'assets/css/base.css'), 'utf8');
assert.doesNotMatch(baseCss, /\.jw-logo::after/, 'global wordmark must not synthesize a dot');
assert.match(baseCss, /\.jw-logo__dot\s*{[^}]*color:\s*var\(--red\)/s, 'period must use the canonical red');

const heroCss = readFileSync(join(root, 'assets/css/hero.css'), 'utf8');
const heroDotRule = heroCss.match(/\.brand-name \.brand-dot\s*{([^}]*)}/s)?.[1] ?? '';
assert.ok(heroDotRule, 'hero period rule must exist');
assert.doesNotMatch(
  heroDotRule,
  /^\s*(?:border-radius|background|width|height):/m,
  'hero period must be a glyph, not a circle',
);

const privacy = readFileSync(join(root, 'privacy.html'), 'utf8');
assert.doesNotMatch(privacy, /\.jw-logo::after/, 'privacy page must not recreate the circle dot');

console.log(`wordmark contract passed across ${logoCount} visual logos`);
