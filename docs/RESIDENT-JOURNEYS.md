# Resident Journeys

## Purpose and boundary

Resident journeys connect technical findings to real civic tasks. In the MVP they are protocols and
records for a human auditor, often using NVDA on Windows. They are not autonomous AI agents,
synthetic screen readers, or proof generated from browser-agent success/failure.

The journey engine must be generic. Examples such as finding an agenda, public PDF, meeting date,
department contact, form, or ordinance are stored journey data, not hard-coded branches.

## Journey definition

The `ResidentJourney` contract captures:

| Requested concept           | Contract field              |
| --------------------------- | --------------------------- |
| Journey ID                  | `id`                        |
| Goal                        | `goal`                      |
| Starting URL                | `startingUrl`               |
| Preconditions               | `preconditions[]`           |
| Human task                  | `humanTask`                 |
| Expected observable outcome | `expectedObservableOutcome` |
| Related findings            | `relatedFindingIds[]`       |

It also carries assessment scope, schema version, and record timestamps. Preconditions should name
relevant browser, authentication/test data, input method, and assistive technology without storing
credentials.

Protocols are created, loaded/listed, edited, and safely deleted through `ResidentJourneyService`.
Editing writes a new immutable revision and audit event while optimistically replacing the current
projection. Deletion is a soft delete allowed only before any result exists; it removes the protocol
from active reads while retaining its row, revisions, and audit history. Related Finding IDs must
identify review bundles in the same assessment. An edit cannot remove a Finding link already
retained by an append-only JourneyResult, and a result-bearing protocol cannot be deleted.

## Result record

`JourneyResult` captures the journey and assessment IDs, required human performer, environment,
start/end time, optional human NVDA observations, outcome, notes, immutable supporting Evidence, and
related Findings. Environment records the platform, browser name/version, and nullable assistive-
technology name/version. Allowed outcomes are:

- `completed`
- `completed_with_difficulty`
- `unable_to_complete`
- `not_attempted`
- `inconclusive`

The first three express actual human task results. `not_attempted` preserves planned work, and
`inconclusive` covers interrupted tests or evidence that cannot isolate accessibility from another
failure. Do not force ambiguous behavior into “unable.”

`not_attempted` has no end time. The other four states represent an attempt and require an end time
at or after the start, including an interrupted `inconclusive` attempt. NVDA observations are
optional and may be stored only with an explicit NVDA-on-Windows environment. Every result has at
least one immutable, same-assessment human Evidence record. Result Finding links must be a subset of
the protocol links.

## Execution protocol

1. Confirm the starting URL and preconditions.
2. Record the human auditor, environment, assistive-technology version, and start time.
3. Perform the task without using implementation knowledge unavailable to a resident.
4. Capture observable behavior and relevant evidence; distinguish site behavior from network,
   authentication, test-data, and tool failures.
5. Select the outcome and record concise notes.
6. Link supported findings and add a separate `Validation` record when the result validates a
   technical or experiential claim.
7. Assign resident-impact severity only after the evidence supports it.

`ResidentJourneyService.recordResult` accepts only an explicitly selected outcome; it has no
browser/scanner/agent failure input or execution callback. Recording a result does not create a
Validation or alter a Finding. `addResultValidation` is a second explicit human action: it targets a
persisted JourneyResult, requires a linked in-review Finding, and references a non-empty subset of
the result's Evidence. A supported severity claim must name one exact severity, after which the
existing `FindingReviewService.assignSeverity` gate may be used.

Persistence schema version 2 stores current protocols, append-only revisions/results/result links,
immutable Evidence, and append-only journey audit events. Protocol create/edit, result recording,
and result-backed Validation each use one `BEGIN IMMEDIATE` transaction.

NVDA-specific execution is Windows-only, but journey definitions/results are platform-neutral JSON
records. A missing NVDA environment must not block browser/scanner work elsewhere.

External Windows/NVDA procedure: prepare the agreed Windows browser and NVDA version; record both
in the result environment; run the human task without implementation knowledge unavailable to a
resident; write only observed announcements/behavior in `nvdaResult`; attach human Evidence; stop
and choose `inconclusive` if network, authentication, test data, or tooling prevents isolating site
behavior. AccessLedger does not start, drive, or capture NVDA remotely.

## Example template

```text
Journey ID: journey-meeting-agenda
Goal: Retrieve the current meeting agenda
Starting URL: assessment target homepage
Preconditions: Human auditor; specified browser; NVDA/version on Windows
Human task: Locate and open the current council meeting agenda
Expected observable outcome: The correct agenda is identifiable and opens in a usable form
Related findings: added after evidence review
Environment: Windows version; browser/version; NVDA/version when used
NVDA result: optional human observation recorded after execution
Outcome: completed | completed with difficulty | unable | not attempted | inconclusive
Notes: observable behavior and evidence references
```

Examples guide test design but do not predetermine the outcome or create a finding without evidence.

Chunk 8 export should consume approved Findings plus optional linked JourneyResult summaries and
their Validation/Evidence IDs in deterministic order. It must preserve all five outcome values and
must not translate a result outcome into severity, violation, conformance, certification, or a legal
conclusion.
