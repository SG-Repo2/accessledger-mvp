# Work Log

## 2026-09-28 — Codex — Chunk 0

- **Files changed:** Created `AGENTS.md`; all required `docs/**` and `project/**` files; and
  `packages/shared` package, source contracts, and tests. Registered the shared workspace in the
  npm lockfile.
- **Implemented:** Agent-agnostic memory, product/architecture/testing/data/WCAG/journey guidance,
  executable Chunk 0–8 plan, and versioned TypeScript/Zod domain contracts.
- **Tests executed:** `npm run typecheck`; `npm test`; `npm run lint`; `npm run format:check`;
  workspace-targeted shared typecheck and test commands.
- **Result:** All required checks passed. Root suite: 2 files / 5 tests. Shared suite: 1 file / 4
  tests.
- **Known issues:** No known Chunk 0 defects. Accessibility runtime is intentionally absent.
- **Next logical action:** Execute Chunk 1 (Browser + Scanner) from `project/HANDOFF.md`; do not
  begin accessibility semantics or later chunks.

## 2026-09-28 — Codex — Chunk 1

- **Files changed:** Added `packages/browser`, `packages/scanner`, and `packages/evidence` package
  manifests, sources, and tests; added `RawPageAssessment` shared contracts/tests; added four HTML
  fixtures and portable fixture-server support; updated root scripts/lockfile, architecture/data
  model/runtime documentation, backlog, decision log, current state, and handoff.
- **Implemented:** One-URL Playwright/Chromium loading; redirect/final URL, title, language, HTTP,
  timestamp, and version capture; axe-core injection/execution; direct JSON axe payload retention;
  validated Page/Evidence aggregate creation; typed navigation and scan failure outcomes; and
  guaranteed browser/context/page closure through the high-level pipeline.
- **Public contract decision:** Added the `RawPageAssessment` aggregate at schema `1.0.0` without
  changing persisted Page/Evidence shapes. ADR-007 records the additive-version and private browser
  ownership decision.
- **Dependencies:** Playwright `1.63.0`, acceptance Chromium build `1243` (`153.0.8010.12`), and
  axe-core `4.13.0`. Browser installation remains the separate `npm run playwright:install` step.
- **Tests executed:** Chunk acceptance suite; `npm run typecheck`; full `npm test`; `npm run lint`;
  `npm run format:check`.
- **Result:** All required checks passed. Root suite: 5 files / 16 tests. Browser/scanner acceptance:
  2 files / 9 tests.
- **Known issues:** No known Chunk 1 defect. Tests required loopback/Chromium permission in the
  managed sandbox. Windows execution was not available on this acceptance host.
- **Next logical action:** Execute Chunk 2 (Accessibility Evidence) from `project/HANDOFF.md`; do not
  begin observation normalization, WCAG mapping, or later chunks.

## 2026-09-28 — Codex — Chunk 1 developer scan CLI follow-up

- **Files changed:** Added the private `@accessledger/assessment-cli` workspace with a thin scan
  entry point and unit tests; added the root `scan` script; updated the lockfile, raw-capture runtime
  documentation, current state, and Chunk 2 handoff.
- **Implemented:** `npm run scan -- <URL>` requires one valid URL, calls the existing
  `assessRawPage` API, writes the complete serializable result to stdout, and returns non-zero for
  invalid input, thrown runtime errors, or typed navigation/scan failure.
- **Scope:** No scanner architecture or public contract changed, and no Chunk 2 work was started.
- **Tests executed:** CLI unit suite; manual scan of `empty-button.html`; `npm run typecheck`; full
  `npm test`; `npm run lint`; `npm run format:check`.
- **Result:** All checks passed. Root suite: 6 files / 21 tests, including 5 CLI tests. The manual
  scan returned status 0 and printed the expected raw `button-name` axe Evidence.
- **Known issues:** None beyond the existing separate Playwright browser installation and
  unrecorded Windows execution noted in current state.
- **Next logical action:** Execute Chunk 2 from the unchanged exact prompt in `project/HANDOFF.md`.

## 2026-09-28 — Codex — Chunk 2

- **Files changed:** Added the `@accessledger/accessibility` workspace and controlled accessibility
  fixture; added shared target/semantics contracts; narrowly extended the private BrowserCapture
  capability and raw-assessment orchestration; updated browser/evidence/shared/CLI tests, lockfile,
  architecture/data/testing/runtime documentation, backlog, decisions, current state, and handoff.
- **Implemented:** Versioned CSS evidence locators; Chromium CDP partial accessibility-tree capture;
  typed collector boundary; browser-exposed role, name, description, value, focusability, selected
  state and relationship extraction; explicit unavailable fields; typed hidden/detached/ambiguous/
  unexposed/API errors; Page/raw-evidence traceability; browser/API provenance; JSON validation; and
  existing-capture resource cleanup.
