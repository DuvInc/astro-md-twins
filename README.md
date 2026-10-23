# astro-md-twins

![astro-md-twins: a dithered banner with the project name and its one-line summary](docs/hero.png)

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
- Front matter that travels with the file: `canonical`, `language`, and
  absolute links, because a twin is read outside the site.
- A build check. It fails if a page has no twin, a twin has the wrong
  canonical or language, a twin is empty or holds a root-relative link, or a
  twin reached the sitemap. It reads both Astro build shapes and a split
  sitemap.

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

The first is my own documentation site, over four weeks. Only
Cloudflare-verified bots are counted. The share is of documents fetched, so
HTML pages plus Markdown twins.

| Crawler | Fetched as `.md` |
| :--- | ---: |
| GoogleOther | **46.8%** |
| GPTBot | **42.7%** |
| ClaudeBot | 34.4% |
| Amazonbot | 16.7% |
| PetalBot | 13.2% |
| meta-externalagent | 11.4% |

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
  lib/lifecycle.ts      the moved and gone rules, same reason
  lib/links.ts          root-relative links to absolute, same reason
  lib/jsonld.ts         the optional JSON-LD node
  pages/[...slug].md.ts builds one .md file per page
  pages/llms.txt.ts     an index for agents, linking to .md
  pages/llms-full.txt.ts  every page in one response
  pages/robots.txt.ts   Allow, plus Content-Signal
  pages/sitemap.xml.ts  HTML pages only
worker/index.ts         optional: negotiation and headers
scripts/check-twins.mjs runs in CI
recipes/html-twins/     opt-in: twins for pages with no Markdown source
skills/md-twins/        the procedure as a skill
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

## Details that bite

- **`_headers` cannot select `*.md`.** Cloudflare's patterns allow one trailing
  splat, so there is no rule for "every Markdown twin". Anything that has to
  differ per twin (the charset, a canonical that names a different URL for each
  response) needs the Worker. `public/_headers` covers the rest.
- **Non-English twins served without a charset.** The asset layer maps `.md` to
  `text/markdown` with no `charset`. An English twin never shows it. A French,
  German or Portuguese twin does: the client guesses the encoding and the
  accents come out wrong. A production site with five non-English locales shipped
  exactly this.
  The Worker sets `charset=utf-8` on every twin, and the build check cannot see
  it, because a file on disk has no headers. On a host without the Worker, set
  the type per file or check with `curl -sI`.
- **Links are absolute in the twin.** The authored Markdown keeps short links
  (`[pricing](/pricing)`) so the HTML page renders them normally. `toMarkdown`
  rewrites root-relative inline links, images, reference definitions and
  `href`/`src` attributes to absolute URLs when it writes the twin, and leaves
  code blocks and inline code alone. `/pricing` means nothing to a client that
  holds only the file.
- **`language:` in the front matter.** The HTML page says `<html lang>`. A file
  fetched on its own can only say it here. Set `site.language`; the build check
  fails if the two disagree.
- **robots.txt names each AI crawler and repeats the signal.** A crawler that
  matches its own group reads only that group and never falls back to `*`
  (RFC 9309). A `Content-Signal` only in the `*` group is therefore invisible to
  exactly the crawlers it is meant for. The generated file puts the signal in
  the wildcard group and in one shared group listing every named crawler. A
  directive above the first `User-agent` belongs to no group. The policy is the
  `agents.contentSignals` object in `src/site.config.ts`, one line to change.

## Moved and withdrawn pages

The Worker runs first for every document, twins included. So when a page is
renamed, its twin does not follow the host's page redirect: it reaches the
Worker, finds no file, and answers 404. Two maps in `src/site.config.ts`, empty
by default, fix that for the page and its twin together:

```ts
export const moved: Record<string, string> = { '/old-slug': '/new-slug' };
export const gone: string[] = ['/withdrawn'];
```

- `moved`: `301` to the new path. A request for `/old-slug.md` goes to
  `/new-slug.md`.
- `gone`: `410`, for a page whose subject no longer exists. It is checked before
  the canonical is attached, so a withdrawn page's twin says Gone instead of
  claiming a canonical for a URL that is not there. Use a 301 only when the
  content really is somewhere else.

`npm run check:twins` fails when a `moved` or `gone` page is still built, or when
a `moved` target is not a built page.

## Sites with languages

If your site has several languages (for example with
[astro-ai-i18n](https://github.com/DuvInc/astro-ai-i18n)), the twins follow one
rule: **a page that is its own document gets a twin, a page that is a copy does
not.**

| | Translated page | Fallback page (original language, at a locale URL) |
| :--- | :--- | :--- |
| Words | translated | the original's |
| `<link rel="canonical">` | itself | the original |
| `robots` | indexable | `noindex, follow` |
| Own Markdown twin | yes, with `language: fr` | none |
| Twin advertised in the head | its own | the original's |
| `hreflang` | listed | not listed |

A fallback page with its own twin would be a second copy of a copy. Advertising
the original's twin tells an agent where the clean text is without minting a
new URL for it. `check-twins` enforces this from the HTML alone: a page whose
canonical is another page must have no twin, must advertise that page's twin and
must be `noindex`; a page whose canonical is itself must have a twin. It needs no
knowledge of your locales.

## Optional: JSON-LD

Off by default. Set `jsonLd = true` in `src/site.config.ts` and every page that
has a twin gets one `application/ld+json` node (`WebPage`, or `Article` for the
blog) whose `encoding` is a `MediaObject` with `encodingFormat: text/markdown`
and `contentUrl` set to the twin. It is a third place saying the twin exists,
after the `<link rel="alternate">` and the front matter, for a reader that parses
structured data and nothing else.

There is no measured effect. I have no evidence that any crawler or answer
engine reads that `encoding` property or acts on it, and I know of no published
test showing it. It is cheap, valid schema.org, and harmless, which is the whole
argument for it. Leave it off if you would rather not carry markup nobody has
shown to matter.

## Exception: pages with no Markdown source

The rule above is that Markdown is the source and a twin is never scraped from
HTML. Some pages have no Markdown: a home page or a pricing page assembled from
components. For those, and only those, [recipes/html-twins](recipes/html-twins)
is a separate opt-in module that converts the built page's `<main>`. It adds
dependencies, so it is not wired into the template. Read its README first.

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
2. Set `site.language` and choose the Markdown policy in `src/site.config.ts`: `canonical` (default) or
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
