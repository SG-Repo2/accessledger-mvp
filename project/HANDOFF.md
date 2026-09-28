# Handoff — Start Chunk 5 Only

## Last completed work

Chunk 4 (Deduplication / Grouping) is complete. Validated Chunk 3 Observation and
ObservationOccurrence records can now become conservative, inspectable GroupProposal records with
stable IDs and zero occurrence loss. No Finding draft, severity, UI, journey, export, LLM, speech,
or NVDA behavior was added.

All required root checks pass: 10 test files / 52 tests. New coverage includes positive, negative,
236-occurrence repeated-component, cross-page template, unstable-selector, ambiguous, singleton,
mixed zero-loss, exact traceability, deterministic rerun, schema-version, serialization,
rejected/split preservation, and invalid-reference cases.

## Public contracts and interfaces

`@accessledger/shared` retains contract schema `1.0.0` and adds:

- `groupProposalSchema` / `GroupProposal`
- `groupProposalMemberSchema` / `GroupProposalMember`
- proposal kind: `repeat_candidate | singleton | ambiguous`
- review status: `pending | accepted | rejected | split`
- grouping confidence: `high | medium | low`
- typed grouping signals and ambiguity metadata

A proposal stores `groupingAlgorithmVersion`, stable `id`, assessment, kind, review status,
grouping-only confidence, rationale, exact `members`, ordered `memberObservationIds`,
`memberOccurrenceIds`, `pageIds`, `evidenceIds`, signals, nullable ambiguity, and timestamps. Zod
refinements require all indexes to match the member ledger exactly. Repeat candidates require at
least two members; singleton/ambiguous proposals require one. Grouping confidence is not Finding
confidence or severity.

`@accessledger/grouping` exports:

- `GroupingEngine.propose(observations, occurrences, context) -> GroupProposal[]`
- `ConservativeGroupingEngine`
- `GroupingContext` with Pages and optional Page/template IDs
- `GROUPING_ALGORITHM_VERSION` (`1.0.0`)

## Grouping behavior and keys

All grouping requires the same source type/name/version, source rule, and category. Exact normalized
component fingerprints are identity signals and may create high-confidence cross-page repeat
candidates. Without fingerprints, both normalized selector structure and opening-element component
structure must match, along with the same Page or an explicit shared template ID; these proposals
have medium grouping confidence. Role/name patterns from browser-semantics source detail are retained
as supporting signals when available.

Fingerprint normalization applies Unicode NFKC, trim, whitespace collapse, and lowercase. Selector
normalization replaces numeric `nth-child`/`nth-of-type` indexes and numeric ID suffixes but preserves
non-numeric IDs and other selector distinctions. Component normalization retains the opening tag and
sorted non-ID attributes, including class tokens. It is intentionally conservative and lightweight.

Partial structural matches that do not satisfy merge requirements remain separate ambiguous
singletons linked through `ambiguity.relatedOccurrenceIds`. Conflicting explicit fingerprints stay
separate ordinary singletons. Every unmatched occurrence receives a singleton proposal. Proposal
IDs are SHA-256-derived from algorithm version, assessment ID, and sorted member Observation/
occurrence IDs. Member ordering is deterministic by Page URL, selector, and occurrence ID.

## Traceability and integrity

Each proposal member retains its Observation ID, ObservationOccurrence ID, Page ID, and union of
the parent Observation and occurrence Evidence IDs. Top-level ordered indexes are derived from the
members and runtime-validated. Every input occurrence belongs to exactly one proposal member; input
records are never mutated. The engine rejects duplicate IDs, mixed assessments, missing
Observation/Page references, duplicate template context, and Observations with no occurrences
instead of silently losing input.

Review status can become `rejected` or `split` without changing the original member ledger. This
chunk defines the serializable state only; persisted review/audit history and lifecycle services
remain future workflow work.

## Persistence and decisions

ADR-010 records the grouping contract, conservative keys, algorithm version, schema-version
decision, and no-persistence decision. Chunk 4 remains a pure transformation with JSON-round-trip
coverage. There are no tables, migrations, ORM, repositories, or artifact layout. Add persistence
only when a concrete cross-session review, query, or transaction requirement is proven.

## Labeled fixture result and limitations

The deterministic fixture suite retains 236/236 members in the large repeated-component case and
classifies all covered merge, non-merge, and review cases as labeled. This is acceptance evidence
for the controlled cases, not a production precision/recall estimate.

Chunk 3 currently emits null component fingerprints, and template IDs are caller-supplied optional
context. Real pipeline data will therefore favor singleton and ambiguous outputs until richer
deterministic identity context exists. The lightweight selector/HTML normalizers are not complete
CSS/DOM parsers, so generated nonnumeric identifiers may cause false negatives. Cross-page
structure never merges without a shared fingerprint or explicit template. Windows execution remains
unrecorded. There are no known Chunk 4 defects.

## What to do next

Implement **Chunk 5 — Draft Findings** exactly as specified in
`docs/MVP-IMPLEMENTATION-PLAN.md`. Consume eligible GroupProposal records plus their exact Chunk 3
observations, occurrences, WCAG evaluations, Pages, and Evidence. Stop before Chunk 6 review UI and
validation workflow.

## Exact recommended prompt for the next agent

```text
Read AGENTS.md, project/CURRENT-STATE.md, project/HANDOFF.md, docs/ARCHITECTURE.md, the Chunk 5 section of docs/MVP-IMPLEMENTATION-PLAN.md, docs/TESTING-METHODOLOGY.md, docs/DATA-MODEL.md, and relevant entries in project/DECISIONS.md. Implement Chunk 5 only: Draft Findings. Use npm and preserve the existing TypeScript/ESM/workspace setup. Consume validated Chunk 4 GroupProposal records together with their exact Chunk 3 Observation, ObservationOccurrence, WcagCandidateEvaluation, Page, and Evidence records, and define and test FindingDrafter.draft(group, evidenceContext) before export. Draft only from an eligible accepted proposal or a high-confidence repeat candidate according to an explicit conservative policy; reject rejected, split, ambiguous, and unsupported singleton inputs rather than silently drafting. Produce Finding(status="draft") with a stable ID, neutral evidence-supported Condition, exact occurrence count, affected URLs/components, Observation and Evidence traceability, supported WCAG criteria behavior, and an explicit validation need. Keep Cause, experiential Effect, Recommendation, Severity, and Finding Confidence null unless independently supported; do not convert grouping confidence or scanner impact into those fields. Prefer deterministic templates and do not add LLM analysis unless a concrete requirement proves it necessary; any optional assistant output must remain labeled, evidence-linked, isolated, and unable to overwrite source truth. Add or revise shared public contracts only through the documented schema process, and add persistence only if Chunk 5 proves a real repository/query/transaction need. Do not begin Chunk 6: do not implement final approval, auditor UI, grouping review UI, human/NVDA validation workflow, journeys/export, autonomous remediation, speech simulation, automated NVDA, certification, legal conclusions, or final resident-impact claims. Add deterministic eligibility, stable-draft, exact-count, multi-page scope, supported-vs-candidate WCAG, missing/broken-trace rejection, nullable-field, schema-version, serialization, and no-certification/severity-language tests. Run npm run typecheck, npm test, npm run lint, and npm run format:check, then update project/CURRENT-STATE.md, project/WORK-LOG.md, project/BACKLOG.md, project/DECISIONS.md if needed, and project/HANDOFF.md. Report files changed, public contracts, drafting policy/templates, tests, decisions, unresolved issues, and the exact prompt for the next Chunk 6 agent.
```
