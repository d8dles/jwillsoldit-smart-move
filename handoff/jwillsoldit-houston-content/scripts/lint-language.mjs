// Fair-housing language gate — transcribed from the Phase 1 plan (Task 2)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BANNED = [
  'best neighborhood', 'good neighborhood', 'bad area', 'safe neighborhood',
  'low-crime', 'family-friendly', 'good schools', 'great schools',
  'perfect for families', 'young professional', 'you belong here',
  'people like you', 'avoid this area', 'up-and-coming', 'dream home',
  'nestled', 'vibrant community', 'something for everyone',
  'best-kept secret', 'perfect place to call home',
];

export function findViolations(text, filePath) {
  if (filePath.includes('lint-language')) return [];
  const violations = [];
  text.split('\n').forEach((line, i) => {
    const lower = line.toLowerCase();
    for (const phrase of BANNED) {
      if (lower.includes(phrase)) violations.push(`${filePath}:${i + 1} -> "${phrase}"`);
    }
  });
  return violations;
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.(md|mdx|astro|ts)$/.test(entry)) out.push(p);
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('lint-language.mjs')) {
  const root = process.argv[2] || 'src';
  const files = walk(root);
  const all = files.flatMap((f) => findViolations(readFileSync(f, 'utf8'), f));
  if (all.length) {
    console.error('Fair-housing language violations:\n' + all.join('\n'));
    process.exit(1);
  }
  console.log(`language lint clean (${files.length} files)`);
}
