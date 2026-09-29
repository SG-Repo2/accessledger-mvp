# Handoff — Pre-Finding Group Review Is the Acceptance Blocker

## Verified Naperville preparation state

The saved `naperville-scan.json` still contains an npm banner before its valid JSON object. The
payload itself was parsed without modification and run through the same
`createAssessmentPreparationStages` / `prepareAssessmentForReview` composition used by
`npm run assessment:prepare`.

Before this normalization work, the payload produced:

```text
observations: 0
occurrences: 0
ignored normalization inputs: 5
unrecognized rules: 2
grouping proposals: 0
draft Findings: 0
persisted review bundles: 0
```

After this work, it produces:

```text
observations: 1
occurrences: 8
ignored normalization inputs: 4
unrecognized rules: 1
WCAG evaluations: 1 uncertain / 0 supported / 0 unsupported
grouping proposals: 5
ineligible grouping proposals: 5
draft Findings: 0
persisted review bundles: 0
```

The five proposals are all pending: two medium-confidence `repeat_candidate` records containing
three and two occurrences, and three low-confidence `singleton` records. No proposal is currently
eligible for `DeterministicFindingDrafter.draft`.

## Added normalization and mapping

`aria-prohibited-attr` is now a narrowly supported axe-core technical observation. Normalization
requires every node to retain:

- a concrete target and parseable HTML;
- a matching non-empty ARIA attribute in that HTML;
- matching `aria-prohibited-attr` check data with element name, computed role (including explicit
  null), and prohibited attributes; and
- axe engine name/version matching the Evidence source provenance.

The Naperville rule has eight `<time tabindex="0" aria-label="…">` nodes. Each carries
`nodeName: "time"`, `role: null`, `prohibited: ["aria-label"]`, an exact selector, HTML, and the
complete raw violation/node detail. One Observation and all eight occurrences retain the Page,
Evidence, selector, HTML, source detail, tool version, and rule version chain.

WCAG dataset `2026.09.29-1` adds a reviewed 4.1.2 candidate mapping. It does not treat axe impact,
tags, prose, or the rule result as a final criterion conclusion. A supported evaluation additionally
requires separate facts that the target is a WCAG user-interface component, the prohibited
attribute carries criterion-relevant information, and that required information is not
programmatically available. Those facts are absent from the Naperville payload, so its candidate is
correctly `uncertain`.

## Inputs that remain ignored or unsupported

- Playwright `raw_browser_result` is operational load evidence, not a normalization source.
- `.site-search-button` is a collected Chromium button named `Search`; it is a negative/non-
  violation example for the empty-button-name normalizer.
- `#label_1` is a collected Chromium tab named `City Events`; it is outside the intentionally
  narrow browser-semantics normalizer and contains no supported deterministic failure.
- `.slick-prev` is a collected Chromium button named `Previous`; it is another negative/non-
  violation empty-name input.
- axe-core `region` remains unrecognized. The one node retains a target and link snippet, but not
  the DOM ancestry/landmark context needed to reproduce the assertion. Deque documents it as a best
  practice rather than a WCAG rule, and landmark usefulness is contextual. No mapping was added.

## Next decision

The immediate normalization blocker is resolved narrowly enough to expose real Naperville
proposals. Component fingerprints remain null, but the two structural repeats already have
inspectable medium-confidence membership. The next blocker is the missing pre-Finding
GroupProposal review/persistence workflow: a human has no durable boundary at which to accept those
proposals before drafting, while persistence currently begins with a Finding.

Do not auto-accept groups or infer fingerprints. The next design should introduce the smallest
reviewable pre-Finding grouping boundary, with a migration only if durable proposal decisions are
actually required. Preserve the existing drafting, severity, validation, approval, and WCAG gates.

## Contracts and verification

Public domain contract remains `1.0.0`; persistence remains schema version `2`; no SQLite migration
was added. No new architecture or normalization policy was introduced beyond ADR-009's existing
reviewed dataset-extension process, so `project/DECISIONS.md` was not changed.

See `project/CURRENT-STATE.md` and the latest `project/WORK-LOG.md` entry for final command results.
