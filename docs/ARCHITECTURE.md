# Architecture

## Purpose and invariant

AccessLedger is an evidence-processing and auditor-support system. It turns raw accessibility data
into a small number of traceable, systemic draft findings and gives a human auditor enough context
to validate resident impact efficiently.

The non-negotiable invariant is:

```text
Finding
  -> explicitly accepted GroupProposal
    -> Observation
      -> ObservationOccurrence records
        -> Evidence
        -> Page
          -> raw browser/scanner result
```

If a claim cannot be followed backward through this chain, it cannot be an approved finding.

## System flow

```text
Target URL
  -> Browser render
  -> Deterministic scanner
  -> Raw Evidence persistence
  -> Observation normalization
  -> Grouping without occurrence loss
  -> WCAG candidate mapping and evidence evaluation
  -> Durable pre-Finding proposal review
  -> Draft Finding
  -> Human / NVDA validation where required
  -> Findings Register export
```

Raw capture and interpretation are separate stages. Storing raw evidence first makes normalization,
mapping, and grouping reproducible as logic evolves.

## Package responsibilities

| Workspace                | Responsibility                                                   | Must not own                                       |
| ------------------------ | ---------------------------------------------------------------- | -------------------------------------------------- |
| `apps/assessment-cli`    | Orchestrate local assessments and future exports                 | Scanner rules or domain truth                      |
| `apps/auditor-studio`    | Minimal internal review and validation UI                        | Evidence generation or public portal concerns      |
| `packages/browser`       | Portable page loading and raw browser capture                    | WCAG conclusions                                   |
| `packages/scanner`       | Run established deterministic checks and preserve raw output     | Grouping or experiential severity                  |
| `packages/accessibility` | Collect browser accessibility semantics and interaction evidence | Claim NVDA equivalence                             |
| `packages/evidence`      | Evidence creation, integrity, storage boundary, and retrieval    | Findings prose                                     |
| `packages/export`        | Deterministic approved Findings Register artifacts               | Reports, certification, or inferred claims         |
| `packages/observations`  | Normalize source results into observations and occurrences       | Destructive deduplication                          |
| `packages/grouping`      | Suggest or produce inspectable systemic groups                   | Delete occurrence evidence                         |
| `packages/wcag`          | Structured criteria and versioned rule mappings                  | Legal or blanket conformance decisions             |
| `packages/findings`      | Draft and review finding records                                 | Manufacture unsupported Cause, Effect, or severity |
| `packages/journeys`      | Manual human journey definitions and results                     | Autonomous resident agents                         |
| `packages/persistence`   | Portable local repositories, migrations, and transactions        | Domain interpretation                              |
| `packages/llm`           | Optional analyst assistance with evidence-linked inputs/outputs  | Source evidence or final authority                 |
| `packages/shared`        | Versioned Zod schemas and TypeScript types at package boundaries | Implementation-specific driver types               |

Packages should expose narrow public entry points. Applications orchestrate packages through those
entry points rather than reaching into package internals.

## Evidence flow and identifiers

An `Assessment` scopes all work. A `Page` records the requested URL, final URL, loading outcome, and
raw evidence references. `Evidence` stores a typed source, capture time, content type, JSON payload,
and metadata without interpreting it as a WCAG failure.

Normalization creates an `Observation` for an evidence-supported technical proposition and one or
more `ObservationOccurrence` records for the concrete affected locations. An occurrence references
its page and exact evidence. Grouping associates observations without overwriting or collapsing
those records. A `Finding` must reference its source GroupProposal, at least one Observation, and at
least one Evidence item; relational integrity beyond record shape belongs in the service or future
persistence layer.

All persisted public entities carry `schemaVersion`. IDs are opaque non-empty strings so storage
implementations may choose UUIDs or another stable strategy without changing contracts.

## Responsibility boundaries

### Deterministic software

Use browser and established scanner behavior for technical facts such as missing accessible names,
empty controls, invalid ARIA, broken references, missing page language, and reliably computable
contrast. Store tool name/version and raw result. Documented scanner-to-WCAG mappings are structured
and versioned.

### LLM-assisted analysis

