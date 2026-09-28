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
Finding *--* Observation and *--* Evidence
Validation *--1 Observation | Finding | JourneyResult
ResidentJourney 1--* JourneyResult
Finding *--* ResidentJourney (related IDs)
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

`RawPageAssessment` is the Chunk 1 serializable aggregate, not a replacement for Page or Evidence.
It contains one validated Page, required raw browser Evidence, nullable raw scanner Evidence, start
and completion timestamps, and a discriminated operational result:

- `loaded`: the page loaded and axe returned raw JSON;
- `navigation_failed`: browser launch, navigation, or page-metadata capture failed; or
- `scan_failed`: the page loaded but axe injection or execution failed.

The aggregate schema enforces matching assessment/page IDs and exact ordered Page
`rawEvidenceIds`. Navigation failures require a failed Page and no scanner Evidence; loaded and
scan-failed results require a loaded Page and scanner Evidence. Its request is only `assessmentId`
plus URL. Runtime Playwright handles are never part of this contract.

### Observation

An observation is a normalized technical proposition derived from evidence. It stores category,
summary, optional source rule, testability category, evaluation state, candidate WCAG criterion IDs,
and at least one evidence ID. It does not claim resident impact.

### ObservationOccurrence

An occurrence is one concrete affected location. It references its observation, page, and at least
one evidence item, with optional selector, HTML snippet, and component fingerprint. Grouping may
associate occurrences but must not delete them. Occurrence count on a finding is a derived snapshot
whose consistency is enforced outside Zod.

### WCAGCriterion

The criterion record contains `id`, title, level, principle, guideline, normative/intent sources,
automated testability, evidence requirements, known rule mappings, and manual validation guidance.
Normative and informative sources are not interchangeable. See `WCAG-KNOWLEDGE-MODEL.md`.

### Finding

A finding is a reviewable systemic issue with:

```text
id, schemaVersion, assessmentId, title, status, wcagCriteria[]
condition, cause, effect, recommendation
severity, confidence, validationStatus
affectedUrls[], affectedComponents[], affectedJourneys[]
occurrenceCount, observationIds[], evidenceIds[]
createdAt, updatedAt
```

`condition` is required. `cause`, `effect`, `recommendation`, `severity`, and `confidence` are
nullable because missing judgment must never be fabricated. A finding requires at least one
observation and evidence reference. Criteria may be empty while a draft is under evaluation.

### Validation

A validation identifies one subject (`observation`, `finding`, or `journey_result`), method,
supported/unsupported/inconclusive outcome, human performer and time, optional assistive technology,
notes, and evidence. `nvda` is a method used by a human; it is not an automated persona.

### ResidentJourney

A journey is a human validation protocol: assessment, goal, starting URL, preconditions, human task,
expected observable outcome, and related finding IDs. Examples are data, not hard-coded engine logic.

### JourneyResult

A result stores its assessment/journey, human performer, timing, optional NVDA observations, notes,
related findings, evidence, and one outcome:

- `completed`
- `completed_with_difficulty`
- `unable_to_complete`
- `not_attempted`
- `inconclusive`

## Lifecycle and integrity expectations

- Records are append-oriented; corrections should preserve audit history once persistence exists.
- Only reviewed findings become `approved` and eligible for authoritative export.
- Approval must fail when required validation is incomplete or traceability is broken.
- Deleting a group must not cascade-delete evidence or occurrences.
- URLs remain URL strings; filesystem artifact locations use portable relative paths.
- Contract migrations are explicit. A public field or enum change requires documentation, tests,
  an architecture decision, and a schema-version decision.

## Deferred modeling

Ownership, remediation cost, due dates, source hashes, grouping proposals, audit-event history, raw
browser driver internals, persistence tables, and export column schemas are intentionally deferred
to the chunks that can validate their requirements. They should extend these relationships rather
than collapse evidence into findings.
