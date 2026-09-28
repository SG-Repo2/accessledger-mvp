# Auditor Review and Validation

## Boundary

Chunk 6 is an internal evidence-review workflow. It consumes a Chunk 5 draft Finding, its source
GroupProposal, and the exact Observation, ObservationOccurrence, WcagCandidateEvaluation, Page, and
Evidence context. It does not run scans, automate NVDA, execute resident journeys, export a Findings
Register, or make certification, conformance, or legal conclusions.

## Storage and migrations

`SqliteReviewRepository` accepts `:memory:` for tests or a filesystem path for retained local work.
On construction it enables foreign keys/WAL and applies ordered SQL migrations. Schema version `1`
creates review bundles, immutable source records, grouping decisions, validations, and audit events;
schema version `2` adds ResidentJourney protocols/revisions, JourneyResult records/links, and journey
audit history without changing migration 1. Migration and domain schema versions are independent.

The repository retains original Finding/GroupProposal JSON and a current Finding projection.
Source records cannot be updated or deleted. Group decisions, validations, and audit events are
append-only. Every Finding change and audit event is one transaction; adding Validation also stores
its human Evidence and derived validation status in that same transaction. Stale Finding snapshots
fail instead of overwriting another reviewer's work.

Review data is first inserted through `FindingReviewService.createReview(...)`; callers must supply
the complete Chunk 5 bundle. The service validates the complete trace before SQLite receives it.

## Service operations

- `createReview(bundle, actor)` validates and stores the original review bundle.
- `loadCompleteTrace(findingId)` returns original/current Finding and group, all source records,
  human validations/evidence, missing fields, approval blockers, and audit history.
- `startReview(findingId, actor)` enforces `draft -> in_review`.
- `decideGrouping(...)` appends `accepted`, `rejected`, or `split` without changing members.
- `editFinding(...)` permits title, Condition, Cause, Effect, Recommendation, confidence, and only
  WCAG criteria present in source candidates.
- `addValidation(...)` requires same-assessment human Evidence and explicit reviewed claims.
- `assignSeverity(...)` requires a supported Validation for that exact severity.
- `approve(...)` and `reject(...)` are the only terminal transitions from `in_review`.

Approval requires accepted grouping, intact traceability, completed five-part judgment fields,
confidence, supported human claims, and an exact supported severity. Unsupported or inconclusive
validations remain in history but do not satisfy a gate.

## Internal UI

Start the local server with a SQLite path:

```text
npm run auditor:studio -- ./accessledger-review.sqlite
```

The server binds only to `127.0.0.1` and defaults to port `4178`; set
`ACCESSLEDGER_AUDITOR_PORT` to change it. A review bundle must already have been created through the
service boundary. The home page lists stored Findings. The review page exposes a skip link,
semantically labeled native forms, representative/all-occurrence views, Evidence disclosures, WCAG
evaluations, validation and severity controls, approval blockers, and audit history. It requires no
client-side scripting and is operable with standard keyboard form interaction.

The home page also links to `/journeys`. Journey screens provide labeled native forms for protocol
creation/edit, explicit manual result recording, and separate result-backed Validation. Finding
review shows linked result outcome, performer, environment, and timing. The UI explains that
`not_attempted`, `inconclusive`, and `unable_to_complete` are distinct and never chooses an outcome
from scanner, browser, or agent state.

## Reviewer assumptions and limitations

The actor/performer text identifies the accountable human in this local single-user MVP; accounts
and authentication are out of scope. Human notes entered in the UI become immutable `human_note`
Evidence. A supported claim means the reviewer has actually performed the stated method and recorded
observable support; selecting an option is not a substitute for that work.

The UI is intentionally unstyled and has no draft importer, artifact viewer, concurrent merge
interface, automated journey runner, form-submission agent, or NVDA controller. `node:sqlite` keeps
installation portable and dependency-free; Node 22 may emit its upstream experimental-feature
warning. Windows/NVDA execution remains an external human procedure.
