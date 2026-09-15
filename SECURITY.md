# Security policy

## Reporting a vulnerability

Please report privately rather than in a public issue, using GitHub's
[private vulnerability reporting](https://github.com/DuvInc/astro-md-twins/security/advisories/new)
on this repository. That opens a channel visible only to you and the maintainer.

This is a one-person project. You should get an acknowledgement within a few
days; if a week passes with no reply, feel free to nudge by opening a public
issue that says only that you are waiting on a private report, with no details.

Please include what an attacker can do, not only what looks wrong: the commit,
the configuration that exposes it, and the smallest reproduction you have.

## What is in scope

This repository builds a static site and, optionally, runs a small Worker in
front of it. The interesting surface is small and worth naming:

- **The Worker's path handling.** `worker/index.ts` maps a request path to an
  asset path. Anything that makes it serve a file outside `dist/`, or serve one
  document's bytes under another document's URL, is the bug worth finding here.
- **Content injection through the twins.** A page's Markdown is written into a
  file with YAML front matter. Anything in a title or description that can
  escape the quoting in `src/lib/markdown.ts` and forge front-matter keys, in
  particular `canonical`, is in scope: a forged canonical points a search
  engine at a URL the site does not own.
- **Negotiation correctness.** A case where a browser is served raw Markdown, or
  where a cache can be made to replay one representation to a client that asked
  for the other. That is a correctness bug with a real-world consequence rather
  than a breach, and it is still worth reporting.
- **The build.** Content that can inject script into a rendered page.

## What is out of scope

- The dummy content, which is fictional and exists to be replaced.
- Crawler behaviour, which is not ours to fix.
- A vulnerability that requires the attacker to already have commit access.

## If you started a site from this template

Replace the link above with your own repository. This file arrived with the code
and points at somebody else's advisories.
