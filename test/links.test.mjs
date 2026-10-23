import assert from 'node:assert/strict';
import test from 'node:test';

import { absoluteLinks } from '../src/lib/links.ts';

const origin = 'https://example.com';
const fix = text => absoluteLinks(text, origin);

test('root-relative links and images become absolute', () => {
  assert.equal(fix('See [pricing](/pricing) and ![logo](/img/logo.png).'),
    'See [pricing](https://example.com/pricing) and ![logo](https://example.com/img/logo.png).');
  assert.equal(fix('[x](/a "Title")'), '[x](https://example.com/a "Title")');
  assert.equal(fix('[twin](/blog/x.md)'), '[twin](https://example.com/blog/x.md)');
});

test('reference definitions and raw href/src are rewritten', () => {
  assert.equal(fix('[id]: /docs/start'), '[id]: https://example.com/docs/start');
  assert.equal(fix('<a href="/about">About</a> <img src="/a.png">'),
    '<a href="https://example.com/about">About</a> <img src="https://example.com/a.png">');
});

test('everything that is not root-relative is left alone', () => {
  for (const text of [
    '[cdn](//cdn.example.net/x.js)', '[top](#top)', '[rel](./sibling)', '[up](../x)',
    '[abs](https://other.example/a)', '[mail](mailto:a@b.c)',
  ]) assert.equal(fix(text), text);
});

test('code is not a link: fences and inline code are verbatim', () => {
  const text = 'Use `[x](/y)` here.\n\n```md\n[pricing](/pricing)\n```\n\n~~~\n[a](/b)\n~~~\n\n[after](/after)';
  assert.equal(fix(text),
    'Use `[x](/y)` here.\n\n```md\n[pricing](/pricing)\n```\n\n~~~\n[a](/b)\n~~~\n\n[after](https://example.com/after)');
});

test('running it twice changes nothing', () => {
  const once = fix('[a](/a)');
  assert.equal(fix(once), once);
});
