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

## 2026-09-28 — Codex — Chunk 4

- **Files changed:** Added the `@accessledger/grouping` workspace with its public boundary,
  deterministic engine, and acceptance tests; added shared GroupProposal contracts and tests;
  updated the lockfile, architecture, data model, testing methodology, backlog, decisions, current
  state, work log, and handoff.
- **Implemented:** Conservative same-source grouping; normalized component-fingerprint identity;
  same-Page or explicit-template structural grouping; stable content-derived proposal IDs;
  deterministic member ordering; exact Observation/occurrence/Page/Evidence member ledgers;
  structured signals and rationale; grouping-only confidence; ambiguous and singleton preservation;
  pending/accepted/rejected/split states; and strict referential/zero-loss validation.
- **Public contract decision:** Added `GroupProposal`, member, signal, ambiguity, kind, grouping
  confidence, and review-status schemas/types. ADR-010 retains contract schema `1.0.0` for additive
  pre-release records and introduces independent grouping algorithm version `1.0.0`.
- **Persistence decision:** No persistence was required or added. Grouping remains a pure,
  JSON-serializable transformation; SQLite stays deferred until a concrete cross-session review,
  query, or transaction need exists.
- **Tests executed:** Targeted grouping/shared suites; `npm run typecheck`; full `npm test` with
  loopback/Chromium permission; `npm run lint`; `npm run format:check`.
- **Result:** All required checks passed. Root suite: 10 files / 52 tests. The labeled deterministic
  cases retained 236/236 members and passed expected merge, non-merge, ambiguity, singleton,
  traceability, rerun, serialization, schema-version, and rejected/split behaviors.
- **Known issues:** Chunk 3 currently supplies null component fingerprints and no template identity;
  lightweight selector/HTML normalization favors false negatives, especially for generated
  nonnumeric IDs; cross-page structure requires explicit shared identity context; review history is
  not persisted; and Windows execution remains unrecorded. No known Chunk 4 defect.
- **Next logical action:** Execute Chunk 5 (Draft Findings) from `project/HANDOFF.md`; do not begin
  final approval, auditor UI/validation, journeys, export, severity inference, or NVDA automation.

## 2026-09-28 — Codex — Chunk 5

- **Files changed:** Added the `@accessledger/findings` workspace with its public boundary,
  deterministic drafter, and acceptance tests; added Finding source-group and validation-need
  fields; updated the lockfile, architecture, data model, testing methodology, backlog, decisions,
  current state, work log, and handoff.
- **Implemented:** Conservative eligibility for accepted proposals and pending high-confidence
  repeat candidates; supported-WCAG gating for accepted singletons; exact context and referential
  validation; stable policy-derived Finding IDs; neutral source/rule/category Condition template;
  exact occurrence, URL, component, Observation, and Evidence scope; supported-for-all-member WCAG
  criteria; explicit human-review need; and null unsupported judgment fields.
- **Public contract decision:** Finding adds required `sourceGroupProposalId` and `validationNeed`.
  ADR-011 retains contract schema `1.0.0` for the additive pre-release change and introduces
  independent drafting-policy version `1.0.0`.
- **Persistence/LLM decision:** Neither was required. Drafting remains a pure deterministic,
  JSON-serializable transformation. Chunk 6's retained edits, review events, and guarded state
  transitions establish the first concrete persistence requirement.
- **Tests executed:** Targeted findings/shared suites; `npm run typecheck`; full `npm test`;
  `npm run lint`; `npm run format:check`.
- **Result:** All required checks passed. Root suite: 11 files / 64 tests. Chunk 5 tests cover
  eligibility, refusal paths, stable output, exact counts, multi-page scope, WCAG support/candidate
  behavior, trace failures, null fields, schema/JSON handling, and prohibited-language/scanner-
  impact isolation.
- **Known issues:** Draft language is intentionally functional rather than polished; criterion
  support is conservative across every member; component descriptions fall back to an occurrence
  ID if no locator evidence exists; Windows execution remains unrecorded. No known Chunk 5 defect.
