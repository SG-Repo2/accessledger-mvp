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

## ADR-010 — Conservative, inspectable grouping proposals without persistence

- **Date:** 2026-09-28
- **Status:** Accepted
- **Context:** Chunk 4 must reduce repeated technical noise without deleting occurrences or turning
  uncertain similarity into a false systemic merge. Chunk 3 does not currently generate component
  fingerprints or page-template identities for every source.
- **Decision:** Add a versioned `GroupProposal` shared contract and deterministic
  `GroupingEngine.propose` boundary. Retain an exact member ledger and redundant validated indexes
  for every Observation, ObservationOccurrence, Page, and Evidence ID. Exact normalized component
  fingerprints may group across Pages. Otherwise, require exact source issue, selector structure,
  component structure, and same-Page or explicit shared-template context. Preserve partial matches
  as separate ambiguous singleton proposals and unmatched inputs as singletons. Use content-derived
  proposal IDs, explicit grouping signals/rationale, grouping-only confidence, and pending,
  accepted, rejected, or split review status.
- **Persistence decision:** Chunk 4 remains a pure deterministic transformation over validated
  records. Proposals validate and round-trip as JSON; no repository, cross-session review workflow,
  transaction, or query requirement exists yet. Add no tables, migrations, ORM, or artifact layout.
- **Reason:** False negatives leave work for an auditor, while false merges can hide distinct
  technical causes and weaken traceability. Exact membership and inspectable signals make a future
  review decision reversible without altering source records.
- **Alternatives considered:** Delete duplicate occurrences; group solely by rule; group cross-page
  selector similarity without template context; treat every weak match as one low-confidence group;
  add SQLite only to retain transient proposals.
- **Schema-version decision:** Retain `CONTRACT_SCHEMA_VERSION` at `1.0.0`. `GroupProposal` and its
  supporting enums/records are additive pre-release contracts. The independent grouping algorithm
  version begins at `1.0.0`; either version must change deliberately when its compatibility boundary
  changes.
- **Consequences:** Chunk 5 can consume exact repeat proposals without reconstructing traceability.
  Current null fingerprints and optional template context intentionally create more singletons and
  ambiguous review cases. Review history and persistence remain deferred until a real workflow
  proves their requirements.

## ADR-011 — Deterministic, conservative draft findings with explicit source and validation need

- **Date:** 2026-09-28
- **Status:** Accepted
- **Context:** Chunk 5 must create useful draft Findings from GroupProposal records without
  promoting uncertain grouping, candidate WCAG mappings, scanner impact, or source prose into an
  unsupported conclusion. The original Finding contract did not directly identify its source group
  or explain why validation was required.
- **Decision:** Add `sourceGroupProposalId` and `validationNeed` to the Finding contract and add the
  deterministic `FindingDrafter.draft(group, evidenceContext)` boundary. Draft from accepted repeat
  proposals, accepted singletons with a supported WCAG criterion, or pending high-confidence repeat
  candidates only. Reject rejected, split, ambiguous, pending weak, pending singleton, unsupported
  singleton, incomplete, and broken-trace inputs. Include a WCAG criterion only when it is supported
  for every member Observation. Derive stable IDs from drafting-policy version `1.0.0` and the
  GroupProposal ID. Generate neutral source/rule/category/count prose and require human review.
  Cause, Effect, Recommendation, severity, and Finding confidence remain null.
- **Persistence decision:** Chunk 5 remains a pure transformation. Drafts validate and round-trip as
  JSON, and there is no cross-session edit, query, transaction, or audit-event requirement yet.
  Chunk 6's retained reviewer edits and state transitions are the first proven persistence need.
- **LLM decision:** Do not add an LLM assistant. Deterministic templates satisfy the current
  requirements without introducing an additional provenance, isolation, or overwrite boundary.
- **Reason:** Strict context validation preserves the full evidence chain, and conservative
  eligibility prevents grouping confidence from masquerading as technical or experiential
  support. Explicit source-group and validation-need fields make the draft reviewable without
  hiding important state in prose.
- **Alternatives considered:** Draft every singleton; promote all candidate criteria; copy scanner
  impact into severity; use an LLM for prose; encode source-group or validation need only inside the
  Condition; add SQLite solely to retain transient deterministic output.
- **Schema-version decision:** Retain `CONTRACT_SCHEMA_VERSION` at `1.0.0`. The two required Finding
  fields and the new package boundary are additive pre-release changes before persisted production
  Finding data exists. A breaking change after persistence or external release requires an explicit
  version increment.
- **Consequences:** Existing Finding fixtures/producers must provide source group and validation
  need. Chunk 6 can load a draft's exact proposal and evidence context, but must add audit-safe
  persistence and enforce reviewed state transitions before final approval.

## ADR-012 — Transactional SQLite review store and evidence-gated approval

- **Date:** 2026-09-28
- **Status:** Accepted
- **Context:** Chunk 6 introduces the first state that must survive process boundaries: reviewer
  edits, grouping decisions, human Validation, Finding transitions, and audit history. These writes
  must retain original records and must not partially commit.
- **Decision:** Use local SQLite through Node's `node:sqlite` API behind a narrow synchronous
  `ReviewRepository`. Use explicit ordered SQL migrations beginning at persistence schema version
  `1`, `BEGIN IMMEDIATE` transactions, foreign keys, and current-Finding optimistic comparison.
  Store immutable source entities once; retain original Finding and GroupProposal JSON; project the
  current Finding; append grouping decisions, Validation records, and versioned ReviewAuditEvent
  records. Enforce source and history immutability with repository APIs plus SQLite triggers.
