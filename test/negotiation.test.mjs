/**
 * The rules that decide which representation a client gets.
 *
 * These run without a build, a server or a network. Every case here is one
 * that a real implementation has shipped wrong at some point, and the first
 * one is the one that matters most: a browser must never be handed raw
 * Markdown, because that is not reported as a negotiation bug, it is reported
 * as "your site is broken".
 */
import assert from 'node:assert/strict';
import test from 'node:test';

const { prefersMarkdown, quality, isDocument, markdownPathFor, pagePathFor } = await import(
  '../src/lib/negotiation.ts'
);

test('a browser always gets HTML', () => {
  const chrome = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8';
  assert.equal(prefersMarkdown(chrome), false);
  assert.equal(prefersMarkdown('*/*'), false);
  assert.equal(prefersMarkdown(null), false);
  assert.equal(prefersMarkdown(''), false);
});

test('a client that prefers Markdown gets Markdown', () => {
  assert.equal(prefersMarkdown('text/markdown'), true);
  assert.equal(prefersMarkdown('text/markdown, text/html;q=0.5'), true);
  assert.equal(prefersMarkdown('text/markdown;q=0.9, text/html;q=0.8'), true);
});

test('q values decide, not the presence of the string', () => {
  /* The case a substring match gets wrong: Markdown is listed, and declined. */
  assert.equal(prefersMarkdown('text/html, text/markdown;q=0.1'), false);
  assert.equal(prefersMarkdown('text/html;q=1.0, text/markdown;q=1.0'), false);
  assert.equal(quality('text/markdown;q=0.4', 'text/markdown'), 0.4);
  assert.equal(quality('text/html', 'text/markdown'), 0);
  /* A malformed q is not a reason to serve the wrong format. */
  assert.equal(quality('text/markdown;q=banana', 'text/markdown'), 0);
});

test('documents are pages and twins, never assets', () => {
  assert.equal(isDocument('/about'), true);
  assert.equal(isDocument('/'), true);
  assert.equal(isDocument('/about.md'), true);
  assert.equal(isDocument('/blog/a-post.md'), true);
  assert.equal(isDocument('/_astro/index.abc123.css'), false);
  assert.equal(isDocument('/sitemap.xml'), false);
  assert.equal(isDocument('/favicon.svg'), false);
});

test('a page and its twin map to each other, home page included', () => {
  /* `/.md` is not a path, which is why the home page twin is `/index.md`. */
  assert.equal(markdownPathFor('/'), '/index.md');
  assert.equal(pagePathFor('/index.md'), '/');
  for (const path of ['/about', '/blog', '/blog/a-post']) {
    assert.equal(pagePathFor(markdownPathFor(path)), path);
  }
  /* A trailing slash must not produce `//.md`. */
  assert.equal(markdownPathFor('/about/'), '/about.md');
});
