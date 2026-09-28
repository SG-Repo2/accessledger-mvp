# Handoff — Start Chunk 8 Only

## Last completed work

Chunk 7 (Resident Journey Recording) is complete. Auditors can create/edit generic human journey
protocols, record explicit manual outcomes with immutable human Evidence, add separate
JourneyResult-subject Validation, and view linked results from Finding review. No export,
autonomous browsing, form submission, synthetic user/speech, or NVDA control was added.

## Public contracts and human boundary

Public contract schema remains `1.0.0` under ADR-013's coordinated pre-release decision.
JourneyResult now requires an explicit environment (platform, browser name/version, nullable
assistive technology), non-empty Evidence IDs, and timing consistency. `not_attempted` has no end
time; every attempted outcome—including interrupted `inconclusive`—has an end time. Optional
`nvdaResult` requires a recorded NVDA-on-Windows environment. `JourneyAuditEvent` records protocol
creation/edit/soft-delete, result recording, and result-backed Validation.

`ResidentJourneyService` exposes protocol create/load/list/edit/safe soft-delete, manual result
recording, and separate result Validation. Soft delete is allowed only before a result exists and
retains revisions/audit. Outcomes are always explicit human inputs. Browser/scanner/navigation/
network/authentication/agent failure has no outcome path. A result alone never creates a Finding
claim or severity.

## Persistence and transactions

`SqliteReviewRepository` now implements `ReviewRepository` and `JourneyRepository`. Ordered
migration 2 leaves migration 1 unchanged and adds current protocol projections, append-only
revisions, normalized protocol/result Finding links, append-only JourneyResult rows, immutable
result Evidence links, and append-only journey audit events. Protocol edits use optimistic
whole-record comparison. Protocol create/edit/soft-delete, result recording, and result-backed
Validation each use `BEGIN IMMEDIATE` transactions.

Related Findings must already exist in the same assessment; result links must be a subset of the
protocol links. Result supporting Evidence must be non-empty same-assessment human Evidence.
Result-backed Validation must target a linked in-review Finding and use a non-empty subset of the
result's Evidence. Its Validation, derived Finding validation status, review audit event, and journey
audit event commit together.

## Validation and severity integration

The shared `validations` table stores both direct Finding Validation and JourneyResult-subject
Validation. `FindingReviewService.loadCompleteTrace` now returns `journeyResults`. Its existing
approval-claim evaluation can consume supported result Validation. Exact severity still requires a
supported `severity` claim with `validatedSeverity`, followed by the separate
`FindingReviewService.assignSeverity` operation. Do not map `unable_to_complete` to Blocker,
`completed_with_difficulty` to Serious, or any outcome to any claim automatically.

## Internal workflow and startup

Start a pre-seeded local database with:

```text
npm run auditor:studio -- ./accessledger-review.sqlite
```

The home page links to `/journeys`. Native labeled forms create/edit protocols, record a manual
result, and add a separate Validation. The UI explicitly distinguishes `not_attempted`,
`inconclusive`, and `unable_to_complete`; Finding review lists linked results. The studio remains
unstyled, local, single-user, and has no importer, artifact viewer, authentication, or concurrent
merge UI.

## Known limitations and Chunk 8 integration points

Node 22 may emit its upstream `node:sqlite` experimental warning. Windows/NVDA execution remains an
external human procedure. Protocol deletion is soft and allowed only before results exist so
revisions and audit history remain intact. The current journey link is authoritative through
normalized repository links and `ResidentJourney.relatedFindingIds`; Chunk 8 should read approved
Finding traces plus optional `journeyResults` without mutating the source records.

Chunk 8 should export deterministic UTF-8 JSON and CSV Findings Register artifacts for approved
Findings only. Preserve stable IDs, source traceability, Validation summaries, all journey outcome
values, and Evidence references. Do not infer severity, violation, legal conclusion, certification,
or conformance from a result outcome. Do not add dashboards, accounts, billing, multi-tenancy, full
reports, or monitoring.

## Exact recommended prompt for the next agent

```text
Read AGENTS.md, project/CURRENT-STATE.md, project/HANDOFF.md, docs/ARCHITECTURE.md, the Chunk 8 section of docs/MVP-IMPLEMENTATION-PLAN.md, docs/AUDITOR-REVIEW.md, docs/RESIDENT-JOURNEYS.md, docs/TESTING-METHODOLOGY.md, docs/DATA-MODEL.md, and relevant entries in project/DECISIONS.md. Implement Chunk 8 only: Findings Register Export. Use npm and preserve the existing TypeScript/ESM/workspace setup. Build on FindingReviewService, ResidentJourneyService, SqliteReviewRepository persistence schema version 2, approved Finding traces, explicit human Validation, and optional linked JourneyResult records. Add deterministic UTF-8 JSON and CSV export for approved Findings only, with stable ordering, stable IDs, five-part finding content, exact supported severity/confidence, WCAG criteria, occurrence counts, affected URLs/components, source Observation/Evidence references, Validation summaries, and optional journey protocol/result summaries that preserve all five outcome values and supporting Evidence IDs. Reject draft, in_review, rejected, broken-trace, incomplete, or unsupported records. Treat journey outcomes as recorded context only: never infer severity, accessibility violation, resident impact, legal conclusion, certification, or conformance from completed, completed_with_difficulty, unable_to_complete, not_attempted, or inconclusive. Add a narrow CLI/export boundary and only the minimal internal auditor-studio download/navigation integration if the implementation plan requires it. Do not add a customer dashboard, multi-tenancy, accounts, billing, polished/full reports, monitoring, XLSX unless straightforward and explicitly justified, autonomous journeys, synthetic speech/users, automated form submission, or automated/remote NVDA. Add deterministic-order, JSON/CSV escaping, schema-version, serialization/round-trip, approved-only, broken-trace refusal, optional/no-journey, every-journey-outcome preservation, evidence/validation linkage, no-outcome-to-severity inference, and happy-path tests. Run npm run typecheck, npm test, npm run lint, and npm run format:check, then update project/CURRENT-STATE.md, project/WORK-LOG.md, project/BACKLOG.md, project/DECISIONS.md, relevant architecture/data/testing/export documentation, and project/HANDOFF.md. Report files changed, public contracts, export schema and ordering, traceability and journey integration, tests, decisions, unresolved issues, and the exact prompt for the next post-MVP agent.
```