- **Next logical action:** Execute Chunk 6 (Auditor Review + Validation) from `project/HANDOFF.md`;
  do not begin journeys, export, customer-facing reporting, or automated NVDA control.

## 2026-09-28 — Codex — Chunk 6

- **Files changed:** Added `@accessledger/persistence` and `@accessledger/auditor-studio`; added the
  Finding review service, shared Validation claim/severity and ReviewAuditEvent contracts, review
  fixtures/tests, root startup script, lockfile workspace entries, auditor-review documentation,
  and required architecture/data/testing/backlog/decision/current-state/handoff updates.
- **Persistence decision:** ADR-012 selects local SQLite through `node:sqlite`, ordered migration
  schema version `1`, immutable per-bundle source links, retained original Finding/GroupProposal,
  current Finding projection, append-only grouping/Validation/audit records, SQLite immutability
  triggers, `BEGIN IMMEDIATE` transactions, and optimistic whole-Finding comparison. No ORM or
  remote/multi-tenant store was added.
- **Implemented:** Complete trace create/load and revalidation; allowed five-part/confidence/source-
  candidate edits; accepted/rejected/split grouping decisions without member loss; explicit human
  Validation claims; exact severity support; `draft -> in_review -> approved|rejected`; atomic
  audit history; and a native server-rendered evidence-first auditor UI.
- **Approval policy:** Requires accepted grouping, intact exact trace, Cause/Effect/Recommendation/
  severity/confidence, supported human claims for all required judgments, and a severity exactly
  matching supported human Validation. Scanner impact, grouping confidence, browser semantics,
  agent failure, and LLM output have no judgment-promotion path.
- **Public contract decision:** Validation adds required `claims[]` and `validatedSeverity`; adds
  `ReviewAuditEvent`, `FindingReviewService`, review trace/edit/input contracts, repository
  contracts, `SqliteReviewRepository`, and persistence schema version `1`. Public contract schema
  remains `1.0.0` as a coordinated pre-release change before retained review data.
- **Tests executed:** Targeted Chunk 6/shared suites; `npm run typecheck`; full `npm test` with
  loopback/Chromium access; `npm run lint`; `npm run format:check`.
- **Result:** All required checks passed. Root suite: 14 files / 75 tests. Chunk 6 targeted suites:
  4 files / 16 tests. Coverage includes migrations, exact bundle source links, rollback,
  immutable-source/original record retention, complete trace, edits, all grouping decisions,
  validation/severity/approval gates, invalid transitions, tampered trace rejection, audit history,
  schema/serialization, semantic keyboard UI, and happy-path approval.
- **Known issues:** The local studio has no importer, binary artifact viewer, styling, account/auth,
  or concurrent merge UI. Node 22 emits the upstream `node:sqlite` experimental warning. Windows
  execution remains unrecorded. No known Chunk 6 correctness defect.
- **Next logical action:** Execute Chunk 7 (Resident Journey Recording) from `project/HANDOFF.md`;
  add a new migration and do not begin export or autonomous/automated resident/NVDA behavior.

## 2026-09-28 — Codex — Chunk 7

- **Files changed:** Added the `@accessledger/journeys` workspace and tests; extended shared journey
  and audit contracts; added SQLite migration 2 plus journey repository operations; extended
  Finding review traces and the auditor studio; updated the lockfile, architecture, auditor-review,
  data-model, journey, testing, backlog, decisions, current-state, work-log, and handoff documents.
- **Persistence design:** Left migration 1 unchanged. Migration 2 adds current ResidentJourney
  projections, append-only protocol revisions, normalized protocol/result Finding links,
  append-only JourneyResult rows, immutable result Evidence links, and append-only journey audit
  events. Protocol edits use optimistic whole-record comparison. Create/edit/result/Validation
  writes use `BEGIN IMMEDIATE`; duplicate result tests prove Evidence and audit rollback.
