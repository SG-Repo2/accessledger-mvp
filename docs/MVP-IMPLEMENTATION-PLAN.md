# MVP Implementation Plan

## Rules for every chunk

Each chunk begins with the reading order in `AGENTS.md`, changes only its allowed areas, and ends by
running root validation plus its listed acceptance tests. Public contract changes require data-model
and architecture updates, tests, an entry in `project/DECISIONS.md`, and a deliberate schema-version
decision. Use local deterministic fixtures before live sites. Preserve the full evidence chain and
update project state/handoff files before stopping.

## Chunk 0 — Foundation (complete)

**Objective:** Establish agent-agnostic context, product/methodology documentation, architecture,
and stable runtime domain contracts without accessibility implementation.

**Dependencies:** Existing npm workspace foundation and the three `/reference` sources.

**Allowed changes:** `AGENTS.md`, `docs/**`, `project/**`, `packages/shared/**`, and the npm lockfile
only as needed to register the workspace.

**Inputs:** Product explainer, independent MVP review, WCAG reference, existing root configuration.

**Outputs:** Durable context files, seven project documents, `@accessledger/shared`, contract tests.

**Public contracts:** `Assessment`, `Page`, `Evidence`, `Observation`,
`ObservationOccurrence`, `WCAGCriterion`, `Finding`, `Validation`, `ResidentJourney`, and
`JourneyResult`, each backed by Zod.

**Implementation tasks:** Distill source material; define package boundaries and evidence flow;
document testing categories; define versioned schemas and inferred types; record initial decisions;
create the backlog and Chunk 1 handoff.

**Tests:** Schema success/failure, nullability, traceability, WCAG mapping, and human journey records;
all four root validation commands.

**Acceptance criteria:** All required files exist; shared package is a valid workspace; contracts
compile and validate at runtime; repository remains npm/ESM and macOS/Windows compatible; state says
Chunk 0 is complete.

**Explicit non-goals:** Playwright, axe-core, scans, accessibility-tree extraction, WCAG evaluation,
grouping, UI, autonomous journeys, and NVDA integration.

**Handoff:** `project/HANDOFF.md` provides the exact Chunk 1 scope, commands, contracts, and traps.

## Chunk 1 — Browser + Scanner

**Objective:** Given one URL, load it with Playwright, run axe-core, and return/persist lossless raw
page and scanner evidence for controlled fixtures.

**Dependencies:** Chunk 0 contracts; Playwright and axe-core added in this chunk; Node LTS. Browser
installation must be documented separately from npm dependency installation.

**Allowed changes:** `packages/browser/**`, `packages/scanner/**`, `packages/evidence/**` only if a
minimal file-backed recorder is required, `packages/shared/**` only for reviewed raw-capture public
contracts, `data/fixtures/**`, relevant tests/docs, root dependency manifests, and project state.
Do not change observation, grouping, findings, journey, UI, or NVDA packages.

**Expected input:**

```ts
type RawPageAssessmentRequest = {
  assessmentId: string;
  url: string;
};
```

**Expected output:** A `RawPageAssessment` public result containing a validated `Page`, raw browser
`Evidence`, raw axe `Evidence`, tool versions, and an operational result that distinguishes a loaded
page from navigation/scan failure. Define and test its Zod schema before exposing it. Do not return
normalized observations or findings.

**Public interfaces/contracts:**

```text
BrowserLoader.load(request) -> BrowserCapture
AccessibilityScanner.scan(BrowserCapture) -> ScannerCapture
assessRawPage(request) -> RawPageAssessment
```

Concrete browser page handles remain internal and must not cross a serializable package boundary.
Persisted results use `Page` and `Evidence`; source payloads retain original axe/browser data.

**Implementation tasks:**

1. Add compatible Playwright and axe-core versions using npm.
2. Implement lifecycle-safe page/browser loading with final URL, title, language, timestamps, and
   explicit failure data.
3. Inject/run axe only after the fixture is ready; capture rule results, nodes, selectors, HTML,
   help URLs, impact labels as raw source data, and tool versions.
4. Convert captures into JSON-serializable `Page`/`Evidence` records without making WCAG findings.
5. Add local HTTP fixture support in portable TypeScript/Node code and guaranteed teardown.
6. Document installation, timeout, and browser ownership behavior.

