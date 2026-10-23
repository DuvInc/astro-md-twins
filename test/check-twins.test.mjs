/**
 * The CI gate, run against small fabricated builds.
 *
 * `scripts/check-twins.mjs` is only worth anything if it fails when it should,
 * so these build a `dist/` by hand in each of the shapes it must understand and
 * in the ways it must reject.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const script = path.resolve(import.meta.dirname, '../scripts/check-twins.mjs');
const origin = 'https://example.com';

const body = 'A paragraph long enough to clear the empty-body floor of forty characters.';
const twin = (pagePath, extra = {}) =>
  [
    '---',
    'title: "T"',
    'description: "D"',
    `canonical: ${origin}${pagePath}`,
    `language: ${extra.language ?? 'en'}`,
    '---',
    '',
    extra.body ?? body,
    '',
  ].join('\n');

const page = ({ canonical, twin: advertised, robots, lang = 'en' }) =>
  `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">` +
  (robots ? `<meta name="robots" content="${robots}">` : '') +
  `<link rel="canonical" href="${origin}${canonical}">` +
  (advertised ? `<link rel="alternate" type="text/markdown" href="${origin}${advertised}">` : '') +
  `</head><body></body></html>`;

function build(files, { split = false } = {}) {
  const dist = mkdtempSync(path.join(tmpdir(), 'twins-'));
  const write = (name, content) => {
    const full = path.join(dist, name);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content);
  };
  for (const [name, content] of Object.entries(files)) write(name, content);
  write('llms.txt', Object.keys(files).filter(f => f.endsWith('.md')).map(f => `- ${origin}/${f}`).join('\n'));
  write('llms-full.txt', 'all');
  write('robots.txt', 'User-agent: *\nAllow: /\n');
  if (split) {
    write('sitemap-index.xml', `<sitemapindex><sitemap><loc>${origin}/sitemap-0.xml</loc></sitemap></sitemapindex>`);
    write('sitemap-0.xml', `<urlset><url><loc>${origin}/about</loc></url></urlset>`);
  } else write('sitemap.xml', `<urlset><url><loc>${origin}/about</loc></url></urlset>`);
  return dist;
}

const run = dist => {
  const result = spawnSync(process.execPath, [script, '--dir', dist], { encoding: 'utf8' });
  rmSync(dist, { recursive: true, force: true });
  return { ok: result.status === 0, out: result.stdout + result.stderr };
};

const site = {
  flat: {
    'index.html': page({ canonical: '/', twin: '/index.md' }),
    'index.md': twin('/'),
    'about.html': page({ canonical: '/about', twin: '/about.md' }),
    'about.md': twin('/about'),
    '404.html': '<html><head></head></html>',
  },
  directory: {
    'index.html': page({ canonical: '/', twin: '/index.md' }),
    'index.md': twin('/'),
    'about/index.html': page({ canonical: '/about', twin: '/about.md' }),
    'about.md': twin('/about'),
    '404.html': '<html><head></head></html>',
  },
};

test('the flat build shape passes', () => {
  const { ok, out } = run(build(site.flat));
  assert.ok(ok, out);
});

test('the directory build shape and a split sitemap pass', () => {
  const { ok, out } = run(build(site.directory, { split: true }));
  assert.ok(ok, out);
});

test('a missing sitemap of either kind fails', () => {
  const dist = build(site.flat);
  rmSync(path.join(dist, 'sitemap.xml'));
  const { ok, out } = run(dist);
  assert.ok(!ok);
  assert.match(out, /sitemap/);
});

test('a page with no twin fails, in the directory shape too', () => {
  const files = { ...site.directory };
  delete files['about.md'];
  const { ok, out } = run(build(files));
  assert.ok(!ok);
  assert.match(out, /missing twin: \/about\/index\.html has no \/about\.md/);
});

test('a twin with no language, or the wrong one, fails', () => {
  const noLanguage = { ...site.flat, 'about.md': twin('/about').replace('language: en\n', '') };
  assert.match(run(build(noLanguage)).out, /no language: \/about\.md/);
  const wrong = { ...site.flat, 'about.md': twin('/about', { language: 'fr' }) };
  assert.match(run(build(wrong)).out, /language mismatch: \/about\.md/);
});

test('a root-relative link in a twin fails, but one in a code block does not', () => {
  const bad = { ...site.flat, 'about.md': twin('/about', { body: `${body} See [pricing](/pricing).` }) };
  assert.match(run(build(bad)).out, /root-relative link in \/about\.md/);
  const code = { ...site.flat, 'about.md': twin('/about', { body: `${body}\n\n\`\`\`md\n[pricing](/pricing)\n\`\`\`` }) };
  assert.ok(run(build(code)).ok);
});

const locales = {
  ...site.flat,
  'fr/about.html': page({ canonical: '/fr/about', twin: '/fr/about.md', lang: 'fr' }),
  'fr/about.md': twin('/fr/about', { language: 'fr' }),
};

test('a translated page with its own twin passes', () => {
  assert.ok(run(build(locales)).ok);
});

test('a translated page without a twin fails', () => {
  const files = { ...locales };
  delete files['fr/about.md'];
  assert.match(run(build(files)).out, /missing twin: \/fr\/about\.html/);
});

const fallback = {
  ...site.flat,
  'de/about.html': page({ canonical: '/about', twin: '/about.md', robots: 'noindex, follow' }),
};

test('a fallback page with no twin, noindex and the original twin advertised passes', () => {
  assert.ok(run(build(fallback)).ok);
});

test('a fallback page must not have a twin, must be noindex and must advertise the original', () => {
  const withTwin = { ...fallback, 'de/about.md': twin('/de/about') };
  assert.match(run(build(withTwin)).out, /must not have its own twin/);
  const indexable = { ...fallback, 'de/about.html': page({ canonical: '/about', twin: '/about.md' }) };
  assert.match(run(build(indexable)).out, /noindex/);
  const wrongTwin = {
    ...fallback,
    'de/about.html': page({ canonical: '/about', twin: '/de/about.md', robots: 'noindex, follow' }),
  };
  assert.match(run(build(wrongTwin)).out, /expected the original's twin \/about\.md/);
});