- **Review policy:** Enforce `draft -> in_review -> approved|rejected` in the service. Allow
  five-part edits, confidence, and source-candidate WCAG selection only while `in_review`. Preserve
  group members for accepted/rejected/split decisions. Require same-assessment human Evidence for
  Validation. Severity must exactly match a supported Validation severity claim. Approval requires
  accepted grouping, intact complete trace, completed Cause/Effect/Recommendation/severity/
  confidence, and supported human claims for grouping, Condition, Cause, Effect, Recommendation,
  severity, and WCAG when present.
- **Public contracts:** Add `Validation.claims`, `Validation.validatedSeverity`, and versioned
  `ReviewAuditEvent`. NVDA-method Validation requires assistive-technology details. Add
  `FindingReviewService`, `ReviewRepository`, `SqliteReviewRepository`, complete-trace and edit/
  validation input types, and persistence schema version `1`.
- **Reason:** SQLite is portable and sufficient for the proven single-user local access pattern.
  JSON domain payloads preserve the existing Zod contract boundary, while transactions and
  append-only history make review changes auditable without designing a remote multi-user system.
  Explicit claim/severity support prevents scanner impact, grouping confidence, browser semantics,
  agent failure, or assisted prose from silently becoming human conclusions.
- **Alternatives considered:** JSON files with rewrite/locking conventions; a remote database; an
  ORM before query needs exist; mutable group/source rows; UI-only transition enforcement; using
  scanner impact as severity.
- **Schema-version decision:** Retain public `CONTRACT_SCHEMA_VERSION` `1.0.0`. The Validation fields
  and ReviewAuditEvent are coordinated pre-release additions made before any persisted review data
  exists. Persistence migrations have their own version sequence beginning at `1`; future table or
  data changes add migrations without rewriting migration 1. A breaking public-contract change
  after retained/released data requires a contract version increment and data migration.
- **Consequences:** Node must provide `node:sqlite`; Node 22 may print its upstream experimental-
  feature warning. The current repository is intentionally local/synchronous and not multi-user.
  A later journey migration can append tables and reuse Validation/human Evidence without changing
  immutable Chunk 6 records.

## ADR-013 — Revisioned human journey records with explicit result-backed Validation

- **Date:** 2026-09-28
- **Status:** Accepted
- **Context:** Chunk 7 must retain editable human-authored civic-task protocols and reproducible
  manual outcomes without turning browser/scanner/agent failure into resident experience or
  bypassing Chunk 6's human Evidence and severity gates.
- **Decision:** Add `ResidentJourneyService` and a `JourneyRepository` implemented by
  `SqliteReviewRepository`. Add ordered persistence migration 2 without changing migration 1.
  Store a current ResidentJourney projection plus append-only revisions, append-only JourneyResult
  records, normalized same-assessment Finding links, immutable result-to-Evidence links, and
  append-only `JourneyAuditEvent` history. Require each result to contain an explicitly selected
  outcome, named human performer, platform/browser/optional assistive-technology environment,
  timing, and non-empty human Evidence. Treat `not_attempted` as having no end time; require an end
  time for every attempted state, including interrupted `inconclusive` work. Permit optional NVDA
  observations only when an NVDA-on-Windows environment is recorded.
- **Deletion policy:** Provide CRUD completeness through a non-destructive soft delete only for
  protocols with no recorded results. Active reads exclude the deleted projection while the row,
  revisions, and audit events remain. Result-bearing protocols cannot be deleted.
- **Validation policy:** Recording a JourneyResult never creates a Validation, alters a Finding, or
  assigns severity. A second explicit operation may add a Validation whose subject is the persisted
  result, whose Finding is linked to the protocol/result, and whose Evidence IDs come from that
  result. Store the Validation, derived Finding validation status, review audit event, and journey
  audit event in one transaction. Existing FindingReviewService exact-severity assignment and
  approval gates remain authoritative.
- **Public contracts:** Add required JourneyResult `environment`, non-empty supporting Evidence,
  timing/NVDA refinements, and versioned `JourneyAuditEvent`; add `ResidentJourneyService`, journey
  input/trace contracts, `JourneyRepository`, and persistence schema version 2. Finding review
  traces add linked `journeyResults`.
- **Reason:** Revisioned protocols preserve corrections without erasing history; immutable results
  and Evidence preserve what a human actually recorded; normalized links enforce scope; and the
  separate Validation step prevents outcome labels from silently becoming technical, experiential,
  severity, conformance, certification, or legal claims.
- **Alternatives considered:** Mutable results; JSON-only journey files; encode outcome directly as
  Validation; map `unable_to_complete` to Blocker; infer outcomes from browser/agent failures; drive
  NVDA remotely; modify migration 1; physically delete protocols and their history.
- **Schema-version decision:** Retain public `CONTRACT_SCHEMA_VERSION` `1.0.0` for coordinated
  pre-release additions before any released/retained journey data exists. Persistence schema moves
  independently from 1 to 2. A breaking public change after release requires a contract version and
  data migration.
- **Consequences:** Existing JourneyResult producers must provide environment and at least one
  Evidence ID. The local core remains cross-platform and runs without NVDA. Windows/NVDA execution
  is an external human procedure. Protocol deletion is a soft delete allowed only before results
  exist; retained rows/revisions/audit history are never physically removed. Chunk 8 may export
  linked result summaries but must preserve uncertainty and must not infer claims from outcome
  names.