An LLM may summarize evidence, suggest grouping candidates, propose WCAG candidates when a
deterministic mapping is unavailable, draft neutral Condition language, or flag manual-review
needs. Every output must be labeled as assisted, tied to input evidence, and reviewable. LLM output
does not replace evidence and cannot certify, establish NVDA behavior, or assign final experiential
severity.

### Human validation

Human review is required for contextual meaning and actual experience: meaningful link purpose,
alternative-text quality, focus behavior, dynamic announcements, complex widgets, task completion,
Cause/Effect where not otherwise supported, and Blocker/Serious severity. NVDA validation is a
Windows-specific implementation behind the cross-platform validation interface.

## Persistence strategy

Chunks 6–7 and the acceptance workflow use SQLite through the Node `node:sqlite` API for the proven durable access patterns:
reviewer edits, grouping decisions, Validation records, guarded Finding transitions, audit
history, human-authored journey protocols, and append-only manual results.
`@accessledger/persistence` owns ordered SQL migrations and narrow synchronous proposal/review/journey
repositories. The current persistence schema version is `3`; migrations run in explicit
`BEGIN IMMEDIATE` transactions and are recorded in `schema_migrations`.

Immutable Observation, ObservationOccurrence, WcagCandidateEvaluation, Page, and Evidence JSON is
stored once in `source_records`. The original Finding and GroupProposal are retained alongside the
current Finding projection. Group decisions, Validation records, and audit events are append-only;
SQLite triggers reject updates/deletes. A Finding update and its audit event, or a Validation plus
human Evidence, derived validation status, and audit event, commit atomically. Optimistic comparison
of the complete current Finding JSON rejects stale reviewer writes. No ORM, remote service, account,
or multi-tenant boundary is introduced.

Migration 2 adds current ResidentJourney projections, append-only protocol revisions, append-only
JourneyResult records, normalized Finding/Evidence links, and append-only journey audit events.
Protocol edits use optimistic whole-record comparison. Creating/editing a protocol, recording a
result with immutable human Evidence, and adding a result-backed Validation each commit atomically.
Journey result Validation reuses the Chunk 6 `validations` table and exact-severity gate; a result
outcome alone never updates a Finding or assigns severity.

Migration 3 adds immutable original GroupProposal rows, ordered immutable links to every source
Observation, ObservationOccurrence, WCAG evaluation, Page, and Evidence record, append-only
pre-Finding decisions, and immutable proposal-to-draft links. An explicit accepted decision and an
eligible draft review bundle/link commit atomically. Rejected, split, ambiguous, and accepted but
unsupported singletons retain their decisions without a draft. Migrations 1 and 2 are unchanged.

SQLite paths are supplied by the caller and resolved with Node path APIs by the local application.
Large binary artifacts remain a future portable artifact-directory concern; only their immutable
Evidence metadata belongs in SQLite. See `AUDITOR-REVIEW.md` and ADR-012.

`apps/assessment-cli` composes the pure Chunk 3–4 transformations with
`GroupProposalReviewService.persistProposals` for saved, successful `RawPageAssessment` JSON. The
preparation application stores every pending proposal and its complete trace in one transaction;
it does not draft or manufacture a grouping decision. Duplicate deterministic proposal IDs fail
before any batch member is written. `GroupProposalReviewService.decide` records the explicit human
decision and invokes the existing `DeterministicFindingDrafter` only after acceptance.

## Package interfaces by stage

Future package interfaces should preserve these shapes:

```text
browser.loadPage(request) -> browser capture + Page fields
scanner.scan(capture) -> raw scanner result
evidence.record(raw source) -> Evidence
observations.normalize(Evidence[]) -> Observation[] + ObservationOccurrence[]
grouping.group(observations, occurrences) -> inspectable grouping proposals
wcag.evaluate(observation, mappings) -> candidate + supported/unsupported/uncertain state
findings.draft(group, evidence) -> Finding(status=draft)
validation.record(subject, human result) -> Validation
export.write(approved findings) -> JSON/CSV artifacts
```

Exact driver types are introduced in their owning chunk, but persisted outputs must validate
against `@accessledger/shared` contracts. Contract changes follow the process in `AGENTS.md`.

### Chunk 1 raw-capture boundary

