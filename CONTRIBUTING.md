# Contributing

Thanks for looking. This is a one-person project maintained on a best-effort
basis, so the most useful thing you can do before writing code is open an issue.
A small fix is always welcome; a large one is worth agreeing on first.

## Getting set up

Node 22.18 or newer. Astro asks only for 22.12, but the tests import
`src/lib/negotiation.ts` directly and rely on Node stripping the types, which is
unflagged from 22.18. `.nvmrc` pins the major, so `nvm use` gets you the version
CI runs.

```bash
npm install
npm run dev          # http://localhost:4321
npm test             # build, unit tests, then check-twins
npm run worker:dev   # the only way to exercise content negotiation locally
```

`npm test` passes on a fresh clone with no key, no account and no network. If it
does not, that is a bug worth reporting on its own.

## Sign your commits off

Every commit needs a `Signed-off-by` line, which certifies that you wrote the
patch or otherwise have the right to submit it under the MIT licence. This is
the [Developer Certificate of Origin](https://developercertificate.org): one
line, no paperwork, no copyright assignment.

```bash
git commit -s -m "Your message"
```

Pull requests without it will be asked for an amend.

## What makes a change likely to be merged

**Evidence, for anything about crawler behaviour.** The README makes claims
about what machines do, each with a source, and it is equally explicit about
what this does not achieve. A change to that section needs a measurement or a
citation, and "everyone says" is not one. Removing an honest limitation is a
regression.

**One list of pages.** `src/lib/pages.ts` answers which pages exist, for every
route, feed and test. A second answer to that question is the failure mode this
codebase is arranged to prevent.

**Testable rules.** `src/lib/negotiation.ts` has no runtime imports so its rules
can be unit-tested. If you add logic that decides what a client gets, it belongs
there, with cases in `test/negotiation.test.mjs`.

**Observed headers.** If you change `worker/index.ts`, include the output of the
three `curl -sI` commands from AGENTS.md in the pull request.

**Comments explain why, not what.** The existing ones are long on purpose: they
record the reasoning and, where it matters, what went wrong before.

**No em dashes**, anywhere: comments, documentation, content. A comma, a colon
or a full stop.

## Changes that need a conversation first

- A new dependency. The current list is Astro, its checker, TypeScript and
  Wrangler, and the shortness of it is a feature.
- Anything that changes a published URL shape. Somebody's twin links depend on
  it.
- Making the Worker mandatory. Working without it on any static host is the
  property that makes this usable outside Cloudflare.

## Reporting a bug

Include the commit, what you expected, what happened, and the smallest content
that reproduces it. For anything about headers, `curl -sI` output beats a
description of it.

Anything with security implications goes to [SECURITY.md](./SECURITY.md) instead
of a public issue.
