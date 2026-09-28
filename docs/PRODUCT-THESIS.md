# Product Thesis

## What AccessLedger sells

AccessLedger sells an accessibility risk-management assessment and a practical remediation
process for municipalities. It converts technical website and document evidence into a concise set
of findings that staff can own, budget, fix, and track. The deliverable structure borrows from the
financial-audit process municipal boards already understand: findings, a management response, and
an adopted corrective plan.

AccessLedger renders an assessment, never a certification, guarantee, or legal conclusion. No
automated or manual sample can establish conformance across an entire changing website. Product
language and data models must preserve that distinction.

## Why a scanner is insufficient

A scanner may produce thousands of rule occurrences. The count is often dominated by one defect
in a shared template or component and does not tell a board why the problem exists, what a resident
experiences, who should act, or what remediation costs. Scanner output is valuable source evidence,
but it is not the product.

AccessLedger must consolidate repeated occurrences into unique systemic issues while retaining
their full scope. “One issue across 236 occurrences” is more actionable than “236 violations,” and
the occurrence records still show every affected location.

## Findings and severity

An approved finding uses five parts:

1. **Criteria** — the applicable accessibility requirement.
2. **Condition** — the evidence-supported state observed.
3. **Cause** — the supported reason the condition exists.
4. **Effect** — the validated impact on residents or operations.
5. **Recommendation** — the action that addresses the condition and cause.

The system may reliably draft Condition from technical evidence. Cause, experiential Effect, and
Recommendation remain nullable until supported. A field must never be invented to make a record
look complete.

Severity describes validated resident impact, not a scanner vendor's impact label. A Blocker means
a resident cannot complete the task; Serious means completion requires significant difficulty or
outside assistance. Those claims need human validation, including NVDA where relevant.

## Findings Register

The Findings Register is the structured source behind downstream deliverables and ongoing status
tracking. Stable finding identifiers, WCAG mappings, affected scope, evidence references,
validation state, ownership, and later remediation data must remain synchronized. Documents should
derive facts from this source rather than retyping numbers.

## MVP implications

The MVP is successful if it reduces auditor effort without reducing reliability or traceability. It
therefore prioritizes:

- deterministic collection before assisted interpretation;
- raw evidence preserved separately from normalized observations;
- inspectable, versioned scanner-to-WCAG mappings;
- consolidation that never discards occurrences;
- neutral draft findings linked to their evidence;
- explicit uncertainty and a human validation queue; and
- structured export of approved findings.

Autonomous resident simulation, synthetic NVDA, certification, and comprehensive WCAG automation
would undermine this hypothesis and are not part of the initial MVP.
