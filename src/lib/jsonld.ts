/**
 * Optional structured data: a minimal schema.org node per page, with an
 * `encoding` that points at the Markdown twin.
 *
 * Behind `jsonLd` in site.config.ts, off by default. It is a third place that
 * says the twin exists, after the `<link rel="alternate">` and the twin's own
 * `canonical:` line, for a reader that parses JSON-LD and nothing else. Nothing
 * here has a measured effect; the README says so. No imports, so it is testable
 * without a build.
 */

export interface JsonLdInput {
  /** `Article` for a post, `WebPage` for everything else. */
  kind: 'WebPage' | 'Article';
  title: string;
  description: string;
  /** Absolute URL of the HTML page. */
  url: string;
  /** Absolute URL of its twin. */
  twin: string;
  language: string;
  datePublished?: Date;
  dateModified?: Date;
  author?: string;
}

const day = (date: Date) => date.toISOString().slice(0, 10);

export function jsonLdFor(input: JsonLdInput): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': input.kind,
    name: input.title,
    headline: input.kind === 'Article' ? input.title : undefined,
    description: input.description,
    url: input.url,
    inLanguage: input.language,
    ...(input.datePublished ? { datePublished: day(input.datePublished) } : {}),
    ...(input.dateModified ? { dateModified: day(input.dateModified) } : {}),
    ...(input.author ? { author: { '@type': 'Person', name: input.author } } : {}),
    encoding: {
      '@type': 'MediaObject',
      encodingFormat: 'text/markdown',
      contentUrl: input.twin,
    },
  };
}

/** Safe inside a `<script>`: `</script>` and `<!--` cannot appear in the output. */
export const serializeJsonLd = (node: Record<string, unknown>): string =>
  JSON.stringify(node).replace(/</g, '\\u003c');
