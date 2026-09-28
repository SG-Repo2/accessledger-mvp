# WCAG 2.1 Reference

## Purpose

This file provides AccessLedger agents with guidance for working with WCAG 2.1.

It is NOT a copy of the WCAG standard and is NOT an independent accessibility standard.

The official W3C Web Content Accessibility Guidelines 2.1 remain authoritative.

Official normative standard:

https://www.w3.org/TR/WCAG21/

Official W3C Quick Reference:

https://www.w3.org/WAI/WCAG21/quickref/

Official Understanding WCAG material:

https://www.w3.org/WAI/WCAG21/Understanding/

---

# 1. How AccessLedger Should Use WCAG

WCAG success criteria provide the standards against which collected accessibility evidence may be evaluated.

The AccessLedger flow is:

```text
Observation
→ Evidence
→ Candidate WCAG Criterion
→ Evidence Requirements
→ Supported / Unsupported / Uncertain
→ Finding
```

Do not use:

```text
Scanner warning
→ automatic WCAG finding
```

or:

```text
Agent failure
→ automatic WCAG violation
```

---

# 2. Scope

The initial AccessLedger target is WCAG 2.1 Level A and Level AA.

AAA criteria are outside the initial MVP unless explicitly required for research or context.

The WCAG knowledge layer should eventually store criteria as structured data rather than requiring an LLM to repeatedly consume the entire standard.

Suggested structure:

```text
WCAGCriterion {
  id
  title
  level
  principle
  guideline
  normativeSource
  intentSource
  automatedTestability
  evidenceRequirements
  knownRuleMappings
  manualValidationGuidance
}
```

---

# 3. Normative vs Supporting Material

Distinguish between:

## Normative

The WCAG 2.1 Recommendation itself.

Success criteria determine the actual requirements.

## Informative

Supporting W3C material such as:

- Understanding documents
- techniques
- sufficient techniques
- advisory techniques
- common failures
- examples

Supporting material helps interpret and test WCAG but does not create additional conformance requirements.

---

# 4. MVP-Priority Criteria

The following criteria are particularly relevant to the first AccessLedger implementation.

This is a priority list, not the complete WCAG 2.1 A/AA standard.

## 1.1.1 Non-text Content

Level: A

Relevant to:

- images
- icons
- image links
- graphical controls
- text alternatives

Common automated evidence:

- missing alt attributes
- inaccessible image controls

Context may still be required to determine whether alternative text is appropriate.

---

## 1.3.1 Info and Relationships

Level: A

Relevant to:

- headings
- form labels
- tables
- lists
- semantic structure
- programmatic relationships

Often partially automatable.

Some failures require contextual/manual evaluation.

---

## 1.4.3 Contrast (Minimum)

Level: AA

Relevant to text contrast.

Many instances can be evaluated deterministically where foreground and background colors can be reliably computed.

---

## 1.4.11 Non-text Contrast

Level: AA

Relevant to:

- controls
- component boundaries
- graphical objects
- visual states

May require more contextual evaluation than normal text contrast.

---

## 2.1.1 Keyboard

Level: A

Relevant to whether functionality can be operated using a keyboard interface.

Static inspection may identify suspicious controls, but actual behavior frequently requires interaction testing.

---

## 2.1.2 No Keyboard Trap

Level: A

Relevant to whether keyboard focus can enter and leave components.

Requires interaction testing.

---

## 2.4.1 Bypass Blocks

Level: A

Relevant to mechanisms for bypassing repeated content.

May involve landmarks, skip links, headings, or other mechanisms.

Requires context.

---

## 2.4.2 Page Titled

Level: A

Relevant to meaningful page titles.

Presence can be checked automatically.

Whether the title adequately describes the page may require context.

---

## 2.4.3 Focus Order

Level: A

Relevant to whether keyboard focus follows a meaningful sequence.

Requires interaction/contextual evaluation.

---

## 2.4.4 Link Purpose (In Context)

Level: A

Relevant to whether users can determine the purpose of links from their text and permitted context.

Machines can identify suspicious cases such as:

- empty links
- repeated "click here"
- repeated "more"
- image links without names

Final interpretation may require context.

---

## 2.4.6 Headings and Labels

Level: AA

Relevant to whether headings and labels describe topic or purpose.

Structure can be collected automatically.

Meaningfulness requires contextual evaluation.

---

## 2.4.7 Focus Visible

Level: AA

Relevant to visible keyboard focus.

Requires browser interaction and visual/style inspection.

