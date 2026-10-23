/**
 * Markdown twins for pages that have no Markdown source, converted from the
 * built HTML.
 *
 * THE EXCEPTION, NOT THE RULE. The default of this repository is that Markdown
 * is the source and the HTML is rendered from it, so a twin is the authored
 * text and never a scrape. Some pages have no such source: a home page, a
 * pricing page, a feature page assembled from components and typed copy. Their
 * twin is the page's `<main>`, converted once the build has written it, so it
 * says what the page says and cannot fall behind it. Anything with a Markdown
 * source must keep using the Markdown route; check-twins fails a twin carrying
 * tags with class attributes, which is what a lazy conversion leaves behind.
 *
 * WHICH PAGES. Not decided here. The layout advertises a twin in the head for
 * the paths in `hasHtmlTwin` (twin-pages.ts), and this step writes the twin
 * each page advertises for ITSELF and that no route has already built. One
 * list, two readers. A fallback page advertises the original's twin, so it
 * writes nothing: the same rule check-twins enforces.
 *
 * WHAT IS DROPPED. Anything that is not text a reader came for: scripts,
 * styles, inline SVG, canvas, iframes, media, forms and their controls,
 * buttons, HTML comments, decorative images (empty `alt`), anything
 * `aria-hidden` or `hidden`, `data-markdown="skip"`, and every `role="img"`
 * element (ARIA defines its contents as presentational: an illustration built
 * from real text in divs would otherwise read as a run of fragments glued
 * together). Tailwind responsive-hidden elements (`sm:hidden`) are dropped as a
 * desktop browser would; a bare `hidden` with no breakpoint bringing it back is
 * state a script reveals and is not on the page. A widget that should print
 * something else carries `data-markdown-text="line one\nline two"`, one list
 * item per line.
 *
 * LINKS. Root-relative links become absolute, because a twin is read outside
 * the site. `toMarkdown` does it too; doing it on the DOM first means `src` on
 * images is covered as well.
 *
 * Copy to `src/integrations/html-twins.ts`, `npm i -D` the packages in the
 * README, and add `htmlTwins()` to `integrations` in astro.config.ts.
 */
import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import type { Element, Nodes, Root } from 'hast';
import { fromHtml } from 'hast-util-from-html';
import { toMdast } from 'hast-util-to-mdast';
import { toString } from 'hast-util-to-string';
import { gfmToMarkdown } from 'mdast-util-gfm';
import { toMarkdown as mdastToMarkdown } from 'mdast-util-to-markdown';

import { toMarkdown } from '../lib/markdown';

const DROP_TAGS = new Set([
  'script', 'style', 'noscript', 'template', 'svg', 'canvas', 'iframe', 'video', 'audio',
  'form', 'button', 'input', 'select', 'textarea', 'label', 'dialog',
]);

/** Inline formatting that sits flush against the words around it. */
const FORMATTING = new Set(['strong', 'em', 'b', 'i', 'u', 's', 'code', 'sup', 'sub', 'mark', 'small']);

/** Elements that legitimately have no text of their own. */
const KEEP_EMPTY = new Set(['img', 'br', 'hr', 'td', 'th']);

const RESPONSIVE = /^(sm|md|lg|xl|2xl):/;
const SHOWN = /^(sm|md|lg|xl|2xl):(block|flex|grid|inline|inline-block|inline-flex|table|contents)$/;

const isElement = (node: Nodes): node is Element => node.type === 'element';

function find(node: Nodes, test: (el: Element) => boolean): Element | undefined {
  if (isElement(node) && test(node)) return node;
  if ('children' in node) {
    for (const child of node.children) {
      const hit = find(child as Nodes, test);
      if (hit) return hit;
    }
  }
  return undefined;
}

function dropped(el: Element): boolean {
  const p = el.properties;
  if (DROP_TAGS.has(el.tagName)) return true;
  if (String(p.ariaHidden) === 'true' || p.hidden != null) return true;
  if (p.dataMarkdown === 'skip' || p.role === 'img') return true;
  if (el.tagName === 'img' && !String(p.alt ?? '').trim()) return true;
  const classes = Array.isArray(p.className) ? p.className.map(String) : [];
  if (classes.some(c => RESPONSIVE.test(c) && c.endsWith(':hidden'))) return true;
  if (classes.includes('hidden') && !classes.some(c => SHOWN.test(c))) return true;
  return false;
}

