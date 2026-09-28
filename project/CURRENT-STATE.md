# Current State

Updated: 2026-09-28

## Completed

Chunks 0 (Foundation), 1 (Browser + Scanner), and 2 (Accessibility Evidence) are complete. The
repository now captures versioned, traceable browser/scanner evidence plus targeted Chromium
accessibility semantics without exposing Playwright handles or claiming screen-reader behavior.

## Working functionality

- `@accessledger/shared` exports versioned accessibility target, collection-context, semantic-field,
  payload, provenance, error, and specialized Evidence contracts. `RawPageAssessment` accepts
  optional targets and contains ordered `accessibilityEvidence`.
- `@accessledger/browser` retains Playwright Page and CDP session handles privately. Its narrow
  serialized accessibility-tree capability resolves controlled CSS targets and calls Chromium's
  `Accessibility.getPartialAXTree`.
- `@accessledger/accessibility` exports the `AccessibilityEvidenceCollector.collect(page, targets)`
  boundary and `BrowserAccessibilityEvidenceCollector` implementation.
- Collected evidence records computed role, name, description, value, focusability, selected states,
  and IDREF relationships. Missing values are explicitly unavailable; hidden, missing/detached,
  ambiguous, unexposed, and API failures are typed target results.
- Every semantics record references its Page, ordered raw browser/scanner evidence IDs, and an
  optional exact source evidence ID. Provenance includes Chromium, Playwright, and CDP versions and
  explicitly marks the data as browser semantics rather than assistive-technology output.
- `assessRawPage` reuses the Chunk 1 browser lifecycle, collects requested semantics before closure,
  returns no semantics on navigation failure, and opens no CDP session when no targets are supplied.
- The developer CLI accepts `npm run scan -- <URL> [--target "<selector>" ...]`. Repeated targets
  exercise the existing Chunk 2 collector; omitting them preserves the original behavior and
  returns an empty `accessibilityEvidence` array.

## Not implemented / known limitations

Observation normalization, WCAG evaluation/mapping, grouping, findings, persistence, auditor UI,
journey recording, export, LLM analysis, severity, interaction simulation, speech output, and NVDA
are deliberately unimplemented. CSS selectors are evidence locators rather than durable identity.
Semantics collection is currently Chromium/CDP-specific, and absence from the AX node cannot
distinguish not-applicable from not-exposed, so the contract records
`not_exposed_or_not_applicable`. Chromium semantics do not establish platform accessibility API or
NVDA behavior. Browser binaries still require `npm run playwright:install`. Windows execution has
not yet been recorded. There are no known Chunk 2 defects.

## Validation

All required root commands pass: `npm run typecheck`, `npm test`, `npm run lint`, and
`npm run format:check`. The root suite passes 7 files / 27 tests. Chunk 2 adds a deterministic
collector acceptance test, integrated lifecycle/traceability coverage, and CLI target forwarding
and validation tests. The acceptance host used Chromium `153.0.8010.12` and CDP protocol `1.3` on
macOS arm64.

## Versions and next work

- Public contract schema: `1.0.0` (retained by ADR-008 for additive pre-release contracts)
- Workspace packages: `0.0.1`
- Playwright: `1.63.0`
- Chromium: Playwright build `1243` (`153.0.8010.12` on the acceptance host)
- Chrome DevTools Protocol: `1.3`
- axe-core: `4.13.0`
- Last completed chunk: 2
- Next recommended chunk: 3 — Observation Normalization + WCAG Mapping
- Blockers: none

Follow `project/HANDOFF.md` exactly and do not begin Chunk 4 during the next task.
