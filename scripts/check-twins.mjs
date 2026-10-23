#!/usr/bin/env node
/**
 * Every HTML page has a Markdown twin, and every twin says what it is.
 *
 * Run against `dist/` after a build. It is in `npm test` and in CI, because
 * this is the class of defect that does not show up in a browser: the site
 * looks perfect to every human who visits while the half built for machines is
 * silently missing, malformed, or pointed at the wrong canonical.
 *
 *   node scripts/check-twins.mjs [--dir dist]
 *
 * It reads either build shape Astro writes, `/about.html` (`build.format:
 * 'file'`) or `/about/index.html` (the default `'directory'`), and either a
 * single `sitemap.xml` or a split `sitemap-index.xml` + `sitemap-0.xml`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const dir = process.argv.includes('--dir') ? process.argv[process.argv.indexOf('--dir') + 1] : 'dist';
const root = path.resolve(process.cwd(), dir);

function walk(directory, files = []) {
  for (const entry of readdirSync(directory)) {
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

const files = walk(root);
const relative = file => `/${path.relative(root, file).split(path.sep).join('/')}`;
const all = files.map(relative);
const read = file => readFileSync(path.join(root, file.slice(1)), 'utf8');

const html = all.filter(file => file.endsWith('.html'));
const markdown = all.filter(file => file.endsWith('.md'));

const problems = [];
const note = message => problems.push(message);

/* ---------------------------------------------------------------- path arithmetic */

/** `/about.html` and `/about/index.html` are the page `/about`; `/index.html` is `/`. */
const pagePathOfHtml = file => {
  const stripped = file.replace(/(?:^|\/)index\.html$/, '').replace(/\.html$/, '');
  return stripped === '' ? '/' : stripped;
};
/** `/about` -> `/about.md`, `/` -> `/index.md`. */
const twinOfPage = pagePath => (pagePath === '/' ? '/index.md' : `${pagePath}.md`);
/** The pages a twin may belong to, in either build shape. */
const htmlOfTwin = twin =>
  twin === '/index.md'
    ? ['/index.html']
    : [twin.replace(/\.md$/, '.html'), twin.replace(/\.md$/, '/index.html')];
const pagePathOfTwin = twin => (twin === '/index.md' ? '/' : twin.slice(0, -'.md'.length));
const normalize = pathname => (pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname);

/* ---------------------------------------------------------------- the head of a page */

const head = file => read(file).split(/<\/head>/i)[0];
const tags = (markup, name) => markup.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) ?? [];
const attribute = (tag, name) => tag.match(new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, 'i'))?.[1];

function describe(file) {
  const markup = head(file);
  const links = tags(markup, 'link');
  const rel = value => links.find(tag => attribute(tag, 'rel')?.toLowerCase() === value);
  const canonicalTag = rel('canonical');
  const markdownTag = links.find(
    tag => attribute(tag, 'rel')?.toLowerCase() === 'alternate' && attribute(tag, 'type') === 'text/markdown',
  );
  const robots = tags(markup, 'meta').find(tag => attribute(tag, 'name')?.toLowerCase() === 'robots');
  return {
    canonical: canonicalTag && attribute(canonicalTag, 'href'),
    advertised: markdownTag && attribute(markdownTag, 'href'),
    robots: (robots && attribute(robots, 'content')) ?? '',
    lang: attribute(tags(read(file).slice(0, 2000), 'html')[0] ?? '', 'lang'),
  };
}

const pathOf = href => {
  try {
    return normalize(new URL(href, 'https://x.invalid').pathname);
  } catch {
    return undefined;
  }
};

/* ---------------------------------------------------------------- pages and twins */

/* The 404 page is excluded: it is not a page anyone links to and has no
   content of its own to serve. */
const is404 = file => file === '/404.html' || file === '/404/index.html';
const pages = html.filter(file => !is404(file));
const langOfPage = new Map();

for (const file of pages) {
  const own = pagePathOfHtml(file);
  const twin = twinOfPage(own);
  const info = describe(file);
  langOfPage.set(own, info.lang);
  const hasTwin = markdown.includes(twin);

  if (!info.canonical) {
    note(`no canonical: ${file} has no <link rel="canonical"> in its head`);
    continue;
  }
  const canonicalPath = pathOf(info.canonical);

  if (canonicalPath === own) {
    /* A page that answers for itself must have a twin, and say so. */
    if (!hasTwin) note(`missing twin: ${file} has no ${twin}`);
    if (!info.advertised) note(`unadvertised twin: ${file} has no <link rel="alternate" type="text/markdown">`);
    else if (pathOf(info.advertised) !== twin) {
      note(`wrong twin link: ${file} advertises ${info.advertised}, expected ${twin}`);
    }
    continue;
  }

  /* The canonical is another page: this one is a fallback (the original's
     words at another URL, typically an untranslated locale). It is not a
     document of its own, so it gets no twin; its head points at the
     original's twin, and it stays out of the index. */
  if (hasTwin) note(`fallback page ${file} (canonical ${canonicalPath}) must not have its own twin ${twin}`);
  const original = twinOfPage(canonicalPath);
  if (!info.advertised) note(`fallback page ${file} does not advertise the original's twin ${original}`);
  else if (pathOf(info.advertised) !== original) {
    note(`fallback page ${file} advertises ${info.advertised}, expected the original's twin ${original}`);
  }
  if (!/noindex/i.test(info.robots)) note(`fallback page ${file} must carry robots noindex, follow`);
}

/* Links with no scheme and a leading slash, outside code, where a twin is
   read away from the site and the link means nothing. */
