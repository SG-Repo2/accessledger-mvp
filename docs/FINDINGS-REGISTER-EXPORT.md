# Findings Register Export

## Boundary

Chunk 8 exports the working Findings Register as deterministic UTF-8 JSON or CSV. It reads retained
review and journey data through `FindingReviewService` and `ResidentJourneyService`; it does not
mutate SQLite, generate a public report, certify conformance, or make a legal conclusion.

Only Findings whose current status is `approved` are included. Draft, in-review, and rejected
records are omitted. Before any artifact is written, every selected Finding is rechecked for an
accepted source group, complete trace, complete five-part content, exact non-null severity and
confidence, validated review status, required supported human claims, matching exact severity
Validation, and valid human Evidence. A malformed or unsupported approved record aborts the whole
export. No partial artifact is intentionally written.

## Public interface and versions

`@accessledger/export` exposes:

```text
FindingsExporter.export(assessmentId, format, destination) -> FindingsRegisterExportManifest
DeterministicFindingsExporter
serializeFindingsRegisterJson(document)
serializeFindingsRegisterCsv(document)
FINDINGS_REGISTER_CSV_COLUMNS
```

`@accessledger/shared` exposes the matching Zod schemas and types. The Findings Register export
schema version is independently fixed at `1.0.0` through
`FINDINGS_REGISTER_EXPORT_SCHEMA_VERSION`. The public domain contract remains `1.0.0`, and SQLite
persistence remains version `2`.

The manifest contains export schema version, `json` or `csv`, assessment ID, generation time,
record count, resolved artifact path, lowercase SHA-256 of the exact file bytes, and byte length.
The exporter refuses an existing destination by default; callers may construct it with
`overwrite: true` only after explicitly choosing replacement behavior.

## JSON schema and order

The JSON document contains:

```text
schemaVersion, assessmentId, generatedAt, recordCount, findings[]
```

Each Finding record contains:

```text
schemaVersion, findingContractSchemaVersion, findingId, assessmentId,
sourceGroupProposalId, status="approved",
content { title, condition, cause, effect, recommendation },
validationNeed, severity, confidence, wcagCriteria[], occurrenceCount,
affectedUrls[], affectedComponents[],
trace { observationIds[], sourceEvidenceIds[], occurrences[] },
validations[], journeys[]
```

Occurrence references retain occurrence, observation, Page, URL, component, and Evidence IDs.
Validation summaries retain Validation and subject IDs, method, outcome, claims, exact validated
severity when present, human performer/time, assistive-technology context, notes, and Evidence IDs.
Unsupported and inconclusive Validation history may be present for traceability, but it never
satisfies the supported-claim export gate.

Journey summaries are present only when a linked JourneyResult exists. They retain the protocol
goal, starting URL, ordered preconditions, human task, expected observable outcome, related Finding
IDs, and result summaries. Each result preserves its exact one-of-five outcome, environment, human
performer/timing, optional recorded NVDA observation, notes, related Finding IDs, Evidence IDs, and
linked Validation IDs.

Ordering is stable:

1. Findings by `findingId`.
2. WCAG criteria numerically; URLs, components, Observation IDs, Evidence IDs, and related Finding
   IDs lexically.
3. Occurrences by `occurrenceId`.
4. Validations by `performedAt`, then `validationId`.
5. Journeys by `journeyId`; results by `startedAt`, then `resultId`.

Protocol preconditions retain authored order. JSON property order is fixed by the serializer. The
generation timestamp is intentionally supplied by the export clock; identical source records and
the same generation time produce identical bytes and hashes.

## CSV schema and escaping

CSV has one row per Finding, CRLF record endings, no byte-order mark, and every cell is quoted.
Embedded quotes are doubled; commas, CR/LF, and Unicode remain exact UTF-8 content. Nested arrays
and objects are compact JSON cells. Columns are fixed in this order:

```text
export_schema_version
assessment_id
generated_at
finding_contract_schema_version
finding_id
source_group_proposal_id
status
title
condition
cause
effect
recommendation
validation_need
severity
confidence
wcag_criteria_json
occurrence_count
affected_urls_json
affected_components_json
observation_ids_json
source_evidence_ids_json
occurrence_references_json
validation_summaries_json
journey_summaries_json
```

An empty export contains the header only. JSON cells retain stable IDs for round-trip tracing.

## CLI

```text
npm run findings:export -- <database-path> <assessment-id> <json|csv> <destination> [--overwrite]
npm run findings:export -- --help
```

The database must already exist. Destination parent directories are created with Node filesystem
APIs, and the returned manifest is printed as JSON. Without `--overwrite`, an existing artifact is
refused.

## Human and journey interpretation boundary

Journey outcomes are recorded context only. `completed`, `completed_with_difficulty`,
`unable_to_complete`, `not_attempted`, and `inconclusive` are copied exactly. The exporter contains
no mapping from outcome to severity, resident impact, accessibility violation, WCAG conclusion,
legal conclusion, certification, or conformance. Exported severity is the already approved Finding
severity and must still match separate supported human Validation.

## Limitations

The artifact is a working register, not a polished/full Assessment Report or Board Brief. It has no
XLSX output, customer dashboard, account, multi-tenant boundary, monitoring, remediation cost, or
automated journey/NVDA execution. CSV consumers must parse the documented JSON cells to reconstruct
nested trace records.
