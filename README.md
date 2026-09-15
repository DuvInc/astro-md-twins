# astro-md-twins

Every page on this site exists twice. Once as HTML, for people. Once as
Markdown, for machines.

This is an Astro template. It builds a static site. For each page it also
builds a Markdown file at the same path plus `.md`. An optional Cloudflare
Worker serves the same Markdown from the page URL when a client sends
`Accept: text/markdown`.

```bash
npm install
npm run dev     # http://localhost:4321
npm test        # build, then check every page has a correct twin
```

Try it on the built site:

```bash
curl https://your-site/about.md                          # the Markdown file
curl -H "Accept: text/markdown" https://your-site/about  # the same bytes
```

The demo site documents the technique. Add `.md` to any page to read it as a
crawler does.

## What you get

- A Markdown file for every page, built at build time. No runtime needed.
- Content negotiation on the page URL, through an optional Worker.
- A canonical link on every Markdown response. Search engines credit the HTML
  page, not the copy.
- `llms.txt` and `llms-full.txt`. Both link to the `.md` files.
- A build check. It fails if a page has no twin, a twin has the wrong
  canonical, a twin is empty, or a twin reached the sitemap.

## Why do this

### HTML is expensive to read

An HTML page contains navigation, footers, banners, scripts and class
attributes. A machine downloads all of it. It needs three paragraphs.

Cloudflare measured one blog post in February 2026. It used 16,180 tokens as
HTML and 3,150 tokens as Markdown. That is 80% less. Commerce pages have been
measured at 95% less. One test found retrieval accuracy 35% higher on Markdown
than on the same content as HTML.

### Crawlers use the Markdown when it exists

Two measurements from server logs, not from vendors.

The first is my own documentation site, `ai-glot.com/docs`. The window is 19
August to 14 September 2026. Only Cloudflare-verified bots are counted, so no
User-Agent is trusted. The table counts document requests only: HTML pages plus
Markdown twins.

| Crawler | Documents fetched | Taken as `.md` | Share |
| :--- | ---: | ---: | ---: |
| GoogleOther | 312 | 146 | **46.8%** |
| GPTBot | 1,134 | 484 | **42.7%** |
| ClaudeBot | 485 | 167 | 34.4% |
| Amazonbot | 1,657 | 276 | 16.7% |
| PetalBot | 8,788 | 1,159 | 13.2% |
| meta-externalagent | 9,013 | 1,025 | 11.4% |

The second is Dries Buytaert's site. He measured GPTBot at 34.8% and
OAI-SearchBot at 22.7%. ClaudeBot was much lower, at 2.1%.

The numbers differ per site. The pattern is the same. The OpenAI and Google
crawlers take the Markdown for a large share of what they fetch. Nobody
configured this. They found the links.

### There are two ways to serve Markdown. Crawlers use one of them

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

| | `<page>.md` | `Accept: text/markdown` |
| :--- | :--- | :--- |
| Who uses it | AI crawlers | coding agents |
| How they find it | links, `llms.txt`, `Link` headers | they ask for it |
| Needs a server | no | yes, or a CDN feature |

Buytaert's report is direct about the second column: *"No AI crawler uses
content negotiation. Not one."* Cloudflare ships negotiation as a zone feature
and Read the Docs supports the header, so it works. The traffic comes from
assistants that a person is using, not from crawlers.

Build both. Expect the traffic on the file. This template writes real `.md`
files at build time, so they work on any static host. The Worker adds
negotiation on top.

### What this does not do

- **It does not reduce crawler traffic.** Crawlers fetch the twins in addition
  to the pages. Buytaert measured about 7% more crawler traffic after adding
  Markdown.
- **`llms.txt` has no proven effect.** Search Engine Journal analysed 300,000
  domains and found no measurable link between having one and being cited. No
  major provider has committed to reading it. Sites that check their logs
  mostly see SEO tools fetch it. This template ships one because it costs one
  generated file, and because its links point at the `.md` URLs that crawlers
  do follow.
- **It is not a ranking factor.** Nothing here makes Google rank you higher.
- **Citations are rare.** Buytaert recorded 1,241 pages crawled for each
  citation received.

### This is not cloaking

Cloaking means serving a crawler different content from what a person gets.
Content negotiation means serving the same content in a different format. HTTP
has done this since 1997. Markdown has had a registered media type since RFC
7763 in 2016.

The real risk is duplicate content. It appears when the Markdown gets its own
URL, which it must. The fix is standard: the copy names the original.

```http
Link: <https://example.com/about>; rel="canonical"
```

Every Markdown response sets this header. Every `.md` file repeats it in its
front matter, for the case where the file is saved or piped somewhere and the
headers are lost.

## How it works

```
src/
  site.config.ts        name, origin, crawler policy, Markdown policy
  content/pages/*.md    the home and about pages
  content/blog/*.md     the posts
  lib/markdown.ts       builds a twin: front matter plus the authored body
  lib/pages.ts          the list of pages. Every route and test reads it
  lib/negotiation.ts    the Accept rules. No runtime imports, so they are testable
  pages/[...slug].md.ts builds one .md file per page
  pages/llms.txt.ts     an index for agents, linking to .md
  pages/llms-full.txt.ts  every page in one response
  pages/robots.txt.ts   Allow, plus Content-Signal
  pages/sitemap.xml.ts  HTML pages only
worker/index.ts         optional: negotiation and headers
scripts/check-twins.mjs runs in CI
skills/md-twins/        the procedure as a skill, symlinked into .claude/skills/
```

The Markdown is the source. The HTML is rendered from it.

