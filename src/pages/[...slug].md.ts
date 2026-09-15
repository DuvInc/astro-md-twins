import type { APIRoute } from 'astro';

import { getPages, type PageRecord } from '../lib/pages';
import { toMarkdown } from '../lib/markdown';

/**
 * The Markdown twin of every page, at `<page>.md`.
 *
 * This is the route AI crawlers actually use. Content negotiation on the page
 * URL (see worker/index.ts) is the more elegant mechanism and the one coding
 * agents send, but measurements published through 2026 agree that crawlers
 * discover Markdown through `.md` URLs and links, not through `Accept`
 * headers. A site that ships only negotiation is serving a door that the
 * visitors it built it for do not knock on.
 *
 * Generated at build time, one file per page, so this works on any static host
 * with no runtime at all.
 */
export async function getStaticPaths() {
  const pages = await getPages();
  return pages.map(page => ({
    /* `/index.md` for the home page: a bare `/.md` is not a path. Its
       canonical still points at `/`. */
    params: { slug: page.markdownPath.replace(/^\//, '').replace(/\.md$/, '') },
    props: { page },
  }));
}

export const GET: APIRoute = ({ props }) => {
  const { page } = props as { page: PageRecord };

  /*
   * The Content-Type matters, and is the most common thing to get wrong.
   *
   * It applies during `astro dev` and `astro preview`. A static build only
   * writes bytes to disk, so in production the type comes from the host:
   * Cloudflare and Netlify infer `text/markdown` from the `.md` extension,
   * some CDNs send `application/octet-stream`, which makes a browser download
   * the file and some agents skip it. public/_headers and worker/index.ts both
   * pin it; AGENTS.md says how to check.
   */
  return new Response(toMarkdown(page.twin), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      /* The header form of the front matter's `canonical:` key. A crawler
         reads headers; it does not parse YAML. Both are set because the file
         travels: saved to disk, piped into a tool, the header is gone and the
         front matter is all that is left. */
      Link: `<${new URL(page.path, import.meta.env.SITE).href}>; rel="canonical"`,
    },
  });
};
