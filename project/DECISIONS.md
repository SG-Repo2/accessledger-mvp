# Architecture Decisions

## ADR-001 — Evidence-first, traceable domain chain

- **Date:** 2026-09-28
- **Status:** Accepted
- **Context:** The product must consolidate scanner noise without weakening defensibility.
- **Decision:** Keep Page, raw Evidence, Observation, ObservationOccurrence, WCAG knowledge,
  Finding, and Validation as distinct records. A Finding requires observation and evidence IDs;
  grouping must retain every occurrence.
- **Reason:** Raw facts must remain reproducible and every claim must be auditable backward.
- **Alternatives considered:** Store only scanner results; flatten evidence into findings; delete
  duplicate occurrences after grouping.
- **Consequences:** More records and referential checks are required. Reprocessing and review remain
  possible, and systemic counts do not hide affected locations.

## ADR-002 — Assessment and human-validation boundary

- **Date:** 2026-09-28
- **Status:** Accepted
- **Context:** Automated agents and scanners cannot reliably establish all accessibility or actual
  screen-reader experience.
- **Decision:** AccessLedger renders assessments, never certifications or legal conclusions. Agent
  failure is not accessibility evidence by itself. LLMs are analyst aids only. Actual task outcomes,
  NVDA behavior, and Blocker/Serious severity require human validation.
- **Reason:** This matches the product promise and avoids unsupported experiential claims.
- **Alternatives considered:** Autonomous resident agent; synthetic screen reader; scanner impact as
  final severity.
- **Consequences:** Some records remain uncertain/null until reviewed; the MVP optimizes auditor
  work instead of attempting full automation.

## ADR-003 — Zod contracts with explicit record schema versioning

- **Date:** 2026-09-28
- **Status:** Accepted
- **Context:** Workspace packages need runtime validation and TypeScript types that can evolve.
- **Decision:** `@accessledger/shared` owns Zod schemas, inferred types, and
  `schemaVersion: "1.0.0"` on public persisted records. IDs remain opaque strings and records use
  JSON-serializable values.
- **Reason:** One source of truth prevents compile-time/runtime drift and supports migrations.
- **Alternatives considered:** TypeScript interfaces only; branded UUID-only IDs; implicit package
  version as data version.
- **Consequences:** Public changes require coordinated docs/tests/decision updates and a deliberate
  schema-version decision. Referential integrity remains a service/persistence responsibility.

## ADR-004 — Unsupported finding judgments are nullable

- **Date:** 2026-09-28
- **Status:** Accepted
- **Context:** Technical evidence can strongly support Condition but may not establish Cause,
  experiential Effect, Recommendation, Severity, or Confidence.
- **Decision:** Those Finding fields are nullable; code must not invent values to complete a record.
- **Reason:** Explicit absence is more reliable than polished but unsupported prose.
- **Alternatives considered:** Required placeholder strings; automated inference; omit fields until
  known.
- **Consequences:** Review/export must handle nulls and may gate approval based on policy developed
  in Chunk 6.

## ADR-005 — Cross-platform core with isolated NVDA boundary

- **Date:** 2026-09-28
- **Status:** Accepted
- **Context:** Core development and scanning must run on macOS and Windows, while NVDA is Windows-
  specific.
- **Decision:** Required workflows use Node/npm and portable path/filesystem APIs. Journey and
  Validation records are platform-neutral; any future NVDA adapter is isolated behind that boundary.
- **Reason:** Windows validation must not make the complete pipeline Windows-dependent.
- **Alternatives considered:** Windows-only application; macOS-only development scripts; treat
  browser accessibility semantics as NVDA output.
- **Consequences:** Platform assumptions require explicit adapter code and cross-platform tests.

## ADR-006 — Defer storage implementation; expect lightweight local persistence

- **Date:** 2026-09-28
- **Status:** Accepted
- **Context:** Chunk 0 needs stable serializable boundaries but lacks real access patterns for a
  database/ORM choice.
- **Decision:** Do not add persistence in Chunk 0. Prefer SQLite for the local MVP unless Chunk 3
  evidence demonstrates a better lightweight option; record that later choice separately.
- **Reason:** This avoids premature table/ORM design while keeping contracts storage-ready.
- **Alternatives considered:** Choose SQLite and ORM now; JSON files as permanent storage; remote
  database.
- **Consequences:** Chunks 1–2 may use in-memory or minimal file artifacts for tests. Chunk 3 must
  decide repositories, migrations, integrity rules, and artifact layout if persistence is required.
