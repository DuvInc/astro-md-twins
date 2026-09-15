import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Content first, and that is the load-bearing decision of this repository.
 *
 * Every page whose words matter is a Markdown file. The HTML page is rendered
 * from it, and the Markdown twin at `<page>.md` is that same file served back.
 * So the twin is the SOURCE, not a conversion of the HTML.
 *
 * The alternative, scraping your own rendered HTML back into Markdown, is what
 * most sites reach for, and it has one failure mode that never stops: the two
 * drift. A component renders something the scraper cannot see, a heading moves
 * inside a tab, and the Markdown quietly stops being the page. Since the
 * Markdown is what an AI answer is grounded in, you find out when a model
 * quotes something your site no longer says.
 */
const shared = {
  title: z.string(),
  /* Also the meta description and the `>` summary line in llms.txt, so it has
     to read as a sentence rather than a keyword list. */
  description: z.string(),
  updated: z.coerce.date().optional(),
};

const pages = defineCollection({
  loader: glob({ base: './src/content/pages', pattern: '*.md' }),
  schema: z.object({
    ...shared,
    /* Position in the navbar. Absent means the page is reachable but not
       listed, which is the right default for a legal page. */
    nav: z.number().optional(),
    navLabel: z.string().optional(),
  }),
});

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '*.md' }),
  schema: z.object({
    ...shared,
    date: z.coerce.date(),
    /* Optional: this site's own pages are project documentation and carry no
       byline. A real blog sets it, and `src/lib/markdown.ts` carries it into
       the twin's front matter when it is there. */
    author: z.string().optional(),
  }),
});

export const collections = { pages, blog };
