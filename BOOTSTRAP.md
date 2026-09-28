# AccessLedger MVP Bootstrap

You are acting as a principal software engineer and accessibility systems architect.

This repository is a NEW AccessLedger MVP codebase.

The basic development environment and repository skeleton have already been created manually.

Do not recreate the repository, change package managers, replace the existing root configuration, or perform unrelated environment setup unless a documented technical problem requires it.

This project uses:

- Node.js LTS
- npm
- npm workspaces
- TypeScript
- Zod
- Vitest
- ESLint
- Prettier
- Git

The immediate task is to complete **Chunk 0 only**.

Do not begin accessibility scanning or browser automation yet.

---

# 1. SOURCE MATERIAL

The `/reference` directory contains source material used to establish product and methodology.

Read these files during Chunk 0:

## Primary Product Source

`reference/AccessLedger-Deliverable-Package-Explainer.md`

This is the primary product source of truth.

Use it to establish:

- what AccessLedger is
- what AccessLedger sells
- why scanner output alone is insufficient
- why findings must represent systemic issues
- how resident impact relates to severity
- why AccessLedger provides assessments rather than certifications
- the five-part finding structure
- the importance of evidence and the Findings Register

## Independent MVP Review

`reference/MVP-Independent-Review.md`

This contains methodology criticism from earlier planning.

Treat this as advisory.

It does not override the primary product source.

Its purpose is to prevent the MVP from becoming:

- an AI screen-reader simulator
- an autonomous resident bot
- a generalized browser-agent research project

## WCAG Reference

`reference/wcag/wcag-2.1-reference.md`

Use this to design the structured WCAG knowledge layer.

Do not copy the entire WCAG standard into project context files.

Do not repeatedly inject full standards text into LLM prompts.

---

# 2. PROJECT MEMORY PRINCIPLE

This repository must become self-documenting.

No future coding agent should require:

- this conversation
- this bootstrap prompt
- previous agent chat history
- proprietary agent memory

After Chunk 0, future agents should normally rely on:

1. `AGENTS.md`
2. `project/CURRENT-STATE.md`
3. `project/HANDOFF.md`
4. `docs/ARCHITECTURE.md`
5. documentation for their assigned implementation chunk
6. relevant architecture decisions

The `/reference` directory should normally only be consulted when original product or methodology source material is required.

---

# 3. CORE PRODUCT OBJECTIVE

AccessLedger should transform noisy technical accessibility data into a small number of accurate, evidence-backed, actionable findings.

The intended MVP pipeline is:

```text
Target URL
↓
Browser render
↓
Deterministic accessibility scan
↓
DOM + accessibility evidence
↓
Normalized observations
↓
Deduplication / grouping
↓
WCAG mapping
↓
Draft findings
↓
Human / NVDA validation where required
```

The system is not primarily a scanner.

The value comes from transforming large quantities of raw accessibility output into meaningful systemic findings.

---

# 4. CORE TECHNICAL HYPOTHESIS

The MVP should eventually prove:

> Can AccessLedger ingest reliable accessibility evidence from municipal websites, consolidate repeated technical failures into systemic findings, map those findings to appropriate WCAG criteria, and provide enough structured evidence that a human auditor can efficiently validate resident impact?

The primary measure of success is not:

> How many accessibility violations can the system detect?

The primary measure is:

> How much can AccessLedger reduce an auditor's manual workload without reducing the reliability or traceability of the findings?

---

# 5. TWO PERSPECTIVES

Design the system around two perspectives.

## Perspective A: Resident Using Assistive Technology

The ultimate outcome concerns a resident who relies on a screen reader and keyboard.

Relevant questions include:

- Can I determine what page I am on?
- Can I understand the page structure?
- Can I navigate using headings and landmarks?
- Can I identify links and buttons?
- Do controls have meaningful accessible names?
- Can I understand forms?
- Can I navigate using a keyboard?
- Can I determine where focus is?
- Can I discover and retrieve important documents?
- Can I accomplish the civic task I came here to perform?

The MVP does NOT autonomously answer all of these questions.

It should collect evidence that helps a human accessibility auditor answer them efficiently.

## Perspective B: Accessibility Auditor / Developer

