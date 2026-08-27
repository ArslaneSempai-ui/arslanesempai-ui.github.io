# The entry point

One page holding ten tools together: [arslanesempai-ui.github.io](https://arslanesempai-ui.github.io/).

Each tool takes a decision an operations team makes every quarter and computes the number
that decision actually turns on. This page states one finding per tool, draws the figure
that carries it, and links to the running demo and the source.

## The one rule

**No figure on this page is typed.** `chiffres.json` is produced by running the ten models
in the neighbouring repositories; the page is built from that file. Three guards keep it
honest:

| Guard | What it catches |
|---|---|
| `npm run mesurer -- --check` | the page's numbers no longer match the models |
| `src/vitrine.test.ts` | a number here that is absent from the tool's own README |
| the same test | a link to the private engine, a missing tile, a half-finished translation |

A repository that is not present on the machine is reported as **not verified** — never as
agreeing. Saying "up to date" about something you did not read is the failure this file
exists to prevent.

## Running it

```
npm install
npm run mesurer     # re-measures from the neighbouring repositories
npm run pages       # builds docs/
npm start           # serves docs/ at http://localhost:4300 for review
npm test            # type-check, staleness check, then the tests above
```

`npm run mesurer` needs the six tool repositories as sibling directories. Without them the
committed `chiffres.json` is used as-is and the page still builds.

## What is deliberately not here

The document-search engine is private. Its demo and write-up are public
([compliance-document-search](https://github.com/ArslaneSempai-ui/compliance-document-search));
the retrieval code is not, and a test fails if a link to it ever appears on this page.
