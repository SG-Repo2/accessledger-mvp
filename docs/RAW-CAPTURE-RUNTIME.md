# Raw Capture Runtime

## Installation

Install npm dependencies and the Playwright-managed Chromium binary separately:

```text
npm install
npm run playwright:install
```

The second command runs `playwright install chromium`. Browser binaries are not stored in the
repository or installed by the package manifest, so a fresh machine and CI runner must run it once
for the installed Playwright version. Chunk 1 was accepted with Playwright 1.63.0, Chromium for
Playwright build 1243, and axe-core 4.13.0.

Start the deterministic local fixture server with:

```text
npm run fixtures:serve
```

It binds an ephemeral port on `127.0.0.1`, prints the origin, serves only the allow-listed files in
`data/fixtures`, and includes `/redirect` and `/close-connection` operational test routes. Stop it
with Ctrl+C. Automated tests start and stop their own server instead of relying on this command.

## Developer scan command

Run the existing Chunk 1 pipeline manually with exactly one URL:

```text
npm run scan -- https://example.gov/
```

To exercise the Chunk 2 collector against controlled elements on that page, repeat `--target` with
a CSS selector:

```text
npm run scan -- https://example.gov/ --target ".site-search-button" --target "#label_1"
```

The CLI assigns ordered `cli-target-N` IDs, uses `strategy: "css"`, and leaves
`sourceEvidenceId: null` because these are operator-supplied locators. Invalid, empty, or incomplete
target arguments fail before browser launch. Omitting `--target` preserves the original request and
returns an empty `accessibilityEvidence` array.

The developer-only CLI prints the complete serialized `RawPageAssessment` JSON to stdout. It exits
with status `0` only when `operationalResult.status` is `loaded`; invalid arguments, invalid URLs,
navigation failures, scan failures, and unexpected runtime errors exit non-zero. Typed operational
failures still print their assessment JSON so the raw failure evidence remains inspectable. The CLI
contains no scanner rules or interpretation and delegates directly to `assessRawPage`.

## Loading, timeout, and ownership

`PlaywrightBrowserLoader` launches one headless Chromium browser, context, and page per `load`
call. The default navigation timeout is 15 seconds and uses Playwright's `load` readiness state.
`BrowserLoadRequest.timeoutMs` can override it; `RawPageAssessorOptions.navigationTimeoutMs`
forwards the override through the full pipeline.

A successful `BrowserCapture` owns those three resources. Its `close()` method is idempotent and
closes page, context, and browser sequentially. `RawPageAssessor.assess()` always closes it in a
`finally` block after scanning, including scanner failures. `PlaywrightBrowserLoader` closes all
resources acquired before any browser-launch, navigation, or metadata failure returns. Callers that
use `BrowserLoader.load()` directly, rather than `assessRawPage()`, must close successful captures.

The concrete Playwright `Page` is private. A `BrowserCapture` exposes only script injection and
JSON-value evaluation capabilities needed by deterministic scanners plus a narrow serialized
accessibility-tree capture capability. It never returns a Page, Locator, ElementHandle, or CDP
session, and no live handle appears in `RawPageAssessment` or another serializable contract.

## Evidence behavior

After navigation completes, `AxeCoreScanner` injects the installed `axe-core` source and runs it
against the document. The result is stringified inside the browser before crossing the runtime
boundary. The parsed JSON—including axe rule IDs, tags, impact, help/help URLs, node targets, HTML,
failure summaries, and check data—is stored directly as the scanner Evidence payload. AccessLedger
does not normalize, map, group, rank, or interpret it in Chunk 1.

Loaded browser evidence records requested/final URLs, title, document language, navigation response
status and headers, load timestamp, Playwright version, and Chromium version. Navigation failures
produce failed Page plus raw browser Evidence and no scanner Evidence. Scan failures retain a loaded
Page and produce scanner Evidence containing only the operational error. Neither failure is an
accessibility conclusion.

## Accessibility semantics collection

Pass optional versioned CSS target descriptors to `assessRawPage`, or use
`BrowserAccessibilityEvidenceCollector.collect(capture, targets)` directly with a Page/raw-evidence
context. The high-level assessor runs collection after browser and scanner evidence creation and
before closing the existing capture. It does not open a second browser. No target descriptors means
no accessibility API session is opened.

For each target, the Chromium implementation resolves exactly one attached and rendered element,
opens a temporary Chrome DevTools Protocol session, and calls
`Accessibility.getPartialAXTree`. The CDP session is detached after collection, and the owning
capture still closes its page, context, and browser in the existing `finally` path.

The collector records role, computed name, computed description, value, focusability, selected AX
states, and IDREF relationships when Chromium exposes them. Absence is stored as
`not_exposed_or_not_applicable`; empty accessible names remain available empty strings. It records
typed errors for missing/detached, multiply matched, hidden, unexposed, and browser-API targets.
CSS selectors are reproducible locators for controlled captures, not durable node identity.

The evidence provenance name is `Chrome DevTools Protocol Accessibility`, includes the browser,
Playwright, and protocol versions, uses classification `browser_accessibility_semantics`, and sets
`assistiveTechnologyOutput` to `false`. Chromium accessibility-tree data may differ from NVDA's
platform API consumption, heuristics, announcements, modes, and user settings. It cannot establish
speech output, focus order quality, task completion, resident experience, WCAG conformance, or
severity.

## Chunk 3 downstream use

Pass a validated Page and its browser, scanner, and accessibility Evidence records to
`DeterministicObservationNormalizer.normalize`. The normalizer never edits the capture aggregate.
It currently recognizes only the documented fixture-covered facts listed in
`docs/WCAG-KNOWLEDGE-MODEL.md`; operational browser evidence, scanner passes/incomplete results,
unknown rules, and accessibility collection errors do not become observations. Unknown source
rules are retained in normalization output with their Evidence and tool/version context. The output
remains in memory as validated JSON-serializable records in Chunk 3; no database setup or migration
command is required.

## Public exports

- `@accessledger/shared`: `rawPageAssessmentRequestSchema`, `rawPageAssessmentErrorSchema`,
  `rawPageAssessmentOperationalResultSchema`, `rawPageAssessmentSchema`, accessibility target,
  context, semantic-field, payload, provenance, error, and specialized Evidence schemas plus their
  inferred types.
- `@accessledger/browser`: `BrowserLoader`, `BrowserCapture`, load/capture types,
  serialized accessibility-tree result types, `PlaywrightBrowserLoader`, its options, and
  Playwright name/version/timeout constants.
- `@accessledger/scanner`: `AccessibilityScanner`, `ScannerCapture`, `AxeCoreScanner`, and options.
- `@accessledger/accessibility`: `AccessibilityEvidenceCollector`,
  `BrowserAccessibilityEvidenceCollector`, and its options.
- `@accessledger/evidence`: `RawPageAssessor`, its options, and `assessRawPage`, now returning
  ordered `accessibilityEvidence` when targets are supplied.
- `@accessledger/observations`: `ObservationNormalizer`,
  `DeterministicObservationNormalizer`, normalization inputs/results, and ignored-evidence reasons.
- `@accessledger/wcag`: `WcagKnowledge`, `JsonWcagKnowledge`, `WcagMapper`, and
  `EvidenceBasedWcagMapper`.

The aggregate accepts `assessmentId`, URL, and optional accessibility targets. Default IDs and
timestamps are generated at runtime; tests can inject clocks, ID factories, loaders, and scanners
without changing serialized records. The developer scan command accepts repeated optional CSS
targets; without them it returns an empty `accessibilityEvidence` array.