The MVP is primarily a tool for this user.

The auditor/developer may inspect:

- rendered DOM
- browser accessibility semantics
- accessible names
- roles
- values
- states
- ARIA
- keyboard behavior
- focus behavior
- axe-core results
- page structure
- document links
- scanner evidence
- WCAG mappings
- repeated component patterns
- human/NVDA validation

---

# 6. METHODOLOGICAL BOUNDARY

Do not build an AI screen reader.

Do not describe an LLM as NVDA.

Do not treat an automated browser agent as a disabled resident.

Never use:

```text
Agent failed task
→ accessibility violation
```

Use:

```text
Observation
→ Evidence
→ Candidate WCAG criterion
→ Evidence evaluation
→ Supported / Unsupported / Uncertain
→ Finding
```

An automated browser or agent may fail because of:

- browser automation limitations
- network conditions
- authentication
- bot protection
- JavaScript timing
- missing credentials
- application state
- website functionality unrelated to accessibility
- actual accessibility barriers

These causes must not be conflated.

---

# 7. DETERMINISTIC VS ASSISTED VS HUMAN

## Deterministic

Use established tools and programmatic logic whenever a technical fact can be established reliably.

Examples:

- missing accessible names
- empty buttons
- empty links
- missing form labels
- invalid ARIA
- broken ARIA references
- missing page language
- deterministic contrast failures
- documented scanner-to-WCAG mappings

## LLM-Assisted Reasoning

An LLM may assist with:

- summarizing technical evidence
- suggesting likely grouping relationships
- identifying candidate WCAG relationships where deterministic mappings are insufficient
- drafting neutral Condition language
- identifying findings that deserve manual validation
- helping an auditor understand a large evidence set

The LLM is an analyst.

It is not:

- the screen-reader user
- the auditor of record
- a legal authority
- a source of technical evidence

## Human / NVDA Validation

Human judgment remains required for claims involving actual resident experience.

Examples:

- the resident cannot complete the task
- the resident needs outside assistance
- an interaction creates significant difficulty
- NVDA fails to announce an important state
- a finding is a Blocker
- a finding is Serious

---

# 8. MVP BOUNDARY

The MVP should eventually support:

1. Loading target pages.
2. Running deterministic accessibility checks.
3. Capturing DOM evidence.
4. Capturing browser accessibility semantics where practical.
5. Normalizing scanner output into observations.
6. Mapping observations to candidate WCAG criteria.
7. Grouping repeated observations into systemic findings.
8. Creating draft finding records.
9. Marking findings for human/NVDA validation.
10. Persisting evidence and decisions.
11. Exporting approved findings into a Findings Register-compatible format.

---

# 9. OUT OF SCOPE

Do not build during the initial MVP unless explicitly introduced through an architecture decision:

- billing
- subscriptions
- public customer accounts
- multi-tenancy
- public dashboards
- client portals
- recurring monitoring
- autonomous resident agents
- autonomous payment agents
- autonomous form-submission agents
- synthetic NVDA simulation
- automatic ADA certification
- blanket WCAG conformance decisions
- automated legal conclusions
- full PDF remediation
- full Board Brief generation
- full Assessment Report generation
- production monitoring infrastructure

Do not broaden scope without documenting the proposal in `project/DECISIONS.md`.

---

# 10. TECHNICAL STACK

Preserve the existing repository setup unless there is a compelling documented reason to change it.

Use:

- TypeScript
- Node.js LTS
- npm
- npm workspaces
- Zod
- Vitest
- ESLint
- Prettier

Future implementation is expected to use:

- Playwright
- axe-core
- SQLite or another justified lightweight local persistence layer

Do not install Playwright or axe-core during Chunk 0 unless strictly necessary for establishing type contracts.

Prefer mature, boring dependencies.

Do not introduce a large framework without an immediate MVP requirement.

---

# 11. CROSS-PLATFORM REQUIREMENT

The AccessLedger core must run on:

- macOS
- Windows

The primary development machine may be macOS.

Actual NVDA validation will occur on Windows.

Do not introduce operating-system-specific assumptions into core application logic.

Requirements:

