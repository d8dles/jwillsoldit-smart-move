import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('cinematic journey mounts one protagonist and the approved scene architecture', async () => {
  const html = await read('index.html');
  assert.match(html, /assets\/css\/journey-motion\.css/);
  assert.match(html, /assets\/js\/journey-motion\.js/);
  assert.equal((html.match(/id="story-dot"/g) || []).length, 1);
  assert.match(html, /id="hero-handoff"/);
  assert.match(html, /id="ribbon-journey"/);
  assert.match(html, /id="journey-path"/);
  assert.match(html, /id="journey-dot"/);
  assert.match(html, /id="start-over"/);
});

test('motion controller owns hero fall, ribbon travel, and distinct scene transitions', async () => {
  const js = await read('assets/js/journey-motion.js');
  assert.match(js, /window\.JourneyMotion/);
  assert.match(js, /playHeroHandoff/);
  assert.match(js, /drawRibbonJourney/);
  assert.match(js, /scene-zoom-enter/);
  assert.match(js, /scene-origami-enter/);
  assert.match(js, /scene-page-turn-enter/);
  assert.match(js, /prefers-reduced-motion/);
  assert.match(js, /activeAnimation/);
});

test('the red protagonist is visible and active on the opening scene', async () => {
  const html = await read('index.html');
  const css = await read('assets/css/journey-motion.css');
  assert.match(html, /id="hero-dot-target"/);
  assert.match(html, /data-motion-anchor="hero-period"/);
  assert.match(css, /#story-dot\.is-hero-active/);
  assert.match(css, /#section-open[\s\S]*hero/);
});

test('approved editorial transitions are structural scenes, not four navigation anchors', async () => {
  const html = await read('index.html');
  assert.match(html, /class="[^"]*journey-scene[^"]*scene-zoom/);
  assert.match(html, /class="[^"]*journey-scene[^"]*scene-origami/);
  assert.match(html, /class="[^"]*journey-scene[^"]*scene-page-turn/);
  assert.match(html, /class="[^"]*handoff-ribbon/);
});

test('print output keeps the brief and excludes controls and footer', async () => {
  const css = await read('assets/css/journey-motion.css');
  assert.match(css, /@media print/);
  assert.match(css, /\.brief-actions/);
  assert.match(css, /#global-footer/);
});

test('Houston map exposes nine semantic optional regions', async () => {
  const html = await read('index.html');
  assert.match(html, /aria-label="Houston region map"/);
  assert.equal((html.match(/class="houston-region(?:\s|")/g) || []).length, 9);
  assert.match(html, /id="custom-area-input"/);
  assert.match(html, /Skip areas for now/);
});

test('final brief uses Texas Houston target and only three primary actions', async () => {
  const html = await read('index.html');
  assert.match(html, /aria-label="Texas map with Houston arrival"/);
  assert.match(html, /data-motion-anchor="houston"/);
  assert.match(html, />Submit</);
  assert.match(html, />Download Form</);
  assert.match(html, />Share This Form</);
  assert.doesNotMatch(html, /class="brief-action" href="tel:/);
});
