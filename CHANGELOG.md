# Changelog

## Unreleased

Brought up to what runs in production, still generic.

- **Twins**: front matter `language:` (from `site.language`, also `<html lang>`).
  Root-relative links in a twin become absolute in `toMarkdown`.
- **Worker**: optional `moved` (301, `.md` kept) and `gone` (410, checked before
  the canonical) maps in `site.config.ts`, applied to the page and its twin.
  Empty by default.
- **robots.txt**: `Content-Signal` is repeated in the group of named AI crawlers
  (one shared group), since a crawler with its own group never reads `*`.
  Added `cohere-ai`.
- **check-twins**: reads `/about.html` and `/about/index.html`, a single or split
  sitemap; checks `language`, root-relative links, and the language rule: a page
  canonical on itself must have a twin, a page canonical on another page (a
  fallback) must have none, advertise the original's twin and be `noindex`.
  Checks `moved`/`gone` entries against the build. Now covered by fixture tests.
- **Optional**: JSON-LD with an `encoding` node (`jsonLd` flag, off, no measured
  effect); `recipes/html-twins` for pages with no Markdown source (extra
  dependencies, not wired in).
- **README**: `_headers` cannot select `*.md`, the missing-charset accent bug,
  moved/gone, sites with languages.
