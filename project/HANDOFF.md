# Handoff — Post-MVP Acceptance and Productization Decision

## MVP completion

Chunks 0–8 are complete. The evidence-first pipeline now reaches deterministic approved Findings
Register JSON/CSV artifacts while retaining the full source trace, explicit human Validation, and
optional recorded journey context. All required root checks pass at 17 test files / 96 tests.

Chunk 8 added no SQLite migration or studio UI. Domain contract schema remains `1.0.0`, persistence
schema remains `2`, and the independently versioned Findings Register export schema begins at
`1.0.0`.

## Export boundary

`@accessledger/export` exposes `FindingsExporter`, `DeterministicFindingsExporter`, fixed JSON/CSV
serializers and CSV columns, and narrow review/journey source interfaces. `@accessledger/shared`
owns the Zod export document/record/summary/manifest schemas. `@accessledger/findings` exposes
`assertExportableApprovedTrace`, and review repository/service Finding listing can be scoped by
assessment.

The exporter omits non-approved records and rechecks every approved trace before writing. It
refuses broken, incomplete, unresolved, improperly evidenced, or insufficiently supported approved
records. JSON is nested; CSV uses one Finding row and compact JSON for nested structures. Findings,
criteria, IDs, occurrences, Validations, journeys, and results have documented stable ordering.
The manifest includes the exact artifact SHA-256 and byte length.

Run:

```text
npm run findings:export -- <database-path> <assessment-id> <json|csv> <destination> [--overwrite]
npm run findings:export -- --help
```

Existing destinations are refused unless `--overwrite` is explicitly supplied. The database must
already exist. See `docs/FINDINGS-REGISTER-EXPORT.md` for schema, columns, ordering, and examples.

## Traceability and journey boundary

Each record retains stable Finding and source GroupProposal IDs; five-part content; exact approved
severity/confidence; WCAG criteria; occurrence count; affected URLs/components; Observation,
Occurrence, Page, and Evidence references; and full Validation summaries. Optional linked journey
summaries retain protocol context, exact result outcomes, performer/environment/timing/notes,
supporting Evidence IDs, and result-subject Validation IDs.

The outcome values `completed`, `completed_with_difficulty`, `unable_to_complete`, `not_attempted`,
and `inconclusive` are recorded context only. No outcome is mapped to severity, accessibility or
WCAG violation, resident impact, conformance, certification, or legal conclusion. Exact severity
continues to require separate supported human Validation.

## Verification and limitations

Required checks passed:

```text
npm run typecheck
npm test                 # 17 files / 96 tests
npm run lint
npm run format:check
```

The test suite's deterministic fixture server requires loopback binding permission. Node 22 may
emit its upstream `node:sqlite` experimental warning. No known Chunk 8 correctness defect remains.

The artifact is a working register, not a polished Board Brief/Assessment Report. XLSX, customer
dashboards, accounts, billing, multi-tenancy, production monitoring, remediation costing,
autonomous journeys, synthetic users/speech, automated form submission, and automated/remote NVDA
remain deferred. CSV nested fields require JSON parsing, and real-run generation timestamps
intentionally produce different bytes/hashes.

## Recommended post-MVP decision point

Do not begin a deferred feature by assumption. First perform an acceptance review against the
product thesis and real stakeholder workflow, inspect a representative exported register, and
select one explicitly funded next track. Likely candidates are a fuller report/Board Brief,
remediation workflow fields, broader detector/WCAG coverage, deployment/account architecture, or
monitoring; each has materially different product and architecture consequences.

The next agent should produce a decision-ready gap analysis and proposed next chunk with explicit
scope, evidence, success criteria, contract/migration consequences, and non-goals. It should not
implement the selected track until the user approves it.

## Exact recommended prompt for the next post-MVP agent

```text
Read AGENTS.md, project/CURRENT-STATE.md, project/HANDOFF.md, project/BACKLOG.md, docs/PRODUCT-THESIS.md, docs/ARCHITECTURE.md, docs/FINDINGS-REGISTER-EXPORT.md, docs/AUDITOR-REVIEW.md, docs/RESIDENT-JOURNEYS.md, docs/TESTING-METHODOLOGY.md, docs/DATA-MODEL.md, and ADR-014 plus relevant earlier entries in project/DECISIONS.md. Conduct a post-MVP acceptance and productization decision review only; do not implement a deferred feature yet. Verify that the completed Chunks 0–8 satisfy the evidence-first MVP objective and that the approved Findings Register export preserves traceability and the human-only claim boundary. Identify concrete workflow, coverage, usability, portability, and product gaps using repository evidence; distinguish correctness defects from deliberate MVP limitations. Compare the next-track options—full Assessment Report/Board Brief, remediation workflow fields, broader detector/WCAG coverage, deployment/accounts/multi-tenancy, and recurring monitoring—against product value, evidence needs, architecture/contract/migration impact, risk, and scope. Recommend one next chunk with explicit objective, allowed changes, public contracts, acceptance tests, non-goals, dependencies, and decision gates. Update project/CURRENT-STATE.md, project/BACKLOG.md, project/DECISIONS.md, project/WORK-LOG.md, and project/HANDOFF.md only if the review produces an approved documentation decision; otherwise report the recommendation and unresolved choices without changing code or expanding scope.
```
