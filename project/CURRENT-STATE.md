# Current State

Updated: 2026-09-28

## Completed

Chunks 0 (Foundation), 1 (Browser + Scanner), 2 (Accessibility Evidence), 3 (Observation
Normalization + WCAG Mapping), 4 (Deduplication / Grouping), 5 (Draft Findings), 6 (Auditor Review

- Validation), and 7 (Resident Journey Recording) are complete. The local MVP now retains
  evidence-first human review, guarded state transitions, exact severity support, revisioned manual
  journey protocols/results, and append-only audit history in SQLite.

## Working functionality

- All Chunk 1–5 capture, semantics, normalization, mapping, grouping, drafting, CLI, and
  traceability behavior remains intact.
- `@accessledger/persistence` provides persistence schema version `2`, ordered migrations,
  `ReviewRepository`, `JourneyRepository`, and `SqliteReviewRepository` using Node SQLite. Migration
  1 is unchanged. Immutable sources and original draft/group JSON are retained; group decisions,
  Validation, journey revisions/results, and audit history are append-only where appropriate.
- Finding updates use optimistic whole-record comparison. Each edit/transition and audit event is
  atomic; Validation, human Evidence, validation-status update, and audit event are one transaction.
- `FindingReviewService` creates/loads complete review traces, starts review, records accepted/
  rejected/split grouping decisions without member loss, edits only allowed fields, adds human
  Validation, assigns exact supported severity, and approves/rejects through service-side gates.
- Legal lifecycle is `draft -> in_review -> approved|rejected`. Approval requires an accepted
  group, intact complete trace, complete five-part judgments plus confidence, supported human claim
  coverage, and severity matching a supported Validation.
- Validation carries explicit claim types and nullable exact `validatedSeverity`; a supported
  severity claim requires that level. NVDA-method records require assistive-technology details.
- `ReviewAuditEvent` stores versioned actor/action/reason/before/after history.
- `ResidentJourneyService` creates/loads/edits/safely soft-deletes generic human protocols with
  revision history, records explicit manual results with performer/environment/timing/all five
  outcomes, attaches immutable human Evidence, and enforces same-assessment Finding links.
- `JourneyResult` NVDA observations are optional and require a recorded NVDA-on-Windows environment.
  `not_attempted` has no end time; all attempted outcomes, including interrupted `inconclusive`, do.
- Journey results support Finding claims only through separate result-subject Validation records.
  Exact severity still uses `FindingReviewService.assignSeverity`; outcome names never assign it.
- `apps/auditor-studio` renders representative/all occurrences, source/human Evidence, WCAG
  support/candidates, missing fields, validation need, review controls, approval blockers, and audit
  history plus protocol/result/Validation journey controls and linked results through keyboard-
  operable native HTML controls. Start with
  `npm run auditor:studio -- <database-path>` after seeding through `createReview`.

## Public contracts and versions

- Public contract schema remains `1.0.0` under ADR-013's coordinated pre-release decision.
- Validation adds required `claims[]` and `validatedSeverity`; `ReviewAuditEvent` is new.
- `@accessledger/findings` adds `FindingReviewService`, complete trace/edit/validation types, and
  trace/approval enforcement.
- `@accessledger/persistence` adds review repository/bundle/decision contracts,
  `JourneyRepository`, `SqliteReviewRepository`, migration metadata, and persistence schema version
  `2`.
- `@accessledger/journeys` adds `ResidentJourneyService`, create/edit/record/validation inputs, and
  complete journey trace types.
- JourneyResult adds required environment and timing/NVDA refinements; `JourneyAuditEvent` is new;
  Finding review traces add linked JourneyResult records.
- Finding drafting policy and grouping algorithm remain `1.0.0`; WCAG dataset remains
  `2026.09.28-1`; workspace packages remain `0.0.1`.

## Not implemented / known limitations

Findings Register export, customer dashboards, multi-tenancy, accounts/authentication, billing,
polished reports, speech simulation, autonomous journeys/remediation, automated form submission,
and automated/remote NVDA are deliberately unimplemented. Protocol deletion is soft and limited to
result-free records; results/revisions/audit are never physically deleted. The studio has no JSON importer,
artifact binary viewer, styling layer, or concurrent merge UI. It assumes an accountable human name
in a local single-user workflow. Node 22 prints its upstream `node:sqlite` experimental warning;
Windows/NVDA execution remains an external procedure. No known Chunk 7 correctness defect remains.

## Validation

Targeted Chunk 7 suites pass, covering ordered migration/idempotence, transaction rollback,
protocol create/edit/history, all outcomes, required performer, environment/timing, link integrity,
interrupted/inconclusive behavior, optional NVDA, immutable supporting Evidence, separate result
Validation/exact severity, no automatic outcome, schema versions/serialization, semantic UI, and a
happy path. Required root commands pass as recorded in `project/WORK-LOG.md`.

## Versions and next work

- Last completed chunk: 7
- Next recommended chunk: 8 — Findings Register Export
- Blockers: none

Follow `project/HANDOFF.md` exactly. Chunk 8 may consume approved Findings and optional linked
journey results but must preserve traceability and the human-only claim boundary.
