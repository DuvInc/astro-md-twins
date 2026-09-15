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
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
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

const html = files.filter(file => file.endsWith('.html')).map(relative);
const markdown = files.filter(file => file.endsWith('.md')).map(relative);

const problems = [];
const note = message => problems.push(message);

/* `/about.html` pairs with `/about.md`, `/index.html` with `/index.md`. The
   404 page is excluded: it is not a page anyone links to and has no content of
   its own to serve. */
for (const page of html) {
  if (page === '/404.html') continue;
  const twin = page.replace(/\.html$/, '.md');
  if (!markdown.includes(twin)) note(`missing twin: ${page} has no ${twin}`);
}

for (const twin of markdown) {
  const page = twin.replace(/\.md$/, '.html');
  if (!html.includes(page)) {
    note(`orphan twin: ${twin} has no page at ${page}`);
    continue;
  }

  const body = readFileSync(path.join(root, twin.slice(1)), 'utf8');

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
    const expected = twin === '/index.md' ? '/' : twin.slice(0, -'.md'.length);
    if (!canonical.endsWith(expected) || (expected === '/' && !/\/$/.test(canonical))) {
      note(`wrong canonical: ${twin} points at ${canonical}, expected a URL ending in ${expected}`);
    }
  }

  if (!/^title:\s*"/m.test(front)) note(`no title: ${twin}`);
  if (!/^description:\s*"/m.test(front)) note(`no description: ${twin}`);

  /* A twin whose body is only front matter is the failure mode of a content
     pipeline that renders to HTML first: the page looks fine, the Markdown is
     empty, and nothing says so. */
  const content = body.slice(body.indexOf('\n---', 4) + 4).trim();
  if (content.length < 40) note(`empty body: ${twin} carries ${content.length} characters`);
  if (/<[a-z][^>]*class=/i.test(content)) {
    note(`HTML leaked into ${twin}: it contains a tag with a class attribute`);
  }
}

/* The machine-readable surfaces, which are easy to break by renaming a route. */
for (const required of ['/llms.txt', '/llms-full.txt', '/robots.txt', '/sitemap.xml']) {
  if (!files.map(relative).includes(required)) note(`missing: ${required}`);
}

const sitemap = files.map(relative).includes('/sitemap.xml')
  ? readFileSync(path.join(root, 'sitemap.xml'), 'utf8')
  : '';
/* A sitemap entry asks for that exact URL to be indexed, which contradicts the
   canonical on the twin. Contradictory signals get resolved by the crawler,
   and not always the way you hoped. */
if (/<loc>[^<]*\.md<\/loc>/.test(sitemap)) note('sitemap.xml lists a .md URL; twins must stay out of it');

const llms = files.map(relative).includes('/llms.txt')
  ? readFileSync(path.join(root, 'llms.txt'), 'utf8')
  : '';
for (const twin of markdown) {
  if (twin === '/index.md') continue;
  if (!llms.includes(twin)) note(`llms.txt does not link ${twin}`);
}

if (problems.length) {
  console.error(`${problems.length} problem(s):\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(
  `${html.length - 1} pages, ${markdown.length} Markdown twins, all with a canonical. ` +
    'llms.txt, llms-full.txt, robots.txt and sitemap.xml present.',
);
