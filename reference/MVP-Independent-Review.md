# AccessLedger MVP Independent Review

## Purpose

This document records an independent critique of an earlier proposed AccessLedger MVP architecture.

It is advisory.

The AccessLedger product proposal remains the primary source of truth.

The purpose of retaining this review is to prevent future implementation agents from repeating architectural mistakes that were identified during MVP planning.

---

# 1. Product Interpretation

The AccessLedger proposal describes a business reporting and risk-management process for web accessibility modeled after familiar municipal audit practices.

The product is not primarily a scanner.

Its value is turning large quantities of technical accessibility data into a small number of understandable, actionable, evidence-backed findings.

Key principles derived from the proposal:

- Raw scanner violations should be consolidated into unique systemic issues.
- Findings should support Criteria, Condition, Cause, Effect, and Recommendation.
- Resident impact is more important than scanner-defined severity.
- The product provides an assessment, not certification or a guarantee of WCAG/ADA conformance.
- The resulting work should support remediation planning, ownership, budgeting, and defensibility.

The proposal does not prescribe a specific technical architecture, LLM architecture, browser automation strategy, or AI screen-reader simulation.

---

# 2. Main Criticism of the Earlier MVP

The earlier architecture attempted to have autonomous AI agents execute resident journeys and infer whether a screen-reader user could complete those journeys.

This was considered too ambitious and methodologically unreliable for an MVP.

An automated browser agent can fail for many reasons unrelated to accessibility, including:

- browser automation limitations
- authentication
- network behavior
- bot protection
- application state
- JavaScript timing
- model reasoning errors
- missing credentials or municipal account data

Therefore:

> Agent failure must never automatically become an accessibility finding.

Likewise:

> An LLM should not be treated as NVDA or as a synthetic disabled user.

Actual assistive-technology behavior and resident-impact severity require appropriate human validation.

---

# 3. Recommended MVP Boundary

The MVP should concentrate on scaling the work of a human accessibility auditor.

Recommended pipeline:

```text
Website
→ Playwright/browser inspection
→ axe-core and deterministic checks
→ DOM/accessibility evidence
→ normalized observations
→ deduplication
→ WCAG mapping
→ draft findings
→ human/NVDA validation where necessary
```

The system should establish technical facts first.

Human judgment remains responsible for experiential claims.

---

# 4. Highest-Priority Capabilities

## Must Have

### Deterministic accessibility scanner

Use established accessibility tooling such as axe-core rather than recreating automated WCAG checks.

Capture:

- rule
- affected element
- page
- HTML
- selector
- technical evidence
- related WCAG criteria where reliably known

### Evidence persistence

Every finding must remain traceable to its source observations.

### Observation deduplication

This is a core product capability.

Repeated occurrences caused by the same underlying component or template should be grouped.

Example:

```text
236 occurrences of the same unlabeled CivicPlus control
→ one systemic draft finding
→ 236 retained occurrences
```

Do not delete occurrence-level evidence.

### WCAG mapping

Reliable deterministic rule mappings should be stored structurally.

### Human validation

Actual NVDA behavior, resident task completion, and outcome-based severity should remain human-validated in the MVP.

---

# 5. Appropriate Role for the LLM

The independent review originally recommended limiting the LLM heavily.

The resulting project decision is slightly broader:

> The LLM may act as an analyst, but not as the screen-reader user or final auditor.

Appropriate LLM tasks include:

- summarizing technical evidence
- assisting with candidate grouping
- identifying possible WCAG relationships when deterministic mapping is insufficient
- drafting neutral Condition language
- identifying findings that deserve manual validation
- helping an auditor interpret a large evidence set

The LLM must not:

- manufacture technical evidence
- declare legal compliance
- certify WCAG conformance
- claim actual NVDA behavior without validation
- determine that a human task failed merely because an AI agent failed
- assign final resident-impact severity without appropriate validation
- invent a root cause not supported by evidence

---

# 6. Accessibility Tree Guidance

Browser accessibility semantics may be useful evidence.

Examples include:

- accessible name
- role
- state
- value
- focusability
- ARIA relationships

However, the browser accessibility tree must not be described as a complete simulation of NVDA.

It is evidence exposed by the browser accessibility stack.

Use it to help identify and explain technical accessibility problems.

Do not build a proprietary "fake screen reader" representation unless a concrete implementation requirement later justifies one.

---

# 7. Resident Journeys

Resident journeys remain useful because the AccessLedger proposal bases severity on resident impact.

For the MVP, journeys should be primarily human validation tasks.

Examples:

- find a meeting agenda
- retrieve a public document
- locate meeting details
- locate department contact information
- complete a public form
- locate an ordinance

Record outcomes such as:

- completed
- completed with difficulty
- unable to complete

Link journey results to relevant findings.

Do not autonomously execute these journeys and treat the resulting agent outcome as resident evidence in the MVP.

---

# 8. Cause and Effect

Automated evidence may establish the Condition of a finding strongly.

It may not establish Cause or Effect with the same confidence.

Example:

Evidence may prove that:

> Multiple buttons have no accessible name.

It may not prove:

> The developer forgot to add an aria-label.

Cause must remain nullable until supported.

Likewise, scanner output alone should not automatically establish experiential Effect.

---

# 9. Core MVP Hypothesis

The MVP should test:

> Can AccessLedger ingest reliable accessibility evidence, consolidate repeated technical failures into systemic findings, map those findings to appropriate WCAG criteria, and provide enough structured evidence that a human auditor can validate resident impact substantially faster than reviewing raw scanner output?

This is more important than attempting comprehensive automation.

---

# 10. Scope Warning

Do not allow the MVP to become a research project involving:

- autonomous resident bots
- synthetic screen-reader simulation
- autonomous payment portals
- autonomous form completion
- generalized AI web navigation
- automated ADA certification
- complete WCAG automation

The core product advantage should first be demonstrated through:

```text
technical evidence
→ consolidation
→ structured findings
→ efficient human validation
```

Once that works reliably, more sophisticated assisted testing can be evaluated separately.