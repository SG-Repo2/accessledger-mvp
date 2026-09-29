# Current State

Updated: 2026-09-29

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
  successful `RawPageAssessment`, composes normalization, WCAG evaluation, grouping, eligible
  Finding drafting, and review-bundle persistence, then prints deterministic stage counts.
- Preparation uses stable application-level transformation IDs/timestamps, creates database parent
  directories portably, applies the existing SQLite migrations, refuses duplicate deterministic
  Finding IDs in an existing database, and closes the repository on success or failure.

## Public contracts and versions

- Public domain contract schema remains `1.0.0`; persistence schema remains `2`.
- Findings Register export schema is independently versioned `1.0.0` through
  `FINDINGS_REGISTER_EXPORT_SCHEMA_VERSION`.
- `@accessledger/shared` adds Zod schemas/types for export format, Validation/occurrence/journey
  summaries, Finding record, JSON document, and manifest.
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
still has no pre-Finding GroupProposal queue/importer, binary artifact viewer, styling layer, or
concurrent merge UI. The current normalizer emits null component fingerprints, so generated pending
groups are not high-confidence and remain ineligible for Finding drafting unless already accepted;
because review persistence begins with a Finding, real raw scans currently prepare zero review
bundles without a future approved grouping-review boundary. Node 22 may print its upstream
`node:sqlite` experimental warning; Windows/NVDA remains an external human procedure. No public
contract or SQLite migration changed for assessment preparation.

## Validation

Chunk 8 targeted tests cover schema/serialization, stable ordering, JSON/CSV escaping and Unicode,
round-trip identifiers, approved-only/empty exports, nested portable destinations, overwrite
behavior, hashes, no-journey/all-outcome journey cases, Evidence/Validation linkage, tampered trace,
incomplete/unsupported record refusal, no outcome-to-severity inference, CLI help/arguments/
manifest/errors/resource closure, and a complete approved export path.

Assessment-preparation tests cover valid/invalid/malformed input, navigation/scan refusal, ignored
and unknown inputs, zero/non-zero eligible cases, deterministic counts, nested portable paths,
complete SQLite trace persistence, existing-database duplicate behavior, cleanup, unsupported WCAG
retention, and absence of inferred severity/confidence/Validation.

Required root commands pass:

```text
npm run typecheck
npm test                 # 18 files / 104 tests
npm run lint
npm run format:check
```

The full test run requires permission to bind the deterministic loopback fixture server. The only
runtime warning is Node 22's upstream `node:sqlite` experimental notice.

## Versions and next work

- Last completed chunk: 8
- MVP status: implementation complete; operator preparation command added
- Next recommended work: decide the minimal pre-Finding grouping-review boundary needed to make
  ordinary saved scans produce reviewable bundles, without auto-accepting groups
- Blockers: current normalized raw assessments cannot produce a pending high-confidence fingerprint
  repeat, while lower-confidence/singleton proposals require acceptance before drafting and the
  persisted review workflow requires a draft Finding before grouping review

Follow `project/HANDOFF.md` for the exact post-MVP decision prompt and retained limitations.