```text
  src/content/pages/about.md          written once, by a person
          │
          │  frontmatter: title, description, updated
          │  body:        the Markdown
          │
          ├──▶ src/pages/[page].astro ────────────▶ dist/about.html
          │      renders the body into a layout       what a person reads
          │
          └──▶ src/pages/[...slug].md.ts ─────────▶ dist/about.md
                 copies the body unchanged,           what a machine reads
                 adds canonical: to the front matter

  Both routes read src/lib/pages.ts. So do llms.txt, sitemap.xml
  and scripts/check-twins.mjs. One list, four consumers.
```

Most sites do the opposite. They convert their rendered HTML back to Markdown.
That works on the first day. Then a component renders something the converter
cannot read. A heading moves into a tab. The Markdown stops matching the page,
and nothing reports it.

The Worker is optional. Remove `main` and `assets.binding` from
`wrangler.jsonc` and this is a plain static site. You keep the twins. You lose
negotiation and the canonical header.

## Four rules you must not break

1. **Set `Vary: Accept` on both branches.** One URL returns two
   representations. Caches must key on `Accept`. Without this header, a cached
   HTML response is served to a client that asked for Markdown. The bug only
   appears under load.
2. **Set `Content-Type: text/markdown; charset=utf-8`.** Some CDNs serve `.md`
   as `application/octet-stream`. Browsers then download the file, and some
   agents skip it. Check with `curl -sI https://your-site/about.md`.
3. **Keep the twins out of `sitemap.xml`.** A sitemap entry asks for that URL
   to be indexed. The canonical on the twin says the opposite. The crawler
   resolves the conflict, and not always in your favour.
4. **Do not add `Disallow: /*.md$`.** It is the usual fix for duplicate
   content. It also blocks the crawlers this template is built for. Use the
   canonical instead. If your host cannot set headers, set
   `markdownPolicy: 'noindex'` in `src/site.config.ts` and read the trade-off
   documented there.

## Deploying

The build is static. Any host that serves files works. Hosts differ in how much
of the machine-facing half survives.

**Cloudflare Workers** needs no extra configuration:

```bash
npm run deploy      # builds, then wrangler deploy
```

`wrangler.jsonc` serves `dist/` through the assets binding, with
`run_worker_first`. The Worker then adds negotiation, the canonical header and
the discovery headers. Cloudflare also provides AI Crawl Control, which reports
verified crawler traffic.

**Other hosts** work too. Deploy `dist/` to Netlify, Vercel, GitHub Pages, S3
or your own nginx. You keep the twins, `llms.txt`, `llms-full.txt`,
`robots.txt` and the `<link rel="alternate">` tag in every page.

| | With the Worker | Static host only |
| :--- | :--- | :--- |
| `<page>.md` | yes | yes |
| `Accept: text/markdown` | yes | no |
| `Link: rel="canonical"` on Markdown | yes | front matter only |
| `Vary: Accept` | yes | not needed |
| `Content-Type: text/markdown` | set by the Worker | set by the host |

Netlify reads `public/_headers`, so it can set most of this itself. If your
host cannot set headers on `.md` files, set `markdownPolicy: 'noindex'` in
`src/site.config.ts`.

## Measure your own site

The numbers above are specific to one site. Measure yours before and after.

- **Cloudflare AI Crawl Control** verifies crawler identity against each
  operator's published IP ranges. Trust it over User-Agent counts.
- **The Worker logs one line per AI crawler request.** Each line carries
  `kind: 'markdown' | 'page' | 'asset'`. That field is the measurement. Without
  it you know a crawler arrived. You do not know what it took. Run
  `npx wrangler tail` to watch it.
- **Store the daily counts yourself.** Most analytics products keep path-level
  detail for a few days, then aggregate it away.

## Make it yours

1. Replace `src/content/pages/` and `src/content/blog/` with your content. Set
   your name, description and origin in `src/site.config.ts` and
   `astro.config.ts`.
2. Choose the Markdown policy in `src/site.config.ts`: `canonical` (default) or
   `noindex`.
3. Update the URLs in `SECURITY.md`, `CODE_OF_CONDUCT.md` and
   `.github/ISSUE_TEMPLATE/config.yml`, or delete those files. They point at
   this project's maintainer.
4. Run `npm test`, then deploy.

## Status and licence

A working example. One person maintains it, on a best-effort basis. It is not a
published package. Fork it and take what you need.

MIT. See [LICENSE](./LICENSE), [CONTRIBUTING.md](./CONTRIBUTING.md) and
[SECURITY.md](./SECURITY.md).

[AGENTS.md](./AGENTS.md) is the manual for an AI agent working in this
repository. `CLAUDE.md` is a symlink to it.

## Sources

- [Markdown, llms.txt and AI crawlers](https://dri.es/markdown-llms-txt-and-ai-crawlers), Dries Buytaert. Per-crawler adoption, the content negotiation finding, the crawl-to-citation ratio.
- [Introducing Markdown for Agents](https://blog.cloudflare.com/markdown-for-agents/), Cloudflare. The token benchmark and the zone feature.
- [Markdown for AI crawlers: content negotiation and token economics](https://www.ekamoira.com/blog/how-to-serve-markdown-to-ai-crawlers-content-negotiation-token-economics-guide). The cloaking distinction and the header checklist.
- [RFC 7763](https://www.rfc-editor.org/rfc/rfc7763). The `text/markdown` media type.
- [Markdown for Agents](https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/), Cloudflare docs, and [Markdown for agents](https://docs.readthedocs.com/platform/latest/reference/markdown-for-agents.html), Read the Docs. Two production implementations.
- My own figures come from the crawl log of `ai-glot.com/docs`, collected daily from Cloudflare's verified-bot data.
