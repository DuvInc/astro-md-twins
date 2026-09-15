// @ts-check
import { defineConfig } from 'astro/config';

import { site } from './src/site.config';

/**
 * https://astro.build/config
 *
 * `trailingSlash: 'never'` and `build.format: 'file'` together are what make
 * the Markdown twin a sibling rather than a child: `/about` is `about.html`,
 * so its twin is `about.md`. With directory-style output the page would be
 * `about/index.html` and the twin would have to be `about/index.md`, which
 * still works but is a second shape to keep in every head.
 */
export default defineConfig({
  site: site.url,
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },
  markdown: {
    shikiConfig: { theme: 'github-light', wrap: true },
  },
});
