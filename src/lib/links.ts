/* No imports, so `test/links.test.mjs` can run it without a build. */

/**
 * Root-relative links become absolute.
 *
 * A twin is read outside the site: saved to disk, pasted into a prompt,
 * fetched by an agent that holds nothing but the file. There `/pricing` means
 * nothing, and the reader cannot tell which site it was relative to. Inline
 * links and images, reference definitions and raw `href`/`src` attributes are
 * rewritten; protocol-relative (`//cdn`), `#fragment`, relative (`./x`) and
 * already-absolute links are left alone, and so are fenced code blocks and
 * inline code, where `/pricing` is an example and not a link.
 *
 * This runs on the body at serialization time, so the authored Markdown in the
 * repository keeps its short links and the same source still renders in the
 * HTML page.
 */
export function absoluteLinks(body: string, origin: string): string {
  const abs = (href: string) => new URL(href, origin).href;
  const rewrite = (text: string) =>
    text
      .replace(/(\]\()(\/(?!\/)[^)\s]*)/g, (_, open, href) => open + abs(href))
      .replace(/^(\s{0,3}\[[^\]]+\]:\s+)(\/(?!\/)\S*)/gm, (_, open, href) => open + abs(href))
      .replace(/(\b(?:href|src)=["'])(\/(?!\/)[^"']*)/g, (_, open, href) => open + abs(href));

  let fence: string | null = null;
  return body
    .split('\n')
    .map(line => {
      const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/)?.[1];
      if (marker) {
        if (!fence) fence = marker[0];
        else if (marker[0] === fence) fence = null;
        return line;
      }
      if (fence) return line;
      /* Inline code spans are kept verbatim: split on them, rewrite the rest. */
      return line
        .split(/(`[^`]*`)/)
        .map((part, index) => (index % 2 ? part : rewrite(part)))
        .join('');
    })
    .join('\n');
}
