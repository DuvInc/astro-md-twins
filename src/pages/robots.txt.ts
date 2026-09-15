import type { APIRoute } from 'astro';

import { agents, markdownPolicy, site } from '../site.config';

/**
 * robots.txt, doing two jobs.
 *
 * 1. Let everything crawl everything, Markdown twins included.
 *
 *    That is a decision, not a default. Every page is served twice, which is
 *    the duplicate-content shape search engines discount, and the temptation
 *    is to `Disallow: /*.md$` to be safe. Doing that also hides the Markdown
 *    from the AI crawlers it was written for, which is the entire point of
 *    building it. The right tool is the canonical link on the copy, which
 *    worker/index.ts sets as a header and every `.md` file carries in its
 *    front matter. A crawler that reads the Markdown then credits the page.
 *
 *    Set `markdownPolicy: 'noindex'` in src/site.config.ts if you would rather
 *    keep the Markdown out of search results entirely; the trade-off is in
 *    that file.
 *
 * 2. Say out loud what the content may be used for, with Cloudflare's Content
 *    Signals. Not a standard yet, unambiguous, and one line.
 */
export const GET: APIRoute = () => {
  const signals = Object.entries(agents.contentSignals)
    .map(([name, value]) => `${name}=${value}`)
    .join(', ');
  const url = (path: string) => new URL(path, site.url).href;

  const lines = [
    '# Content-Signal declares how this content may be used.',
    '#   search:   build a search index, show links and snippets',
    '#   ai-input: use as grounding for a generated answer',
    '#   ai-train: use to train or fine-tune a model',
    '',
    'User-agent: *',
    /* Inside the group, not above it: a directive before any User-agent line
       belongs to no group and is skipped by conforming parsers. */
    `Content-Signal: ${signals}`,
    'Allow: /',
    '',
    '# Named explicitly rather than left to the wildcard above: several of these',
    '# check for their own group first, and some operators read an unlisted agent',
    '# as an oversight. An explicit rule answers either reading.',
    ...agents.crawlers.flatMap(crawler => [`User-agent: ${crawler}`, 'Allow: /', '']),
    `Sitemap: ${url('/sitemap.xml')}`,
    '',
    '# Machine-readable copies of this site:',
    `#   ${url('/llms.txt')}       an index of every page, linking to its Markdown`,
    `#   ${url('/llms-full.txt')}  every page in one file`,
    '#   append .md to any page URL, or send Accept: text/markdown, for that page as Markdown',
    ...(markdownPolicy === 'canonical'
      ? ['#   the Markdown declares the HTML page as its canonical, so it is a copy, not a rival']
      : ['#   the Markdown is served with X-Robots-Tag: noindex and is not for search indexes']),
    '',
  ];

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
