# Current State

Updated: 2026-09-28

## Completed

Chunks 0 (Foundation), 1 (Browser + Scanner), 2 (Accessibility Evidence), 3 (Observation
Normalization + WCAG Mapping), 4 (Deduplication / Grouping), and 5 (Draft Findings) are complete.
The repository now turns eligible, fully traced GroupProposal records into neutral deterministic
draft Findings without inventing unsupported judgments.

## Working functionality

- All Chunk 1–4 browser, scanner, evidence, semantics, normalization, WCAG, grouping, CLI,
  traceability, and lifecycle behavior remains intact.
- `@accessledger/findings` exports `FindingDrafter`, `DeterministicFindingDrafter`, exact evidence-
  context types, and `FINDING_DRAFTING_POLICY_VERSION` `1.0.0`.
- `FindingDrafter.draft(group, evidenceContext)` validates the GroupProposal and the exact
  Observation, ObservationOccurrence, WcagCandidateEvaluation, Page, and Evidence records. Missing,
  unrelated, cross-assessment, duplicated, or ledger-mismatched trace records fail explicitly.
- Accepted repeat proposals may draft. Accepted singletons require a supported WCAG criterion.
  Pending proposals may draft only when they are high-confidence repeat candidates. Rejected,
  split, ambiguous, pending singleton, pending medium/low repeat, and unsupported singleton inputs
  are rejected.
- Draft IDs are stable from policy version plus GroupProposal ID. Drafts carry the source proposal
  ID, exact occurrence count, deterministic multi-page URL/component scope, exact Observation and
  Evidence indexes, explicit validation need, and only criteria supported for every member
  Observation.
- Deterministic templates describe collected source/rule/category evidence without certification,
  conformance, legal, or resident-impact conclusions. Cause, Effect, Recommendation, severity, and
  Finding confidence remain null. Grouping confidence and scanner impact never populate them.
- No LLM layer was necessary. No persistence was required for this pure JSON-serializable
  transformation; Chunk 6's auditable review changes are the first proven persistence need.

## Public contracts and versions

- Contract schema remains `1.0.0` under ADR-011's additive pre-release decision.
- Finding adds required `sourceGroupProposalId` and `validationNeed` fields.
- Finding drafting policy version is independently `1.0.0`.
- Grouping algorithm remains `1.0.0`; WCAG dataset remains `2026.09.28-1` for WCAG 2.1 A/AA.
- Workspace packages remain `0.0.1`.

## Not implemented / known limitations

Persisted review/audit history, auditor UI, final approval, editable five-part findings, human/NVDA
validation workflow, journey recording, export, severity assignment, interaction simulation,
speech output, and automated NVDA are deliberately unimplemented. Draft prose is intentionally
plain and currently covers any valid source/rule/category through one conservative template rather
than polished issue-specific language. A supported criterion is included only when every grouped
Observation supports it; mixed support remains for human resolution. Component scope uses the exact
fingerprint, selector, markup, or an explicit unavailable-locator fallback. Windows execution
remains unrecorded. There are no known Chunk 5 defects.

## Validation

All required root commands pass: `npm run typecheck`, `npm test`, `npm run lint`, and
`npm run format:check`. The root suite passes 11 files / 64 tests. Chunk 5 coverage includes
eligibility, rejected/split/ambiguous and weak input refusal, unsupported singleton refusal, stable
drafts, exact counts, multi-page scope, supported-versus-candidate WCAG handling, missing/broken
trace rejection, null judgment fields, schema version, serialization, and prohibited-language/
scanner-impact isolation.

## Versions and next work

- Last completed chunk: 5
- Next recommended chunk: 6 — Auditor Review + Validation
- Blockers: none

Follow `project/HANDOFF.md` exactly. Chunk 6 must make and document the repository/migration/
transaction decision required for audit-safe edits and state transitions; do not begin Chunk 7.