`@accessledger/browser` owns Playwright launch, navigation, page metadata capture, and resource
lifecycle. Its runtime-only `BrowserCapture` exposes narrow script capabilities while retaining the
concrete Playwright page internally. `@accessledger/scanner` uses those capabilities to inject and
run axe-core. `@accessledger/evidence` orchestrates the two and creates a validated,
JSON-serializable `RawPageAssessment` from shared Page and Evidence records.

`RawPageAssessment` explicitly separates `loaded`, `navigation_failed`, and `scan_failed`
operational outcomes. Browser and scanner failures remain raw operational evidence. The scanner
payload is the direct JSON representation of axe output; no observation, WCAG mapping, finding, or
severity exists at this boundary. See `RAW-CAPTURE-RUNTIME.md` for ownership and installation
details.

### Chunk 2 accessibility-semantics boundary

`@accessledger/accessibility` consumes the live `BrowserCapture` through
`AccessibilityEvidenceCollector.collect(page, targets)`. A target is a versioned, serializable CSS
locator with an opaque ID and optional source-evidence reference; it is an evidence locator, not a
promise of durable element identity. Playwright Page and CDP session handles remain private to
`@accessledger/browser`.

The browser package resolves each controlled target and obtains its partial accessibility node from
the Chromium DevTools Protocol Accessibility domain. The collector reduces that serialized node to
available role, name, description, value, focusability, selected states, and IDREF relationships.
Every absent field is marked unavailable. Hidden, detached/missing, ambiguous, unexposed, and
browser-API failures are typed per-target evidence results rather than WCAG conclusions.

`RawPageAssessment` can accept optional target descriptors and adds ordered
`accessibilityEvidence`. Each record references its Page through `pageId`, lists the browser/scanner
raw evidence IDs in metadata, and optionally identifies the exact source evidence that supplied the
target. Provenance labels the result `browser_accessibility_semantics`, includes Chromium,
Playwright, and protocol versions, and sets `assistiveTechnologyOutput: false`. These records are
not NVDA output, synthesized speech, resident experience, or human validation.

### Chunk 3 observation and WCAG boundary

`@accessledger/observations` exposes `ObservationNormalizer.normalize({ page, evidence })`. The
deterministic implementation validates scope before processing and currently covers axe-core
`button-name`, `label`, `aria-valid-attr-value`, and narrowly validated `aria-prohibited-attr`
violations plus a collected Chromium button whose computed name is explicitly available and empty.
The prohibited-attribute path requires every node to retain a concrete target, parseable HTML with
the same non-empty ARIA attribute, element and computed-role check data, and axe engine provenance
that exactly matches the Evidence source. It creates one Observation per covered raw rule result and
one `ObservationOccurrence` per concrete axe node or semantics target. It does not group repeated
locations. Raw selectors, HTML, node/check detail, semantics, target descriptors, provenance, Page
IDs, and all evidence-chain IDs are retained without changing the raw records. Passes, browser
operational evidence, semantics errors, covered rules missing required facts, and facts outside this
allow-list remain explicit ignored inputs and do not become accessibility conclusions. Unknown
source rules are retained separately with their Evidence ID and tool/version instead of being
silently discarded.

`@accessledger/wcag` exposes `WcagKnowledge.getCriterion(id)` and
`WcagMapper.evaluate(observation)`. `JsonWcagKnowledge` loads and runtime-validates the reviewable
dataset under `data/wcag`; `EvidenceBasedWcagMapper` resolves a source tool/rule, checks its source
version and explicit fact requirements, and emits separate `WcagCandidateEvaluation` records.
Known candidates remain `supported`, `unsupported`, or `uncertain`; unknown rules produce an
uncertain trace with no fabricated criterion. The mapper does not mutate observations or create
findings. Dataset version, contract schema version, WCAG edition, and source-tool version remain
independent. The `aria-prohibited-attr` mapping is only a WCAG 4.1.2 candidate: scanner/node facts
alone leave it uncertain until separate evidence establishes user-interface-component
applicability, relevance of the prohibited attribute, and absence of the required programmatic
information. Axe impact, WCAG tags, and the rule assertion do not satisfy those requirements.

### Chunk 4 grouping boundary

