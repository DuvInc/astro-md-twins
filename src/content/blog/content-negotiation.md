---
title: "Content negotiation is not cloaking"
description: "Serving Markdown to a client that asked for Markdown is a 1997 web standard, not a trick. The distinction is worth being precise about."
date: 2026-07-03
---

Every time serving Markdown to machines comes up, someone says the word
cloaking, and the conversation stops. It is worth being precise, because the
objection is right about one thing and wrong about the general case.

## What cloaking is

Cloaking is showing a crawler different **content** from what a person gets:
keyword-stuffed text for the robot, a sales page for the human. Search engines
have penalised it since the early 2000s, and they should.

The test is whether the substance differs. Not the bytes, the substance.

## What content negotiation is

Content negotiation is HTTP asking the client what **format** it would like,
and serving the same document in it. It is specified in HTTP/1.1, it is how
browsers have been getting the right image format for twenty years, and the
Markdown media type has been registered since RFC 7763 in 2016.

```bash
curl -H "Accept: text/markdown" https://example.com/pricing
```

Same URL, same words, one without markup. Nobody is being told a different
story.

## Where the real risk is

The risk is not cloaking. It is duplicate content, and it only appears when the
Markdown lives at its own URL, which it does as soon as you also publish
`/pricing.md`, which you should, because that is the URL crawlers actually
fetch.

Two URLs serving one document is exactly what `rel="canonical"` exists for.
Set it as a header on the Markdown response, keep the twins out of your
sitemap, and the arrangement is explicit in every direction a crawler can look.

## The practical shape

Ship both doors:

1. `/pricing.md`, a real file, because that is what crawlers follow.
2. `Accept: text/markdown` on `/pricing`, because that is what coding agents
   send when a person points one at your site.

Then add `Vary: Accept` so a cache does not hand the HTML response to the next
client that asked for Markdown. That one line is the bug everybody ships once.
