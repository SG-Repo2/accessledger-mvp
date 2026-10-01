# Current State

Updated: 2026-10-01

## Completed

Chunks 0–8 are complete. The local MVP now captures and normalizes browser/scanner evidence, maps
reviewable WCAG candidates, groups without occurrence loss, drafts traceable Findings, retains
human review and manual journey records, and exports approved Findings as deterministic working
register artifacts.

## Working functionality

- All Chunk 1–7 capture, semantics, normalization, mapping, grouping, drafting, persistence, review,
  Validation, studio, and resident-journey behavior remains intact.
- `@accessledger/export` provides `FindingsExporter` and `DeterministicFindingsExporter` over the
  existing `FindingReviewService` and `ResidentJourneyService` read boundaries.
- Assessment-scoped export omits draft, in-review, and rejected records, then revalidates every
  approved Finding before any file write. Broken trace, incomplete content, unresolved grouping,
  missing exact severity/confidence, invalid human Evidence, or insufficient supported claims
  aborts the export.
- JSON exports are nested, schema-valid register documents. CSV is one Finding per row with fixed
  columns, CRLF records, quoted UTF-8 cells, doubled quotes, and compact JSON cells for arrays and
  nested trace records.
- Stable ordering covers Findings, criteria, set-like IDs/strings, occurrences, Validations,
  journeys, and journey results. Fixed source data plus a fixed generation time produces identical
  bytes and SHA-256.
- Exports preserve stable Finding/GroupProposal/Observation/Occurrence/Page/Evidence/Validation/
  Journey/Result IDs, five-part content, exact severity/confidence, WCAG criteria, scope/counts,
  human Validation summaries, and optional protocol/result summaries.
- Every JourneyResult outcome is copied exactly as recorded with Evidence and result-subject
  Validation IDs. No outcome-to-severity, violation, impact, conformance, certification, or legal
  inference exists.
- `npm run findings:export -- <database-path> <assessment-id> <json|csv> <destination>
[--overwrite]` supplies the narrow local CLI. It refuses a missing database and existing output
  by default, creates destination parents portably, and prints the manifest.
- `apps/auditor-studio` remains the minimal internal review/journey interface; Chunk 8 required no
  studio download/navigation change.
- `npm run assessment:prepare -- <scan-json-path> <database-path>` runtime-validates a saved
  successful `RawPageAssessment`, composes normalization, WCAG evaluation, and grouping, persists
  every proposal with its complete trace, and prints proposal/draft/review-bundle counts separately.
- Preparation uses stable application-level transformation IDs/timestamps, creates database parent
  directories portably, applies SQLite migration 3, refuses duplicate deterministic proposal IDs
  before its atomic batch write, and closes the repository on success or failure.
- `GroupProposalReviewService` loads the original/current proposal, complete trace, append-only
  decision history, and optional draft link. It records explicit accept/reject/split decisions and
  invokes `DeterministicFindingDrafter` only after acceptance.
- Auditor Studio `/proposals` lists every preparation-stage proposal and exposes membership,
  rationale, grouping confidence, WCAG status, evidence/source versions, decision history, and
  native accept/reject/split forms. No proposal is auto-accepted.
- Deterministic scanner normalization now also covers axe-core `aria-prohibited-attr` when every
  node preserves a target, matching non-empty ARIA attribute in parseable HTML, element/computed-
  role check facts, and source/payload engine provenance. The Naperville payload produces one
  technical Observation and eight exact occurrences from that rule.
- `aria-prohibited-attr` is a reviewed WCAG 4.1.2 candidate, not an automatic conclusion. Its
  evaluation remains uncertain unless separate facts establish a user-interface component,
  criterion-relevant attribute information, and that the information is not programmatically
  available. The Naperville payload does not contain those facts.

## Public contracts and versions

- Public domain contract schema remains `1.0.0`; persistence schema is `3`.
- WCAG dataset version is `2026.09.29-1`; it adds the reviewed, evidence-gated
  `aria-prohibited-attr` mapping without adding a criterion or changing the public schema.
- Findings Register export schema is independently versioned `1.0.0` through
  `FINDINGS_REGISTER_EXPORT_SCHEMA_VERSION`.
