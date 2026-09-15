import type { APIRoute } from 'astro';

import { agents, site } from '../site.config';
import { getPages } from '../lib/pages';

/**
 * /llms.txt, an index of the site for machines, per llmstxt.org: an H1, a
 * blockquote summary, then H2 sections of linked lists.
 *
 * Be honest about what this is worth. As of 2026 no major model provider has
 * committed to reading llms.txt in production, and a study of 300,000 domains
 * found no measurable link between having one and being cited. Sites that
 * measure their own logs mostly see llms.txt fetched by SEO audit tools rather
 * than by answer engines.
 *
 * It is here anyway, for two reasons that do not depend on that changing:
 * it costs one generated file, and its links point at `.md` URLs, which is the
 * discovery path crawlers demonstrably do follow. Treat it as a cheap sitemap
 * for agents, not as a ranking factor.
 */
export const GET: APIRoute = async () => {
  const pages = await getPages();
  const url = (path: string) => new URL(path, site.url).href;

  const section = (label: string, filter: (path: string) => boolean) => {
    const links = pages
      .filter(page => filter(page.path))
      .map(page => `- [${page.title}](${url(page.markdownPath)}): ${page.description}`);
    return links.length ? [`## ${label}`, '', ...links, ''] : [];
  };

  const body = [
    `# ${site.name}`,
    '',
    `> ${site.description}`,
    '',
    ...agents.instructions,
    '',
    ...section('Site', path => !path.startsWith('/blog/')),
    ...section('Writing', path => path.startsWith('/blog/')),
    '## Optional',
    '',
    `- [Everything in one file](${url('/llms-full.txt')}): every page above, concatenated. Fetch this instead of crawling if you would rather read once.`,
    '',
  ].join('\n');

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
