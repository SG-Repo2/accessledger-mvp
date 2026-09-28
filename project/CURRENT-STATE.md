# Current State

Updated: 2026-09-28

## Completed

Chunks 0 (Foundation), 1 (Browser + Scanner), 2 (Accessibility Evidence), 3 (Observation
Normalization + WCAG Mapping), and 4 (Deduplication / Grouping) are complete. The repository now
produces conservative, inspectable, versioned grouping proposals from validated observations and
occurrences without losing or rewriting any source record.

## Working functionality

- All Chunk 1–3 browser, scanner, evidence, semantics, normalization, WCAG, CLI, traceability, and
  lifecycle behavior remains intact.
- `@accessledger/grouping` exports `GroupingEngine`, `ConservativeGroupingEngine`, grouping context
  types, and `GROUPING_ALGORITHM_VERSION` `1.0.0`.
- `GroupingEngine.propose(observations, occurrences, context)` validates public records, unique IDs,
  one-assessment scope, occurrence-to-observation/page references, and complete occurrence coverage.
  It refuses to silently drop an Observation with no occurrence.
- Proposals have stable content-derived IDs, exact member ledgers, ordered Observation/occurrence/
  Page/Evidence indexes, structured matching signals, visible rationale, grouping-only confidence,
  ambiguity links, and pending/accepted/rejected/split review status.
- Exact normalized component fingerprints create high-confidence repeat candidates across Pages.
  Without fingerprints, exact selector and component structure can group only on the same Page or
  under an explicit shared template ID. Source type/name/version, rule, and category must match.
- Weak partial matches remain separate ambiguous singleton proposals; unrelated inputs remain
  ordinary singletons. Similar records with conflicting explicit fingerprints stay separate.
- Input Observation and ObservationOccurrence records are not mutated, deleted, rewritten, or
  collapsed. Every occurrence appears in exactly one proposal member ledger.
- No persistence was required or added. Grouping is a deterministic, JSON-serializable
  transformation; SQLite remains deferred until repository/query/transaction needs exist.

## Public contracts and versions

- Contract schema remains `1.0.0` under ADR-010's additive pre-release decision.
- Shared exports now include `GroupProposal`, `GroupProposalMember`, grouping signals, ambiguity,
  proposal kind, grouping confidence, and review-status Zod schemas/types.
- Proposal schema refinements enforce unique occurrence membership, kind/member cardinality,
  ambiguity shape, in-member signal references, and exact ordered member-derived ID indexes.
- Grouping algorithm version is independently `1.0.0`.
- WCAG dataset remains `2026.09.28-1`, targeting WCAG 2.1 A/AA with current criterion 4.1.2.
- Workspace packages remain `0.0.1`.

## Not implemented / known limitations

Findings and drafting, persisted review history, auditor UI, journey recording, export, LLM
analysis, severity, interaction simulation, speech output, and NVDA are deliberately unimplemented.
Chunk 3 currently emits null component fingerprints, and template IDs are optional caller context,
so real pipeline output will conservatively produce more singleton/ambiguous proposals until those
signals are supplied. Selector/HTML normalization is intentionally lightweight rather than a full
DOM/CSS parser; nonnumeric generated selectors can cause false negatives. Cross-page structural
similarity without an explicit shared template does not merge. Windows execution remains
unrecorded. There are no known Chunk 4 defects.

## Validation

All required root commands pass: `npm run typecheck`, `npm test`, `npm run lint`, and
`npm run format:check`. The root suite passes 10 files / 52 tests. Chunk 4 coverage includes
positive, negative, 236-occurrence repeated-component, cross-page template, unstable-selector,
ambiguous, singleton, zero-occurrence-loss, traceability, deterministic rerun, schema-version,
serialization, rejected/split preservation, and invalid-reference tests. The controlled grouping
fixtures retain 236/236 repeated members and classify all labeled merge/non-merge/review cases as
expected; this is fixture acceptance evidence, not a production precision/recall claim.

## Versions and next work

- Last completed chunk: 4
- Next recommended chunk: 5 — Draft Findings
- Blockers: none

Follow `project/HANDOFF.md` exactly and do not begin Chunk 6 during the next task.
