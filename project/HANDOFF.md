# Handoff — Start Chunk 6 Only

## Last completed work

Chunk 5 (Draft Findings) is complete. Eligible, fully traced GroupProposal records can now become
neutral deterministic Finding records with `status="draft"`. No final approval, auditor UI,
persisted review history, human/NVDA workflow, journey, export, LLM, speech, or automated NVDA
behavior was added.

All required root checks pass: 11 test files / 64 tests. New coverage includes eligibility and
refusal paths, stable drafts, exact occurrence count, multi-page scope, supported-versus-candidate
WCAG behavior, missing/broken trace rejection, nullable fields, schema version, serialization, and
prohibited-language/scanner-impact isolation.

## Public contracts and interfaces

`@accessledger/shared` retains contract schema `1.0.0`. Finding now also requires:

- `sourceGroupProposalId`, preserving the direct Finding-to-GroupProposal link; and
- `validationNeed`, stating what human review must resolve.

`@accessledger/findings` exports:

- `FindingDrafter.draft(group, evidenceContext) -> Finding`
- `DeterministicFindingDrafter`
- `FindingEvidenceContext` containing exact Observation, ObservationOccurrence,
  WcagCandidateEvaluation, Page, and Evidence records
- `FINDING_DRAFTING_POLICY_VERSION` (`1.0.0`)

## Drafting policy and template

Eligible inputs are:

- an accepted repeat proposal;
- an accepted singleton with at least one WCAG criterion supported by its evaluation; or
- a pending high-confidence repeat candidate.

Rejected, split, ambiguous, pending singleton, pending medium/low-confidence repeat, and unsupported
singleton inputs fail. The drafter also fails on duplicate, missing, extra, unrelated,
cross-assessment, or mismatched source records. It requires WCAG evaluation coverage for every
member Observation.

The title template is `Review <humanized category> evidence`. The Condition template reports the
collected source, rule/category, exact occurrence count, and inspected URL count. Affected URLs use
final URL with requested URL fallback. Components use exact fingerprint, selector, markup, or an
explicit occurrence-locator-unavailable fallback. WCAG criteria appear only when supported for
every member Observation. Candidate, uncertain, unsupported, or mixed mappings remain outside
`wcagCriteria` and in the validation need.

Every draft uses `validationStatus="required"` and explicit human-review text. Cause, Effect,
Recommendation, severity, and Finding confidence are null. Grouping confidence and scanner impact
are never converted into Finding judgment. No LLM assistant exists because deterministic templates
meet Chunk 5 needs.

## Traceability and integrity

The draft stores the source GroupProposal ID plus exact group-derived Observation and Evidence ID
indexes. `occurrenceCount` is the exact member-ledger length. The service validates every
occurrence-to-Observation/Page reference, every member Evidence ledger, every assessment boundary,
all evaluation Evidence, and the exact top-level context before producing a Finding. Finding IDs
are SHA-256-derived from drafting-policy version and stable GroupProposal ID.

## Persistence and decisions

ADR-011 records eligibility, deterministic templates, public contract additions, schema-version,
no-LLM, and no-persistence decisions. Chunk 5 remains a pure JSON-serializable transformation.
Chunk 6 now has the first concrete persistence need: retained reviewer edits, grouping decisions,
validation records, audit history, and service-enforced state transitions. Make and document that
repository/database/migration/transaction decision before building the review workflow.

## Limitations and Chunk 6 requirements

Draft prose is intentionally functional, with one conservative template rather than issue-specific
polish. Cross-member WCAG support is intentionally strict. Component fallback text identifies the
occurrence when source evidence has no locator. Windows execution remains unrecorded.

Chunk 6 must provide the smallest evidence-first, keyboard-operable internal workflow for complete
trace loading, group decisions, allowed five-part edits, Validation creation, evidence-gated
severity, and approve/reject transitions. Preserve Evidence, Observation, occurrence, proposal, and
original draft truth. Do not begin journeys or export.

## Exact recommended prompt for the next agent

```text
Read AGENTS.md, project/CURRENT-STATE.md, project/HANDOFF.md, docs/ARCHITECTURE.md, the Chunk 6 section of docs/MVP-IMPLEMENTATION-PLAN.md, docs/TESTING-METHODOLOGY.md, docs/DATA-MODEL.md, docs/RESIDENT-JOURNEYS.md only for the human-validation boundary, and relevant entries in project/DECISIONS.md. Implement Chunk 6 only: Auditor Review + Validation. Use npm and preserve the existing TypeScript/ESM/workspace setup. Consume Chunk 5 draft Findings together with their source GroupProposal and complete Observation, ObservationOccurrence, WcagCandidateEvaluation, Page, Evidence, and Validation trace. First make and document the concrete lightweight persistence, repository, migration, transaction, and audit-history decision required for retained reviewer edits and state transitions; prefer SQLite unless repository evidence supports another portable local choice. Define service-side review operations for loading a complete trace, recording accept/reject/split grouping decisions without deleting members, editing only allowed Finding fields, adding human Validation records, assigning severity only when supporting human evidence exists, and enforcing valid Finding transitions through in_review to approved or rejected. Build the smallest keyboard-operable, semantically labeled internal auditor workflow needed to inspect representative and all occurrences, raw evidence, WCAG support/candidates, missing judgment fields, validation needs, and audit history. Approval must fail for broken traceability, unresolved grouping, required validation not supported, or unsupported required claims. Preserve immutable Evidence and source records; never convert scanner impact, grouping confidence, browser semantics, agent failure, or LLM output into resident impact, NVDA behavior, severity, legal conclusions, certification, or conformance. Do not begin Chunk 7 or 8: no resident-journey implementation, export, customer dashboard, multi-tenancy, billing, polished reports, speech simulation, autonomous remediation, or automated NVDA control. Add deterministic repository/migration/transaction, complete-trace loading, edit persistence, grouping decision, validation gating, severity gating, invalid-transition, immutable-source, audit-history, keyboard/semantic UI, schema-version, serialization, and happy-path approval tests. Run npm run typecheck, npm test, npm run lint, and npm run format:check, then update project/CURRENT-STATE.md, project/WORK-LOG.md, project/BACKLOG.md, project/DECISIONS.md, relevant architecture/data/testing documentation, and project/HANDOFF.md. Report files changed, public contracts, persistence and transition design, reviewer workflow, tests, decisions, unresolved issues, and the exact prompt for the next Chunk 7 agent.
```