`@accessledger/grouping` exposes
`GroupingEngine.propose(observations, occurrences, context) -> GroupProposal[]` through
`ConservativeGroupingEngine`. The context supplies validated Pages and optional explicit Page-to-
template IDs. The engine validates one-assessment referential integrity and refuses to silently
drop an Observation that has no occurrence.

Proposals use stable content-derived IDs and grouping algorithm version `1.0.0`. Every proposal
contains an exact member ledger plus ordered Observation, ObservationOccurrence, Page, and Evidence
ID indexes. It also records structured source, fingerprint, selector, component, role/name, page,
and template signals; a visible rationale; grouping-only confidence; and pending/accepted/rejected/
split review status. Proposal schema refinements ensure the ID indexes exactly match members.

Exact normalized component fingerprints can create high-confidence cross-page repeat candidates.
Without a fingerprint, selector and component structures must both match inside the same Page or an
explicitly declared shared template. Partial matches remain separate ambiguous singleton proposals
with related occurrence IDs; unmatched occurrences remain ordinary singletons. Grouping never
modifies or deletes an input record. This implementation does not create Findings, WCAG claims,
severity, experiential language, or approval decisions.

### Chunk 5 draft-finding boundary

`@accessledger/findings` exposes
`FindingDrafter.draft(group, evidenceContext) -> Finding(status="draft")` through
`DeterministicFindingDrafter`. The evidence context is the exact set of referenced Observations,
ObservationOccurrences, Pages, Evidence, and WCAG candidate evaluations. The drafter validates the
complete chain and rejects missing, unrelated, cross-assessment, or mismatched records.

The conservative policy accepts an explicitly accepted repeat proposal, or an accepted singleton
with a WCAG criterion supported by its evidence evaluation. A still-pending proposal may draft only
when it is a high-confidence repeat candidate. Rejected, split, ambiguous, pending singleton,
pending medium/low-confidence repeat, and unsupported singleton inputs fail explicitly.

Finding IDs are derived from drafting-policy version `1.0.0` and the stable GroupProposal ID. A
fixed template records the source tool/rule/category, exact occurrence and URL counts, affected URL
and component locators, exact Observation/Evidence indexes, only WCAG criteria supported for every
member Observation, and an explicit human-review need. Cause, Effect, Recommendation, severity,
and Finding confidence remain null; grouping confidence and scanner impact never populate them.
The public Finding record now carries its source GroupProposal ID and validation-need text so the
backward chain and the reason for review are explicit.

Drafting is a deterministic, JSON-serializable transformation and creates no review state that must
survive process boundaries. No LLM layer or persistence was added. Chunk 6's audit-safe edits and
state transitions are the first concrete persistence requirement.

### Chunk 6 auditor-review boundary

`@accessledger/findings` exposes `FindingReviewService` over a `ReviewRepository`. It creates a
review bundle only from a complete Chunk 5 trace, reloads and rechecks that trace on every operation,
and permits review mutations only while a Finding is `in_review`. The only legal terminal paths are
`draft -> in_review -> approved` and `draft -> in_review -> rejected`.

The service records accepted, rejected, or split grouping decisions as append-only projections; it
never edits the proposal member ledger. Finding edits are restricted to the five-part fields,
Finding confidence, and source-candidate WCAG criteria. Severity has a separate operation and must
exactly match a supported human Validation severity claim. Validation records identify explicit
claim types and, for severity, the exact validated level. NVDA-method records require assistive-
technology details; no adapter or simulated output is provided.

Approval requires an accepted group, complete source trace, all five-part judgment fields,
confidence, exact supported severity, and supported human Validation claims for grouping,
Condition, WCAG when present, Cause, Effect, Recommendation, and severity. Candidate WCAG criteria
must come from the source evaluations. Scanner impact, grouping confidence, browser semantics,
agent behavior, and LLM text have no promotion path into these judgments.

`apps/auditor-studio` is a small server-rendered internal interface. Native links, forms, labels,
fieldsets, tables, buttons, and disclosure elements expose the representative occurrence, every
member occurrence, raw/human Evidence, WCAG evaluations, missing fields, validation needs, review
actions, and audit history without requiring direct database use. It is not a customer dashboard.

