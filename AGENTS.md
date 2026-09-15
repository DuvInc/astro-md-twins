# AGENTS.md

Instructions for any AI agent working in this repository. `CLAUDE.md` is a
symlink to this file, so Claude Code, Cursor, Codex and anything else reading
`AGENTS.md` get the same manual.

Read this before touching content, routes or headers. The rules below are not
style preferences: this site publishes every page twice, and the difference
between that being an asset and being a search-engine liability is four
specific signals that no browser will ever show you missing.

## What this repository is

An Astro site where every page has a Markdown twin, plus the headers and
policies that make serving both safe.

The site's content is this project's own documentation, so the demo is the
thing it documents: every page explaining the technique is served by it. Keep
that property. A change to how twins work that leaves the pages describing the
old behaviour has broken the demo, not just the docs.

The parts worth reading are `src/lib/`, `src/pages/[...slug].md.ts`,
`worker/index.ts`, `scripts/check-twins.mjs` and this file.

The README argues *why*, with measurements. This file says *how*, and what not
to break.

## Layout

| Path | What it is |
| --- | --- |
| `src/site.config.ts` | identity, origin, agent policy, and `markdownPolicy` |
| `src/content/pages/*.md` | the static pages. **Markdown is the source; the HTML is rendered from it** |
| `src/content/blog/*.md` | the posts, same rule |
| `src/lib/markdown.ts` | the bytes a twin is made of: front matter plus the authored body |
| `src/lib/pages.ts` | every page resolved once; routes, feeds and tests all read it |
| `src/lib/negotiation.ts` | the `Accept` rules, importable without a runtime so they are testable |
| `src/pages/[...slug].md.ts` | the twins, one static file per page |
| `src/pages/llms.txt.ts`, `llms-full.txt.ts`, `robots.txt.ts`, `sitemap.xml.ts` | the machine surfaces |
| `worker/index.ts` | optional Cloudflare Worker: negotiation, canonical and discovery headers |
| `scripts/check-twins.mjs` | the CI gate |

## Commands

```bash
npm install
npm run dev            # http://localhost:4321
npm run build
npm test               # build, unit tests, then check-twins
npm run check:twins    # against an existing dist/
npm run worker:dev     # wrangler dev, the only way to exercise negotiation locally
npm run deploy         # build and publish to Cloudflare Workers
```

Node 22.18 or newer: the tests import `src/lib/negotiation.ts` directly and
rely on Node stripping the types, which is unflagged from 22.18.

## The model, in five rules

1. **The Markdown is the source, not a conversion.** Every page whose words
   matter is a Markdown file that the HTML is rendered from. Never add a
   pipeline that converts rendered HTML back to Markdown: it works the day you
   write it and then drifts silently, and the drift surfaces as a model
   quoting a sentence the site no longer contains.
2. **One list of pages.** `src/lib/pages.ts` answers "which pages exist" for
   the routes, `llms.txt`, `llms-full.txt`, the sitemap and the tests. Do not
   add a second place that answers it.
3. **Both doors, always.** `<page>.md` is a real file for crawlers;
   `Accept: text/markdown` on the page URL is for coding agents. Shipping only
   the second means shipping to almost no traffic. See the README for the
   measurements.
4. **The copy names the original.** Every Markdown response carries
   `Link: <page>; rel="canonical"`, and every `.md` file repeats it in front
   matter. This is the entire duplicate-content answer.
5. **The twins are invited, never indexed as themselves.** They are linked from
   `llms.txt`, from `<link rel="alternate">` and from the `Link` header. They
   are not in the sitemap, and they are not `Disallow`ed either.

## Do not break these four signals

They are invisible in a browser, so only `npm test` and a `curl -I` will tell
you.

| Signal | Where it is set | What breaks without it |
| --- | --- | --- |
| `Link: …; rel="canonical"` on Markdown | `worker/index.ts`, and front matter in `src/lib/markdown.ts` | every page competes with its own twin in search |
| `Vary: Accept` on **both** branches | `worker/index.ts` | a cache replays HTML to a client that asked for Markdown, under load only |
| `Content-Type: text/markdown; charset=utf-8` | the route, `public/_headers`, the Worker | browsers download the file, some agents skip it |
| No `.md` in `sitemap.xml` | `src/pages/sitemap.xml.ts` | the sitemap asks for indexing while the canonical says do not |

