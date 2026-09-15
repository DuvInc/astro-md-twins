import type { APIRoute } from 'astro';

import { site } from '../site.config';
import { getPages } from '../lib/pages';

/**
 * The sitemap lists HTML pages only.
 *
 * Listing the `.md` twins here would be the single fastest way to turn this
 * design into the duplicate-content problem it is built to avoid: a sitemap
 * entry is a request to index that exact URL, which is the opposite of what
 * the canonical on the twin says. The two signals would contradict each other,
 * and a crawler resolving the contradiction may pick the wrong winner.
 *
 * The twins are discovered instead through the `.md` links in llms.txt, the
 * `<link rel="alternate">` in each page's head, and the `Link` header. All
 * three are invitations to fetch; none of them ask for indexing.
 */
export const GET: APIRoute = async () => {
  const pages = await getPages();

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...pages.map(page =>
      [
        '  <url>',
        `    <loc>${new URL(page.path, site.url).href}</loc>`,
        ...(page.date ? [`    <lastmod>${page.date.toISOString().slice(0, 10)}</lastmod>`] : []),
        '  </url>',
      ].join('\n'),
    ),
    '</urlset>',
    '',
  ].join('\n');

  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
