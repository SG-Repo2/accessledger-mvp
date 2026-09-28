# Current State

Updated: 2026-09-28

## Completed

Chunks 0 (Foundation) and 1 (Browser + Scanner) are complete. The repository has versioned domain
contracts plus a portable single-page pipeline that loads a URL with Playwright, runs axe-core, and
returns validated Page and lossless raw Evidence without interpretation.

## Working functionality

- `@accessledger/shared` exports the `RawPageAssessmentRequest`, error, operational-result, and
  `RawPageAssessment` Zod contracts in addition to the Chunk 0 domain contracts.
- `@accessledger/browser` loads one URL in headless Chromium, captures requested/final URL, title,
  document language, HTTP response data, timestamps, and Playwright/Chromium provenance.
- `@accessledger/scanner` injects axe-core after page load and preserves its complete JSON result,
  including rules, nodes, selectors, HTML, help URLs, impact labels, and check data.
- `@accessledger/evidence` exports `RawPageAssessor` and `assessRawPage`, producing validated Page,
  browser Evidence, optional scanner Evidence, and `loaded`, `navigation_failed`, or `scan_failed`
  operational state.
- Browser, context, page, and fixture server resources close on success and failure. Concrete
  Playwright handles never enter a serialized contract.
- Deterministic fixtures cover a good form, unlabeled input, empty button, invalid ARIA value,
  redirects, and connection failure.
- A developer-only `npm run scan -- <URL>` command invokes `assessRawPage`, prints the serialized
  aggregate, and returns non-zero for invalid input or operational failure.

## Not implemented / known limitations

Accessibility semantics extraction, observation normalization, WCAG evaluation, grouping,
findings, persistence, auditor UI, journey recording, export, LLM analysis, severity, and NVDA are
deliberately unimplemented. Browser binaries require the separate `npm run playwright:install`
step. Chunk 1 was executed on macOS arm64; the code uses portable Node/Playwright APIs but Windows
execution has not yet been recorded. There are no known Chunk 1 defects.

## Validation

Final Chunk 1 validation and the developer CLI follow-up are recorded in `project/WORK-LOG.md`. All
required root commands pass. The root suite passes 6 files / 21 tests, including 9 browser/scanner
acceptance tests and 5 CLI tests.

## Versions and next work

- Public contract schema: `1.0.0` (unchanged; additive aggregate)
- Workspace packages: `0.0.1`
- Playwright: `1.63.0`
- Chromium: Playwright build `1243` (`153.0.8010.12` on the acceptance host)
- axe-core: `4.13.0`
- Last completed chunk: 1
- Next recommended chunk: 2 — Accessibility Evidence
- Blockers: none

Follow `project/HANDOFF.md` exactly and do not begin Chunk 3 during the next task.
