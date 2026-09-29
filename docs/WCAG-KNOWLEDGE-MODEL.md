# WCAG Knowledge Model

## Purpose

The WCAG knowledge layer gives deterministic and human review code a small, structured,
version-aware dataset. It avoids repeatedly sending standards text to an LLM and keeps normative
requirements separate from supporting interpretation.

The initial scope is WCAG 2.1 Level A and AA. Criteria are added as implementation needs them; the
repository does not copy the entire standard into prompts or context files.

## Criterion record

`WCAGCriterion` is defined in `@accessledger/shared` with:

```text
schemaVersion
id
title
level
principle
guideline
normativeSource
intentSource
automatedTestability
evidenceRequirements[]
knownRuleMappings[]
manualValidationGuidance
```

- `id` is the success-criterion number, such as `4.1.2`.
- `level` is A, AA, or AAA; the MVP dataset includes A/AA only.
- `principle` is perceivable, operable, understandable, or robust.
- `normativeSource` points to the authoritative W3C WCAG Recommendation.
- `intentSource` may point to informative W3C Understanding material.
- `automatedTestability` is `automated`, `partial`, or `manual`.
- `evidenceRequirements` states what must exist before a conclusion is supported.
- `manualValidationGuidance` identifies contextual/interaction checks without inventing a result.

The record describes evaluation knowledge, not a finding. A criterion relationship still moves
through candidate and evidence evaluation states.

## Rule mappings

Each known rule mapping records:

```text
tool
ruleId
toolVersionRange
mappingType: tool_documented | reviewed
mappingSource
verifiedAt
evidenceRequirements[]
```

Tool-documented mappings should be imported from stable tool metadata or official documentation and
pinned to a compatible version range where available. Reviewed mappings are explicitly approved by
an auditor/maintainer. Speculative LLM suggestions are not persisted as deterministic mappings;
they remain candidates attached to analysis and require review.

Each mapping requirement has a stable ID, concise description, normalized fact path, operator, and
expected JSON value. Chunk 3 supports `equals`, `greater_than`, and `non_empty`. These requirements
make the candidate decision inspectable; criterion-level prose requirements still describe the
broader evidence expectation.

A scanner rule may map to multiple criteria, and a criterion may have many rules. The mapping only
creates a candidate unless the rule result and criterion-specific evidence requirements support the
conclusion.

## Evidence evaluation

For each candidate relationship:

1. Resolve the criterion record and applicable version.
2. Collect the referenced raw result and normalized technical facts.
3. Check the source-tool version and compare normalized facts with the mapping's explicit
   `evidenceRequirements`.
4. Record `supported`, `unsupported`, or `uncertain` plus each satisfied, contradicted, or
   insufficient requirement without rewriting source evidence.
5. Queue contextual, interaction, or NVDA guidance for human validation.

This prevents `scanner warning -> WCAG finding` and `agent failure -> WCAG violation` shortcuts.

## Dataset layout and versioning

When Chunk 3 introduces data, use a reviewable layout such as:

```text
data/wcag/
  index.json
  criteria/4.1.2.json
  mappings/axe-core.json
```

`index.json` identifies the WCAG edition, dataset version, publication sources, and included
criteria. Every record validates through shared schemas. Mapping changes are code-reviewed and
tested against fixtures. Store links and concise requirements, not large copied W3C text.

The current dataset version is `2026.09.29-1`. It targets WCAG 2.1 A/AA and intentionally includes
only 4.1.2 Name, Role, Value because that is the only criterion needed by current deterministic
fixture coverage. It contains axe-core 4.13.x mappings for `button-name`, `label`,
`aria-valid-attr-value`, and `aria-prohibited-attr`, plus a reviewed mapping for a Chromium button
with an explicitly available empty computed name. The prohibited-attribute mapping is reviewed
against the W3C ACT rule as well as the tool rule: it requires complete node facts but remains
uncertain until separate evidence establishes a user-interface component, criterion-relevant
information, and that the required information is not programmatically available. This is required
because the ACT rule identifies WCAG 4.1.2 as a secondary, less-strict requirement and explicitly
notes that some rule failures satisfy the criterion. Deque's versioned rule pages and the W3C ACT
rule are mapping sources; the W3C Recommendation is normative and Understanding/ACT material is
supporting guidance.

Application schema version, WCAG standard version, dataset version, and scanner version are
separate concepts and must not be conflated.

## Initial priority

Early implementation should add only criteria required by fixture coverage, likely 1.1.1, 1.3.1,
1.4.3, 2.1.1, 2.4.2, 2.4.4, 2.4.6, 2.5.3, 3.1.1, 3.3.2, 4.1.2, and 4.1.3. This is a priority
list, not a declaration that other A/AA criteria are irrelevant or that these are fully automatable.

## Authority boundary

The W3C WCAG 2.1 Recommendation is normative. Understanding documents, techniques, failures, and
tool mappings are informative. AccessLedger provides an assessment of evidence, not a standards
certification or legal opinion.