- **Implemented:** Generic protocol create/load/list/edit/safe soft-delete; human performer; platform/browser/
  optional assistive-technology environment; start/end timing; all five explicit outcomes;
  distinct not-attempted/interrupted-inconclusive/unable behavior; optional human NVDA observations;
  immutable same-assessment human Evidence; same-assessment Finding links; complete audit history;
  and native keyboard-operable studio forms plus linked-result Finding review.
- **Validation policy:** Recording a result never creates a claim or severity. A separate operation
  creates JourneyResult-subject Validation only for a linked in-review Finding using Evidence from
  that result. The Validation, Finding validation-status projection, review audit event, and journey
  audit event commit atomically. Existing exact supported-severity assignment remains authoritative.
- **Public contract decision:** JourneyResult adds required `environment`, non-empty unique Evidence,
  timing refinements, and guarded optional NVDA observations. Added `JourneyAuditEvent`,
  `ResidentJourneyService`, journey inputs/traces, `JourneyRepository`, linked JourneyResults on
  Finding review traces, and persistence schema version 2. ADR-013 retains public contract schema
  `1.0.0` as a coordinated pre-release change.
- **Tests executed:** Targeted shared/persistence/journeys/findings/studio suites; `npm run
typecheck`; full `npm test` with loopback permission for deterministic browser fixtures; `npm run
lint`; `npm run format:check`.
- **Result:** All required checks passed. Root suite: 15 files / 81 tests. Targeted Chunk 7/review
  suites: 5 files / 22 tests. Coverage includes migration order/idempotence, transaction rollback,
  create/edit/audit history, all outcomes, performer/environment/timing, link integrity,
  interrupted/inconclusive, optional NVDA, immutable supporting Evidence, separate Validation/exact
  severity, no automatic outcome, schema/serialization, semantic keyboard UI, and happy path.
- **Known issues:** The studio remains unstyled/local and has no importer, artifact viewer,
  authentication, concurrent merge UI, or delete control (safe result-free soft delete is service-only). Node 22 emits the upstream
  `node:sqlite` experimental warning. Windows/NVDA execution remains an external human procedure.
  No known Chunk 7 correctness defect.
- **Next logical action:** Execute Chunk 8 (Findings Register Export) from `project/HANDOFF.md`;
  preserve approved-only traceability and never infer claims or severity from journey outcomes.

## 2026-09-28 — Codex — Chunk 8

- **Files changed:** Added the `@accessledger/export` workspace, shared export schemas/types, JSON/
  CSV serializers, approved-trace eligibility recheck, assessment-scoped Finding listing, export
  CLI/tests, lockfile workspace entry, and Findings Register export documentation. Updated
  architecture, data model, review/journey/testing docs, backlog, decisions, current state, work
  log, and post-MVP handoff.
- **Implemented:** `FindingsExporter.export(assessmentId, format, destination)` through
  `DeterministicFindingsExporter`; deterministic UTF-8 JSON/CSV; fixed schema/column order; stable
  nested ordering; exact five-part content, severity/confidence, WCAG, count/scope, and source trace;
  Validation summaries; optional linked journey protocol/result summaries; SHA-256/byte-length
  manifest; portable parent creation; default overwrite refusal; explicit CLI overwrite; and valid
  empty exports.
- **Eligibility policy:** Non-approved Findings are omitted. Every selected approved Finding is
  revalidated for complete trace, accepted grouping, complete judgments, validated status,
  required supported human claims, exact severity support, valid Validation subjects, and resolved
  human Evidence before file creation. Invalid approved data aborts the complete export.
- **Journey policy:** All five outcome values, protocol context, environments, timing, notes,
  supporting Evidence IDs, and result-subject Validation IDs are preserved. Outcomes are never
  mapped to severity, resident impact, accessibility/WCAG conclusions, conformance,
  certification, or legal conclusions.
