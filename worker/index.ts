import { markdownPolicy } from '../src/site.config';
import {
  isDocument,
  markdownPathFor,
  pagePathFor,
  prefersMarkdown,
} from '../src/lib/negotiation';

/**
 * The edge Worker in front of the static build. Optional, and small on purpose.
 *
 * The site is a static build and stays one: every byte served comes out of
 * `dist` through the ASSETS binding, including every Markdown twin, which was
 * written to disk at build time. What this adds is the three things a file on
 * disk cannot do:
 *
 *   1. CONTENT NEGOTIATION. `Accept: text/markdown` on an ordinary page URL
 *      returns that page's Markdown. Coding agents send this (Claude Code and
 *      OpenCode both do); crawlers, as of 2026, do not. So this is the surface
 *      for assistants a person is driving, and `<page>.md` remains the one
 *      crawlers use. Ship both, expect traffic on the second.
 *
 *   2. THE CANONICAL HEADER. Every Markdown response says
 *      `Link: <page>; rel="canonical"`. This is the header form of the
 *      `canonical:` key in the file's own front matter, and it is what a
 *      search crawler reads. Without it, publishing every page twice is the
 *      textbook duplicate-content mistake.
 *
 *   3. DISCOVERY HEADERS. A page announces its Markdown twin and the site's
 *      llms.txt in `Link` headers, so a client that issues a HEAD finds both
 *      without parsing HTML.
 *
 * Deleting this Worker is supported: drop `main` and `assets.binding` from
 * wrangler.jsonc and the site serves as pure static assets. You keep the `.md`
 * twins and lose negotiation and the headers. Since the twins are what
 * crawlers actually fetch, that is a smaller loss than it sounds, and it is
 * what makes this repository useful on Netlify, Vercel, S3 or a plain nginx.
 */

/*
 * Typed by hand rather than by `wrangler types`, so `astro check` passes on a
 * fresh clone with no generated file and no @cloudflare/workers-types
 * dependency. One binding, one method, and this is all of it either would give
 * us. Run `npx wrangler types` if you add bindings and want the full set.
 */
interface Env {
  ASSETS: { fetch(request: Request | URL): Promise<Response> };
}

const LLMS_TXT = '/llms.txt';

/**
 * Crawlers worth counting in the logs.
 *
 * A User-Agent regex is the portable floor, and it is not proof: a client can
 * claim any name it likes. Cloudflare's AI Crawl Control verifies the source
 * IP against each operator's published ranges and is what you should read for
 * real numbers, but it is a zone feature and reports nothing for a
 * workers.dev hostname. One structured log line per hit is what works
 * everywhere, and `wrangler tail` shows it immediately.
 */
const AI_CRAWLERS =
  /(GPTBot|OAI-SearchBot|ChatGPT-User|ClaudeBot|Claude-User|Claude-SearchBot|PerplexityBot|Perplexity-User|Google-Extended|GoogleOther|Applebot-Extended|meta-externalagent|Amazonbot|CCBot|Bytespider)/i;

/*
 * `prefersMarkdown`, `isDocument`, `markdownPathFor` and `pagePathFor` live in
 * src/lib/negotiation.ts rather than here. They are the rules most likely to
 * be subtly wrong, the build-time routes need the same path arithmetic, and a
 * function that needs a Worker to run is a function nobody unit-tests.
 */

/**
 * Re-emit a response with the discovery headers attached.
 *
 * A response from the ASSETS binding has immutable headers, so it is rebuilt
 * rather than mutated. `Link` is appended rather than set: each relation is an
 * independent statement about the same resource and gets its own line.
 */
function annotate(
  response: Response,
  { origin, pagePath, asMarkdown }: { origin: string; pagePath: string; asMarkdown: boolean },
): Response {
  const headers = new Headers(response.headers);
  const absolute = (path: string) => new URL(path, origin).href;

  headers.append('Link', `<${absolute(LLMS_TXT)}>; rel="llms-txt"`);
  headers.append(
    'Link',
    `<${absolute(markdownPathFor(pagePath))}>; rel="alternate"; type="text/markdown"`,
  );

  if (asMarkdown) {
    headers.set('Content-Type', 'text/markdown; charset=utf-8');

    if (markdownPolicy === 'canonical') {
      /* The copy names the original. This is what lets a search crawler read
         the Markdown without counting it against the page. */
      headers.append('Link', `<${absolute(pagePath)}>; rel="canonical"`);
    } else {
      /* The other defensible policy: keep the Markdown out of search indexes
         entirely. Safer against duplicate content, worse for AI search, since
         an engine told not to index a URL may also decline to retrieve it. */
      headers.set('X-Robots-Tag', 'noindex');
    }
  }

  /*
   * The page URL can answer with either representation, so caches must key on
   * the request's Accept. Set on both branches, not just the Markdown one: a
   * cached HTML response without it would be replayed to the next client that
   * asked for Markdown, and the bug only shows up under load.
   */
  headers.append('Vary', 'Accept');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    const agent = request.headers.get('user-agent') ?? '';
    const crawler = agent.match(AI_CRAWLERS)?.[1];
    if (crawler) {
      /* `kind` is the field worth having: it is what turns "GPTBot came by
         200 times" into "GPTBot took the Markdown 4 times out of 10", which is
         the only number that tells you whether any of this is working. */
      console.log(
        JSON.stringify({
          event: 'ai-crawler',
          crawler,
          path,
          kind: path.endsWith('.md') ? 'markdown' : isDocument(path) ? 'page' : 'asset',
        }),
      );
    }

    if (!isDocument(path)) return env.ASSETS.fetch(request);

    /* The `.md` URL, which is the path crawlers use. */
    if (path.endsWith('.md')) {
      const response = await env.ASSETS.fetch(request);
      if (!response.ok) return response;
      return annotate(response, { origin: url.origin, pagePath: pagePathFor(path), asMarkdown: true });
    }

    /* The negotiated page URL, which is the path coding agents use. */
    if (prefersMarkdown(request.headers.get('accept'))) {
      const markdown = await env.ASSETS.fetch(new URL(markdownPathFor(path), url.origin));
      /* A page with no twin falls through to HTML rather than answering 404 to
         a request the site can satisfy in the other format. */
      if (markdown.ok) {
        return annotate(markdown, { origin: url.origin, pagePath: path, asMarkdown: true });
      }
    }

    const response = await env.ASSETS.fetch(request);
    /* Only a page that exists has a twin to advertise. */
    if (response.status !== 200) return response;
    return annotate(response, { origin: url.origin, pagePath: path, asMarkdown: false });
  },
};