- use Node.js filesystem APIs
- use `path.join()` and `path.resolve()`
- do not hard-code `/` or `\` path separators
- avoid Bash-only npm scripts
- avoid macOS-only shell utilities in required project workflows
- avoid Windows-only utilities in core assessment logic
- resolve storage paths programmatically
- tests must not depend on Unix-specific paths
- core browser/scanner logic must be portable

NVDA-specific functionality is explicitly allowed to be Windows-specific.

The architecture should conceptually separate:

```text
Cross-platform core
    ↓
Browser / Scanner / Evidence / WCAG / Findings
    ↓
Validation interface
    ↓
Windows-specific NVDA validation
```

Do not make the entire application Windows-dependent merely because NVDA is used for validation.

---

# 12. EXISTING REPOSITORY FOUNDATION

The repository skeleton already exists approximately as:

```text
/
├── apps/
│   ├── assessment-cli/
│   └── auditor-studio/
│
├── packages/
│   ├── browser/
│   ├── scanner/
│   ├── accessibility/
│   ├── observations/
│   ├── grouping/
│   ├── wcag/
│   ├── findings/
│   ├── journeys/
│   ├── evidence/
│   ├── persistence/
│   ├── llm/
│   └── shared/
│
├── data/
│   ├── wcag/
│   └── fixtures/
│
├── docs/
├── project/
├── reference/
├── tests/
├── package.json
├── package-lock.json
├── tsconfig.json
├── tsconfig.base.json
└── AGENTS.md      # create during Chunk 0 if absent
```

The repository uses npm workspaces configured through the root `package.json`.

Do NOT create or use:

```text
pnpm-workspace.yaml
```

Do not change package managers.

---

# 13. AGENT-AGNOSTIC PROJECT MEMORY

Create the following project memory system.

## `AGENTS.md`

This is the entry point for every future coding agent.

Keep it concise.

It must explain:

1. What AccessLedger is.
2. The current MVP objective.
3. What is out of scope.
4. Required reading order.
5. Repository architecture.
6. Engineering conventions.
7. Testing requirements.
8. Rules for modifying public schemas/interfaces.
9. Required project files to update before finishing.
10. Core methodology boundaries.

Future agents must read, in order:

1. `AGENTS.md`
2. `project/CURRENT-STATE.md`
3. `project/HANDOFF.md`
4. `docs/ARCHITECTURE.md`
5. documentation for the assigned chunk
6. relevant entries in `project/DECISIONS.md`

Agents should not normally reread `/reference`.

---

# 14. PROJECT STATE FILES

Create:

## `project/CURRENT-STATE.md`

Keep concise, preferably below 500 words.

Include:

- current completed chunk
- working functionality
- known broken functionality
- tests currently passing
- current schema version
- next recommended chunk
- current blockers

This file describes reality, not goals.

---

## `project/DECISIONS.md`

Use lightweight architecture decision records.

Each decision should contain:

```text
Decision ID
Date
Status
Context
Decision
Reason
Alternatives considered
Consequences
```

Important architectural knowledge must not exist only in agent conversation history.

---

## `project/WORK-LOG.md`

Append one concise entry after every meaningful implementation session.

Include:

```text
Date
Agent
Chunk
Files changed
What was implemented
Tests executed
Result
Known issues
Next logical action
```

Do not write essays.

---

## `project/BACKLOG.md`

Track:

```text
ID
Description
Priority
Status
Dependency
Target chunk
```

Separate:

- MVP requirements
- bugs
- deferred work
- future ideas

---

## `project/HANDOFF.md`

This must answer:

> If a completely new coding agent opened this repository right now, what would it need to know to continue safely?

Include:

- last completed work
- what should happen next
- important interfaces
- known traps
- commands to run
- test commands
- relevant files

Keep it concise.

Update or overwrite it as project state changes.

---

# 15. REQUIRED DOCUMENTATION

Create these files during Chunk 0.

## `docs/PRODUCT-THESIS.md`

Distill the product proposal into a concise development reference.

Include:

- what AccessLedger sells
- why scanner output alone is insufficient
- why systemic findings matter
- assessment vs certification
- resident-impact severity
- five-part finding structure
- role of the Findings Register
- implications for MVP development

Keep this significantly shorter than the source proposal.

---

## `docs/ARCHITECTURE.md`

Define:

- system purpose
- boundaries
- package responsibilities
- data flow
- evidence flow
- deterministic responsibilities
- LLM responsibilities
- human validation boundary
- persistence strategy
- interfaces between packages
- future extension points
- cross-platform boundaries

Primary pipeline:

```text
Target URL
↓
Browser
↓
Scanner
↓
Evidence
↓
Observations
↓
Grouping
↓
WCAG Mapping
↓
Draft Findings
↓
Human Validation
```

Every Finding must trace backward:

```text
Finding
↓
Grouped Observation
↓
Observation Occurrences
↓
Evidence
↓
Page
↓
Raw Browser / Scanner Result
```

If this trace cannot be followed, the architecture is incorrect.

---

## `docs/TESTING-METHODOLOGY.md`

Define exactly what AccessLedger can and cannot conclude.

Separate:

### Automatically Testable

Examples:

- missing accessible names
- empty buttons
- empty links
- missing form labels
- invalid ARIA
- broken ARIA relationships
- missing document language
- deterministic contrast failures

### Context-Dependent

Examples:

- meaningful link purpose
- quality of alternative text
- useful headings
- understandable instructions
- navigation clarity

### Human / NVDA Validation

Examples:

- dynamic announcements
- focus management
- complex widgets
- dialogs
- difficult forms
- actual screen-reader task completion
- resident-impact severity

Explicitly document:

> Agent failure is not accessibility evidence unless the failure can be tied to observable website behavior and supported by an accessibility requirement.

---

## `docs/DATA-MODEL.md`

Define schemas for at least:

- Assessment
- Page
- Evidence
- Observation
- ObservationOccurrence
- WCAGCriterion
- Finding
- Validation
- ResidentJourney
- JourneyResult

Keep raw evidence separate from interpretation.

A Finding should eventually support:

```text
id
title
status
wcagCriteria[]
condition
cause
effect
recommendation
severity
confidence
validationStatus
affectedUrls[]
affectedComponents[]
affectedJourneys[]
occurrenceCount
evidenceIds[]
createdAt
updatedAt
```

Cause, Effect, Recommendation, Severity, and Confidence may initially be nullable.

Never fabricate values merely to populate fields.

---

## `docs/WCAG-KNOWLEDGE-MODEL.md`

Define the structured WCAG representation.

At minimum:

```text
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
```

Documented scanner mappings should be deterministic and versioned where possible.

Do not design a system that repeatedly sends the entire WCAG standard to an LLM.

---

## `docs/RESIDENT-JOURNEYS.md`

For the MVP, resident journeys are human validation records.

They are not autonomous AI agents.

Define:

```text
Journey ID
Goal
Starting URL
Preconditions
Human task
Expected observable outcome
Related findings
NVDA result
Outcome
Notes
```

Allowed outcome concepts should include:

- completed
- completed with difficulty
- unable to complete

Examples may include:

- find a meeting agenda
- retrieve a public PDF
- locate meeting date/time
- find department contact information
- complete a public form
- locate an ordinance

Do not hard-code the engine around these examples.

---

## `docs/MVP-IMPLEMENTATION-PLAN.md`

Break development into independently executable chunks.

Every chunk must specify:

- objective
- dependencies
- packages/files allowed to change
- expected inputs
- expected outputs
- public interfaces/contracts
- implementation tasks
- tests
- acceptance criteria
- explicit non-goals
- handoff requirements

A new coding agent must be able to implement one chunk without undocumented knowledge from previous agent sessions.

---

# 16. SHARED DOMAIN CONTRACTS

During Chunk 0, create a real npm workspace package at:

```text
packages/shared
```

Use TypeScript and Zod where appropriate.

Create initial domain contracts for:

- Assessment
- Page
- Evidence
- Observation
- ObservationOccurrence
- WCAGCriterion
- Finding
- Validation
- ResidentJourney
- JourneyResult

Do not over-model implementation details.

Focus on stable boundaries between future packages.

Prefer schemas that can:

- validate runtime data
- infer TypeScript types
- serialize cleanly
- evolve through explicit versioning

Uncertain schema decisions should be documented in `project/DECISIONS.md`.

---

# 17. IMPLEMENTATION CHUNKS

Document the following chunk structure in `docs/MVP-IMPLEMENTATION-PLAN.md`.

## Chunk 0: Foundation

Current task.

Deliver:

- project context system
- documentation
- architecture
- testing methodology
- domain schemas
- shared package
- implementation boundaries
- agent workflow
- test conventions
- future chunk contracts

No accessibility implementation yet.

---

## Chunk 1: Browser + Scanner

Input:

```text
URL
```

Expected conceptual output:

```text
RawPageAssessment
```

Eventually implement:

- Playwright page loading
- page metadata
- axe-core execution
- rule results
- affected nodes
- HTML snippets
- selectors
- URLs
- raw evidence persistence

Use controlled fixtures for acceptance tests.

---

## Chunk 2: Accessibility Evidence

Collect additional browser accessibility semantics where technically feasible.

Examples:

- accessible role
- accessible name
- description
- value
- states
- focusability
- accessibility relationships

Do not build a fake screen reader.

This is evidence collection.

---

## Chunk 3: Observation Normalization + WCAG Mapping

Convert raw scanner/browser evidence into normalized Observation records.

Conceptually:

```text
Raw result
→ Observation
→ Candidate WCAG mapping
→ Evidence references
```

Maintain strict separation between:

- raw result
- evidence
- observation
- WCAG mapping
- finding

---

## Chunk 4: Deduplication / Grouping

This is a core product capability.

Use signals such as:

- scanner rule
- DOM structure
- selectors
- element attributes
- component ancestry
- URL/template relationships
- accessible role/name patterns

Target behavior:

```text
236 repeated instances
→ one systemic grouped issue
→ 236 retained occurrences
```

Occurrence-level evidence must never be destroyed.

---

## Chunk 5: Draft Findings

Transform grouped observations into Draft Finding records.

Prefer deterministic templates first.

Optional LLM assistance may draft neutral Condition text.

LLM input must include evidence.

LLM output must not replace evidence.

Do not automatically invent:

- Cause
- experiential Effect
- experiential severity

---

## Chunk 6: Auditor Review + Validation

Create the smallest useful internal review workflow.

Allow an auditor to:

- inspect findings
- inspect representative evidence
- inspect occurrences
- approve/reject grouping
- edit finding language
- add Cause
- add Effect
- add Recommendation
- mark NVDA validation required
- record validation outcome
- assign severity
- approve finding

This may be a minimal internal web UI.

Do not build a polished customer dashboard.

---

## Chunk 7: Resident Journey Recording

Implement manual resident journey records.

The auditor should be able to record:

```text
Journey
Goal
URL
NVDA result
Completed / difficult / failed
Notes
Related findings
```

Do not automate resident journeys in the initial MVP.

---

## Chunk 8: Findings Register Export

Export approved findings in structured formats.

Required:

- JSON
- CSV

Optional if straightforward:

- XLSX

Preserve:

- stable identifiers
- evidence references
- WCAG mappings
- occurrence counts
- validation state

Do not build the full Board Brief or Assessment Report yet.

---

# 18. CHUNK INDEPENDENCE

Every implementation chunk must be independently implementable.

Packages communicate through documented public interfaces.

Do not depend on undocumented internals from another package.

Each completed implementation package should contain:

- public interface
- tests
- deterministic fixtures where applicable
- acceptance criteria
- concise package documentation

If a public contract changes, update:

- `docs/DATA-MODEL.md`
- `docs/ARCHITECTURE.md`
- affected tests
- `project/DECISIONS.md`

before considering the work complete.

---

# 19. FIXTURE-DRIVEN DEVELOPMENT

Future accessibility implementation should prioritize local deterministic fixtures.

Expected fixture categories include:

```text
good-form.html
unlabeled-input.html
empty-button.html
ambiguous-links.html
broken-aria.html
heading-structure.html
repeated-component.html
dialog-focus.html
```

Tests should not depend primarily on unpredictable live municipal websites.

Use real municipal sites for validation after deterministic fixture behavior is established.

---

# 20. EVIDENCE FIRST

Every final finding must remain traceable:

```text
Finding
↓
Grouped Observation
↓
Observation Occurrences
↓
Evidence
↓
Page / URL
↓
Raw Browser / Scanner Result
```

LLM-generated prose must never become the source of truth.

Technical evidence remains authoritative.

---

# 21. FUTURE AGENT WORKFLOW

Every future coding agent must follow this process.

## Before Coding

Read:

1. `AGENTS.md`
2. `project/CURRENT-STATE.md`
3. `project/HANDOFF.md`
4. `docs/ARCHITECTURE.md`
5. documentation for the assigned chunk
6. relevant entries in `project/DECISIONS.md`

Then inspect only code relevant to the assigned task.

## During Coding

- preserve established interfaces
- write tests alongside implementation
- avoid unrelated refactors
- avoid unnecessary dependencies
- preserve evidence traceability
- keep technical facts separate from interpretation
- do not expand MVP scope

## Before Finishing

Run:

```bash
npm run typecheck
npm test
npm run lint
npm run format:check
```

Run additional chunk-specific tests where applicable.

Then update:

- `project/CURRENT-STATE.md`
- `project/WORK-LOG.md`
- `project/HANDOFF.md`
- `project/BACKLOG.md` if required
- `project/DECISIONS.md` if architecture changed

Critical project knowledge must not remain only in the final agent response.

---

# 22. CHUNK 0 TASK

Implement Chunk 0 only.

Do not:

- install Playwright
- install axe-core
- perform website scans
- build accessibility-tree extraction
- implement WCAG evaluation logic
- build deduplication algorithms
- build the auditor UI
- implement resident automation
- implement NVDA integration

Chunk 0 is about establishing the architecture and contracts that make these future chunks independently implementable.

---

# 23. CHUNK 0 REQUIRED OUTPUTS

Create or complete:

```text
AGENTS.md

