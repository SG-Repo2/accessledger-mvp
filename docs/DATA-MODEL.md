# Data Model

## Contract rules

Runtime contracts live in `packages/shared/src` and are exported by `@accessledger/shared`. Zod
schemas are authoritative for record shape; TypeScript types are inferred from those schemas.
Persisted public records carry `schemaVersion: "1.0.0"`. IDs are opaque, stable, non-empty strings,
timestamps are ISO 8601 strings with offsets, and payloads must be JSON-serializable.

Schema validation checks shape, not cross-record existence. The persistence/service layer must
enforce referential integrity, count consistency, uniqueness, and lifecycle transitions.

Raw evidence and interpretation are different records. Normalization, WCAG evaluation, grouping,
and drafting must never overwrite raw payloads.

## Relationships

```text
Assessment 1--* Page 1--* Evidence
Assessment 1--* Observation 1--* ObservationOccurrence
ObservationOccurrence *--1 Page
ObservationOccurrence *--* Evidence
GroupProposal *--* ObservationOccurrence, Observation, Page, and Evidence
Finding *--1 source GroupProposal and *--* Observation and *--* Evidence
Validation *--1 Observation | Finding | JourneyResult
ResidentJourney 1--* JourneyResult
Finding *--* ResidentJourney (related IDs)
JourneyResult *--* Evidence (immutable supporting links)
```

### Assessment

An assessment is the top-level scope for targets and results.

| Field                      | Meaning                                                |
| -------------------------- | ------------------------------------------------------ |
| `id`, `schemaVersion`      | Stable identity and contract version                   |
| `name`, `status`           | Human label and lifecycle (`draft` through `archived`) |
| `targetUrls`               | One or more requested web targets                      |
| `targetStandard`           | WCAG version and target levels                         |
| `startedAt`, `completedAt` | Nullable execution bounds                              |
| `createdAt`, `updatedAt`   | Record timestamps                                      |

### Page

A page belongs to an assessment and records requested/final URL, title, language, load status,
failure reason, load time, and raw evidence IDs. A failed load is not an accessibility failure.
`finalUrl`, metadata, and failure information remain nullable when unknown or inapplicable.

### Evidence

Evidence is an immutable source record: `id`, assessment/page scope, `kind`, typed `source`, capture
time, `contentType`, JSON `payload`, and JSON metadata. Kinds cover raw browser/scanner results, DOM,
browser accessibility semantics, interaction traces, screenshots, and human notes. Tool versions
are nullable only when genuinely unavailable. Binary artifacts are referenced through JSON metadata
rather than embedded in relational records.

### RawPageAssessment

`RawPageAssessment` is the serializable page-capture aggregate, not a replacement for Page or
Evidence. It contains one validated Page, required raw browser Evidence, nullable raw scanner
Evidence, ordered accessibility-semantics Evidence when targets were requested, start and
completion timestamps, and a discriminated operational result:

- `loaded`: the page loaded and axe returned raw JSON;
- `navigation_failed`: browser launch, navigation, or page-metadata capture failed; or
- `scan_failed`: the page loaded but axe injection or execution failed.

The aggregate schema enforces matching assessment/page IDs and exact ordered Page
`rawEvidenceIds`. Accessibility evidence must link the aggregate browser/scanner evidence and its
target metadata. Navigation failures require a failed Page, no scanner Evidence, and no
accessibility Evidence; loaded and scan-failed results require a loaded Page and scanner Evidence.
Its request is `assessmentId`, URL, and optional accessibility target descriptors. Runtime
Playwright handles are never part of this contract.

### AccessibilityTargetDescriptor and accessibility semantics

An `AccessibilityTargetDescriptor` is a versioned CSS evidence locator with an opaque target ID,
selector, and nullable `sourceEvidenceId`. Selectors can reproduce a controlled collection but are
not durable DOM identity. Target IDs must be unique within a collection, and a non-null source
evidence ID must belong to the collection's browser/scanner evidence context.

`AccessibilitySemanticsEvidence` specializes `Evidence(kind="accessibility_semantics")`. Its
payload is either `collected`, with browser-exposed role, name, description, value, focusability,
selected states, and relationships, or `error`, with a typed target/API error. Each semantic field
is explicitly `available` or `unavailable`; an available empty name is distinct from an unavailable
name. Its provenance records browser, automation, and Chrome DevTools Protocol versions and
explicitly says the record is browser semantics, not assistive-technology output. Metadata retains
the target ID, ordered raw evidence IDs, and optional exact source evidence ID.

### Observation

