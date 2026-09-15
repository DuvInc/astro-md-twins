import { getCollection, type CollectionEntry } from 'astro:content';

import { twinFromEntry, type TwinSource } from './markdown';
import { markdownPathFor, pagePathFor } from './negotiation';

export { markdownPathFor, pagePathFor };

/**
 * Every page this site publishes, resolved once.
 *
 * The routes, llms.txt, llms-full.txt, the sitemap and the test suite all read
 * this list. That is the point: "which pages exist" is answered in one place,
 * so a page cannot be in the sitemap and missing from llms.txt, or have an
 * HTML route and no Markdown twin. Those two bugs are invisible to a person
 * browsing the site and obvious to the machine reading it.
 */

export interface PageRecord {
  /** The HTML path: `/`, `/about`, `/blog`, `/blog/a-post`. */
  path: string;
  /** Where the Markdown twin is served. `/` twins at `/index.md`. */
  markdownPath: string;
  title: string;
  description: string;
  /** For the sitemap and the updates feed. */
  date?: Date;
  section: 'site' | 'blog';
  twin: TwinSource;
}

const pathForPage = (entry: CollectionEntry<'pages'>) =>
  entry.id === 'index' ? '/' : `/${entry.id}`;

export async function getBlogPosts(): Promise<CollectionEntry<'blog'>[]> {
  const posts = await getCollection('blog');
  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export async function getPages(): Promise<PageRecord[]> {
  const [staticPages, posts] = await Promise.all([getCollection('pages'), getBlogPosts()]);

  const records: PageRecord[] = [];

  for (const entry of staticPages.sort((a, b) => (a.data.nav ?? 99) - (b.data.nav ?? 99))) {
    const path = pathForPage(entry);
    records.push({
      path,
      markdownPath: markdownPathFor(path),
      title: entry.data.title,
      description: entry.data.description,
      date: entry.data.updated,
      section: 'site',
      twin: twinFromEntry(entry, path),
    });
  }

  /*
   * The blog index, which has no Markdown file behind it.
   *
   * Every real site has pages like this: a listing, a search page, a
   * dashboard. They still deserve a twin, because an agent that fetches
   * `/blog.md` and gets a 404 concludes the section is empty rather than that
   * this one page is special. So the twin is GENERATED from the same data the
   * HTML listing renders, in the same function, rather than scraped back out
   * of the rendered page.
   */
  records.push({
    path: '/blog',
    markdownPath: '/blog.md',
    title: 'Writing',
    description: 'Notes on publishing for readers who are not people.',
    section: 'site',
    twin: {
      path: '/blog',
      title: 'Writing',
      description: 'Notes on publishing for readers who are not people.',
      body: [
        'Every entry below is available as Markdown at the same URL plus `.md`.',
        '',
        ...posts.map(
          post =>
            `- [${post.data.title}](/blog/${post.id}.md) (${post.data.date.toISOString().slice(0, 10)}): ${post.data.description}`,
        ),
      ].join('\n'),
    },
  });

  for (const post of posts) {
    const path = `/blog/${post.id}`;
    records.push({
      path,
      markdownPath: markdownPathFor(path),
      title: post.data.title,
      description: post.data.description,
      date: post.data.date,
      section: 'blog',
      twin: twinFromEntry(post, path),
    });
  }

  return records;
}
