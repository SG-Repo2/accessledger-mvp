# Handoff — Start Chunk 7 Only

## Last completed work

Chunk 6 (Auditor Review + Validation) is complete. A complete Chunk 5 draft trace can now be stored,
reviewed, edited, validated, assigned evidence-supported severity, and approved or rejected through
service-side policy and a minimal internal UI. No journey recording or export was added.

## Persistence and repository boundary

`@accessledger/persistence` uses Node SQLite with ordered migrations. Persistence schema version `1`
creates review bundles, immutable source records, append-only grouping decisions, append-only
Validation, and append-only audit events. Original Finding/GroupProposal JSON is retained alongside
the mutable current Finding projection. Transactions use `BEGIN IMMEDIATE`; current Finding JSON is
optimistically compared to reject stale writes. SQLite triggers reject source/history changes.

Do not edit migration 1. Chunk 7 journey storage must be a new ordered migration and must preserve
all Chunk 6 data. Keep public domain records as runtime-validated JSON at repository boundaries.

## Public contracts and services

Public contract schema remains `1.0.0`. Validation now requires explicit `claims[]` and nullable
`validatedSeverity`; a supported severity claim must carry exactly one severity. NVDA-method
Validation requires assistive-technology details. `ReviewAuditEvent` is a versioned append-only
record.

`FindingReviewService` exposes review creation, complete-trace loading, `draft -> in_review`, group
accept/reject/split, restricted Finding edits, human Validation addition, exact supported severity,
and terminal approval/rejection. `FindingReviewTrace` returns original/current records, all source
and human evidence, Validation, missing judgment fields, approval blockers, and audit history.

## Approval and safety policy

Approval requires accepted grouping, intact Observation/occurrence/WCAG/Page/Evidence trace,
complete five-part fields and confidence, supported human Validation claims for every required
claim, and assigned severity matching an exact supported Validation. Group members and source
records never change. Scanner impact, grouping confidence, browser semantics, agent failure, and LLM
output cannot become resident impact, NVDA behavior, severity, certification, conformance, or legal
conclusions.

## Internal workflow and startup

`apps/auditor-studio` is server-rendered native HTML. It shows representative/all occurrences, raw
and human Evidence, WCAG evaluations, missing fields, validation needs, actions, blockers, and audit
history. Start a pre-seeded database with:

```text
npm run auditor:studio -- ./accessledger-review.sqlite
```

The server binds to `127.0.0.1:4178` by default. Review bundles are inserted through
`FindingReviewService.createReview`; there is no importer or account/authentication layer.

## Known limitations and Chunk 7 integration points

The studio is intentionally unstyled and local/single-user. Node 22 may emit the upstream
`node:sqlite` experimental warning. Windows execution remains unrecorded. Chunk 7 should add journey
protocol/result persistence, services, and studio sections using the existing human Evidence,
Validation, transaction, and audit conventions. Journey results may support validation/severity but
must never be inferred from browser/scanner/agent failure.

## Exact recommended prompt for the next agent

```text
Read AGENTS.md, project/CURRENT-STATE.md, project/HANDOFF.md, docs/ARCHITECTURE.md, the Chunk 7 section of docs/MVP-IMPLEMENTATION-PLAN.md, docs/AUDITOR-REVIEW.md, docs/RESIDENT-JOURNEYS.md, docs/TESTING-METHODOLOGY.md, docs/DATA-MODEL.md, and relevant entries in project/DECISIONS.md. Implement Chunk 7 only: Resident Journey Recording. Use npm and preserve the existing TypeScript/ESM/workspace setup. Build on FindingReviewService, the human Evidence/Validation claim boundary, and SqliteReviewRepository. Add a new ordered SQLite migration without changing migration 1, with transactional repositories for creating and editing human-authored ResidentJourney protocols and appending JourneyResult records while preserving audit history and link integrity. Define service operations for generic journey protocols, performer/environment/timing, all allowed outcomes, optional human NVDA observations, immutable supporting Evidence, related Finding links, and separate Validation records when a result supports a finding claim or exact severity. Extend the internal auditor studio only enough to create/edit protocols, record a manual result, distinguish not_attempted and inconclusive from unable_to_complete, and show linked results in finding review using keyboard-operable semantically labeled controls. Never infer a journey outcome, resident impact, NVDA behavior, severity, accessibility violation, legal conclusion, certification, or conformance from browser/scanner/agent failure; do not add autonomous browsing, synthetic users/speech, automated form submission, or remote/automated NVDA control. Do not begin Chunk 8: no Findings Register export, customer dashboard, multi-tenancy, billing, or polished reports. Add deterministic migration/repository/transaction, CRUD/recording, every outcome state, required performer, environment/timing, link-integrity, interrupted/inconclusive, optional-NVDA, supporting-evidence, validation/severity integration, no-automatic-outcome, audit-history, keyboard/semantic UI, schema-version, serialization, and happy-path tests. Run npm run typecheck, npm test, npm run lint, and npm run format:check, then update project/CURRENT-STATE.md, project/WORK-LOG.md, project/BACKLOG.md, project/DECISIONS.md, relevant architecture/data/testing/journey documentation, and project/HANDOFF.md. Report files changed, public contracts, persistence/migration design, journey workflow, validation/severity integration, tests, decisions, unresolved issues, and the exact prompt for the next Chunk 8 agent.
```
