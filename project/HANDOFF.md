# Handoff — Start Chunk 3 Only

## Last completed work

Chunk 2 (Accessibility Evidence) is complete. Controlled targets can be collected through the
existing live `BrowserCapture` and emitted as validated, JSON-serializable
`Evidence(kind="accessibility_semantics")`. The implementation records browser-exposed role, name,
description, value, focusability, states, relationships, unavailable fields, and typed target
errors. It does not create observations, WCAG mappings, findings, severity, synthesized speech, or
NVDA claims.

All root checks pass: 7 test files / 27 tests. Collector, integrated assessor, and CLI tests cover
browser semantics, error behavior, round-trip serialization, traceability, resource cleanup, and
optional target forwarding.

## Runtime versions and installation

- Node acceptance host: `22.23.3`
- npm: `10.9.9`
- Playwright: `1.63.0`
- Installed acceptance Chromium: Playwright build `1243`, browser `153.0.8010.12`, macOS arm64
- Chrome DevTools Protocol: `1.3`
- axe-core: `4.13.0`

After `npm install`, install the platform browser separately with:

```text
npm run playwright:install
```

The developer CLI accepts `npm run scan -- <URL> [--target "<selector>" ...]`. Each repeated flag
creates an ordered CSS target descriptor and exercises the existing Chunk 2 collector. With no
targets it preserves the original behavior and returns an empty `accessibilityEvidence` array. See
`docs/RAW-CAPTURE-RUNTIME.md` for lifecycle and provenance details.

## Public contracts and interfaces

`@accessledger/shared` now exports these Chunk 2 schemas and inferred types:

- `accessibilityTargetDescriptorSchema` / `AccessibilityTargetDescriptor`
- `accessibilityCollectionContextSchema` / `AccessibilityCollectionContext`
- `accessibilityTextFieldSchema`, `accessibilityPrimitiveFieldSchema`, and
  `accessibilityBooleanFieldSchema`
- `accessibilityRelationshipTargetSchema` and `accessibilityRelationshipFieldSchema`
- `accessibilitySemanticsSchema` / `AccessibilitySemantics`
- `accessibilitySemanticsProvenanceSchema`
- `accessibilitySemanticsErrorSchema` / `AccessibilitySemanticsError`
- `accessibilitySemanticsPayloadSchema` / `AccessibilitySemanticsPayload`
- `accessibilitySemanticsEvidenceMetadataSchema`
- `accessibilitySemanticsEvidenceSchema` / `AccessibilitySemanticsEvidence`

`RawPageAssessmentRequest` has optional `accessibilityTargets`; `RawPageAssessment` has required,
ordered `accessibilityEvidence`. Page `rawEvidenceIds` contains browser, scanner, then accessibility
evidence IDs. Each semantics record's metadata separately preserves the ordered browser/scanner raw
evidence IDs and nullable exact source evidence ID.

`@accessledger/browser` extends the runtime-only `BrowserCapture` with
`captureAccessibilityTree(targets)`, returning `BrowserAccessibilityTreeSnapshot` and per-target
`BrowserAccessibilityTreeResult` JSON. No Playwright/CDP handles cross the boundary.

`@accessledger/accessibility` exports:

- `AccessibilityEvidenceCollector.collect(page, targets)`
- `BrowserAccessibilityEvidenceCollector`
- `BrowserAccessibilityEvidenceCollectorOptions`

`@accessledger/evidence` keeps `RawPageAssessor` and `assessRawPage`; both now run requested target
collection inside the existing `try/finally` lifecycle before closing the capture.

## Target and payload behavior

A target descriptor has `schemaVersion: "1.0.0"`, opaque `id`, `strategy: "css"`, non-empty
`selector`, and nullable `sourceEvidenceId`. Target IDs are unique within one collection. Selectors
are reproducible evidence locators for the captured page, not guaranteed durable element identity.

Collected payloads distinguish `available` values from `unavailable` values with reason
`not_exposed_or_not_applicable`. In particular, an empty computed accessible name is stored as
available `""`, not as unavailable. State fields currently cover busy, disabled, focused, invalid,
read-only, required, checked, expanded, modal, pressed, and selected. Relationship fields cover
active descendant, controls, described-by, details, error-message, flow-to, labelled-by, and owns.

