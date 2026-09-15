/**
 * The rules that decide which representation a request gets.
 *
 * In their own file, and free of any runtime import, for one reason: this is
 * the logic that is wrong in most implementations, and it is only testable if
 * it does not need a Worker, a server or a build to run. `worker/index.ts`
 * imports these; so does `test/negotiation.test.mjs`.
 */

/**
 * The quality value an Accept header gives a media type, 0 when absent.
 *
 * Substring-matching `text/markdown` would be wrong in the direction that
 * matters: a client sending `text/html, text/markdown;q=0.1` is saying it
 * would rather have HTML, and a substring match would hand it Markdown. Only
 * the relative q values decide.
 */
export function quality(accept: string, type: string): number {
  for (const entry of accept.split(',')) {
    const [media, ...parameters] = entry.split(';');
    if (media.trim().toLowerCase() !== type) continue;
    const q = parameters.map(p => p.trim()).find(p => p.startsWith('q='));
    if (!q) return 1;
    const value = Number.parseFloat(q.slice(2));
    return Number.isFinite(value) ? value : 0;
  }
  return 0;
}

/**
 * Whether this client would rather have Markdown than HTML.
 *
 * A browser's Accept never names `text/markdown`, so it scores zero and always
 * gets the page. That is the property to preserve above all others: a bug here
 * serves raw Markdown to a person, and it will be reported as "the site is
 * broken", not as "negotiation is misconfigured".
 */
export const prefersMarkdown = (accept: string | null | undefined): boolean =>
  Boolean(accept) && quality(accept!, 'text/markdown') > quality(accept!, 'text/html');

/**
 * A document is a page, as opposed to an asset: no file extension, or the
 * `.md` twin of one.
 */
export const isDocument = (pathname: string): boolean =>
  !/\.[^/]+$/.test(pathname) || pathname.endsWith('.md');

/** `/about` -> `/about.md`, and `/` -> `/index.md`, which is a path that exists. */
export const markdownPathFor = (pathname: string): string =>
  pathname === '/' ? '/index.md' : `${pathname.replace(/\/$/, '')}.md`;

/** The inverse. */
export const pagePathFor = (markdownPath: string): string =>
  markdownPath === '/index.md' ? '/' : markdownPath.slice(0, -'.md'.length);
