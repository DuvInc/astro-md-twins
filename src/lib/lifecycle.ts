/**
 * Moved and withdrawn pages, decided without a runtime.
 *
 * In their own file for the reason `negotiation.ts` is: the Worker needs this
 * on every document request, and a rule that needs a Worker to run is a rule
 * nobody tests.
 */

export type Lifecycle =
  | { status: 410 }
  | { status: 301; location: string };

/** `/old.md`, `/old/` and `/old` are one page: strip the twin suffix and the trailing slash. */
export const pageKey = (pathname: string): string =>
  pathname === '/index.md' ? '/' : pathname.replace(/\.md$/, '').replace(/\/$/, '') || '/';

/**
 * What a request for a page or its twin should answer instead of the file, or
 * null when the page is live.
 *
 * `gone` wins over `moved` when a path is in both: withdrawn is the stronger
 * statement. The 301 keeps the `.md` the request came with, so a client that
 * asked for the twin of a renamed page lands on the twin of the new one.
 */
export function lifecycleFor(
  pathname: string,
  moved: Record<string, string>,
  gone: Iterable<string>,
): Lifecycle | null {
  const key = pageKey(pathname);
  if (new Set(gone).has(key)) return { status: 410 };
  const target = Object.hasOwn(moved, key) ? moved[key] : undefined;
  if (target) {
    const asTwin = pathname.endsWith('.md');
    return { status: 301, location: asTwin ? (target === '/' ? '/index.md' : `${target}.md`) : target };
  }
  return null;
}
