# Testing Methodology

## Standard of evidence

AccessLedger records what the available evidence supports and preserves uncertainty where it does
not. The evaluation path is:

```text
Observation -> Evidence -> Candidate WCAG criterion -> Evidence requirements
            -> supported / unsupported / uncertain -> Finding or no finding
```

A scanner warning is a source result, not automatically a WCAG failure. Agent failure is not
accessibility evidence unless the failure can be tied to observable website behavior and supported
by an accessibility requirement. LLM confidence never substitutes for missing evidence.

## Testing categories

### Automatically testable

These checks can often establish strong technical facts with deterministic tools:

- missing or empty accessible names on controls;
- empty links and buttons;
- missing programmatic form labels;
- invalid ARIA roles, attributes, values, or references;
- missing page language declarations;
- deterministic label-in-name mismatches; and
- contrast failures when foreground/background colors and thresholds are reliably computable.

An automatic result must include the page URL, tool/rule and version, affected node details, and
enough source or computed data to reproduce the result. Tool-documented WCAG mappings may create
candidate mappings. They do not justify unrelated experiential claims.

### Context-dependent

Software can collect facts and flag candidates, but a reviewer must interpret context for:

- whether link purpose is meaningful in its permitted context;
- whether alternative text conveys the image's purpose;
- whether headings and labels usefully describe content;
- whether instructions are understandable and sufficient;
- whether landmarks, navigation, or bypass mechanisms are useful; and
- whether non-text contrast applies to the relevant visual information.

These observations remain `uncertain` until evidence requirements are evaluated. Assisted analysis
may summarize or prioritize them but must expose its source evidence and cannot silently promote a
candidate to supported.

### Human / NVDA validation

Actual interaction and resident-impact claims require a human, with NVDA where relevant:

- keyboard traps and meaningful focus order;
- visible focus and focus restoration;
- dialogs and complex custom widgets;
- dynamic state/status announcements;
- form error identification and recovery;
- real screen-reader task completion;
- completion with difficulty or need for outside assistance; and
- Blocker or Serious resident-impact severity.

Browser accessibility semantics are useful evidence but are not an NVDA simulation. Validation
records identify the human, method, platform/assistive technology where applicable, time, outcome,
notes, and supporting evidence.

Browser-semantics fixtures may assert what the pinned Chromium accessibility API exposes: computed
role/name/description/value, focusability, states, and relationships. Tests and records must label
that source and version, preserve unavailable fields and target errors, and explicitly distinguish
the result from assistive-technology output. They must not turn a missing node, automation error, or
browser tree value into a claim about NVDA speech or resident experience.

## Conclusion vocabulary

At the observation/WCAG evaluation layer:

- `candidate` means a possible relationship has not been evaluated.
- `supported` means required evidence supports the technical conclusion.
- `unsupported` means evaluated evidence does not support it.
- `uncertain` means available evidence is insufficient or context-dependent.

Validation uses `supported`, `unsupported`, or `inconclusive`. A failure to load, automate, or
authenticate is operational evidence only unless separately tied to an accessibility requirement.

## Severity and confidence

Scanner impact labels may be retained inside raw evidence but do not set finding severity. Severity
is based on validated resident impact:

- **Blocker:** the resident cannot complete the relevant task.
- **Serious:** completion requires significant difficulty or outside assistance.
- **Moderate/Minor:** lesser validated impacts, defined operationally before production use.

Severity and confidence are nullable. The auditor assigns them after appropriate evidence and
validation; automation must not populate them merely for completeness.

## Fixture-driven verification

Core acceptance tests use small local HTML fixtures with one intentional behavior per fixture,
including good forms, unlabeled inputs, empty buttons, ambiguous links, broken ARIA, heading
structure, repeated components, and dialog focus. Tests must be deterministic, self-contained, and
portable across macOS and Windows.

Each detector needs positive, negative, and preservation tests. Normalization tests must prove raw
evidence references survive. Grouping tests must prove repeated occurrences are retained. Mapping
tests must pin tool/rule versions and expected candidates. Export tests must prove stable IDs and
traceability fields survive round trips.

Live municipal websites are exploratory/validation targets only after fixture acceptance tests pass.
They must not be the primary CI dependency because content, timing, consent screens, and network
behavior change independently of the code.

Chunk 3 normalization tests exercise the controlled axe and browser-semantics fixture path plus
fully local source payloads. They prove positive and negative behavior, exact node/selector/source
detail retention, Page/Evidence traceability, unknown-rule retention, insufficient evidence,
unsupported candidates, JSON round trips, source-version scope, and dataset version. The WCAG
mapper tests compare explicit facts only; scanner impact labels are never converted into severity.

Chunk 4 grouping tests use deterministic labeled records rather than live pages. They cover a
236-occurrence repeated component, similar-but-distinct fingerprints, same-template cross-page
repeats, unstable selectors with stable fingerprints, ambiguous cross-page matches without a
template, ordinary singletons, mixed-outcome zero-loss accounting, exact Page/Evidence traceability,
deterministic reruns, schema version rejection, JSON round trips, and rejected/split review-state
preservation. The fixture cases currently retain 236/236 members and classify every labeled merge,
non-merge, and review case as expected; that small controlled result is acceptance evidence, not a
claim of production precision or recall.

## Product-level MVP measure

The MVP is evaluated by whether an auditor can reach reliable, reviewable findings in less manual
time than reviewing raw scanner output—not by maximizing violation count. Useful measures include
time-to-review, grouping precision/recall on labeled fixtures, percentage of claims with complete
traceability, reviewer corrections, and number of findings that remain uncertain pending validation.