docs/
  PRODUCT-THESIS.md
  ARCHITECTURE.md
  TESTING-METHODOLOGY.md
  DATA-MODEL.md
  WCAG-KNOWLEDGE-MODEL.md
  RESIDENT-JOURNEYS.md
  MVP-IMPLEMENTATION-PLAN.md

project/
  CURRENT-STATE.md
  DECISIONS.md
  WORK-LOG.md
  BACKLOG.md
  HANDOFF.md

packages/shared/
  package.json
  tsconfig.json
  src/
  tests/
```

You may improve the exact internal layout of `packages/shared`.

Do not change the high-level architecture without documenting why.

---

# 24. CHUNK 0 ACCEPTANCE CRITERIA

Before stopping, verify:

1. `AGENTS.md` exists and is concise.
2. `docs/PRODUCT-THESIS.md` exists.
3. All required architecture/methodology documents exist.
4. All project memory files exist.
5. `packages/shared` is a valid npm workspace package.
6. Core domain contracts compile.
7. Runtime Zod schemas exist where appropriate.
8. Shared-contract tests pass.
9. Root type checking passes.
10. Root tests pass.
11. ESLint passes.
12. Prettier check passes.
13. No pnpm-specific configuration has been introduced.
14. The project remains compatible with macOS and Windows.
15. `CURRENT-STATE.md` accurately records that Chunk 0 is complete.
16. `HANDOFF.md` clearly explains how a fresh agent should begin Chunk 1.

Required validation commands:

```bash
npm run typecheck
npm test
npm run lint
npm run format:check
```

---

# 25. FIRST RESPONSE

Before modifying files:

1. Restate the MVP boundary in no more than 10 bullets.
2. Identify any material assumptions or conflicts found in the existing repository.
3. Confirm that npm workspaces and the existing environment will be preserved.
4. State the expected Chunk 0 outputs.

Then implement Chunk 0.

Do not ask for confirmation unless a genuinely blocking ambiguity prevents implementation.

---

# 26. FINAL RESPONSE

After implementation:

Report only:

1. What was created or changed.
2. Public contracts established.
3. Tests and validation commands executed.
4. Architectural decisions recorded.
5. Remaining known issues or questions.
6. Exact recommended prompt for the next Chunk 1 agent.

Do not begin Chunk 1.

The repository must be usable by a completely different coding agent with no access to this bootstrap prompt or prior conversation.
