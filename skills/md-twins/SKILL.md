---
name: md-twins
description: Work on this site's Markdown twins, the machine-readable surfaces (llms.txt, robots.txt, sitemap) and the content-negotiation headers. Use when adding or editing pages, when a twin is missing or wrong, when changing what crawlers are told, or when the user asks whether any of this is working.
---

# Markdown twins

The procedure. The reasoning is in `AGENTS.md` and the evidence in `README.md`;
read those before changing anything structural.

## 1. Adding or editing a page

Content goes in `src/content/pages/` or `src/content/blog/`, as Markdown. That
is the whole step: the HTML route, the `.md` twin, the sitemap entry and the
`llms.txt` line are all derived from `src/lib/pages.ts`.

Then:

```bash
npm test
```

which builds, runs the unit tests and runs `scripts/check-twins.mjs`.

**Never write page content into an `.astro` file.** A sentence that exists only
in a template cannot appear in that page's Markdown twin, and nothing will
report it missing. If you find copy in a template, move it into `src/content/`.

## 2. A page that has no Markdown behind it

A listing, an index, a generated page. Add a record to `getPages()` in
`src/lib/pages.ts` and generate its `twin.body` from the same data the HTML
route renders. The blog index in that file is the worked example.

Do not scrape the rendered HTML back into Markdown, here or anywhere.

## 3. Checking the headers

The four signals that matter are invisible in a browser. `npm test` covers two;
the other two need the Worker:

```bash
npm run build && npm run worker:dev

curl -sI http://localhost:8787/about            | grep -iE 'link|vary'
curl -sI -H 'Accept: text/markdown' http://localhost:8787/about | grep -iE 'content-type|link'
curl -sI http://localhost:8787/about.md         | grep -iE 'content-type|link'
```

Expect, in order: an `alternate` link to the twin and `Vary: Accept` on the
page; `text/markdown` plus a `canonical` link on the negotiated response; the
same on the `.md` URL.

If you changed anything in `worker/index.ts`, paste that output into the pull
request. A header change nobody observed is a header change nobody made.

## 4. Answering "is this working?"

The honest answer comes from logs, not from the code.

- `worker/index.ts` logs one line per AI crawler hit with
  `kind: 'markdown' | 'page' | 'asset'`. `npx wrangler tail` shows it live.
- That `kind` split is the measurement. "GPTBot made 400 requests" is not an
  answer; "170 of them were `.md`" is.
- A User-Agent match is a claim, not a verification. Cloudflare's AI Crawl
  Control checks the source IP against the operator's ranges. Say which of the
  two a number came from whenever you report one.

## What not to do

| Tempting | Why it is wrong |
| --- | --- |
| `Disallow: /*.md$` in robots.txt | blocks exactly the crawlers this is built for. Use the canonical |
| Adding twins to `sitemap.xml` | asks for indexing while the canonical says the opposite |
| Dropping `Vary: Accept` on the HTML branch | caches then serve HTML to clients that asked for Markdown |
| Converting rendered HTML to Markdown | works on day one, drifts forever after |
| Claiming a ranking benefit | not measured, not claimed in the README, do not add it |