`scripts/check-twins.mjs` enforces the first and last at build time. The two
header rules need the Worker running:

```bash
npm run build && npm run worker:dev
curl -sI http://localhost:8787/about | grep -iE 'link|vary'
curl -sI -H 'Accept: text/markdown' http://localhost:8787/about | grep -iE 'content-type|link'
curl -sI http://localhost:8787/about.md | grep -iE 'content-type|link'
```

## The two Markdown policies

`markdownPolicy` in `src/site.config.ts`:

- **`canonical`** (default): the twin declares the HTML page as the original.
  Crawlers may read it, and credit the page. This is what you want if you want
  AI search to quote you.
- **`noindex`**: the twin is served with `X-Robots-Tag: noindex`. Safer against
  duplicate content, and worse for AI search, because an engine told not to
  index a URL may also decline to retrieve it.

Choose `noindex` when you cannot set response headers on your host, because
then the canonical exists only in front matter, which search crawlers do not
read. Say which you chose in the README of a fork; it changes what the site is
for.

## Checklists

**Adding a page**

1. Add a Markdown file under `src/content/pages/`. Set `nav` to put it in the
   navbar, leave it out to keep it unlisted.
2. Nothing else. The route, the twin, the sitemap entry and the `llms.txt` line
   all come from `src/lib/pages.ts`.
3. `npm test`.

**Adding a page that has no Markdown behind it** (a listing, a search page)

1. Add a record to `getPages()` in `src/lib/pages.ts` with a `twin` whose body
   you generate from the same data the HTML route renders.
2. Never scrape the rendered HTML to produce it. The blog index in that file is
   the worked example.

**Changing anything about headers**

1. Change `worker/index.ts`.
2. Re-run the three `curl -sI` commands above and paste the output in the pull
   request. A header change that was not observed is a header change that was
   not made.

## Rules for agents

- **Never convert HTML to Markdown** anywhere in this repository, for any
  reason. If a page's content is not available as Markdown, that page's content
  is in the wrong place; move it into `src/content/`.
- **Never add a twin to the sitemap**, and never add `Disallow: /*.md` to
  robots.txt. Both are plausible-looking fixes that defeat the design.
- **Never drop `Vary: Accept`** from the HTML branch because "it only matters
  for Markdown". It matters most there.
- **Do not claim effects that are not measured.** The README is careful about
  what this does and does not do, and it cites its sources. Keep it that way:
  the credibility of the argument is the point of the repository, and an
  overclaim in the documentation is worse than a missing feature.
- **Do not add a dependency** without saying why in the pull request. The
  current list is Astro, its checker, TypeScript and Wrangler.
- **No em dashes** anywhere: code comments, documentation, content. Use a
  comma, a colon, a full stop or parentheses.

## Things that bite

- **`/.md` is not a path.** The home page twin is `/index.md`, and
  `markdownPathFor` / `pagePathFor` in `src/lib/negotiation.ts` are the only
  two functions that know it. Do not inline the arithmetic anywhere else.
- **Substring-matching `text/markdown` in the Accept header.** A client sending
  `text/html, text/markdown;q=0.1` is *declining* Markdown. Compare q values,
  which is what `quality()` does and what the tests pin.
- **`_headers` cannot target `*.md`.** Cloudflare's patterns allow one trailing
  splat, so there is no rule that selects every twin. That is why the
  `Content-Type` and canonical for Markdown live in the Worker, and why
  `public/_headers` documents the gap rather than pretending to fill it.
- **A twin that is only front matter.** The symptom of a content pipeline that
  renders to HTML first: the page looks fine, the Markdown is empty, nothing
  reports it. `check-twins.mjs` fails on a body under 40 characters for exactly
  this reason.
- **Trailing slashes.** `trailingSlash: 'never'` with `build.format: 'file'` is
  what makes `/about` pair with `/about.md`. Changing either turns every twin
  into `/about/index.md` and breaks the pairing in the Worker.