- **Public contract decision:** ADR-014 adds an independent Findings Register export schema version
  `1.0.0`; the domain contract remains `1.0.0` and persistence remains version `2`. Added shared
  export schemas/types, `@accessledger/export` public interfaces, optional assessment scoping on
  `listFindingIds`, and `assertExportableApprovedTrace`. No SQLite migration or domain-record shape
  changed.
- **Application decision:** Added
  `npm run findings:export -- <database-path> <assessment-id> <json|csv> <destination>
[--overwrite]`. No auditor-studio integration was added because the implementation plan requires
  only the narrow CLI/export boundary.
- **Tests executed:** Export/CLI/persistence targeted suites; `npm run typecheck`; full `npm test`
  with loopback permission; `npm run lint`; `npm run format:check`.
- **Result:** All required checks passed. Root suite: 17 files / 96 tests. Chunk 8 adds 11 tests
  covering schema/serialization, stable ordering, JSON/CSV escaping and Unicode, round-trip trace
  IDs, approved-only/empty/no-journey behavior, portable nested paths, overwrite policy, hash/size,
  broken/incomplete/unsupported refusal, all journey outcomes, Evidence/Validation linkage, no
  outcome-to-severity inference, CLI help/arguments/errors/cleanup, and happy-path export.
- **Known issues:** `generatedAt` intentionally changes bytes/hashes across real runs; CSV nested
  fields require JSON parsing. XLSX, full reports, dashboards, accounts, multi-tenancy, monitoring,
  and automated journey/NVDA behavior remain deferred. Node 22 emits its upstream `node:sqlite`
  warning. No known Chunk 8 correctness defect.
- **Next logical action:** Conduct the post-MVP acceptance and productization decision in
  `project/HANDOFF.md`; do not begin a deferred product track until it is explicitly selected.

## 2026-09-29 — Codex — Saved assessment preparation CLI

- **Files changed:** Added assessment preparation orchestration/CLI and focused tests in
  `apps/assessment-cli`; added the root `assessment:prepare` script and workspace dependencies;
  updated architecture, raw-capture, auditor-review, backlog, current-state, work-log, and handoff
  documentation.
- **Implemented:** Runtime validation and operational-failure refusal; deterministic observation,
  WCAG, grouping, and drafting composition; exact per-Finding context slicing; review-service
  persistence; portable database parent creation; duplicate deterministic Finding preflight;
  concise count manifest; and repository closure on success/failure.
- **Boundaries retained:** No group is auto-accepted. No severity, Finding confidence, Validation,
  unsupported WCAG claim, scanner impact, or grouping confidence is promoted into a Finding.
  Public contract remains `1.0.0`; persistence schema remains `2`; no migration changed.
- **Tests:** Added focused coverage for valid, malformed, contract-invalid, navigation-failed, and
  scan-failed input; supported/ignored/unknown inputs; zero/non-zero eligible paths; deterministic
  counts; portable nested paths; complete trace persistence; existing-database duplicate refusal;
  resource closure; unsupported WCAG retention; and no-inference fields.
- **Checks executed:** `npm run typecheck`; full `npm test` with loopback permission; `npm run lint`;
  `npm run format:check`. Result: 18 files / 104 tests passed; only Node 22's expected
  `node:sqlite` experimental warning was emitted.
- **Acceptance finding:** The current normalizer always emits null component fingerprints, so raw
  scans cannot create a pending high-confidence repeat. The existing studio/repository cannot
  accept a GroupProposal before a draft Finding exists. Preparation therefore yields zero bundles
  for ordinary current scans unless upstream normalization supplies a valid fingerprint-bearing
  occurrence. This was documented rather than bypassed.
- **Manual artifact:** The user-owned `naperville-scan.json` was not modified. Its npm command
  banner makes it malformed JSON; regenerate it with the documented silent npm scan command before
  manual acceptance. A read-only diagnostic of its JSON payload produced 0 observations, 5 ignored
  inputs, and 2 unrecognized rules, so the current Naperville capture would still create an empty
  review database after banner removal.