The studio also exposes `/proposals` as the pre-Finding queue. Its detail view shows immutable
membership, rationale, grouping confidence, WCAG evaluations, source/tool versions, raw Evidence,
decision history, and any draft link. Native forms require an actor, reason, and explicit accept,
reject, or split choice. Acceptance never supplies WCAG support or resident-impact claims and does
not guarantee that a draft is eligible.

### Chunk 7 resident-journey boundary

`@accessledger/journeys` exposes `ResidentJourneyService` over the combined `JourneyRepository` and
`ReviewRepository` implemented by `SqliteReviewRepository`. It creates, loads/lists, edits, and
safely soft-deletes result-free generic human-authored protocols; loads their append-only audit
history; and records explicit manual
results with a named performer, platform/browser/optional assistive-technology environment,
start/end timing, one of five outcomes, notes, optional human NVDA observations, Finding links, and
immutable human Evidence.

`not_attempted` has no completion time. Every attempted result—including an interrupted or
otherwise `inconclusive` attempt—has an end time. `unable_to_complete` is reserved for an observed
human task result and is not selected from a browser, scanner, network, authentication, or agent
failure. NVDA observations require a recorded NVDA-on-Windows environment, but NVDA is optional and
the service has no execution/control adapter.

A JourneyResult can support a Finding only through a separately recorded `Validation` whose subject
is that persisted result, whose Evidence IDs are a non-empty subset of the immutable result
Evidence, and whose Finding is already linked to the protocol/result in the same assessment. The
Validation and Finding validation-status projection are one transaction. Exact severity still
requires a supported `severity` claim and is assigned through `FindingReviewService`; outcome names
do not map automatically to severity or any other claim.

The internal studio adds protocol create/edit, manual result recording, separate result Validation,
protocol audit history, and linked-result views in Finding review using native semantic controls.
It does not execute tasks, submit forms, synthesize users/speech, automate NVDA, or add export.

### Chunk 8 Findings Register export boundary

`@accessledger/export` exposes `FindingsExporter.export(assessmentId, format, destination)` through
`DeterministicFindingsExporter`. It scopes repository reads by assessment, loads complete traces
through `FindingReviewService`, omits non-approved records, and independently rechecks every
approved record before writing. Broken trace, incomplete five-part content, unresolved grouping,
missing exact severity/confidence, invalid Evidence, or insufficient supported human claims aborts
the export.

The independently versioned `1.0.0` export contract lives in `@accessledger/shared`. JSON is a
nested register document; CSV is one Finding per row with a fixed header and compact JSON cells for
arrays and nested trace summaries. Both outputs use stable ordering and UTF-8. The manifest records
assessment/format/generation metadata, record count, resolved path, exact byte length, and SHA-256.
Existing destinations are refused unless overwrite was explicitly enabled.

Occurrence references retain Observation, occurrence, Page, URL, component, and source Evidence
IDs. Validation summaries retain subject and Evidence links. Optional linked journey summaries are
loaded through `ResidentJourneyService` and retain protocol context, every recorded outcome value,
result Evidence IDs, and result-subject Validation IDs. Outcome values are copied only; no export
code maps them to severity, resident impact, accessibility/WCAG conclusions, certification,
conformance, or legal conclusions. `apps/assessment-cli` supplies the narrow local export command;
the auditor studio remains unchanged.

## Cross-platform boundary

Browser, scanner, evidence, WCAG, findings, persistence, CLI, and tests must run on macOS and
Windows. Required scripts must be Node/npm commands, not shell pipelines. Use `path.join`,
`path.resolve`, filesystem URLs, and temporary-directory APIs instead of hard-coded separators or
Unix utilities. Normalize URLs as URLs, not filesystem paths.

Only an NVDA adapter may assume Windows. It must implement a platform-neutral validation boundary
so its absence does not prevent collection, review, or export on macOS.

## Extension points

Later architecture may add document assessment, alternative assistive technologies, additional
WCAG versions, monitored reassessments, and downstream Board Brief/Assessment Report generation.
Each extension must preserve stable IDs, source evidence, explicit versions, and the distinction
between assessment and certification. Multi-tenancy and production infrastructure require a new
architecture decision; they are not latent MVP requirements.
