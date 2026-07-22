import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('journey motion assets and single story dot are mounted', async () => {
  const html = await read('index.html');
  assert.match(html, /assets\/css\/journey-motion\.css/);
  assert.match(html, /assets\/js\/journey-motion\.js/);
  assert.equal((html.match(/id="story-dot"/g) || []).length, 1);
});

test('motion controller exposes one public travel contract', async () => {
  const js = await read('assets/js/journey-motion.js');
  assert.match(js, /window\.JourneyMotion/);
  assert.match(js, /travel/);
  assert.match(js, /prefers-reduced-motion/);
  assert.match(js, /activeAnimation/);
});

test('print output keeps the brief and excludes controls and footer', async () => {
  const css = await read('assets/css/journey-motion.css');
  assert.match(css, /@media print/);
  assert.match(css, /\.brief-actions/);
  assert.match(css, /#global-footer/);
});
