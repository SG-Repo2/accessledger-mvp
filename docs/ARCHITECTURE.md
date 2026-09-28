# Architecture

## Purpose and invariant

AccessLedger is an evidence-processing and auditor-support system. It turns raw accessibility data
into a small number of traceable, systemic draft findings and gives a human auditor enough context
to validate resident impact efficiently.

The non-negotiable invariant is:

```text
Finding
  -> grouped Observation
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
those records. A `Finding` must reference at least one observation and one evidence item; relational
integrity beyond record shape belongs in the persistence/service layer.

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

The MVP should use a local, lightweight database after its access patterns are proven; SQLite is
the expected default, subject to a Chunk 3 decision. Persistence uses repositories defined around
shared domain records, migrations, and explicit transactions. Large binary artifacts such as
screenshots may be stored in a portable artifact directory with database metadata and content
hashes. Paths must be resolved with Node `path` APIs and stored as portable relative references
when possible.

No persistence layer exists in Chunk 0. JSON-serializable schemas define the boundary without
prematurely choosing tables or an ORM.

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
