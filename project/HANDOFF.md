# Handoff — Proposal Review Is Durable; Finding Validation Is Next

## Completed boundary

Preparation now persists every deterministic GroupProposal with its complete immutable
Observation, ObservationOccurrence, WCAG evaluation, Page, and Evidence trace. Migration 3 stores
original proposals and ordered trace links immutably, decisions append-only, and proposal-to-draft
links immutably. Migrations 1 and 2 were not changed.

Auditor Studio now links to `/proposals`. The queue contains pending and ineligible proposals, and
the detail page shows exact membership, rationale, grouping confidence, WCAG status, Evidence,
source/tool versions, decision history, and any draft link. The only proposal actions are explicit
human accept, reject, or split forms with actor and reason. Nothing auto-accepts.

Acceptance invokes the existing `DeterministicFindingDrafter`. Accepted repeats may draft under its
existing policy. Accepted singletons require a supported WCAG criterion. Rejected, split,
ambiguous, and otherwise ineligible accepted proposals retain their decision without a draft. An
eligible decision, review bundle, review audit event, and proposal-to-draft link commit atomically.

## Verified Naperville state

The JSON payload inside `naperville-scan.json` was passed through the production preparation
composition. Its leading npm command banner remains untouched and must be stripped or avoided when
using the CLI directly.

Before human proposal review:

```text
observations: 1
occurrences: 8
WCAG evaluations: 1 uncertain
persisted proposals: 5
proposal decisions: 0
draft Findings: 0
persisted review bundles: 0
```

The five original proposals are pending: two medium-confidence repeat candidates with 3 and 2
members, and three low-confidence singletons. Explicitly accepting only the two repeats produces:

```text
accepted proposals: 2
pending proposals: 3
draft Findings: 2
persisted review bundles: 2
draft occurrence counts: 3 and 2
```

The original proposal JSON/member ledgers remain pending and unchanged; current accepted status is
projected from decision history. No singleton, WCAG mapping, fingerprint, severity, confidence,
resident impact, Validation, or legal conclusion is invented.

## Next blocker

The two Naperville records are only draft Findings. They cannot be approved or exported until a
human starts Finding review, completes the missing Cause/Effect/Recommendation/confidence fields,
records the required evidence-backed Validation claims, assigns an exactly supported severity, and
passes the existing approval gate. The three remaining singleton proposals additionally cannot
draft while their WCAG 4.1.2 candidate remains uncertain.

Preserve the current grouping, WCAG, drafting, severity, validation, approval, and export policies.
Do not auto-accept the remaining proposals, infer component fingerprints, or promote the scanner
result into resident impact or a WCAG conclusion.

## Versions and checks

- Public domain contract: `1.0.0` (additive `ProposalReviewDecision` and `ProposalDraftLink`)
- Persistence schema: `3`
- WCAG dataset: `2026.09.29-1`
- Grouping algorithm: `1.0.0`
- Finding drafting policy: `1.0.0`

See `project/CURRENT-STATE.md`, ADR-015 in `project/DECISIONS.md`, and the latest
`project/WORK-LOG.md` entry for final command counts.
