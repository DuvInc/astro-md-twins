# astro-md-twins

**Every page, twice: HTML for people, Markdown for machines.**

An Astro site where each page also exists as clean Markdown, at the same path
plus `.md` and at the same URL under `Accept: text/markdown`, with the
canonical, `Vary` and `robots` handling that keeps publishing everything twice
from becoming a duplicate-content problem.

```bash
npm install
npm run dev          # http://localhost:4321
npm test             # build, then assert every page has a correct twin
```

```bash
curl https://your-site/about.md                          # the twin
curl -H "Accept: text/markdown" https://your-site/about   # the same bytes, same URL
```

The demo site is its own documentation: the pages explain the technique, and
they are served by it. Append `.md` to any of them to read the same page the
way a crawler does. What is worth copying is `src/lib/`,
`src/pages/[...slug].md.ts`, `worker/index.ts` and the two files that explain
the decisions: this one and [AGENTS.md](./AGENTS.md).

## Why bother

### Machines are a real share of your traffic, and HTML is an expensive way to talk to them

An HTML page is mostly not content. Navigation, footers, consent banners,
analytics, class attributes: all of it is downloaded and parsed to recover the
three paragraphs that mattered.

Cloudflare benchmarked an ordinary blog post in February 2026 at **16,180
tokens as HTML and 3,150 as Markdown**, an 80% reduction. Commerce pages, which
carry more markup per sentence, have been measured at 95%. One analysis put
retrieval accuracy on Markdown at 35% above the same content as HTML, which is
the more interesting number: less markup is not only cheaper, it is less noise
between the model and your sentences.

### They fetch the Markdown when you publish it

This is the part that is usually asserted and rarely measured. Two independent
measurements, both from server logs rather than from a vendor:

**On my own documentation site** (`ai-glot.com/docs`, 19 August to 14 September
2026, Cloudflare-verified bots only, so no spoofed User-Agents), counting only
document requests, HTML pages plus Markdown twins:

| Crawler | Documents fetched | Taken as `.md` | Share |
| :--- | ---: | ---: | ---: |
| GoogleOther | 312 | 146 | **46.8%** |
| GPTBot | 1,134 | 484 | **42.7%** |
| ClaudeBot | 485 | 167 | 34.4% |
| Amazonbot | 1,657 | 276 | 16.7% |
| PetalBot | 8,788 | 1,159 | 13.2% |
| meta-externalagent | 9,013 | 1,025 | 11.4% |

**Independently**, Dries Buytaert published the same split for his own site and
found GPTBot taking 34.8% of its requests as Markdown and OAI-SearchBot 22.7%,
with ClaudeBot far lower at 2.1%.

The numbers differ, the shape does not: for the OpenAI and Google crawlers,
something between a third and a half of what they fetch is the Markdown, as
soon as the Markdown exists. Nobody had to be told about it.

### Two doors, and the crawlers only use one of them

There are two ways to serve Markdown, and they reach different clients.

```text
  WHO IS ASKING                 WHAT THEY SEND            WHAT COMES BACK
  ────────────────────────────────────────────────────────────────────────────
                                GET /about
  a person, in a browser        Accept: text/html    ──▶  about.html
                                                          Link: <about.md>; rel="alternate"
                                                          Vary: Accept

                                GET /about
  a coding agent                Accept: text/markdown ─▶  about.md
  (Claude Code, OpenCode)                                 Content-Type: text/markdown
                                                          Link: <about>; rel="canonical"
                                                          Vary: Accept

                                GET /about.md
  an AI crawler                 (no negotiation)     ──▶  about.md
  (GPTBot, ClaudeBot, ...)                                same headers, no Worker needed
```

The third row is the one that carries the traffic, and it is a plain file on
disk. The second needs a server and reaches assistants rather than crawlers.

| | `<page>.md` | `Accept: text/markdown` |
| :--- | :--- | :--- |
| Who uses it | AI crawlers, in the numbers above | coding agents (Claude Code, OpenCode) |
| How it is found | links, `llms.txt`, `Link` headers | the client just asks |
| Needs a server | no, it is a file | yes, or a CDN feature |