**Tests:** At minimum `good-form.html`, `unlabeled-input.html`, `empty-button.html`, and
`broken-aria.html`; success, redirect/final URL, load failure, scanner execution, exact raw node
preservation, JSON round trip, and resource cleanup. Tests must not require a live municipal site or
Unix-only command.

**Acceptance criteria:** A fixture URL produces deterministic raw Page/Evidence output; operational
failures are typed and never labeled accessibility failures; axe source details remain lossless;
browser processes close on success/failure; tests and all root checks pass on the development OS
with no hard-coded path separators.

**Explicit non-goals:** Accessibility-tree collection, observation normalization, WCAG adjudication,
deduplication, findings, LLM use, auditor UI, resident journeys, severity, and NVDA.

**Handoff:** Record dependency/browser versions, exact public exports, fixture server command,
evidence payload examples, known platform limitations, test results, and the next Chunk 2 prompt.

## Chunk 2 — Accessibility Evidence

**Objective:** Add browser-exposed accessibility semantics and narrowly scoped interaction facts as
evidence without claiming to simulate a screen reader.

**Dependencies:** Chunk 1 browser lifecycle and Evidence contract.

**Allowed changes:** `packages/accessibility/**`, necessary narrow extensions to `packages/browser`,
`packages/evidence`, or shared contracts, controlled fixtures/tests, relevant docs, project state.

**Expected inputs:** Loaded browser capture/page context and target elements identified by fixture or
scanner node references.

**Expected outputs:** `Evidence(kind="accessibility_semantics")` containing available role, name,
description, value, states, focusability, and relationships, plus explicitly recorded unavailable
fields/errors.

**Public interfaces/contracts:**

```text
AccessibilityEvidenceCollector.collect(page, targets) -> accessibility Evidence[]
```

Do not expose Playwright handles. If a serializable target descriptor is needed, version it and keep
selectors as evidence locators rather than guaranteed durable identity.

**Implementation tasks:** Collect semantics through supported browser APIs; record provenance and
browser version; handle detached/hidden elements; add accessible-name/role/state fixtures; document
gaps relative to NVDA.

**Tests:** Known roles/names/states, missing-name case, hidden/detached behavior, JSON serialization,
and proof that results are labeled browser semantics rather than NVDA output.

**Acceptance criteria:** Evidence is reproducible on fixtures, linked to page/raw evidence, portable,
and contains no experiential or WCAG conclusion.

**Explicit non-goals:** Synthetic speech, NVDA automation, task completion, normalization, mapping,
grouping, or severity.

**Handoff:** Document browser APIs used, unavailable semantics, target descriptor contract, fixture
coverage, and commands/results.

## Chunk 3 — Observation Normalization + WCAG Mapping

**Objective:** Convert raw evidence into normalized observations/occurrences and evaluate candidate
WCAG relationships using a small, versioned knowledge dataset.

**Dependencies:** Chunks 1–2 evidence and shared observation/WCAG contracts.

**Allowed changes:** `packages/observations/**`, `packages/wcag/**`, `data/wcag/**`, fixtures/tests,
reviewed shared-contract changes, relevant docs, project state. A persistence decision may be made
here only if required to retain the normalized chain.

**Expected inputs:** Validated Page and Evidence records from browser, scanner, and accessibility
collectors.

**Expected outputs:** Observation and ObservationOccurrence records; per-candidate evaluation state
and trace; versioned criterion/mapping records.

**Public interfaces/contracts:**

```text
ObservationNormalizer.normalize(evidence) -> observations + occurrences
WcagKnowledge.getCriterion(id) -> WCAGCriterion | undefined
WcagMapper.evaluate(observation) -> candidate evaluations
```

If candidate evaluation needs a new persisted contract, add it through the public-schema process;
do not overload `Finding`.

**Implementation tasks:** Define deterministic normalizers for covered axe rules; add only required
WCAG 2.1 A/AA criteria; encode official tool mappings with provenance/version; compare evidence to
requirements; retain unsupported/uncertain results; choose/document lightweight persistence if
needed.

**Tests:** One-to-one raw-to-observation trace, occurrence detail preservation, known mapping,
unknown rule, insufficient evidence, unsupported candidate, criterion schema validation, dataset
version, and fixture determinism.

**Acceptance criteria:** Every observation points to raw evidence; every occurrence points to a page;
mappings are inspectable and not LLM-generated; uncertainty is preserved; no finding is created.

