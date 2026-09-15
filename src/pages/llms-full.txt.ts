import type { APIRoute } from 'astro';

import { site } from '../site.config';
import { getPages } from '../lib/pages';
import { toMarkdown } from '../lib/markdown';

/**
 * /llms-full.txt: every page's Markdown, concatenated, in one request.
 *
 * The argument for it is bandwidth on both sides: a model that wants the whole
 * site makes one request instead of forty, and the site serves one response
 * instead of forty. The argument against is that it goes stale as a unit and
 * can grow past a context window without anyone noticing.
 *
 * The size at which that stops being free is roughly a megabyte. Past it,
 * delete this route and keep llms.txt: an index of `.md` URLs that a crawler
 * can fetch selectively ages better than a single file nothing can page
 * through.
 */
export const GET: APIRoute = async () => {
  const pages = await getPages();

  const body = [
    `# ${site.name}`,
    '',
    `> ${site.description}`,
    '',
    `Every page of ${site.url}, as Markdown, in reading order. Each section keeps`,
    'its own front matter, including the `canonical` URL of the HTML page it came from.',
    '',
    ...pages.flatMap(page => ['<!-- ' + '-'.repeat(68) + ' -->', '', toMarkdown(page.twin), '']),
  ].join('\n');

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