An observation is a normalized technical proposition derived from evidence. It stores the exact
source tool and version, category, summary, optional source rule, testability category, evaluation
state, candidate WCAG criterion IDs, at least one evidence ID, and structured deterministic
`facts`. Facts are intentionally small inputs for inspectable requirement evaluation; they do not
replace or rewrite the referenced raw payload. An observation does not claim resident impact.

### ObservationOccurrence

An occurrence is one concrete affected location. It references its observation, page, and at least
one evidence item, with optional selector, HTML snippet, component fingerprint, and JSON
`sourceDetail`. Source detail retains the exact relevant scanner rule/node or accessibility target,
semantics, and provenance so later stages need not infer them from prose. Grouping may associate
occurrences but must not delete them. Occurrence count on a finding is a derived snapshot whose
consistency is enforced outside Zod.

### WCAGCriterion

The criterion record contains `id`, title, level, principle, guideline, normative/intent sources,
automated testability, evidence requirements, known rule mappings, and manual validation guidance.
Normative and informative sources are not interchangeable. See `WCAG-KNOWLEDGE-MODEL.md`.

### WcagCandidateEvaluation

A candidate evaluation is a separate versioned record, never a Finding. It references its
Observation and evidence, the independent WCAG dataset version, WCAG edition, nullable criterion,
source mapping, evaluation state, reason, and an ordered requirement trace. Each requirement trace
records the inspected fact path, operator, expected and actual JSON values, and whether evidence
was `satisfied`, `contradicted`, or `insufficient`. A known mapping produces `supported`,
`unsupported`, or `uncertain`; an unknown source rule is preserved as `unknown_rule` with an
uncertain evaluation and no invented criterion.

### GroupProposal

A group proposal is a versioned, reviewable association and never a destructive deduplication. It
stores `schemaVersion`, an independent grouping-algorithm version, stable proposal ID, assessment,
kind (`repeat_candidate`, `singleton`, or `ambiguous`), review status, grouping-only confidence,
visible rationale, timestamps, and structured deterministic signals.

Each proposal has an exact member ledger containing Observation ID, ObservationOccurrence ID, Page
ID, and the union of parent-observation and occurrence Evidence IDs. Ordered top-level Observation,
occurrence, Page, and Evidence ID indexes must exactly match those members. Repeat candidates have
at least two members; singleton and ambiguous proposals have exactly one. Ambiguous proposals link
related occurrences without treating them as members. Review can accept, reject, or mark a proposal
split without removing its original member ledger. Grouping confidence is not Finding confidence,
severity, WCAG support, or resident impact.

### Finding

A finding is a reviewable systemic issue with:

```text
id, schemaVersion, assessmentId, sourceGroupProposalId, title, status, wcagCriteria[]
condition, cause, effect, recommendation
severity, confidence, validationStatus, validationNeed
affectedUrls[], affectedComponents[], affectedJourneys[]
occurrenceCount, observationIds[], evidenceIds[]
createdAt, updatedAt
```

`condition` is required. `cause`, `effect`, `recommendation`, `severity`, and `confidence` are
nullable because missing judgment must never be fabricated. A finding requires at least one
observation and evidence reference. `sourceGroupProposalId` preserves the drafting boundary, and
`validationNeed` states what a human must verify. Criteria may be empty while a draft is under
evaluation; deterministic drafting includes a criterion only when every member Observation has a
supported evaluation for it.

### Validation

A validation identifies one subject (`observation`, `finding`, or `journey_result`), method,
supported/unsupported/inconclusive outcome, explicit reviewed claims, human performer and time,
optional assistive technology, notes, and Evidence. Finding-review claims are `grouping`,
`condition`, `wcag`, `cause`, `effect`, `recommendation`, and `severity`. A supported severity claim
also records exactly one `validatedSeverity`; no other Validation may populate that field. The
`nvda` method requires assistive-technology details and remains a method used by a human, not an
automated persona.

### ReviewAuditEvent

A review audit event is a versioned append-only record containing the assessment/Finding, affected
entity, typed action, human actor, optional reason, timestamp, and JSON before/after snapshots.
Actions cover review creation/start, grouping decisions, allowed edits, Validation addition,
severity assignment, and approval/rejection. Audit snapshots do not replace the immutable domain
records they reference.

### Review and journey persistence projection

SQLite persistence schema version `1` stores the immutable source records, immutable original draft
Finding and GroupProposal, mutable current Finding projection, append-only grouping decisions,
append-only Validation records, and append-only audit events. The current GroupProposal review
status is projected from the newest decision while its original members and indexes remain intact.
Public domain JSON is runtime-validated on every repository read.

