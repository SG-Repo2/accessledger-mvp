# AccessLedger

## The Deliverable Package

*Why it exists, how it is built, and the elevator pitch*

### The elevator pitch

> “Every Illinois municipality’s website is a legal exposure the board can’t see. Most accessibility audits hand back a spreadsheet of scanner noise nobody can act on. AccessLedger doesn’t sell a scan — we sell a risk management process, built on the same audit structure your board already trusts for its finances. We turn thousands of raw violations into a short list of unique, prioritized fixes with owners and costs attached, so residents can actually use the site, and your board has the documented, adopted plan that regulators and courts look for.”

### The problem this solves

Every Illinois local government must meet WCAG 2.1 Level AA for its website and online documents under the 2024 ADA Title II rule, on a fixed compliance date. Almost none of them know where they stand, and the tools that could tell them produce the wrong kind of answer for a board: a scanner report lists thousands of "violations," most of them the same handful of template problems repeated on every page. It has no plan, no cost, no owner, and it invites exactly the wrong response — either panic or a shrug.

AccessLedger exists to close that gap: turn a technical scan into a governance document a board can act on, in the same way an annual financial audit turns a general ledger into something a board can act on.

### The core idea: borrow the financial audit, not the scanner report

A board, a manager and a finance director already know how to receive bad news about risk: they get it every year, in a financial audit. That structure — a short auditor's letter, a management letter of findings, a corrective action plan the board adopts — is familiar, credible, and already trusted. Rather than invent a new format for accessibility, the package reuses that one.

| Financial audit piece they already trust | AccessLedger equivalent |
| --- | --- |
| Auditor's report (short, for the board) | Board Brief — 2 pages |
| Management letter of findings | Assessment Report |
| Findings in a standard format (criteria, condition, cause, effect) | Same five-part format, drawn from government auditing standards |
| Management's corrective action plan | Remediation Roadmap the board formally adopts |
| Schedule of prior-year findings | Quarterly status report under the monitoring retainer |

One deliberate difference: a financial auditor renders an opinion. AccessLedger renders an assessment, never a certification. No automated or manual test proves conformance across an entire website, and the word "certified" creates liability for both AccessLedger and the client. The package is built to make that distinction impossible to blur — the phrase never appears, in any document, under any circumstance.

### Design decisions, and why we made them

#### Unique issues, not raw violation counts

A crawl of a typical municipal site returns four or five thousand individual "violations." Nearly all of them trace back to a dozen or so problems built into the site template or one document producer — one broken link pattern, one missing form label, repeated 236 times. Reporting the raw count is technically accurate and practically useless: it terrifies a board without telling them what to do. The package always reports unique issues, with the page or document count attached separately, so a reader sees both the true scope of the problem and how small the actual fix list is.

#### Severity means what a resident experiences, not what a scanner flags

Automated tools rate severity by rule type. The package rates it by outcome: can a resident using a screen reader complete the task or not. A Blocker means they cannot. A Serious issue means they can, but only with significant effort or outside help. That framing is what lets the report open with a sentence a trustee understands immediately — "two of five things residents try to do on this site cannot be done with a screen reader" — instead of a WCAG criterion number.

#### Five-part findings, not a bug list

Every finding that drives the plan is written as Criteria, Condition, Cause, Effect, Recommendation — the same structure government auditors use for compliance findings. It forces every finding to answer the question a manager actually asks: not just what's wrong, but why it happened, who it affects, and who has to fix it. A one-line bug report can't do that; a five-part finding always does.

#### The board brief and the roadmap are separate documents from the report

A full assessment report is 15 to 25 pages, written for a manager and an attorney who need the whole picture. A board doesn't read that at a meeting — it reads two pages and votes. Splitting the board brief and the remediation roadmap out as their own short documents means the clerk has a clean document for the board packet, and the board is asked to do exactly three things: adopt a plan, adopt a policy, approve a budget line. Everything else stays in the longer report, available to whoever needs the detail.

#### A workbook behind every document, not a static report

Every number in every document traces to one findings register and a small number of data tabs, kept in a single Excel workbook per engagement. The Word documents don't hold numbers — they hold placeholders that cite a workbook cell. That means the numbers are never re-typed and never drift out of sync across five documents, and the same workbook becomes the tracking tool for the quarterly monitoring retainer after the report ships.

### What the package actually contains

| Component | Reader | Job it does |
| --- | --- | --- |
| Board Brief | Board, manager | Get a decision in two pages |
| Assessment Report | Manager, attorney, staff | Document the full assessment, defensibly |
| Findings Register (Excel) | Staff, vendors | The working list everyone fixes from |
| Document Accessibility Inventory | Clerk | What to do differently, PDF by PDF |
| Remediation Roadmap and Quote | Manager, board | A plan the board can adopt and price |
| Compliance Kit | Manager, clerk, attorney | The paperwork a documented effort requires |

Full detail on every component — exact contents, exhibits, and the exact workbook cells behind each number — lives in the companion design blueprint. This document exists to explain the *why*; that one exists to specify the *what*.

### What this buys the client

Two things, and only two things, really: defensibility and a plan they can budget. A plaintiff's attorney or a Department of Justice investigator asks the same two questions after a complaint: did the entity know, and did it do anything. A documented, dated assessment plus an adopted, funded remediation plan is what answers "yes" to both. Every design choice in the package points at making that "yes" as easy as possible to demonstrate — and nothing else. It is not a certification, not a guarantee, and not a substitute for the entity's own attorney.
