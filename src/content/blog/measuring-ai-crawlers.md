---
title: "Measure the machines before you redesign for them"
description: "Most advice about AI crawlers is inherited. Your own logs are specific, cheap, and usually disagree with at least one thing you believed."
date: 2026-08-20
---

Nearly every decision about publishing for machines is made on inherited
opinion: a conference talk, a vendor page, a thread. The evidence is sitting in
your access logs and almost nobody reads it.

## The one field that matters

Count requests by crawler, and split them by what kind of thing was fetched:
a page, a Markdown twin, an asset, a feed.

That second dimension is what turns a number into a decision. "GPTBot made 400
requests" tells you nothing you can act on. "GPTBot made 400 requests and 170 of
them were `.md`" tells you the twins are being used, by whom, and roughly how
much of your crawl budget they are absorbing.

Without the split you cannot answer the only question worth asking: did
publishing the second format change anything?

## Verify, do not trust the User-Agent

A User-Agent string is a claim. Anything can send `GPTBot` and plenty of things
do, which is why raw log counts overstate the polite crawlers and hide the
impolite ones.

Cloudflare, Akamai and Fastly all verify crawler identity by matching the
source IP against the operator's published ranges. Use whichever your CDN
offers and treat the verified number as the real one. A regex over User-Agents
is a floor, not a measurement, and it is worth saying so in the report.

## What to expect

Two things surprise people, in opposite directions.

Adding Markdown does not reduce crawl traffic. Crawlers fetch the new URLs
**as well as** the pages, at least at first, so total requests go up. If you
were hoping to save bandwidth, that is not the trade you are making.

And adoption is wildly uneven between crawlers. Some take Markdown for a large
share of what they fetch; others have never requested a `.md` file from us and
probably never will. Averages across crawlers are useless here. Read the split.

## Keep the series

Whatever you measure, keep it. Most analytics products hold path-level detail
for days and then aggregate it away, which is exactly the resolution this
question needs. A nightly job that appends yesterday's counts to a table you
own costs almost nothing and is the only way to answer "what changed after we
shipped it" six months later.