Persistence schema version `2` adds current ResidentJourney projections, append-only protocol
revisions, normalized current protocol-to-Finding links, append-only JourneyResult records,
append-only result-to-Finding and result-to-Evidence links, and append-only journey audit events.
Migration 1 is unchanged. Protocol edits use optimistic comparison; result/Evidence/Validation and
audit writes are transactional.

### ResidentJourney

A journey is a human validation protocol: assessment, goal, starting URL, preconditions, human task,
expected observable outcome, related Finding IDs, and record timestamps. Examples are data, not
hard-coded engine logic. Finding links must exist in the same assessment. Edits replace the current
projection while retaining an append-only revision and audit event; results remain attached to the
stable journey identity. A protocol edit cannot remove a Finding link referenced by an existing
append-only result. Safe deletion is an internal soft-delete projection allowed only before results
exist; revisions and audit history remain.

### JourneyResult

A result stores its assessment/journey, required human performer, explicit environment, timing,
optional human NVDA observations, notes, related Findings, immutable supporting Evidence, and one
outcome. Environment contains platform, browser name/version, and nullable assistive-technology
name/version:

- `completed`
- `completed_with_difficulty`
- `unable_to_complete`
- `not_attempted`
- `inconclusive`

`not_attempted` requires a null completion time. Every attempted outcome requires an end time no
earlier than its start; an interrupted attempt is `inconclusive`, not `not_attempted`. NVDA notes
require a recorded NVDA-on-Windows environment, but both NVDA and the notes are optional. Result
Finding links must already belong to the protocol and the same assessment. Supporting Evidence is
non-empty, same-assessment human Evidence and is stored through immutable source records/links.

Journey result outcomes do not alter Finding claims. A result supports a Finding only through a
separate Validation with subject type `journey_result`, a linked Finding, and non-empty Evidence IDs
drawn from that result. A supported severity claim names one exact severity; assignment still uses
the Finding review gate.

### JourneyAuditEvent

A journey audit event is a versioned append-only record for protocol creation/edit/soft-delete, result
recording, or result-backed Validation. It stores assessment/journey/entity identity, human actor,
optional reason, before/after JSON, and occurrence time. Protocol revisions and events preserve the
history even though the current protocol projection is editable.

### FindingsRegisterDocument and export manifest

The independently versioned Findings Register export schema begins at `1.0.0`. A document contains
one assessment ID, generation time, exact record count, and ordered approved Finding records. Each
record preserves the Finding contract version and stable ID, source GroupProposal ID, five-part
content, validation need, exact severity/confidence, WCAG criteria, occurrence count, affected
URLs/components, source Observation/Evidence IDs, concrete occurrence references, Validation
summaries, and optional linked journey protocol/result summaries.

Occurrence summaries identify their ObservationOccurrence, Observation, Page, effective URL,
component reference, and Evidence. Validation summaries preserve subject, method, outcome, claims,
exact validated severity when applicable, performer/time, assistive-technology context, notes, and
Evidence IDs. Journey result summaries preserve the exact outcome enum, environment, timing,
optional human NVDA notes, Finding/Evidence IDs, and result-subject Validation IDs. These copied
outcomes are context and have no inference relationship to Finding severity or any legal,
certification, conformance, or violation conclusion.

`FindingsRegisterExportManifest` records schema version, format, assessment, generation time,
record count, resolved artifact path, exact UTF-8 byte length, and lowercase SHA-256. The JSON
document is nested. CSV uses one Finding per row and compact JSON for nested values; its column
schema and ordering are documented in `FINDINGS-REGISTER-EXPORT.md`.

## Lifecycle and integrity expectations

- Records are append-oriented; corrections should preserve audit history once persistence exists.
- Journey protocols are editable only through revisioned transactions; JourneyResult, supporting
  Evidence links, Validation, and journey audit records are append-only.
- Only reviewed findings become `approved` and eligible for authoritative export.
- Approval must fail when required validation is incomplete or traceability is broken.
- Finding lifecycle is `draft -> in_review -> approved|rejected`; review mutations require
  `in_review`, and approved/rejected Findings are terminal in Chunk 6.
- Approval requires accepted grouping, complete five-part judgments and confidence, and explicit
  supported human claims, including exact evidence-backed severity.
- Deleting a group must not cascade-delete evidence or occurrences.
- URLs remain URL strings; filesystem artifact locations are resolved with portable Node path APIs.
- Contract migrations are explicit. A public field or enum change requires documentation, tests,
  an architecture decision, and a schema-version decision.

## Deferred modeling

Ownership, remediation cost, due dates, grouping audit-event history, raw browser driver internals,
and additional persistence projections are intentionally deferred to the chunks that can validate
their requirements. They should extend these relationships rather than collapse evidence into
findings.
