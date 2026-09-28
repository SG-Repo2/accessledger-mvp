# Current State

Updated: 2026-09-28

## Completed

Chunks 0 (Foundation), 1 (Browser + Scanner), 2 (Accessibility Evidence), 3 (Observation
Normalization + WCAG Mapping), 4 (Deduplication / Grouping), 5 (Draft Findings), and 6 (Auditor
Review + Validation) are complete. The local MVP now retains evidence-first human review, guarded
state transitions, exact severity support, and append-only audit history in SQLite.

## Working functionality

- All Chunk 1–5 capture, semantics, normalization, mapping, grouping, drafting, CLI, and
  traceability behavior remains intact.
- `@accessledger/persistence` provides persistence schema version `1`, ordered migrations,
  `ReviewRepository`, and `SqliteReviewRepository` using Node SQLite. Immutable sources and original
  draft/group JSON are retained; group decisions, Validation, and audit history are append-only.
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
- `apps/auditor-studio` renders representative/all occurrences, source/human Evidence, WCAG
  support/candidates, missing fields, validation need, review controls, approval blockers, and audit
  history through keyboard-operable native HTML controls. Start with
  `npm run auditor:studio -- <database-path>` after seeding through `createReview`.

## Public contracts and versions

- Public contract schema remains `1.0.0` under ADR-012's coordinated pre-release decision.
- Validation adds required `claims[]` and `validatedSeverity`; `ReviewAuditEvent` is new.
- `@accessledger/findings` adds `FindingReviewService`, complete trace/edit/validation types, and
  trace/approval enforcement.
- `@accessledger/persistence` adds review repository/bundle/decision contracts,
  `SqliteReviewRepository`, migration metadata, and persistence schema version `1`.
- Finding drafting policy and grouping algorithm remain `1.0.0`; WCAG dataset remains
  `2026.09.28-1`; workspace packages remain `0.0.1`.

## Not implemented / known limitations

Resident journey CRUD/execution records, Findings Register export, customer dashboards,
multi-tenancy, accounts/authentication, billing, polished reports, speech simulation, autonomous
remediation, and automated NVDA are deliberately unimplemented. The studio has no JSON importer,
artifact binary viewer, styling layer, or concurrent merge UI. It assumes an accountable human name
in a local single-user workflow. Node 22 prints its upstream `node:sqlite` experimental warning;
Windows execution remains unrecorded. No known Chunk 6 correctness defect remains.

## Validation

Targeted Chunk 6 suites pass, covering migration/idempotence, rollback, complete trace loading,
edits, grouping decisions, required-validation and severity gates, invalid transitions, immutable
source/history, broken trace detection, audit history, schema versions/serialization, semantic UI,
and happy-path approval. Required root commands pass as recorded in `project/WORK-LOG.md`.

## Versions and next work

- Last completed chunk: 6
- Next recommended chunk: 7 — Resident Journey Recording
- Blockers: none

Follow `project/HANDOFF.md` exactly. Chunk 7 must extend the existing SQLite repository through a
new migration and preserve the human-only journey boundary; do not begin export or automation.
