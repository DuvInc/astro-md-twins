import type { CollectionEntry } from 'astro:content';

import { markdownPolicy, site } from '../site.config';

/**
 * The bytes a Markdown twin is made of.
 *
 * One function, called from three places: the `.md` route, `llms-full.txt`,
 * and the test suite. A second implementation of "what does the Markdown for
 * this page look like" is how a site ends up publishing two different answers
 * to the same question.
 */

export interface TwinSource {
  /** The HTML page this is the Markdown of, as a path: `/about`, `/blog/x`. */
  path: string;
  title: string;
  description: string;
  /** The Markdown body, exactly as authored. */
  body: string;
  date?: Date;
  updated?: Date;
  author?: string;
}

const iso = (date: Date) => date.toISOString().slice(0, 10);

/**
 * YAML front matter, then the body.
 *
 * The front matter is not decoration. `canonical` is the machine-readable way
 * to say "this file is a copy, that URL is the page", and it is the half of
 * the duplicate-content answer that survives when the file is fetched from a
 * host that cannot set headers, saved to disk, or passed between tools. The
 * Worker sets the same statement as a `Link: <page>; rel="canonical"` header,
 * because a crawler reads headers and does not parse YAML.
 *
 * Quoting is deliberate and minimal: values are wrapped in double quotes with
 * inner quotes escaped, which is valid YAML for every title a person is likely
 * to write and does not pull in a YAML serializer for four keys.
 */
export function toMarkdown(source: TwinSource): string {
  const canonical = new URL(source.path, site.url).href;
  const quote = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

  const front = [
    '---',
    `title: ${quote(source.title)}`,
    `description: ${quote(source.description)}`,
    /* Named `canonical` rather than `url`: it is the same claim an HTML page
       makes with <link rel="canonical">, and naming it the same thing means a
       reader does not have to be told what it is. */
    `canonical: ${canonical}`,
    ...(source.author ? [`author: ${quote(source.author)}`] : []),
    ...(source.date ? [`date: ${iso(source.date)}`] : []),
    ...(source.updated ? [`updated: ${iso(source.updated)}`] : []),
    ...(markdownPolicy === 'noindex' ? ['robots: noindex'] : []),
    '---',
    '',
    '',
  ].join('\n');

  /* One trailing newline, always. A file that ends mid-line concatenates badly
     into llms-full.txt, which is the one place these bodies meet each other. */
  return `${front}${source.body.trim()}\n`;
}

/** A content entry, as the twin sees it. */
export function twinFromEntry(
  entry: CollectionEntry<'pages'> | CollectionEntry<'blog'>,
  path: string,
): TwinSource {
  const data = entry.data as CollectionEntry<'blog'>['data'] & CollectionEntry<'pages'>['data'];
  return {
    path,
    title: data.title,
    description: data.description,
    /* `entry.body` is the raw Markdown as authored, before Astro renders it.
       That is the whole trick: no HTML is produced, parsed or reversed. */
    body: entry.body ?? '',
    date: data.date,
    updated: data.updated,
    author: data.author,
  };
}
