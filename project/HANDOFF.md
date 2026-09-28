# Handoff — Start Chunk 4 Only

## Last completed work

Chunk 3 (Observation Normalization + WCAG Mapping) is complete. Validated raw scanner and
accessibility-semantics evidence can now become narrow, deterministic Observation and
ObservationOccurrence records, and source-rule candidates can be evaluated against a small,
versioned WCAG dataset as supported, unsupported, or uncertain. No occurrence is grouped or
deduplicated, and no Finding, severity, UI, journey, export, LLM, speech, or NVDA behavior exists.

All root checks pass: 9 test files / 41 tests. The suite includes controlled Chromium/axe fixture
acceptance plus positive, negative, preservation, unknown-rule, insufficient-evidence,
unsupported-candidate, dataset-version, source-version, serialization, and traceability cases.

## Public contracts and interfaces

`@accessledger/shared` retains contract schema `1.0.0` and now includes:

- Observation `source` (exact Evidence source) and structured JSON `facts` used by explicit mapping
  requirements.
- ObservationOccurrence `sourceDetail`, retaining exact relevant axe rule/node or accessibility
  target/semantics/provenance data.
- `ruleEvidenceRequirementSchema` / `RuleEvidenceRequirement` and the extended `RuleMapping`
  `evidenceRequirements` field.
- `wcagRequirementEvaluationSchema` / `WcagRequirementEvaluation`.
- `wcagCandidateEvaluationSchema` / `WcagCandidateEvaluation`, which records dataset/standard,
  mapping resolution, nullable criterion/mapping for unknown rules, supported/unsupported/uncertain
  state, reason, ordered requirement trace, evidence IDs, and evaluation time.

`@accessledger/observations` exports:

- `ObservationNormalizer.normalize({ page, evidence }) -> { observations, occurrences,
ignoredEvidence, unrecognizedRules }`
- `DeterministicObservationNormalizer` and injectable clock/ID options
- input/result/context and ignored-evidence types

`@accessledger/wcag` exports:

- `WcagKnowledge.getCriterion(id)`, `getCriteria()`, and `findRuleMappings(tool, ruleId)`
- `JsonWcagKnowledge`, loading reviewable JSON from `data/wcag`
- `WcagMapper.evaluate(observation) -> WcagCandidateEvaluation[]`
- `EvidenceBasedWcagMapper` and injectable clock/ID options

## Normalization behavior and traceability

The normalizer covers only axe-core violation results for `button-name`, `label`, and
`aria-valid-attr-value`, plus collected Chromium semantics where role is explicitly `button` and
computed name is explicitly available as `""`. One covered axe violation creates one observation;
each node creates a separate occurrence. A semantics fact creates one observation and one
occurrence. Repeated locations are intentionally not merged.

Scanner passes, incomplete results, unknown rules, raw browser results, collection errors, non-empty
names, and other semantics do not create observations. Unknown source rules remain in
`unrecognizedRules` with their Evidence ID and tool/version. Browser-semantics observations retain the
accessibility Evidence ID plus its ordered browser/scanner raw-evidence chain. Scanner observations
retain their exact scanner Evidence ID. Every occurrence keeps its Page ID, selector where
available, HTML where supplied, exact source detail, and observation/evidence linkage.

## WCAG dataset and evaluation

Dataset `2026.09.28-1` targets WCAG 2.1 Levels A/AA and includes only criterion 4.1.2 Name, Role,
Value because current fixtures require no other criterion. Tool-documented axe-core 4.13.x mappings
cover `button-name`, `label`, and `aria-valid-attr-value`; a reviewed Chromium mapping covers the
explicit empty computed button name. Mapping sources are versioned Deque rule pages or W3C
Understanding guidance; the W3C WCAG 2.1 Recommendation remains normative.

The mapper checks source-version scope and explicit fact requirements. All satisfied requirements
produce `supported`; a contradicted fact produces `unsupported`; missing facts or an out-of-range
tool version produce `uncertain`. An unknown tool/rule produces an `unknown_rule` uncertain record
with null criterion/source mapping. Candidate evaluations do not mutate observations or create
findings.

## Persistence and decisions

ADR-009 records the additive contracts, narrow covered facts, dataset version, mapping semantics,
and decision to retain contract schema `1.0.0`. Chunk 3 did not require persistence; there are no
tables, migrations, ORM, database setup commands, or artifact layout. SQLite remains an expected
later default only if a later chunk proves repository/query/transaction requirements.

## Coverage gaps and limits

The WCAG dataset is deliberately incomplete, normalization does not ingest all axe rules, and rule
range matching currently supports the pinned `4.13.x` dataset scope. Extending coverage requires
reviewed mappings, explicit requirements, deterministic fixtures, and tests. Browser semantics are
not NVDA, actual assistive-technology behavior, resident testimony, severity, certification, or a
legal conclusion. Windows execution remains unrecorded; there are no known Chunk 3 defects.

## What to do next

Implement **Chunk 4 — Deduplication / Grouping** exactly as specified in
`docs/MVP-IMPLEMENTATION-PLAN.md`. Consume the normalized observations and every concrete
occurrence without deleting or overwriting any of them. Stop before Chunk 5 findings.

## Exact recommended prompt for the next agent

```text
Read AGENTS.md, project/CURRENT-STATE.md, project/HANDOFF.md, docs/ARCHITECTURE.md, the Chunk 4 section of docs/MVP-IMPLEMENTATION-PLAN.md, docs/TESTING-METHODOLOGY.md, docs/DATA-MODEL.md, and relevant entries in project/DECISIONS.md. Implement Chunk 4 only: Deduplication / Grouping. Use npm and preserve the existing TypeScript/ESM/workspace setup. Consume validated Chunk 3 Observation and ObservationOccurrence records and define and test the grouping.group boundary before export. Add conservative, inspectable, versioned grouping proposals using deterministic signals such as source rule/category, normalized component fingerprints when present, selector/component structure, and page/template context; retain every member observation ID, occurrence ID, Page ID, and Evidence ID without deleting, rewriting, or collapsing any occurrence. Prefer false negatives to false merges, preserve singleton and ambiguous cases for review, and make grouping rationale/signals explicit. Add or revise shared public contracts only through the documented schema process, and make a lightweight persistence decision only if Chunk 4 actually requires persistence. Do not begin Chunk 5: do not draft findings or condition/cause/effect/recommendation prose, assign severity or confidence, implement the auditor UI or journeys/export, use LLM analysis, simulate speech, automate NVDA, or claim certification/legal conformance. Add deterministic positive, negative, repeated-component, cross-page, ambiguous, singleton, zero-occurrence-loss, traceability, schema-version, and serialization tests. Run npm run typecheck, npm test, npm run lint, and npm run format:check, then update project/CURRENT-STATE.md, project/WORK-LOG.md, project/BACKLOG.md, project/DECISIONS.md if needed, and project/HANDOFF.md. Report files changed, public contracts, tests, decisions, unresolved issues, and the exact prompt for the next Chunk 5 agent.
```
