# html-twins

An opt-in recipe: Markdown twins for pages that have **no Markdown source**.

The default of this repository is the opposite. Markdown is the source, the HTML
is rendered from it, and a twin is the authored text, never a scrape of the page.
Use this only for pages assembled from components and typed copy (a home page, a
pricing page, a feature page), where there is no Markdown to copy. If a page has
a Markdown source, it keeps the Markdown route.

It is a recipe and not part of the template because it needs dependencies the
template does not otherwise carry. `recipes/` is excluded from `tsconfig.json`,
so `astro check` does not need them installed until you copy the files in.

## Install

```bash
npm i -D hast-util-from-html@2.0.3 hast-util-to-mdast@10.1.2 hast-util-to-string@3.0.1 \
  mdast-util-gfm@3.1.0 mdast-util-to-markdown@2.2.0 @types/hast@3.0.5 @types/node
mkdir -p src/integrations
cp recipes/html-twins/html-twins.ts src/integrations/html-twins.ts
cp recipes/html-twins/twin-pages.ts src/lib/twin-pages.ts
```

Then in `astro.config.ts`:

```ts
import htmlTwins from './src/integrations/html-twins';

export default defineConfig({
  // ...
  integrations: [htmlTwins()],
});
```

Verified with those versions on a page containing an inline SVG, a `role="img"`
block, a button, an empty-alt image, a script and Tailwind responsive-hidden
copy: all dropped, links made absolute, front matter written by the template's
own `toMarkdown`.

## One list, read by both halves

Edit `hasHtmlTwin` in `src/lib/twin-pages.ts` to say which pages have a
generated twin. Pass its result to the layout's `twin` prop so the head
advertises a twin for those pages and no others:

```astro
<Base path={path} title={title} description={description} twin={hasHtmlTwin(path)}>
```

The integration writes exactly the twin each built page advertises for itself,
and skips a twin a route has already built. The head and the build read the same
predicate, so they cannot disagree. A page that advertises another page's twin
(a fallback) writes nothing.

## What it drops

Scripts, styles, `noscript`, `template`, inline SVG, canvas, iframes, media,
forms and their controls, buttons, HTML comments, images with an empty `alt`,
anything `aria-hidden` or `hidden`, `data-markdown="skip"`, every `role="img"`
element (ARIA defines its contents as presentational), and Tailwind
`sm:hidden`-style classes. A bare `hidden` without a breakpoint class bringing it
back is dropped too: it is state a script reveals, not what the page shows.

To print something else for a widget, give it
`data-markdown-text="line one\nline two"`: one list item per line.

## Check it

`npm run check:twins` applies to these twins like any other: a canonical, a
language, no root-relative links, and it fails on a leftover tag with a `class`
attribute, which is what a lazy conversion leaves behind. Read a few of the
output twins by hand the first time. A conversion cannot tell you a section is
missing.
