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
JSON-value evaluation capabilities needed by deterministic scanners, and no live handle appears in
`RawPageAssessment` or another serializable contract.

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

## Public exports

- `@accessledger/shared`: `rawPageAssessmentRequestSchema`, `rawPageAssessmentErrorSchema`,
  `rawPageAssessmentOperationalResultSchema`, `rawPageAssessmentSchema`, and their inferred types.
- `@accessledger/browser`: `BrowserLoader`, `BrowserCapture`, load/capture types,
  `PlaywrightBrowserLoader`, its options, and Playwright name/version/timeout constants.
- `@accessledger/scanner`: `AccessibilityScanner`, `ScannerCapture`, `AxeCoreScanner`, and options.
- `@accessledger/evidence`: `RawPageAssessor`, its options, and `assessRawPage`.

The aggregate accepts only `assessmentId` and URL. Default IDs and timestamps are generated at
runtime; tests can inject clocks, ID factories, loaders, and scanners without changing serialized
records.