Buytaert's measurement is blunt about the second: *"No AI crawler uses content
negotiation. Not one."* Cloudflare shipped Markdown for Agents as a zone
feature and Read the Docs supports the header, so it works, but the traffic is
from assistants a person is driving, not from crawlers.

**So ship both, and expect the traffic on the file.** A repository that
implements only negotiation has built the elegant half and will see close to
nothing in its logs. This one generates real `.md` files at build time, which
work on any static host, and adds negotiation through an optional Worker.

### What it does not do

Worth knowing before you build it, because most articles on this leave it out.

- **It does not reduce crawl traffic.** Crawlers fetch the twins *in addition
  to* the pages. Buytaert measured about 7% more crawler traffic after adding
  Markdown. If the goal was saving bandwidth, this is the wrong lever.
- **`llms.txt` has no demonstrated effect.** A Search Engine Journal analysis
  of 300,000 domains found no measurable link between having one and being
  cited, no major provider has committed to reading it, and sites that check
  their logs mostly find it fetched by SEO audit tools. This repository ships
  one because it costs a generated file and its links point at the `.md` URLs
  that crawlers do follow. Treat it as a sitemap for agents, not a ranking
  factor.
- **It is not a ranking factor.** Nothing here makes Google rank you higher.
  What it changes is the cost and fidelity of being read by the systems that
  increasingly sit between your page and a reader.
- **Citations are not traffic.** Buytaert's site recorded 1,241 pages crawled
  per citation received. Publishing for machines is publishing, with the
  attribution economics that implies.

### It is not cloaking, and the distinction is precise

Cloaking is serving a crawler different **content** from what a person gets.
Content negotiation is serving the same document in a different **format**,
which HTTP has done since 1997 and for which Markdown has had a registered
media type since RFC 7763 in 2016.

The real risk is duplicate content, and it appears the moment the Markdown gets
its own URL, which it must. The answer is the one search engines documented
twenty years ago: the copy names the original.

```http
Link: <https://example.com/about>; rel="canonical"
```

Every Markdown response here sets that header, and every `.md` file repeats it
in its front matter for the case where the file is saved, piped or passed
between tools and the headers are gone.

## How it works

```
src/
  site.config.ts        identity, agent policy, and what a twin says about itself
  content/pages/*.md    the home and about pages. Markdown, because the twin is the source
  content/blog/*.md     the posts
  lib/markdown.ts       the bytes a twin is made of: front matter plus the authored body
  lib/pages.ts          every page, resolved once, read by every route and the tests
  lib/negotiation.ts    the Accept rules, in a file with no runtime imports so they are testable
  pages/[...slug].md.ts the twins, generated at build time, one file per page
  pages/llms.txt.ts     an index for agents, linking .md
  pages/llms-full.txt.ts  every page in one response
  pages/robots.txt.ts   Allow, plus Content-Signal
  pages/sitemap.xml.ts  HTML pages only, never the twins
worker/index.ts         optional: negotiation, canonical header, discovery headers
scripts/check-twins.mjs runs in CI: every page has a twin, every twin has a canonical
```

One source, two outputs, and no step in which anything is converted back:

```text
  src/content/pages/about.md          authored once, by a person
          │
          │  frontmatter: title, description, updated
          │  body:        the Markdown
          │
          ├──▶ src/pages/[page].astro ────────────▶ dist/about.html
          │      renders the body into a layout       the page a person reads
          │
          └──▶ src/pages/[...slug].md.ts ─────────▶ dist/about.md
                 re-emits the body verbatim,          the page a machine reads
                 adding canonical: to the frontmatter

  Both routes read src/lib/pages.ts, which is also what llms.txt,
  sitemap.xml and scripts/check-twins.mjs read. One list, four consumers.
```

**The twin is the source, not a conversion.** Every page whose words matter is
a Markdown file that the HTML is rendered from. The usual approach, converting
your rendered HTML back to Markdown, works on the day you build it and then
drifts: a component renders something the converter cannot see, a heading moves
into a tab, and the Markdown quietly stops being the page. You find out when a
model quotes you saying something you no longer say.

**One list of pages.** Routes, `llms.txt`, the sitemap and the tests all read
`src/lib/pages.ts`, so a page cannot exist in one and be missing from another.