- `@accessledger/shared` adds Zod schemas/types for export format, Validation/occurrence/journey
  summaries, Finding record, JSON document, and manifest.
- `@accessledger/shared` also exposes versioned `ProposalReviewDecision` and `ProposalDraftLink`
  schemas/types; the original `GroupProposal` contract and algorithm version are unchanged.
- Migration 3 adds immutable proposal originals, immutable ordered source links, append-only
  decisions, and immutable proposal-to-draft links without changing migrations 1 or 2.
- `@accessledger/export` publicly exposes the exporter interface/implementation, options/source
  boundaries, JSON/CSV serializers, and fixed CSV column list.
- `ReviewRepository.listFindingIds(assessmentId?)` and
  `FindingReviewService.listFindingIds(assessmentId?)` add optional assessment scoping.
- `assertExportableApprovedTrace` is the public Finding-domain eligibility recheck used by export.
- The manifest carries schema/format/assessment/generation metadata, record count, resolved path,
  exact UTF-8 byte length, and lowercase SHA-256.

## Not implemented / known limitations

XLSX, polished/full Board Brief or Assessment Report generation, customer dashboards,
multi-tenancy, accounts/authentication, billing, production monitoring, remediation costing,
autonomous journeys, synthetic users/speech, automated form submission, and automated/remote NVDA
remain deliberately out of scope. CSV consumers must parse documented JSON cells for nested
records. `generatedAt` intentionally changes artifact bytes/hashes across real runs. The studio
still has no binary artifact viewer, styling layer, or concurrent merge UI. The current normalizer
emits null component fingerprints. The Naperville payload creates two medium-confidence repeat
proposals and three low-confidence singletons. Its WCAG evaluations remain uncertain; therefore the
singletons cannot draft even if accepted. Node 22 may print its upstream `node:sqlite` experimental
warning; Windows/NVDA remains an external human procedure.

## Validation

Chunk 8 targeted tests cover schema/serialization, stable ordering, JSON/CSV escaping and Unicode,
round-trip identifiers, approved-only/empty exports, nested portable destinations, overwrite
behavior, hashes, no-journey/all-outcome journey cases, Evidence/Validation linkage, tampered trace,
incomplete/unsupported record refusal, no outcome-to-severity inference, CLI help/arguments/
manifest/errors/resource closure, and a complete approved export path.

Assessment-preparation tests cover valid/invalid/malformed input, navigation/scan refusal, ignored
and unknown inputs, zero/non-zero eligible cases, deterministic counts, nested portable paths,
complete SQLite trace persistence, existing-database duplicate behavior, cleanup, unsupported WCAG
and uncertain WCAG retention, and absence of inferred severity/confidence/Validation.
Observation/WCAG tests add positive, negative, preservation, source-version, traceability,
supported, unsupported, and uncertain coverage for `aria-prohibited-attr`, plus explicit `region`
non-coverage.

Proposal-review tests cover public serialization, migration 3 and immutability triggers, atomic
round trips with full trace/source versions, duplicate rerun refusal, append-only decision history,
accepted repeat and supported-singleton drafting, ineligible accepted singletons, rejected/split/
ambiguous non-drafting, studio queue/detail/native forms, and occurrence preservation. The saved
Naperville payload is verified at five persisted pending proposals and zero drafts before review;
explicit acceptance of only its two medium repeats yields two drafts with 3 and 2 occurrences.

Required root commands pass:

```text
npm run typecheck
npm test                 # 19 files / 124 tests
npm run lint
npm run format:check
```

The full test run requires permission to bind the deterministic loopback fixture server. The only
runtime warning is Node 22's upstream `node:sqlite` experimental notice.

## Versions and next work

- Last completed chunk: 8
- MVP status: implementation complete; operator preparation command added
- Next recommended work: conduct human Finding review/Validation for the two Naperville drafts
  before any approval or export attempt
- Blocker: the two drafts still lack human judgment fields, supported Validation claims, exact
  severity, and approval; the three remaining singletons also lack supported WCAG criteria

Follow `project/HANDOFF.md` for the exact post-MVP decision prompt and retained limitations.
