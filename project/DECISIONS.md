# Architecture Decisions

## ADR-001 — Evidence-first, traceable domain chain

- **Date:** 2026-09-28
- **Status:** Accepted
- **Context:** The product must consolidate scanner noise without weakening defensibility.
- **Decision:** Keep Page, raw Evidence, Observation, ObservationOccurrence, WCAG knowledge,
  Finding, and Validation as distinct records. A Finding requires observation and evidence IDs;
  grouping must retain every occurrence.
- **Reason:** Raw facts must remain reproducible and every claim must be auditable backward.
- **Alternatives considered:** Store only scanner results; flatten evidence into findings; delete
  duplicate occurrences after grouping.
- **Consequences:** More records and referential checks are required. Reprocessing and review remain
  possible, and systemic counts do not hide affected locations.

## ADR-002 — Assessment and human-validation boundary

- **Date:** 2026-09-28
- **Status:** Accepted
- **Context:** Automated agents and scanners cannot reliably establish all accessibility or actual
  screen-reader experience.
- **Decision:** AccessLedger renders assessments, never certifications or legal conclusions. Agent
  failure is not accessibility evidence by itself. LLMs are analyst aids only. Actual task outcomes,
  NVDA behavior, and Blocker/Serious severity require human validation.
- **Reason:** This matches the product promise and avoids unsupported experiential claims.
- **Alternatives considered:** Autonomous resident agent; synthetic screen reader; scanner impact as
  final severity.
- **Consequences:** Some records remain uncertain/null until reviewed; the MVP optimizes auditor
  work instead of attempting full automation.

## ADR-003 — Zod contracts with explicit record schema versioning

- **Date:** 2026-09-28
- **Status:** Accepted
- **Context:** Workspace packages need runtime validation and TypeScript types that can evolve.
- **Decision:** `@accessledger/shared` owns Zod schemas, inferred types, and
  `schemaVersion: "1.0.0"` on public persisted records. IDs remain opaque strings and records use
  JSON-serializable values.
- **Reason:** One source of truth prevents compile-time/runtime drift and supports migrations.
- **Alternatives considered:** TypeScript interfaces only; branded UUID-only IDs; implicit package
  version as data version.
- **Consequences:** Public changes require coordinated docs/tests/decision updates and a deliberate
  schema-version decision. Referential integrity remains a service/persistence responsibility.

## ADR-004 — Unsupported finding judgments are nullable

- **Date:** 2026-09-28
- **Status:** Accepted
- **Context:** Technical evidence can strongly support Condition but may not establish Cause,
  experiential Effect, Recommendation, Severity, or Confidence.
- **Decision:** Those Finding fields are nullable; code must not invent values to complete a record.
- **Reason:** Explicit absence is more reliable than polished but unsupported prose.
- **Alternatives considered:** Required placeholder strings; automated inference; omit fields until
  known.
- **Consequences:** Review/export must handle nulls and may gate approval based on policy developed
  in Chunk 6.

## ADR-005 — Cross-platform core with isolated NVDA boundary

- **Date:** 2026-09-28
- **Status:** Accepted
- **Context:** Core development and scanning must run on macOS and Windows, while NVDA is Windows-
  specific.
- **Decision:** Required workflows use Node/npm and portable path/filesystem APIs. Journey and
  Validation records are platform-neutral; any future NVDA adapter is isolated behind that boundary.
- **Reason:** Windows validation must not make the complete pipeline Windows-dependent.
- **Alternatives considered:** Windows-only application; macOS-only development scripts; treat
  browser accessibility semantics as NVDA output.
- **Consequences:** Platform assumptions require explicit adapter code and cross-platform tests.

## ADR-006 — Defer storage implementation; expect lightweight local persistence

- **Date:** 2026-09-28
- **Status:** Accepted
- **Context:** Chunk 0 needs stable serializable boundaries but lacks real access patterns for a
  database/ORM choice.
- **Decision:** Do not add persistence in Chunk 0. Prefer SQLite for the local MVP unless Chunk 3
  evidence demonstrates a better lightweight option; record that later choice separately.
- **Reason:** This avoids premature table/ORM design while keeping contracts storage-ready.
- **Alternatives considered:** Choose SQLite and ORM now; JSON files as permanent storage; remote
  database.
- **Consequences:** Chunks 1–2 may use in-memory or minimal file artifacts for tests. Chunk 3 must
  decide repositories, migrations, integrity rules, and artifact layout if persistence is required.

## ADR-007 — Serializable raw-assessment aggregate with private browser ownership

- **Date:** 2026-09-28
- **Status:** Accepted
- **Context:** Chunk 1 must connect a live Playwright page to axe-core without leaking driver
  handles across the durable contract boundary or treating operational failures as findings.
- **Decision:** Add `RawPageAssessment` as an additive `1.0.0` shared aggregate composed of existing
  Page/Evidence records, timestamps, and a discriminated `loaded` / `navigation_failed` /
  `scan_failed` operational result. Keep concrete Playwright handles private inside a runtime
  `BrowserCapture`; expose only injection/evaluation capabilities. Serialize axe output inside the
  browser and store that parsed JSON directly as raw scanner Evidence. Each load owns one browser,
  context, and page, all closed on every pipeline path.
