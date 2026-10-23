/**
 * Which pages have a generated twin. One list, read by two halves.
 *
 * The layout advertises a twin in the head for exactly these paths, and the
 * integration (html-twins.ts) writes exactly the twins the layouts advertise.
 * Both read this predicate, so the head can never point at a file the build
 * forgot to write, and the build never writes a file nothing points at. Edit
 * the list to match your site; this one is an example shape.
 *
 * Copy to `src/lib/twin-pages.ts`. No imports on purpose.
 */
export function hasHtmlTwin(path: string): boolean {
  const p = path.replace(/\/$/, '') || '/';
  return (
    p === '/' ||
    p === '/pricing' ||
    /^\/features\/[^/]+$/.test(p)
  );
}