**Explicit non-goals:** Grouping, draft prose, severity, UI, autonomous testing, or broad ingestion of
the entire WCAG standard.

**Handoff:** Record supported source rules/criteria, dataset and storage versions, migration/setup
commands, mapping provenance, coverage gaps, and Chunk 4 inputs.

## Chunk 4 — Deduplication / Grouping

**Objective:** Consolidate repeated technical observations into reviewable systemic group proposals
while retaining every occurrence and avoiding false merges.

**Dependencies:** Chunk 3 normalized observations, occurrences, pages, and candidates.

**Allowed changes:** `packages/grouping/**`, grouping fixtures/tests, reviewed shared/persistence
extensions, relevant docs, project state.

**Expected inputs:** Observation/occurrence records plus page URL/template and available DOM or
component fingerprints.

**Expected outputs:** Versioned grouping proposals containing stable proposal ID, member observation
and occurrence IDs, grouping signals/rationale, confidence as grouping metadata, and review status.

**Public interfaces/contracts:**

```text
GroupingEngine.propose(observations, occurrences, context) -> GroupProposal[]
```

Define `GroupProposal` in shared only after its actual review needs are proven. Grouping confidence
must not be confused with Finding confidence or severity.

**Implementation tasks:** Establish conservative deterministic keys; combine rule, DOM structure,
attributes, ancestry, URL/template, and role/name patterns; make proposals inspectable; support no-
merge/split review states; preserve member ordering deterministically.

**Tests:** `236 -> one proposal + 236 occurrences`, similar-but-distinct components stay separate,
cross-page template repeats group, unstable selector does not erase identity, deterministic rerun,
and split/reject preservation.

**Acceptance criteria:** Zero occurrence loss; repeatable output; rationale visible; precision is
favored over aggressive consolidation; groups are proposals until accepted where ambiguity exists.

**Explicit non-goals:** Findings prose, Cause/Effect inference, severity, LLM-only grouping, UI, or
resident automation.

**Handoff:** Record grouping keys/limits, labeled fixture metrics, public proposal shape, unresolved
false merge/split risks, and Chunk 5 inputs.

## Chunk 5 — Draft Findings

**Objective:** Turn accepted/high-confidence groups into neutral, evidence-linked draft findings.

**Dependencies:** Chunk 4 groups and Chunk 3 WCAG evaluations.

**Allowed changes:** `packages/findings/**`, optional isolated `packages/llm/**`, templates/tests,
reviewed contract/persistence changes, relevant docs, project state.

**Expected inputs:** Group proposal, observations/occurrences, supported/candidate WCAG evaluations,
and referenced evidence.

**Expected outputs:** `Finding(status="draft")` with condition, scope, counts, traceability, validation
need, and nullable unsupported fields.

**Public interfaces/contracts:**

```text
FindingDrafter.draft(group, evidenceContext) -> Finding
```

Optional `FindingLanguageAssistant` must return labeled suggestions plus input evidence IDs; its
output is not automatically approved.

**Implementation tasks:** Prefer deterministic templates; compute affected scope/counts; require
traceability; set validation needs; keep Cause, experiential Effect, Recommendation, Severity, and
Confidence null unless supported; isolate/record any LLM prompt, model, response, and evidence IDs.

**Tests:** Stable draft from fixed group, exact occurrence count, no invented nullable fields,
candidate vs supported criteria behavior, missing-evidence rejection, optional LLM output cannot
overwrite evidence.

**Acceptance criteria:** Every draft traces backward; neutral Condition describes evidence; output
validates; no certification language or automatic experiential severity appears.

**Explicit non-goals:** Final approval, polished customer reports, autonomous remediation, or final
resident-impact claims.

**Handoff:** Document template coverage, validation triggers, optional model configuration and safe
fallback, example trace, and Chunk 6 review requirements.

## Chunk 6 — Auditor Review + Validation

**Objective:** Provide the smallest useful internal workflow to inspect evidence, correct groups,
edit findings, record validation, assign supported severity, and approve/reject findings.

**Dependencies:** Chunk 5 drafts and persistence capable of audit-safe updates.

**Allowed changes:** `apps/auditor-studio/**`, necessary findings/grouping/validation/persistence
services, reviewed shared changes, UI tests/fixtures, relevant docs, project state.

