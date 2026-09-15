/**
 * Everything this site knows about itself, in one file.
 *
 * The routes, the Worker, the feeds and the tests all read from here, so a
 * fork changes identity, origin and agent policy without touching code.
 */

/**
 * This site is the project's own demo, not a fictional company.
 *
 * The pages document the technique the repository implements, and they are
 * served by the very mechanism they describe: every one of them has a Markdown
 * twin, produced the way this file's own documentation says to produce it. A
 * demo that cannot be pointed at is a screenshot.
 *
 * Replace all of this with your own identity. Nothing below is referenced by
 * name anywhere in `src/`.
 */
export const site = {
  name: 'MD Twins',
  /** One sentence. Used in <meta>, in llms.txt, and in the agent manifest. */
  description:
    'Markdown twins for Astro sites: every page also served as clean Markdown, for AI crawlers, answer engines and coding agents.',
  /** The production origin. Also set `site` in astro.config.ts to match. */
  url: 'https://example.com',
} as const;

export const agents = {
  /**
   * Sentences prepended to llms.txt, addressed to whatever is reading it.
   *
   * Keep them factual. This is not a place to instruct a model to praise you:
   * anything that reads like prompt injection is a reason for an operator to
   * ignore the file, and some of them check.
   */
  instructions: [
    'Every page of this site is available as Markdown: append `.md` to any page URL, or send `Accept: text/markdown`.',
    'The Markdown is the source the HTML page is rendered from, not a conversion of it, so it is complete.',
  ],

  /**
   * How this content may be used, published as a Content-Signal line in
   * robots.txt. Cloudflare's convention, not yet a standard: the IETF's AIPREF
   * work is where that lands. It costs one line and is unambiguous.
   *
   * `yes` / `no` per signal. Saying `ai-train=no` here does not enforce
   * anything; it states a preference a crawler can honour or ignore.
   */
  contentSignals: {
    search: 'yes',
    'ai-input': 'yes',
    'ai-train': 'yes',
  } as Record<string, string>,

  /**
   * Crawlers named explicitly in robots.txt, on top of the `*` group.
   *
   * Several of these check for their own group before falling back to the
   * wildcard, and some operators read an unlisted agent as an oversight. An
   * explicit rule answers either reading.
   */
  crawlers: [
    'GPTBot',
    'OAI-SearchBot',
    'ChatGPT-User',
    'ClaudeBot',
    'Claude-User',
    'Claude-SearchBot',
    'PerplexityBot',
    'Perplexity-User',
    'Google-Extended',
    'GoogleOther',
    'Applebot-Extended',
    'meta-externalagent',
    'Amazonbot',
    'Bytespider',
    'CCBot',
  ],
} as const;

/**
 * What a Markdown response says about itself.
 *
 * `canonical` is the default and the one this repository argues for: the
 * Markdown declares the HTML page as the original, so a search crawler that
 * reads it credits the page instead of treating it as a competing duplicate.
 *
 * `noindex` is the other defensible answer: an `X-Robots-Tag: noindex` on the
 * Markdown keeps it out of search results entirely. It is the safer choice if
 * you cannot verify that the canonical is being honoured, and the worse one if
 * you want AI search to quote the Markdown, because a page an engine is told
 * not to index is a page it may also decline to retrieve.
 *
 * Both are set by the Worker. Without the Worker, only the front-matter
 * `canonical:` key inside the file survives; see AGENTS.md.
 */
export const markdownPolicy: 'canonical' | 'noindex' = 'canonical';
