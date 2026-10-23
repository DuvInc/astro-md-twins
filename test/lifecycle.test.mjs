import assert from 'node:assert/strict';
import test from 'node:test';

import { lifecycleFor } from '../src/lib/lifecycle.ts';

const moved = { '/old': '/new', '/blog/a': '/blog/b', '/was-home': '/' };
const gone = ['/withdrawn'];
const run = path => lifecycleFor(path, moved, gone);

test('a moved page and its twin both redirect, the twin keeping .md', () => {
  assert.deepEqual(run('/old'), { status: 301, location: '/new' });
  assert.deepEqual(run('/old/'), { status: 301, location: '/new' });
  assert.deepEqual(run('/old.md'), { status: 301, location: '/new.md' });
  assert.deepEqual(run('/blog/a.md'), { status: 301, location: '/blog/b.md' });
});

test('a page moved to the home page lands on /index.md for its twin', () => {
  assert.deepEqual(run('/was-home.md'), { status: 301, location: '/index.md' });
  assert.deepEqual(run('/was-home'), { status: 301, location: '/' });
});

test('a withdrawn page and its twin are 410', () => {
  assert.deepEqual(run('/withdrawn'), { status: 410 });
  assert.deepEqual(run('/withdrawn.md'), { status: 410 });
});

test('gone wins over moved, live pages and prototype keys pass through', () => {
  assert.deepEqual(lifecycleFor('/x', { '/x': '/y' }, ['/x']), { status: 410 });
  assert.equal(run('/about'), null);
  assert.equal(run('/index.md'), null);
  assert.equal(run('/constructor'), null);
  assert.equal(lifecycleFor('/anything', {}, []), null);
});