**The Worker is optional.** Delete `main` and `assets.binding` from
`wrangler.jsonc` and this is a plain static site on any host: you keep the
twins, you lose negotiation and the header-set canonical. Since the twins are
what crawlers actually fetch, that is a smaller loss than it sounds.

## The four things that are easy to get wrong

1. **`Vary: Accept`**, on both branches. One URL with two representations must
   tell caches to key on Accept. Without it a cached HTML response is replayed
   to the next client that asked for Markdown, and the bug only appears under
   load.
2. **`Content-Type: text/markdown; charset=utf-8`.** Some CDNs serve `.md` as
   `application/octet-stream`, which makes browsers download it and some agents
   skip it. `curl -sI https://your-site/about.md` is the check.
3. **The twins stay out of `sitemap.xml`.** A sitemap entry asks for that URL
   to be indexed, which contradicts the canonical on the twin. Contradictory
   signals get resolved by the crawler, not always in your favour.
4. **No `Disallow: /*.md$`.** It is the reflex fix for duplicate content and it
   blocks exactly the traffic this whole design exists to serve. Use the
   canonical. If you cannot set headers on your host, set
   `markdownPolicy: 'noindex'` in `src/site.config.ts` and understand the
   trade-off, which is documented there.

## Measuring your own

The numbers at the top of this file are the reason to build this, and they are
site-specific. Get your own before and after:

- **Cloudflare AI Crawl Control** verifies crawler identity against each
  operator's published IP ranges. Trust it over any User-Agent count.
- **`worker/index.ts` logs one structured line per AI crawler hit**, carrying
  `kind: 'markdown' | 'page' | 'asset'`. That field is the whole measurement:
  without the split you know a crawler came by, not whether it took the
  Markdown. `npx wrangler tail` shows it live.
- Keep the daily series somewhere you own. Most analytics products hold
  path-level detail for days and then aggregate it away, which is exactly the
  resolution this question needs.

## Making it yours

1. Replace `src/content/pages/` and `src/content/blog/` with your content, and
   set your name, description and origin in `src/site.config.ts` and
   `astro.config.ts`. Replacing `src/content/` deletes this template's own
   documentation from your clone, which is intended: the copy that matters
   lives in this README and in AGENTS.md, and both survive.
2. Decide the Markdown policy in `src/site.config.ts`: `canonical` (default) or
   `noindex`.
3. Point the URLs in `SECURITY.md`, `CODE_OF_CONDUCT.md` and
   `.github/ISSUE_TEMPLATE/config.yml` at your repository, or delete those
   files. They name this project's maintainer, who cannot act on anything in
   yours.
4. `npm test`, then deploy. `npm run deploy` publishes to Cloudflare Workers;
   any static host works without the Worker.

## Status and licence

A working example, maintained on a best-effort basis by one person. Not a
published package: fork it, read it, take the parts you want.

MIT. See [LICENSE](./LICENSE), [CONTRIBUTING.md](./CONTRIBUTING.md) and
[SECURITY.md](./SECURITY.md).

## Sources

- [Markdown, llms.txt and AI crawlers](https://dri.es/markdown-llms-txt-and-ai-crawlers), Dries Buytaert: per-crawler Markdown adoption, the "no crawler uses content negotiation" finding, crawl-to-citation ratio.
- [Introducing Markdown for Agents](https://blog.cloudflare.com/markdown-for-agents/), Cloudflare: the token benchmark and the zone-level negotiation feature.
- [Markdown for AI crawlers: content negotiation and token economics](https://www.ekamoira.com/blog/how-to-serve-markdown-to-ai-crawlers-content-negotiation-token-economics-guide): the cloaking distinction, the header checklist, collected benchmarks.
- [RFC 7763](https://www.rfc-editor.org/rfc/rfc7763): the `text/markdown` media type.
- [Markdown for Agents](https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/), Cloudflare docs, and [Markdown for agents](https://docs.readthedocs.com/platform/latest/reference/markdown-for-agents.html), Read the Docs: two production implementations of the `Accept` header.
- My own figures come from the crawl log of `ai-glot.com/docs`, collected daily from Cloudflare's verified-bot data.