/** Strip the chrome in place and make every link absolute. */
function clean(node: Element | Root, site: string): void {
  node.children = node.children.filter(
    child => child.type !== 'comment' && !(isElement(child as Nodes) && dropped(child as Element)),
  );
  for (const child of node.children) {
    if (!isElement(child as Nodes)) continue;
    const el = child as Element;
    const replacement = el.properties.dataMarkdownText;
    if (typeof replacement === 'string') {
      el.tagName = 'ul';
      el.properties = {};
      el.children = replacement.split('\n').map(line => ({
        type: 'element',
        tagName: 'li',
        properties: {},
        children: [{ type: 'text', value: line }],
      }));
      continue;
    }
    for (const name of ['href', 'src'] as const) {
      const value = el.properties[name];
      if (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')) {
        el.properties[name] = new URL(value, site).href;
      }
    }
    clean(el, site);
  }
  /* Two elements side by side with no whitespace between them are spaced by CSS
     (`gap`) on the page. Without the stylesheet they would read as one word. */
  node.children = node.children.flatMap((child, index) => {
    const previous = node.children[index - 1];
    const flush =
      previous &&
      isElement(previous as Nodes) &&
      isElement(child as Nodes) &&
      !FORMATTING.has((previous as Element).tagName) &&
      !FORMATTING.has((child as Element).tagName);
    return flush ? [{ type: 'text' as const, value: ' ' }, child] : [child];
  });
  /* A wrapper left with no text once its icon is gone would print as `****` or `[]()`. */
  node.children = node.children.filter(
    child =>
      !(isElement(child as Nodes) && !KEEP_EMPTY.has((child as Element).tagName) && !toString(child as Nodes).trim()),
  );
}

const attribute = (root: Root, test: (el: Element) => boolean, name: string) => {
  const value = find(root, test)?.properties[name];
  return typeof value === 'string' ? value : Array.isArray(value) ? value.join(' ') : undefined;
};

async function* htmlFiles(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(full);
    else if (entry.name.endsWith('.html')) yield full;
  }
}

/** The twin a file would own, in either build shape: `about.html` and `about/index.html` are `about.md`. */
const ownTwin = (relative: string) => {
  const page = relative.replace(/(^|\/)index\.html$/, '').replace(/\.html$/, '');
  return page === '' ? 'index.md' : `${page}.md`;
};

export interface Converted {
  markdown: string;
  /** The twin the page advertises in its head. */
  twinHref: string;
}

export function convert(html: string, site: string): Converted | undefined {
  const root = fromHtml(html);
  const twinHref = attribute(
    root,
    el => el.tagName === 'link' && el.properties.type === 'text/markdown' && String(el.properties.rel) === 'alternate',
    'href',
  );
  const main = find(root, el => el.tagName === 'main');
  if (!twinHref || !main) return undefined;

  const title = find(root, el => el.tagName === 'title');
  const description = attribute(root, el => el.tagName === 'meta' && el.properties.name === 'description', 'content');
  const canonical = attribute(root, el => el.tagName === 'link' && String(el.properties.rel) === 'canonical', 'href');
  const language = attribute(root, el => el.tagName === 'html', 'lang');

  clean(main, site);
  const body = mdastToMarkdown(toMdast(main), { extensions: [gfmToMarkdown()] })
    .replace(/\n{3,}/g, '\n\n')
    /* The spacing above lands inside a link when its text and icon were siblings. */
    .replace(/ +\]\(([^)\s]*)\)/g, ']($1) ')
    .trim();

  const pagePath = new URL(canonical ?? twinHref.replace(/\.md$/, ''), site).pathname;
  return {
    twinHref,
    markdown: toMarkdown({
      path: pagePath,
      title: title?.children.map(c => ('value' in c ? c.value : '')).join('').trim() ?? '',
      description: description ?? '',
      body,
      language,
    }),
  };
}

export default function htmlTwins(): AstroIntegration {
  let site = 'https://example.com';
  return {
    name: 'md-twins:html-twins',
    hooks: {
      'astro:config:done': ({ config }) => {
        if (config.site) site = config.site;
      },
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        let written = 0;
        for await (const file of htmlFiles(root)) {
          const relative = path.relative(root, file).split(path.sep).join('/');
          const target = path.join(root, ownTwin(relative));
          /* Already built by a route: a page with a Markdown source. */
          if (existsSync(target)) continue;
          const result = convert(await readFile(file, 'utf8'), site);
          if (!result) continue;
          /* Only the twin this page advertises for itself. A fallback page
             advertises the original's, which the original writes. */
          if (new URL(result.twinHref, site).pathname.replace(/^\//, '') !== ownTwin(relative)) continue;
          await writeFile(target, result.markdown);
          written += 1;
        }
        logger.info(`${written} Markdown twins converted from HTML`);
      },
    },
  };
}
