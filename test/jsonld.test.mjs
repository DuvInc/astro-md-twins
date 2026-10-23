import assert from 'node:assert/strict';
import test from 'node:test';

import { jsonLdFor, serializeJsonLd } from '../src/lib/jsonld.ts';

const base = {
  kind: 'Article', title: 'A </script> title', description: 'd', url: 'https://example.com/blog/a',
  twin: 'https://example.com/blog/a.md', language: 'fr', datePublished: new Date('2026-01-02'),
};

test('the node points at the twin through encoding', () => {
  const node = jsonLdFor(base);
  assert.deepEqual(node.encoding, {
    '@type': 'MediaObject', encodingFormat: 'text/markdown', contentUrl: 'https://example.com/blog/a.md',
  });
  assert.equal(node.inLanguage, 'fr');
  assert.equal(node.datePublished, '2026-01-02');
});

test('serialized JSON cannot close the script element', () => {
  assert.ok(!serializeJsonLd(jsonLdFor(base)).includes('</script'));
  assert.equal(JSON.parse(serializeJsonLd(jsonLdFor(base))).name, 'A </script> title');
});
