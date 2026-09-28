# AccessLedger Agent Guide

## Product and MVP objective

AccessLedger turns noisy website-accessibility data into a small set of evidence-backed,
systemic findings that municipal staff can validate and act on. It sells a risk-management
assessment and remediation process, not a scan, certification, legal opinion, or guarantee of
WCAG/ADA conformance.

The MVP must prove that reliable evidence can be collected, normalized, consolidated, mapped to
WCAG, and presented for efficient human validation without losing traceability. A final finding
must trace through observations and occurrences to evidence, page, and raw browser/scanner data.

## Required reading order

Before changing code, read:

1. `AGENTS.md`
2. `project/CURRENT-STATE.md`
3. `project/HANDOFF.md`
4. `docs/ARCHITECTURE.md`
5. the assigned chunk in `docs/MVP-IMPLEMENTATION-PLAN.md` and its relevant documentation
6. relevant records in `project/DECISIONS.md`

Consult `/reference` only when original product or methodology source material is needed.

## Scope boundaries

Initial MVP scope is browser/scanner evidence, accessibility semantics, observations, WCAG
mapping, grouping, draft findings, auditor validation, manual resident journeys, and Findings
Register export. Billing, customer accounts, multi-tenancy, public dashboards, production
monitoring, full reports, autonomous resident agents, synthetic screen readers, certification,
legal conclusions, and comprehensive WCAG automation are out of scope.

Never infer an accessibility violation from agent failure alone. LLM output is analyst assistance,
not evidence, NVDA behavior, resident testimony, final severity, or legal authority. Claims about
actual resident experience require human/assistive-technology validation.

## Architecture

The intended flow is:

```text
Target URL -> Browser -> Scanner -> Evidence -> Observations -> Grouping
           -> WCAG mapping -> Draft findings -> Human validation -> Export
```

Package responsibilities are documented in `docs/ARCHITECTURE.md`. `packages/shared` owns the
versioned runtime contracts at package boundaries. Raw evidence must remain distinct from
interpretation; grouping must retain every occurrence.

## Engineering conventions

- Use Node.js LTS, npm workspaces, TypeScript strict mode, Zod, Vitest, ESLint, and Prettier.
- Preserve ESM/NodeNext conventions and include `.js` in relative TypeScript import specifiers.
- Prefer small, explicit interfaces and mature dependencies. Avoid unrelated refactors.
- Keep the core portable across macOS and Windows. Use Node path/filesystem APIs; do not put
  Bash-only, macOS-only, or Windows-only commands in required workflows.
- Use deterministic local fixtures before live sites. Never put secrets or captured resident data
  in fixtures.
- Do not broaden scope without an architecture decision.

## Contracts and tests

Public schema/interface changes require updates to `docs/DATA-MODEL.md`,
`docs/ARCHITECTURE.md`, affected tests, and `project/DECISIONS.md`. Preserve explicit schema
versioning and serialization. Do not fabricate Cause, Effect, Recommendation, Severity, or
Confidence merely to satisfy a schema.

Write unit and contract tests with implementation. Required completion checks are:

```text
npm run typecheck
npm test
npm run lint
npm run format:check
```

Run chunk-specific acceptance tests as documented in the implementation plan.

## Before finishing

Update `project/CURRENT-STATE.md`, append `project/WORK-LOG.md`, and replace
`project/HANDOFF.md` with an accurate next-agent handoff. Update `project/BACKLOG.md` when work
status changes and `project/DECISIONS.md` for architectural or public-contract decisions. Critical
knowledge must live in the repository, not only in a chat response.