const stripCode = text => text.replace(/^(```|~~~)[\s\S]*?^\1/gm, '').replace(/`[^`\n]*`/g, '');
const rootRelative = text =>
  /\]\(\/(?!\/)/.test(text) || /^\s{0,3}\[[^\]]+\]:\s+\/(?!\/)/m.test(text) || /\b(?:href|src)=["']\/(?!\/)/.test(text);

for (const twin of markdown) {
  const candidates = htmlOfTwin(twin);
  const page = candidates.find(file => html.includes(file));
  if (!page) {
    note(`orphan twin: ${twin} has no page at ${candidates.join(' or ')}`);
    continue;
  }

  const body = read(twin);

  if (!body.startsWith('---\n')) {
    note(`no front matter: ${twin}`);
    continue;
  }

  const front = body.slice(4, body.indexOf('\n---', 4));

  /* The canonical is the load-bearing line. A twin without one is a duplicate
     of its own page competing with it in search, which is the exact failure
     this whole design exists to avoid. */
  const canonical = front.match(/^canonical:\s*(\S+)$/m)?.[1];
  if (!canonical) note(`no canonical: ${twin}`);
  else {
    const expected = pagePathOfTwin(twin);
    if (pathOf(canonical) !== expected) {
      note(`wrong canonical: ${twin} points at ${canonical}, expected a URL ending in ${expected}`);
    }
  }

  if (!/^title:\s*"/m.test(front)) note(`no title: ${twin}`);
  if (!/^description:\s*"/m.test(front)) note(`no description: ${twin}`);

  /* The page says `<html lang>`; a file fetched on its own can only say it
     here. They must agree. */
  const language = front.match(/^language:\s*(\S+)$/m)?.[1];
  if (!language) note(`no language: ${twin}`);
  else {
    const lang = langOfPage.get(pagePathOfTwin(twin));
    if (lang && lang.toLowerCase() !== language.toLowerCase()) {
      note(`language mismatch: ${twin} says ${language}, its page says <html lang="${lang}">`);
    }
  }

  /* A twin whose body is only front matter is the failure mode of a content
     pipeline that renders to HTML first: the page looks fine, the Markdown is
     empty, and nothing says so. */
  const content = body.slice(body.indexOf('\n---', 4) + 4).trim();
  if (content.length < 40) note(`empty body: ${twin} carries ${content.length} characters`);
  if (/<[a-z][^>]*class=/i.test(content)) {
    note(`HTML leaked into ${twin}: it contains a tag with a class attribute`);
  }
  if (rootRelative(stripCode(content))) {
    note(`root-relative link in ${twin}: a twin is read outside the site, links must be absolute`);
  }
}

/* ---------------------------------------------------------------- machine surfaces */

/* The machine-readable surfaces, which are easy to break by renaming a route. */
for (const required of ['/llms.txt', '/llms-full.txt', '/robots.txt']) {
  if (!all.includes(required)) note(`missing: ${required}`);
}
if (!all.includes('/sitemap.xml') && !all.includes('/sitemap-index.xml')) {
  note('missing: /sitemap.xml or /sitemap-index.xml');
}

/* A single `sitemap.xml`, or an index plus the files it points at
   (`sitemap-0.xml`, ...): read them all. */
const sitemap = all
  .filter(file => /^\/sitemap(-[^/]*)?\.xml$/.test(file))
  .map(read)
  .join('\n');
/* A sitemap entry asks for that exact URL to be indexed, which contradicts the
   canonical on the twin. Contradictory signals get resolved by the crawler,
   and not always the way you hoped. */
if (/<loc>[^<]*\.md<\/loc>/.test(sitemap)) note('the sitemap lists a .md URL; twins must stay out of it');

const llms = all.includes('/llms.txt') ? read('/llms.txt') : '';
for (const twin of markdown) {
  if (twin === '/index.md') continue;
  /* Drafts and unindexed pages (`robots: noindex` in the front matter) stay
     out of llms.txt. */
  const noindex = /^robots:\s*noindex$/m.test(read(twin).split('\n---')[0]);
  if (noindex) {
    if (llms.includes(twin)) note(`llms.txt links ${twin}, which is noindex`);
  } else if (!llms.includes(twin)) note(`llms.txt does not link ${twin}`);
}

/* ---------------------------------------------------------------- moved and gone */

/* A page in `moved` or `gone` must not still be built: the Worker answers 301
   or 410 first, so the file would be dead weight that a host without the
   Worker would serve. A `moved` target must exist. */
const configFile = path.resolve(import.meta.dirname, '../src/site.config.ts');
/* Only for the real build: a fixture passed with --dir is not this site. */
if (existsSync(configFile) && dir === 'dist') {
  const { moved = {}, gone = [] } = await import(configFile);
  const built = new Set(pages.map(pagePathOfHtml));
  for (const [from, to] of Object.entries(moved)) {
    if (built.has(from)) note(`moved: ${from} is still built, remove the page or the entry`);
    if (!built.has(to)) note(`moved: ${from} points at ${to}, which is not a built page`);
  }
  for (const page of gone) {
    if (built.has(page)) note(`gone: ${page} is still built, remove the page or the entry`);
  }
}

if (problems.length) {
  console.error(`${problems.length} problem(s):\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

const withTwin = pages.filter(file => markdown.includes(twinOfPage(pagePathOfHtml(file)))).length;
console.log(
  `${pages.length} pages, ${markdown.length} Markdown twins (${pages.length - withTwin} fallback pages without one), all with a canonical. ` +
    'llms.txt, llms-full.txt, robots.txt and the sitemap present.',
);