---

## 2.5.3 Label in Name

Level: A

Relevant when a control has a visible text label.

The accessible name should contain the visible label as required by the criterion.

Often suitable for automated or semi-automated testing.

---

## 3.1.1 Language of Page

Level: A

Relevant to the default human language of a page.

Missing programmatic language declarations can often be detected automatically.

---

## 3.3.1 Error Identification

Level: A

Relevant to forms and input errors.

Usually requires interaction testing.

---

## 3.3.2 Labels or Instructions

Level: A

Relevant to forms requiring user input.

Many missing label relationships are automatically detectable.

Whether instructions are sufficient may require context.

---

## 3.3.3 Error Suggestion

Level: AA

Relevant to whether users receive useful correction suggestions when input errors are detected and suggestions are possible.

Generally requires form interaction and contextual evaluation.

---

## 4.1.2 Name, Role, Value

Level: A

High priority for screen-reader-oriented testing.

Relevant to user-interface components and whether important information is programmatically available to assistive technology.

Useful evidence includes:

- accessible name
- role
- value
- state
- ARIA relationships
- accessibility-tree exposure

Many issues can be identified deterministically.

Complex widgets may require actual assistive-technology validation.

---

## 4.1.3 Status Messages

Level: AA

Relevant to status information that should be programmatically available to assistive technologies without requiring focus.

Examples may include:

- success messages
- loading states
- search results counts
- form status
- asynchronous updates

Frequently requires dynamic interaction testing and may warrant NVDA validation.

---

# 5. Testability Categories

AccessLedger should classify checks approximately as follows.

## Deterministic / Automated

Examples:

- empty accessible name
- empty button
- empty link
- missing form label
- invalid ARIA
- broken ARIA references
- missing page language
- some contrast failures
- certain label-in-name failures

These can produce strong technical evidence.

They should still retain the exact source evidence.

---

## Contextual

Examples:

- whether link text is meaningful
- whether alternative text is appropriate
- whether headings adequately describe sections
- whether labels and instructions are understandable
- whether navigation structure is useful

The system may collect facts automatically and use assisted analysis, but should preserve uncertainty.

---

## Interaction / Human Validation

Examples:

- keyboard traps
- logical focus movement
- complex custom widgets
- dynamic announcements
- dialogs
- form error recovery
- actual screen-reader task completion
- resident-impact severity

These should enter a validation workflow rather than being asserted automatically.

---

# 6. Scanner Mapping

Where established tools such as axe-core provide documented mappings between a rule and WCAG success criteria, store those mappings structurally.

Example conceptual record:

```json
{
  "scanner": "axe-core",
  "ruleId": "button-name",
  "candidateCriteria": ["4.1.2"],
  "mappingType": "tool-documented"
}
```

Do not ask an LLM to recreate deterministic mappings repeatedly.

Mappings should be inspectable and versioned.

---

# 7. Evidence Requirements

Every WCAG-related finding should be traceable to technical evidence.

Evidence may include:

- URL
- HTML
- selector
- DOM context
- accessibility-tree information
- computed accessible name
- role
- state
- keyboard interaction trace
- screenshot
- scanner rule output
- human/NVDA validation notes

The amount and type of evidence required will vary by criterion.

---

# 8. Important Boundary

A WCAG criterion describes an accessibility requirement.

It does not mean every observed technical anomaly is automatically a failure of that criterion.

AccessLedger must preserve the distinction between:

```text
Candidate
Supported
Unsupported
Uncertain
```

Human review should remain available whenever the collected evidence does not support a reliable conclusion.

---

# 9. Future Structured Dataset

During implementation, convert the WCAG information actually needed by the application into structured files such as:

```text
data/wcag/
├── index.json
└── criteria/
    ├── 1.1.1.json
    ├── 1.3.1.json
    ├── 1.4.3.json
    ├── 2.1.1.json
    ├── 2.4.4.json
    ├── 2.4.6.json
    ├── 2.5.3.json
    ├── 3.1.1.json
    ├── 3.3.2.json
    ├── 4.1.2.json
    └── 4.1.3.json
```

Add criteria as implementation requires them.

Do not preload large amounts of unused standards text into agent prompts.

---

# 10. Guiding Rule

Use WCAG as a structured evaluation standard.

Use deterministic software for facts that software can establish reliably.

Use assisted reasoning where context matters.

Use human and assistive-technology validation where actual user experience must be established.

Never allow confidence in an LLM answer to substitute for missing accessibility evidence.