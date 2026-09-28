# Handoff — Start Chunk 1 Only

## Last completed work

Chunk 0 is complete. Durable context and project documentation now live in the repository.
`@accessledger/shared` exports versioned Zod schemas and inferred types for the core domain. Root
typecheck, tests, lint, and formatting checks pass. No browser, scanner, persistence, grouping, UI,
or NVDA implementation exists yet.

## What to do next

Implement **Chunk 1 — Browser + Scanner** exactly as specified in
`docs/MVP-IMPLEMENTATION-PLAN.md`. Add Playwright and axe-core in that chunk, build a portable
single-page raw assessment pipeline, and verify it against deterministic local fixtures. Stop before
Chunk 2.

## Required reading

1. `AGENTS.md`
2. `project/CURRENT-STATE.md`
3. this file
4. `docs/ARCHITECTURE.md`
5. Chunk 1 in `docs/MVP-IMPLEMENTATION-PLAN.md`
6. `docs/TESTING-METHODOLOGY.md`, `docs/DATA-MODEL.md`, and ADRs 001–006

Do not normally reread `/reference`; Chunk 0 already distilled it.

## Important interfaces

- Import runtime schemas/types from `@accessledger/shared`.
- `Page` distinguishes requested/final URLs and operational load failure.
- `Evidence` stores JSON source payloads and exact tool provenance without interpretation.
- The Chunk 1 result must conceptually be `RawPageAssessment`: validated Page plus raw browser and
  axe Evidence and typed operational outcome. Define/test its public Zod contract before export.
- Keep Playwright `Page`/browser handles internal. Serialized package boundaries must be portable.

## Known traps

- A navigation, timeout, bot, authentication, or automation failure is not an accessibility finding.
- Preserve raw axe rule/node/selector/HTML/help/impact data; do not normalize it yet.
- Do not map WCAG, group occurrences, draft findings, infer resident impact, or begin accessibility-
  semantics collection.
- Use a Node/TypeScript fixture server and Node path APIs, not Bash or OS-specific scripts.
- Ensure browser/context/page and fixture-server teardown on every code path.
- Adding/changing a public contract requires the documented schema-change process.

## Commands

Install dependencies with npm only. Before finishing, run:

```text
npm run typecheck
npm test
npm run lint
npm run format:check
```

Update current state, work log, backlog status, decisions as applicable, and replace this handoff.

## Exact recommended prompt for the next agent

```text
Read AGENTS.md, project/CURRENT-STATE.md, project/HANDOFF.md, docs/ARCHITECTURE.md, the Chunk 1 section of docs/MVP-IMPLEMENTATION-PLAN.md, docs/TESTING-METHODOLOGY.md, docs/DATA-MODEL.md, and relevant entries in project/DECISIONS.md. Implement Chunk 1 only: Browser + Scanner. Use npm and preserve the existing TypeScript/ESM/workspace setup. Add Playwright and axe-core, implement a cross-platform single-page RawPageAssessment pipeline that produces validated Page and lossless raw Evidence records, and add deterministic local HTML fixtures and tests for success, failures, redirects, raw axe node preservation, JSON serialization, and resource cleanup. Do not begin Chunk 2: do not implement accessibility-tree/semantics extraction, observation normalization, WCAG evaluation, grouping, findings, LLM analysis, the auditor UI, resident automation, severity, or NVDA integration. Run npm run typecheck, npm test, npm run lint, and npm run format:check, then update project/CURRENT-STATE.md, project/WORK-LOG.md, project/BACKLOG.md, project/DECISIONS.md if needed, and project/HANDOFF.md. Report files changed, public contracts, tests, decisions, unresolved issues, and the exact prompt for the next Chunk 2 agent.
```
