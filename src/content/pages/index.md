---
title: "MD Twins for Astro"
description: "Every page of an Astro site, also served as clean Markdown, with the canonical and cache headers that keep publishing twice from becoming a duplicate-content problem."
nav: 1
navLabel: "Home"
updated: 2026-09-15
---

# Markdown twins for Astro

Every page on this site exists twice. Once as HTML, for you. Once as Markdown,
for whatever machine reads it next.

You are looking at the HTML. The Markdown is at [/index.md](/index.md), and the
same bytes come back from this URL if you ask for them:

```bash
curl -H "Accept: text/markdown" https://example.com/
```

This site is the demo, and it is also the documentation. Everything described
here is running underneath it.

## Why

An HTML page is mostly not content. Navigation, footers, consent banners,
analytics, class attributes on every element: all of it is downloaded and
parsed to recover the paragraphs that mattered. Cloudflare benchmarked an
ordinary blog post at 16,180 tokens as HTML against 3,150 as Markdown.

And the machines take the Markdown when it exists. On one production
documentation site, measured over 27 days against Cloudflare-verified crawlers,
GPTBot took 42.7% of the documents it fetched as `.md`, and GoogleOther 46.8%.
Nobody told them it was there beyond a link and a header.

## What is actually involved

Four things, and only the first is obvious:

1. A `.md` file per page, generated at build time.
2. `Accept: text/markdown` on the page URL returning the same bytes.
3. `Link: <page>; rel="canonical"` on every Markdown response, so a search
   engine reads the copy and credits the page.
4. `Vary: Accept`, so a cache never replays one representation to a client that
   asked for the other.

Skip the third and you have published a competitor to every page you own, on
your own domain. Skip the fourth and it works until it is under load.

## What it does not do

It does not reduce crawler traffic, it is not a ranking factor, and `llms.txt`
has no demonstrated effect on citations. The [writing](/blog) goes through the
evidence for each of those, including the parts that argue against doing this
at all.
