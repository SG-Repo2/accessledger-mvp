# Current State

Updated: 2026-09-28

## Completed

Chunks 0 (Foundation), 1 (Browser + Scanner), 2 (Accessibility Evidence), and 3 (Observation
Normalization + WCAG Mapping) are complete. The repository now converts a narrow, deterministic set
of validated raw fixture facts into fully traceable observations/occurrences and evaluates
inspectable WCAG candidates without creating findings or losing uncertainty.

## Working functionality

- The Chunk 1–2 browser, axe-core, raw Evidence, accessibility-semantics, CLI, traceability, and
  resource-lifecycle behavior remains intact.
- `@accessledger/observations` exports `ObservationNormalizer` and
  `DeterministicObservationNormalizer.normalize({ page, evidence })`. It validates assessment/page
  scope and covers axe-core `button-name`, `label`, and `aria-valid-attr-value` violations plus a
  collected Chromium button whose computed name is explicitly available and empty.
- Each covered raw rule becomes one Observation; every axe node or semantics target becomes a
  distinct ObservationOccurrence. The implementation retains Page ID, exact evidence-chain IDs,
  selectors, HTML, raw node/check data, target descriptors, complete semantics, and provenance.
  It does not group or deduplicate occurrences.
- Scanner passes/incomplete results, unknown rules, browser operational evidence, non-covered
  semantics, and semantics collection errors do not become accessibility conclusions. Ignored
  evidence is explicit, and unknown source rules are retained with Evidence/tool/version detail.
- `@accessledger/wcag` exports `WcagKnowledge`/`JsonWcagKnowledge` and
  `WcagMapper`/`EvidenceBasedWcagMapper`. The mapper checks source version plus explicit normalized
  fact requirements and emits versioned candidate evaluations with supported, unsupported, or
  uncertain state and a per-requirement trace. Unknown rules remain uncertain with no invented
  criterion.
- `data/wcag` contains runtime-validated dataset `2026.09.28-1`, targeting WCAG 2.1 A/AA and
  intentionally containing only 4.1.2 Name, Role, Value. Mappings cover axe-core 4.13.x
  `button-name`, `label`, and `aria-valid-attr-value`, plus a reviewed empty-button-name Chromium
  semantics mapping with inspectable provenance.
- No persistence was required or added. Chunk 3 transformations and outputs are validated and
  JSON-serializable; SQLite remains an expected later default only when real repository/query/
  transaction requirements are proven.

## Not implemented / known limitations

Grouping/deduplication, grouping proposals, findings, persistence, auditor UI, journey recording,
export, LLM analysis, severity, interaction simulation, speech output, and NVDA are deliberately
unimplemented. WCAG coverage is not comprehensive: the dataset has one criterion and four mappings,
and normalization has three axe rules plus one browser-semantics fact. Browser semantics remain
Chromium/CDP evidence, not assistive-technology behavior. CSS selectors remain evidence locators,
not durable identity. Browser binaries still require `npm run playwright:install`. Windows
execution remains unrecorded. There are no known Chunk 3 defects.

## Validation

All required root commands pass: `npm run typecheck`, `npm test`, `npm run lint`, and
`npm run format:check`. The root suite passes 9 files / 41 tests. Chunk 3 coverage includes a live
controlled-fixture pipeline plus deterministic unit cases for positive, negative, preservation,
unknown-rule, insufficient-evidence, unsupported-candidate, dataset-version, source-version,
round-trip, and Page/Evidence traceability behavior.

## Versions and next work

- Public contract schema: `1.0.0` (retained by ADR-009 for additive pre-release contracts)
- WCAG knowledge dataset: `2026.09.28-1`
- WCAG target: `2.1`, Levels A/AA; included criterion: `4.1.2`
- Workspace packages: `0.0.1`
- Playwright: `1.63.0`
- Chromium: Playwright build `1243` (`153.0.8010.12` on the acceptance host)
- Chrome DevTools Protocol: `1.3`
- axe-core: `4.13.0`; mapped range: `4.13.x`
- Last completed chunk: 3
- Next recommended chunk: 4 — Deduplication / Grouping
- Blockers: none

Follow `project/HANDOFF.md` exactly and do not begin Chunk 5 during the next task.
