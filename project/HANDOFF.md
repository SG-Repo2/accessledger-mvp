# Handoff — Assessment Preparation Acceptance Gap

## Completed operator command

The assessment CLI now supports:

```text
npm run assessment:prepare -- <scan-json-path> <database-path>
```

It reads and validates `RawPageAssessment` JSON, refuses `navigation_failed` and `scan_failed`,
composes `DeterministicObservationNormalizer`, `EvidenceBasedWcagMapper`,
`ConservativeGroupingEngine`, `DeterministicFindingDrafter`, and
`FindingReviewService.createReview`, initializes the existing SQLite schema, and closes the
repository on every post-open path. The manifest includes resolved input/database paths and counts
for observations, occurrences, WCAG states, groups, ineligible groups, drafts, persisted bundles,
ignored evidence, and unknown rules.

Stable IDs and the scan completion time are supplied through existing public dependency-injection
options. Preparing an already-present deterministic Finding ID is refused before bundle insertion.
No public domain contract, WCAG dataset, domain policy, SQLite schema, or migration changed.

## Manual workflow

Save pure scan JSON by suppressing npm's banner, then prepare and open it:

```text
npm run --silent scan -- https://www.naperville.il.us/ --target ".site-search-button" --target "#label_1" --target ".slick-prev" > naperville-scan.json
npm run assessment:prepare -- ./naperville-scan.json ./naperville.sqlite
npm run auditor:studio -- ./naperville.sqlite
```

After a human completes review and approval, export remains unchanged:

```text
npm run findings:export -- ./naperville.sqlite <assessment-id> json ./output/naperville-findings.json
```

The currently uncommitted `naperville-scan.json` in the working tree begins with npm command-banner
text and is therefore intentionally rejected as malformed JSON. It is user-owned and was not
modified by this work. A read-only diagnostic of its JSON portion found 0 observations, 0
occurrences, 0 groups, 0 drafts, 5 ignored normalization inputs, and 2 unrecognized scanner rules.
Thus, even after regenerating pure JSON, that particular scan currently produces an empty review
database because its findings are outside the deliberately narrow normalization coverage.

## Blocking workflow gap

Current production normalization sets every `ObservationOccurrence.componentFingerprint` to null.
The grouping engine therefore emits pending low/medium-confidence singleton, ambiguous, or
structural-repeat proposals from raw scans. The Finding drafter correctly accepts pending proposals
only for high-confidence fingerprint repeats; otherwise it requires a human-accepted group. The
review repository/studio begins at a draft Finding, so no public persisted queue currently lets a
human accept a GroupProposal before drafting.

The CLI does not bypass this boundary. Ordinary current raw scans can initialize a valid database
but will persist zero review bundles. Tests prove a non-zero path by supplying a valid
fingerprint-bearing normalization result through the existing public interface, and prove the full
trace is then retained with no severity, confidence, Validation, or unsupported-WCAG inference.

The next decision must choose one explicitly reviewed fix: add evidence-supported component
fingerprints in normalization, or introduce a pre-Finding GroupProposal review/persistence boundary.
Auto-accepting groups in the CLI is not an acceptable fix. A persistence solution requires a new
migration; a normalization solution changes domain logic and needs fixture-backed design review.

## Verification

All required root checks pass:

```text
npm run typecheck
npm test                 # 18 files / 104 tests
npm run lint
npm run format:check
```

Node 22 may print its upstream `node:sqlite` experimental warning. The full browser suite may need
permission to bind its deterministic loopback fixture server.
