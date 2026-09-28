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

## Result record

`JourneyResult` captures the journey and assessment IDs, performer, start/completion time, NVDA
observations when applicable, outcome, notes, evidence, and related findings. Allowed outcomes are:

- `completed`
- `completed_with_difficulty`
- `unable_to_complete`
- `not_attempted`
- `inconclusive`

The first three express actual human task results. `not_attempted` preserves planned work, and
`inconclusive` covers interrupted tests or evidence that cannot isolate accessibility from another
failure. Do not force ambiguous behavior into “unable.”

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

NVDA-specific execution is Windows-only, but journey definitions/results are platform-neutral JSON
records. A missing NVDA environment must not block browser/scanner work elsewhere.

## Example template

```text
Journey ID: journey-meeting-agenda
Goal: Retrieve the current meeting agenda
Starting URL: assessment target homepage
Preconditions: Human auditor; specified browser; NVDA/version on Windows
Human task: Locate and open the current council meeting agenda
Expected observable outcome: The correct agenda is identifiable and opens in a usable form
Related findings: added after evidence review
NVDA result: recorded after execution
Outcome: completed | completed with difficulty | unable | inconclusive
Notes: observable behavior and evidence references
```

Examples guide test design but do not predetermine the outcome or create a finding without evidence.