- **Public contract decision:** Added `AccessibilityTargetDescriptor`, collection context, semantic
  field/payload/error/provenance, and specialized accessibility Evidence contracts. Extended
  `RawPageAssessment` with optional target input and ordered semantics output. ADR-008 retains
  schema `1.0.0` for these additive pre-release changes and records the browser-not-NVDA boundary.
- **Runtime provenance:** Playwright `1.63.0`, Chromium build `1243` / `153.0.8010.12`, CDP protocol
  `1.3`, and axe-core `4.13.0` on macOS arm64.
- **Tests executed:** Targeted shared/accessibility/evidence acceptance suites; `npm run typecheck`;
  full `npm test`; `npm run lint`; `npm run format:check`.
- **Result:** All required checks passed. Root suite: 7 files / 23 tests. New tests cover known
  semantics, missing names, unavailable fields, hidden/detached targets, round-trip serialization,
  Page/raw-evidence links, non-NVDA provenance, and browser closure.
- **Known issues:** No known Chunk 2 defects. CSS locators are not durable identity; absent AX fields
  cannot distinguish unexposed from inapplicable; collection is currently Chromium/CDP-specific;
  and Windows execution remains unrecorded.
- **Next logical action:** Execute Chunk 3 (Observation Normalization + WCAG Mapping) from
  `project/HANDOFF.md`; do not begin grouping or later chunks.

## 2026-09-28 — Codex — Chunk 2 scan CLI target follow-up

- **Files changed:** Updated the assessment CLI parser/tests; raw-runtime, current-state, work-log,
  and handoff documentation; and formatter exclusions for local `*-scan.json` capture artifacts.
- **Implemented:** Repeated optional `--target "<selector>"` arguments become versioned,
  deterministic `cli-target-N` CSS descriptors and pass through the existing
  `RawPageAssessmentRequest.accessibilityTargets` input. Operator-supplied targets have null source
  evidence IDs. No-target invocation and normal RawPageAssessment JSON output are unchanged.
- **Tests:** Added focused forwarding and invalid-target argument coverage, then ran all required
  root validation commands. Root suite: 7 files / 27 tests.
- **Scope:** No collector, schema, architecture, WCAG, observation, grouping, finding, severity,
  LLM, UI, journey, speech, or NVDA behavior changed. No Chunk 3 work began.
- **Next logical action:** Execute Chunk 3 from the exact prompt in `project/HANDOFF.md`.

## 2026-09-28 — Codex — Chunk 3

- **Files changed:** Added `@accessledger/observations`, `@accessledger/wcag`, and the versioned
  `data/wcag` dataset; extended shared Observation, ObservationOccurrence, rule-mapping, and WCAG
  candidate-evaluation contracts; updated contract/acceptance tests, workspace lockfile,
  architecture/data/WCAG/testing/runtime documentation, backlog, decisions, current state, and
  handoff.
- **Implemented:** Deterministic normalization for axe-core `button-name`, `label`, and
  `aria-valid-attr-value` violations and explicitly empty computed Chromium button names; exact
  per-node/target occurrence preservation; source/tool/fact provenance; scope validation; explicit
  ignored-evidence outcomes; runtime-validated WCAG knowledge loading; source-version and fact-based
  supported/unsupported/uncertain evaluation; and unknown-rule preservation.
- **Public contract decision:** Added Observation `source`/`facts`, ObservationOccurrence
  `sourceDetail`, rule mapping evidence requirements, requirement evaluations, and
  `WcagCandidateEvaluation`. ADR-009 retains contract schema `1.0.0` for additive pre-release
  changes and records dataset version `2026.09.28-1`.
- **Persistence decision:** No persistence was required or added. Chunk 3 is a pure transformation
  boundary over validated, JSON-serializable inputs/outputs; SQLite remains only an expected later
  default when concrete access patterns exist.
- **Tests executed:** Chunk 3 unit and controlled live-fixture tests; `npm run typecheck`; full
  `npm test`; `npm run lint`; `npm run format:check`.
- **Result:** All checks passed. Root suite: 9 files / 41 tests. Tests cover positive, negative,
  preservation, deterministic fixture, unknown-rule, insufficient-evidence, unsupported-candidate,
  dataset-version, JSON round-trip, source-version, and Page/Evidence traceability behavior.
- **Known issues:** WCAG coverage is intentionally limited to 4.1.2 and four mappings; only three
  axe violation rules and one browser-semantics fact normalize. Windows execution remains
  unrecorded. No known Chunk 3 defect.
- **Next logical action:** Execute Chunk 4 (Deduplication / Grouping) from `project/HANDOFF.md`; do
  not begin findings, severity, UI, journeys, export, LLM analysis, or NVDA automation.