**Expected inputs:** Draft findings, groups, occurrences, evidence, pages, WCAG records.

**Expected outputs:** Reviewed findings, grouping decisions, Validation records, and auditable state
transitions.

**Public interfaces/contracts:** Review service operations for loading a complete trace, editing
allowed fields, approving/rejecting grouping, adding validation, and transitioning finding status.
State transitions must be enforced server/service-side, not only in the UI.

**Implementation tasks:** Minimal evidence-first views; representative and all-occurrence access;
edits for five-part fields; validation queue; severity controls gated by evidence; approval checks;
audit history if not already present; accessible keyboard-operable internal UI.

**Tests:** Trace loading, edit persistence, grouping accept/reject, required-validation gate, invalid
transition rejection, evidence remains immutable, UI keyboard/screen semantics, and happy-path
approval.

**Acceptance criteria:** An auditor can inspect and approve a fully traceable finding without using
raw database tools; unsupported claims remain visibly incomplete; all state changes are retained.

**Explicit non-goals:** Customer dashboard, multi-tenancy, visual polish, billing, full reporting, or
automated NVDA control.

**Handoff:** Document local startup, storage/migrations, review roles/assumptions, transition rules,
known usability issues, and Chunk 7 integration points.

## Chunk 7 — Resident Journey Recording

**Objective:** Let an auditor define human civic tasks, record human/NVDA outcomes, attach evidence,
and relate results to findings.

**Dependencies:** Chunk 6 review/validation workflow and journey contracts.

**Allowed changes:** `packages/journeys/**`, journey sections in auditor studio, validation and
persistence integration, reviewed contracts, tests/docs, project state.

**Expected inputs:** Human-authored journey definition and manually observed execution details.

**Expected outputs:** Validated ResidentJourney, JourneyResult, and related Validation records.

**Public interfaces/contracts:** CRUD/recording services around existing shared journey schemas; no
browser agent execution interface.

**Implementation tasks:** Create/edit journey protocols; capture performer/environment/timing;
record allowed outcomes and NVDA notes; link findings/evidence; handle not-attempted/inconclusive;
show results in finding review.

**Tests:** All outcome states, required human performer, link integrity, interrupted/inconclusive
test, NVDA data optional, and no automatic outcome from browser failure.

**Acceptance criteria:** Human results are reproducible records and can support validation/severity;
the core still runs without Windows/NVDA; examples are not hard-coded.

**Explicit non-goals:** Autonomous journeys, synthetic users, automated form submission, or remote
NVDA control.

**Handoff:** Document human protocol, Windows validation setup as an external procedure, linking
rules, sample record, and export requirements.

## Chunk 8 — Findings Register Export

**Objective:** Export approved findings as stable, traceable JSON and CSV suitable for the working
Findings Register.

**Dependencies:** Approved Chunk 6 findings and optional Chunk 7 journey results.

**Allowed changes:** Export package or CLI command, assessment CLI wiring, schemas/tests/docs,
project state. XLSX may be added only if straightforward and justified.

**Expected inputs:** An assessment ID and its approved findings, mappings, validation summaries,
scope, and evidence references.

**Expected outputs:** Deterministically ordered UTF-8 JSON and CSV files; optional XLSX.

**Public interfaces/contracts:**

```text
FindingsExporter.export(assessmentId, format, destination) -> ExportManifest
```

Define/version the export schema and manifest (format, schema version, assessment, generated time,
record count, and artifact path/hash) before implementation.

**Implementation tasks:** Establish columns/nested JSON structure; filter approved findings; preserve
stable IDs, criteria, occurrence count, validation, journeys, and evidence references; implement
portable paths/escaping; provide CLI help and overwrite behavior.

**Tests:** Golden JSON/CSV, commas/quotes/newlines/Unicode, stable ordering, rejected/draft exclusion,
empty export, portable destination paths, schema validation, and round-trip trace identifiers.

**Acceptance criteria:** Approved findings export without fact drift; consumers can trace each record;
files open correctly on macOS and Windows; all root checks pass.

**Explicit non-goals:** Full Board Brief, Assessment Report, remediation costing, public portal,
certification language, or monitoring service.

**Handoff:** Record schema/column version, command examples, sample artifacts, limitations, validation
results, and the recommended post-MVP decision point.
