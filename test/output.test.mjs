/**
 * What the built site actually publishes.
 *
 * `scripts/check-twins.mjs` asserts the structural rules across every file.
 * These are the claims that need a specific page to check: that the HTML
 * declares its twin, and that the twin carries the same words the source file
 * does rather than a rendering of them.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const read = file => readFileSync(path.join(dist, file), 'utf8');

const built = existsSync(dist);
const options = { skip: built ? false : 'run `npm run build` first' };

test('every page declares its Markdown twin in the head', options, () => {
  for (const page of ['index.html', 'about.html', 'blog/markdown-twins.html']) {
    const html = read(page);
    assert.match(
      html,
      /<link rel="alternate" type="text\/markdown"/,
      `${page} does not advertise its twin`,
    );
    assert.match(html, /<link rel="canonical"/, `${page} has no canonical`);
  }
});

test('the twin carries the source file, not a rendering of it', options, () => {
  const source = readFileSync(path.join(root, 'src/content/blog/markdown-twins.md'), 'utf8');
  const twin = read('blog/markdown-twins.md');

  /* The body after the front matter must be the authored Markdown, character
     for character. This is the assertion that fails the day someone swaps the
     pipeline for an HTML-to-Markdown converter. */
  const body = source.slice(source.indexOf('\n---', 4) + 4).trim();
  const twinBody = twin.slice(twin.indexOf('\n---', 4) + 4).trim();
  assert.equal(twinBody, body);

  /* And the fenced code block survives, which is the first thing a converter
     mangles. */
  assert.match(twinBody, /```http\nLink: <https:\/\/example\.com\/pricing>; rel="canonical"\n```/);
});

test('the twin names the page as its canonical', options, () => {
  const twin = read('about.md');
  assert.match(twin, /^canonical: https:\/\/example\.com\/about$/m);
});

test('llms.txt links Markdown, not HTML', options, () => {
  const llms = read('llms.txt');
  assert.match(llms, /\/about\.md\)/);
  assert.doesNotMatch(llms, /\]\(https:\/\/example\.com\/about\)/);
});

test('robots.txt allows the twins and publishes the machine surfaces', options, () => {
  const robots = read('robots.txt');
  assert.match(robots, /^Allow: \/$/m);
  assert.doesNotMatch(robots, /Disallow: .*\.md/);
  assert.match(robots, /llms\.txt/);
  assert.match(robots, /Content-Signal:/);
});