- **Reason:** This preserves exact JSON scanner data and provenance while making the public result
  portable, runtime-validated, and unambiguous about operational state.
- **Alternatives considered:** Expose Playwright Page publicly; flatten browser and axe output into
  one payload; treat scanner errors as empty successful scans; add observations in the capture
  stage.
- **Schema-version decision:** Keep `CONTRACT_SCHEMA_VERSION` at `1.0.0`. This is an additive
  aggregate during the pre-release MVP and does not alter an existing persisted entity shape or
  enum. A breaking change to Page, Evidence, or this aggregate requires a new decision and version.
- **Consequences:** Direct BrowserLoader callers must close successful captures; the high-level
  assessor guarantees closure. Scanner output may be large and remains intentionally unnormalized.
  Chromium installation is a documented step separate from npm dependency installation.

## ADR-008 — Versioned target locators and browser-semantics evidence

- **Date:** 2026-09-28
- **Status:** Accepted
- **Context:** Chunk 2 needs reproducible browser accessibility semantics for controlled elements
  without exposing Playwright handles or presenting Chromium's tree as NVDA behavior.
- **Decision:** Add a versioned CSS `AccessibilityTargetDescriptor`, a specialized
  `AccessibilitySemanticsEvidence` contract, and an `AccessibilityEvidenceCollector.collect`
  boundary. `BrowserCapture` privately uses a temporary Chrome DevTools Protocol Accessibility
  session and returns serialized AX nodes only. The collector records explicit availability,
  per-target errors, browser/API provenance, `assistiveTechnologyOutput: false`, Page linkage, and
  browser/scanner evidence linkage. Extend `RawPageAssessment` additively with optional target input
  and ordered accessibility evidence output while reusing its existing lifecycle.
- **Reason:** This preserves reproducibility and traceability while making the distinction between
  browser semantics, scanner output, human validation, and NVDA behavior machine-readable.
- **Alternatives considered:** Expose Playwright Page/Locator handles; use DOM/ARIA attributes as a
  substitute for computed semantics; label the Chromium tree as screen-reader output; open a second
  browser after raw assessment; introduce observations or WCAG conclusions in the collector.
- **Schema-version decision:** Keep `CONTRACT_SCHEMA_VERSION` at `1.0.0`. The contracts are additive
  during the pre-release MVP: new target/evidence schemas, an optional request field, and a required
  aggregate evidence array whose producer and existing fixtures were updated together. A breaking
  change to a persisted entity or released aggregate still requires a version increment.
- **Consequences:** Collection currently depends on the pinned Chromium/CDP implementation and CSS
  selectors. Selectors are evidence locators, not durable identity. Unexposed fields remain
  explicitly unavailable, platform/AT behavior still requires human validation, and Chunk 3 may
  normalize these records without changing their source meaning.

## ADR-009 — Deterministic normalization and explicit WCAG candidate evaluation

- **Date:** 2026-09-28
- **Status:** Accepted
- **Context:** Chunk 3 must turn validated raw evidence into traceable technical propositions and
  evaluate documented WCAG candidates without treating scanner output as a Finding or losing
  unknown/insufficient states.
- **Decision:** Add source provenance and structured facts to Observation, exact JSON source detail
  to ObservationOccurrence, explicit rule evidence requirements to WCAG mappings, and a separate
  versioned `WcagCandidateEvaluation` contract. Normalize only axe-core `button-name`, `label`, and
  `aria-valid-attr-value` violations plus a collected browser-semantics button with an explicitly
  available empty name. Evaluate mappings through source-version and fact requirements as
  supported, unsupported, or uncertain; preserve unknown rules as uncertain with no criterion.
  Store the initial WCAG 2.1 A/AA dataset as reviewable JSON version `2026.09.28-1`, containing only
  criterion 4.1.2 and the mappings needed by fixtures.
- **Persistence decision:** Chunk 3 does not require persistence. Normalization and mapping are pure
  transformations over validated records and produce JSON-serializable contracts. Keep SQLite as
  the expected later default, but add no tables, ORM, migration, or setup command until a later
  chunk proves repository/query/transaction requirements.
- **Reason:** The mapper needs inspectable inputs and per-requirement trace to distinguish absent
  evidence from contradictory evidence. Exact occurrence source detail keeps later grouping and
  review auditable without copying or altering raw Evidence.
- **Alternatives considered:** Trust axe WCAG tags as conclusions; store evaluation on Finding;
  discard unknown rules; infer missing evidence as failure; introduce SQLite solely to retain
  transient Chunk 3 outputs.
- **Schema-version decision:** Retain `CONTRACT_SCHEMA_VERSION` at `1.0.0`. These are additive
  pre-release contracts and fields introduced before persisted production data exists. A breaking
  change after persistence or external release requires an explicit version increment.
- **Consequences:** Chunk 4 receives independent observations and concrete occurrences with no
  deduplication. Coverage is intentionally narrow; adding rules, criteria, operators, or source
  versions requires reviewed dataset/code changes and deterministic tests. Browser semantics remain
  browser evidence, not NVDA or resident experience.