Typed error codes are `target_not_found_or_detached`, `multiple_targets_matched`, `hidden_target`,
`accessibility_node_unavailable`, and `browser_api_error`. Errors remain source evidence; they are
not accessibility violations.

## Browser API and NVDA boundary

The implementation uses a temporary Chromium CDP session and
`Accessibility.getPartialAXTree` after resolving exactly one attached, rendered CSS target. It
detaches the CDP session after collection and closes the owning Playwright page/context/browser via
the existing assessor lifecycle.

Provenance uses classification `browser_accessibility_semantics`, source/API name
`Chrome DevTools Protocol Accessibility`, pinned browser/automation/protocol versions, and
`assistiveTechnologyOutput: false`. These values may differ from platform accessibility APIs and
NVDA's heuristics, modes, announcements, and settings. They do not prove speech, focus-order
quality, task completion, resident experience, WCAG conformance, or severity.

## Fixture and test coverage

`data/fixtures/accessibility-semantics.html` covers a labelled/described/value-bearing required
textbox, labelled/described checked custom checkbox, expanded/controls button, unnamed button,
hidden button, and element detached before collection. Tests prove computed roles/names/
descriptions/value, focusability, states, IDREF relationships, explicit unavailable fields,
hidden/detached errors, JSON round trips, raw-evidence/Page traceability, browser-semantic labeling,
and resource closure.

The fixture server remains portable Node code and uses an explicit allow-list. Managed sandboxes
may require permission for loopback binding and Chromium launch. Windows execution remains
unrecorded; there are no known Chunk 2 defects.

## Decision and limits

ADR-008 records the target/evidence contracts, Chromium/CDP boundary, existing-capture lifecycle,
explicit browser-not-AT classification, and decision to retain schema `1.0.0` for additive
pre-release contracts. No persistence, observation, WCAG mapping, grouping, finding, UI, journey,
severity, LLM, speech, or NVDA implementation was added.

## What to do next

Implement **Chunk 3 — Observation Normalization + WCAG Mapping** exactly as specified in
`docs/MVP-IMPLEMENTATION-PLAN.md`. Consume the existing raw scanner and accessibility evidence,
preserve every Page/Evidence reference, make a persistence decision only if Chunk 3 requires it,
and stop before Chunk 4 grouping.

## Exact recommended prompt for the next agent

```text
Read AGENTS.md, project/CURRENT-STATE.md, project/HANDOFF.md, docs/ARCHITECTURE.md, the Chunk 3 section of docs/MVP-IMPLEMENTATION-PLAN.md, docs/TESTING-METHODOLOGY.md, docs/DATA-MODEL.md, docs/WCAG-KNOWLEDGE-MODEL.md, docs/RAW-CAPTURE-RUNTIME.md, and relevant entries in project/DECISIONS.md. Implement Chunk 3 only: Observation Normalization + WCAG Mapping. Use npm and preserve the existing TypeScript/ESM/workspace setup. Consume validated raw browser/scanner and accessibility_semantics Evidence without changing its source meaning. Define and test the ObservationNormalizer.normalize and WcagKnowledge/WcagMapper boundaries before export. Normalize only deterministic covered fixture facts into Observation and ObservationOccurrence records while preserving every Page ID, Evidence ID, selector, source detail, and concrete occurrence. Add a small versioned WCAG 2.1 A/AA knowledge dataset and inspectable, documented tool/rule mappings with provenance; evaluate candidate mappings as supported, unsupported, or uncertain from explicit evidence requirements, and preserve unknown rules and insufficient evidence. Make and document a lightweight persistence decision only if Chunk 3 actually requires persistence. Do not begin Chunk 4: do not group or deduplicate occurrences, draft findings, implement the auditor UI or resident automation, assign severity, use LLM analysis, simulate speech, automate NVDA, or claim certification/legal conformance. Add deterministic positive, negative, preservation, unknown-rule, insufficient-evidence, dataset-version, and traceability tests. Run npm run typecheck, npm test, npm run lint, and npm run format:check, then update project/CURRENT-STATE.md, project/WORK-LOG.md, project/BACKLOG.md, project/DECISIONS.md if needed, and project/HANDOFF.md. Report files changed, public contracts, tests, decisions, unresolved issues, and the exact prompt for the next Chunk 4 agent.
```
