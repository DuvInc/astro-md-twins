---
title: "About this project"
description: "An open-source Astro template for Markdown twins: what it ships, what it deliberately leaves out, and what it does not claim."
nav: 2
navLabel: "About"
updated: 2026-09-15
---

# About this project

`astro-md-twins` is an open-source Astro template. It builds a static site
where every page also exists as clean Markdown, and it ships the headers and
policies that make serving both safe rather than costly.

This site is what the template produces, with its own documentation as the
content. So every claim on it can be checked against the page you are reading:
append `.md` to this URL.

## What it ships

- **A Markdown twin per page**, generated at build time, so it works on any
  static host with no runtime.
- **Content negotiation**, through an optional Cloudflare Worker, for clients
  that send `Accept: text/markdown`. Deleting the Worker leaves a plain static
  site and the twins.
- **The canonical, `Vary` and `robots` handling** that keeps one document at two
  URLs from being read as two documents.
- **`llms.txt` and `llms-full.txt`**, whose links point at the `.md` URLs.
- **A build-time check** that fails if a page has no twin, a twin has the wrong
  canonical, a twin reached the sitemap, or a twin came out empty.

## The one design decision

The Markdown is the source. The HTML is rendered from it.

The alternative, converting your own rendered HTML back to Markdown, is what
most implementations do, and it works on the day it is written. Then a
component renders something the converter cannot see, a heading moves inside a
tab, and the Markdown quietly stops being the page. Nothing breaks loudly. You
find out when a model quotes you saying something you no longer say.

## What it does not claim

No ranking benefit. No reduction in crawler traffic, which measurably goes up.
No evidence that `llms.txt` affects whether you are cited. The README states
each of those with its source, and the [writing](/blog) works through them.

The honest summary: this makes your content cheaper and cleaner to read for the
systems that increasingly sit between your page and a reader. Whether that is
worth an afternoon depends on how much of your traffic those systems already
are, which is a question your own logs answer better than anyone's blog post.

## Licence

MIT. The repository is at
[github.com/DuvInc/astro-md-twins](https://github.com/DuvInc/astro-md-twins).
