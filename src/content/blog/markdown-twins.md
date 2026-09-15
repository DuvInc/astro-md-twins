---
title: "Give every page a Markdown twin"
description: "The same content, at the same path plus .md, is the cheapest thing you can do for the machines reading your site."
date: 2026-06-12
---

A Markdown twin is the same page, at the same URL with `.md` appended, served
as plain Markdown instead of HTML. `/pricing` and `/pricing.md`. Same words,
one without the furniture.

It takes an afternoon to add and it changes what a machine has to do to read
you.

## What the machine is doing now

An HTML page is mostly not content. Navigation, footers, cookie notices,
analytics snippets, the class attributes on every element: all of it arrives,
all of it has to be parsed, and none of it is what the reader wanted.

Cloudflare benchmarked this in early 2026 on an ordinary blog post: about
16,000 tokens as HTML, about 3,000 as Markdown. Commerce pages, which carry
more markup per sentence, do worse still.

That ratio is the whole argument. You are not making your content better by
publishing Markdown. You are making it four to twenty times cheaper to read,
for a reader that pays per token and decides what to retrieve accordingly.

## Why the twin rather than a conversion

Most sites that ship Markdown for machines generate it by converting their own
rendered HTML back into Markdown. It works on the day you build it.

Then a component renders something the converter cannot see. A heading moves
inside a tab. A callout becomes a React island. Nothing breaks loudly, and the
Markdown slowly stops being the page. You find out when a model quotes you
saying something you stopped saying a year ago.

The alternative is to make the Markdown the source and render the HTML from it.
Then the twin is not a conversion, it is the original, and the drift has nowhere
to happen.

## The part people skip

Publishing every page twice is the shape search engines have discounted since
the beginning: two URLs, one document. The fix is old and boring. The copy
declares the original:

```http
Link: <https://example.com/pricing>; rel="canonical"
```

Set that on every Markdown response and a crawler that reads the twin credits
the page. Skip it and you have built a competitor to yourself, on your own
domain, in bulk.
