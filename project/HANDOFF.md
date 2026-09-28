# Handoff — Start Chunk 2 Only

## Last completed work

Chunk 1 (Browser + Scanner) is complete. One URL can be loaded with Playwright/Chromium, scanned
with axe-core, and returned as a runtime-validated, JSON-serializable `RawPageAssessment` containing
Page, raw browser Evidence, raw scanner Evidence when scanning was attempted, and typed operational
state. Navigation/scan failures remain operational evidence and no Chunk 2+ interpretation exists.

A developer-only `npm run scan -- <URL>` wrapper now invokes that same pipeline, prints its complete
JSON result, and exits non-zero for invalid input or operational failure. It adds no scanner logic or
public contract.

All root checks pass: 6 test files / 21 tests. The browser/scanner acceptance subset is 2 files / 9
tests, and the CLI wrapper has 5 tests.

## Runtime versions and installation

- Node acceptance host: `22.23.3`
- npm: `10.9.9`
- Playwright: `1.63.0`
- Installed acceptance Chromium: Playwright build `1243`, browser `153.0.8010.12`, macOS arm64
- axe-core: `4.13.0`

After `npm install`, install the platform browser separately with:

```text
npm run playwright:install
```

Browser binaries are not committed or installed implicitly. Full details are in
`docs/RAW-CAPTURE-RUNTIME.md`.

Run a manual raw scan with exactly one URL:

```text
npm run scan -- https://example.gov/
```

The complete serialized `RawPageAssessment` is written to stdout. Only a `loaded` operational
result exits zero; typed navigation/scan failures still print JSON and exit non-zero.

## Important public interfaces

`@accessledger/shared` exports:

- `rawPageAssessmentRequestSchema` / `RawPageAssessmentRequest`
- `rawPageAssessmentErrorSchema` / `RawPageAssessmentError`
- `rawPageAssessmentOperationalResultSchema` / `RawPageAssessmentOperationalResult`
- `rawPageAssessmentSchema` / `RawPageAssessment`

`@accessledger/browser` exports `BrowserLoader`, runtime-only `BrowserCapture`, load/capture types,
`PlaywrightBrowserLoader`, loader options, and its version/timeout constants. `BrowserCapture`
retains the concrete Playwright Page privately and currently exposes `injectScript`, JSON-value
`evaluate`, idempotent `close`, captured data, and closed state.

`@accessledger/scanner` exports `AccessibilityScanner`, `ScannerCapture`, `AxeCoreScanner`, and its
options. `@accessledger/evidence` exports `RawPageAssessor`, `RawPageAssessorOptions`, and
`assessRawPage(request, options)`.

The default navigation timeout is 15 seconds. Each load owns one browser/context/page. The
high-level assessor closes them in `finally`; direct BrowserLoader callers must close a successful
capture themselves.

## Fixture server and tests

Run the inspection-only fixture server with:

```text
npm run fixtures:serve
```

It prints an ephemeral `127.0.0.1` origin. Tests manage their own server and cover
`good-form.html`, `unlabeled-input.html`, `empty-button.html`, `broken-aria.html`, `/redirect`, and
`/close-connection`. The server and paths use Node APIs and an explicit fixture allow-list.

An axe success stores the parsed JSON result directly in scanner Evidence payload, for example:

```json
{
  "testEngine": { "name": "axe-core", "version": "4.13.0" },
  "violations": [
    {
      "id": "button-name",
      "impact": "critical",
      "helpUrl": "https://dequeuniversity.com/rules/axe/4.13/button-name?application=axeAPI",
      "nodes": [
        {
          "target": ["#empty-action"],
          "html": "<button id=\"empty-action\" type=\"button\"></button>"
        }
      ]
    }
  ]
}
```

The actual payload also retains passes, incomplete, inapplicable, tags, help text, failure
summaries, and check data. A navigation failure has failed Page + browser Evidence + null scanner
Evidence. A scan failure has loaded Page + browser Evidence + scanner Evidence with the raw
operational error.

## Decisions and limits

ADR-007 records the additive `RawPageAssessment` contract, retained `1.0.0` schema version, private
browser ownership, and in-browser JSON serialization of axe output. No persistence was added. No
accessibility semantics, observations, WCAG mapping, grouping, findings, UI, resident automation,
severity, LLM, or NVDA behavior was implemented.

There are no known Chunk 1 defects. The acceptance host was macOS arm64; portable Node/Playwright
APIs are used, but Windows execution has not been recorded. Managed sandboxes may require
permission for loopback binding and Chromium launch.

## What to do next

Implement **Chunk 2 — Accessibility Evidence** exactly as specified in
`docs/MVP-IMPLEMENTATION-PLAN.md`. Use the existing browser lifecycle and raw Evidence contracts,
make only narrow extensions needed for browser semantics collection, and stop before Chunk 3.

## Exact recommended prompt for the next agent

```text
Read AGENTS.md, project/CURRENT-STATE.md, project/HANDOFF.md, docs/ARCHITECTURE.md, the Chunk 2 section of docs/MVP-IMPLEMENTATION-PLAN.md, docs/TESTING-METHODOLOGY.md, docs/DATA-MODEL.md, docs/RAW-CAPTURE-RUNTIME.md, and relevant entries in project/DECISIONS.md. Implement Chunk 2 only: Accessibility Evidence. Use npm and preserve the existing TypeScript/ESM/workspace setup. Reuse the Chunk 1 BrowserCapture lifecycle without exposing Playwright handles. Define and test any necessary serializable target descriptor and the AccessibilityEvidenceCollector.collect boundary before export. Collect reproducible browser-exposed role, name, description, value, states, focusability, and relationships for controlled targets; explicitly record unavailable fields and detached/hidden-target errors; include browser/API provenance and link accessibility_semantics Evidence to the Page and existing raw evidence. Add deterministic fixtures/tests for known roles, names, states, missing names, hidden and detached elements, JSON serialization, traceability, resource cleanup, and proof that results are browser semantics—not NVDA output. Do not begin Chunk 3: do not normalize observations, evaluate or map WCAG, group occurrences, draft findings, use LLM analysis, implement the auditor UI or resident automation, assign severity, simulate speech, or automate NVDA. Run npm run typecheck, npm test, npm run lint, and npm run format:check, then update project/CURRENT-STATE.md, project/WORK-LOG.md, project/BACKLOG.md, project/DECISIONS.md if needed, and project/HANDOFF.md. Report files changed, public contracts, tests, decisions, unresolved issues, and the exact prompt for the next Chunk 3 agent.
```
