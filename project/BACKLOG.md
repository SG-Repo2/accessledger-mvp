# Backlog

Status values: `done`, `ready`, `planned`, `deferred`, `idea`. Priorities: P0 (required), P1
(important), P2 (later).

## MVP requirements

| ID      | Description                                                     | Priority | Status  | Dependency          | Target chunk |
| ------- | --------------------------------------------------------------- | -------- | ------- | ------------------- | ------------ |
| MVP-000 | Foundation, durable context, architecture, and shared contracts | P0       | done    | Existing repository | 0            |
| MVP-101 | Portable browser loading and raw page capture                   | P0       | done    | MVP-000             | 1            |
| MVP-102 | axe-core scan with lossless raw evidence                        | P0       | done    | MVP-101             | 1            |
| MVP-201 | Browser accessibility semantics evidence                        | P0       | done    | MVP-101             | 2            |
| MVP-301 | Normalize evidence into observations/occurrences                | P0       | done    | MVP-102, MVP-201    | 3            |
| MVP-302 | Structured WCAG 2.1 criteria and versioned mappings             | P0       | done    | MVP-301             | 3            |
| MVP-401 | Conservative systemic grouping with zero occurrence loss        | P0       | done    | MVP-301             | 4            |
| MVP-501 | Evidence-linked draft findings                                  | P0       | planned | MVP-401, MVP-302    | 5            |
| MVP-601 | Minimal auditor review and human validation workflow            | P0       | planned | MVP-501             | 6            |
| MVP-701 | Manual resident journey recording                               | P1       | planned | MVP-601             | 7            |
| MVP-801 | Approved Findings Register JSON/CSV export                      | P0       | planned | MVP-601             | 8            |

## Bugs

No known bugs.

## Deferred work

| ID      | Description                                              | Priority | Status   | Dependency                           | Target chunk                 |
| ------- | -------------------------------------------------------- | -------- | -------- | ------------------------------------ | ---------------------------- |
| DEF-001 | XLSX Findings Register export                            | P2       | deferred | MVP-801                              | Post-MVP unless trivial in 8 |
| DEF-002 | Full Board Brief and Assessment Report generation        | P2       | deferred | Validated export/product decision    | Post-MVP                     |
| DEF-003 | Full PDF remediation                                     | P2       | deferred | Separate product scope               | Post-MVP                     |
| DEF-004 | Customer accounts, billing, multi-tenancy, public portal | P2       | deferred | Product/architecture decision        | Post-MVP                     |
| DEF-005 | Recurring monitoring and production infrastructure       | P2       | deferred | Proven core pipeline                 | Post-MVP                     |
| DEF-006 | Automated NVDA adapter                                   | P2       | deferred | Human workflow and separate decision | Post-MVP                     |

## Future ideas

| ID       | Description                                         | Priority | Status | Dependency                  | Target chunk |
| -------- | --------------------------------------------------- | -------- | ------ | --------------------------- | ------------ |
| IDEA-001 | Additional assistive-technology validation adapters | P2       | idea   | Stable Validation interface | Future       |
| IDEA-002 | Additional WCAG editions with independent datasets  | P2       | idea   | Versioned WCAG layer        | Future       |
| IDEA-003 | Document-assessment pipeline                        | P2       | idea   | Proven website pipeline     | Future       |
