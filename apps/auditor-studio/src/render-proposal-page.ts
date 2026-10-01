import type { GroupProposalReviewTrace } from '@accessledger/findings';

export function renderProposalIndexPage(traces: readonly GroupProposalReviewTrace[]): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Proposal queue — Auditor Studio</title></head><body><main><h1>Pre-Finding proposal queue</h1><p><a href="/">Findings awaiting review</a></p>${
    traces.length === 0
      ? '<p>No persisted GroupProposal records.</p>'
      : `<table><caption>Every preparation-stage proposal, including pending and ineligible records</caption><thead><tr><th scope="col">Proposal</th><th scope="col">Kind</th><th scope="col">Confidence</th><th scope="col">Status</th><th scope="col">Members</th><th scope="col">Draft</th></tr></thead><tbody>${traces
          .map(
            (trace) =>
              `<tr><th scope="row"><a href="/proposals?proposalId=${encodeURIComponent(trace.proposal.id)}">${escapeHtml(trace.proposal.id)}</a></th><td>${escapeHtml(trace.proposal.kind)}</td><td>${escapeHtml(trace.proposal.groupingConfidence)}</td><td>${escapeHtml(trace.proposal.reviewStatus)}</td><td>${trace.proposal.members.length}</td><td>${trace.draftLink === null ? 'None' : `<a href="/?findingId=${encodeURIComponent(trace.draftLink.findingId)}">${escapeHtml(trace.draftLink.findingId)}</a>`}</td></tr>`,
          )
          .join('')}</tbody></table>`
  }</main></body></html>`;
}

export function renderProposalPage(trace: GroupProposalReviewTrace): string {
  const proposal = trace.proposal;
  const observationById = new Map(trace.observations.map((record) => [record.id, record]));
  const occurrenceById = new Map(trace.occurrences.map((record) => [record.id, record]));
  const pageById = new Map(trace.pages.map((record) => [record.id, record]));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(proposal.id)} — Proposal review</title></head><body><a href="#proposal-main">Skip to proposal review</a><header><h1>AccessLedger Auditor Studio</h1><p>Internal evidence review; not certification or legal advice.</p></header><main id="proposal-main"><p><a href="/proposals">Back to proposal queue</a></p>
<section aria-labelledby="proposal-heading"><h2 id="proposal-heading">${escapeHtml(proposal.id)}</h2><dl><dt>Kind</dt><dd>${escapeHtml(proposal.kind)}</dd><dt>Review status</dt><dd>${escapeHtml(proposal.reviewStatus)}</dd><dt>Grouping confidence</dt><dd>${escapeHtml(proposal.groupingConfidence)}</dd><dt>Grouping algorithm</dt><dd>${escapeHtml(proposal.groupingAlgorithmVersion)}</dd><dt>Member count</dt><dd>${proposal.members.length}</dd></dl><h3>Rationale</h3><p>${escapeHtml(proposal.rationale)}</p><details><summary>Grouping signals</summary><pre>${escapeHtml(JSON.stringify(proposal.signals, null, 2))}</pre></details>${proposal.ambiguity === null ? '' : `<h3>Ambiguity</h3><pre>${escapeHtml(JSON.stringify(proposal.ambiguity, null, 2))}</pre>`}</section>
<section aria-labelledby="members-heading"><h2 id="members-heading">Proposal membership</h2><table><caption>Immutable proposal member ledger</caption><thead><tr><th scope="col">Occurrence</th><th scope="col">Observation</th><th scope="col">Page</th><th scope="col">Locator</th><th scope="col">Evidence</th></tr></thead><tbody>${proposal.members
    .map((member) => {
      const occurrence = occurrenceById.get(member.occurrenceId);
      const page = pageById.get(member.pageId);
      return `<tr><th scope="row">${escapeHtml(member.occurrenceId)}</th><td>${escapeHtml(observationById.get(member.observationId)?.summary ?? member.observationId)}</td><td>${escapeHtml(page?.finalUrl ?? page?.requestedUrl ?? member.pageId)}</td><td>${escapeHtml(occurrence?.componentFingerprint ?? occurrence?.selector ?? occurrence?.htmlSnippet ?? 'Unavailable')}</td><td>${escapeHtml(member.evidenceIds.join(', '))}</td></tr>`;
    })
    .join('')}</tbody></table></section>
<section aria-labelledby="wcag-heading"><h2 id="wcag-heading">WCAG candidate status</h2><table><caption>Evaluations remain separate from a Finding judgment</caption><thead><tr><th scope="col">Observation</th><th scope="col">Criterion</th><th scope="col">Status</th><th scope="col">Reason</th></tr></thead><tbody>${trace.wcagEvaluations.map((evaluation) => `<tr><th scope="row">${escapeHtml(evaluation.observationId)}</th><td>${escapeHtml(evaluation.criterionId ?? 'Unknown')}</td><td>${escapeHtml(evaluation.evaluation)}</td><td>${escapeHtml(evaluation.reason)}</td></tr>`).join('')}</tbody></table></section>
<section aria-labelledby="evidence-heading"><h2 id="evidence-heading">Evidence and source metadata</h2>${trace.evidence.map((evidence) => `<details><summary>${escapeHtml(evidence.id)} — ${escapeHtml(evidence.source.name)} ${escapeHtml(evidence.source.version ?? 'version unavailable')}</summary><pre>${escapeHtml(JSON.stringify(evidence, null, 2))}</pre></details>`).join('')}</section>
${renderDecisionForm(trace)}
<section aria-labelledby="decision-history-heading"><h2 id="decision-history-heading">Append-only decision history</h2>${trace.decisions.length === 0 ? '<p>No human decision has been recorded.</p>' : `<ol>${trace.decisions.map((decision) => `<li><time datetime="${escapeHtml(decision.decidedAt)}">${escapeHtml(decision.decidedAt)}</time> — ${escapeHtml(decision.status)} by ${escapeHtml(decision.actor)}: ${escapeHtml(decision.reason)}</li>`).join('')}</ol>`}</section>
<section aria-labelledby="draft-heading"><h2 id="draft-heading">Draft linkage</h2>${trace.draftLink === null ? '<p>No draft Finding was created. Acceptance does not override drafting eligibility.</p>' : `<p><a href="/?findingId=${encodeURIComponent(trace.draftLink.findingId)}">Open draft Finding ${escapeHtml(trace.draftLink.findingId)}</a></p>`}</section>
</main></body></html>`;
}

function renderDecisionForm(trace: GroupProposalReviewTrace): string {
  if (trace.draftLink !== null) {
    return '<section aria-labelledby="decision-heading"><h2 id="decision-heading">Proposal decision</h2><p>This accepted proposal is linked to a draft Finding; the original proposal and decision history remain immutable.</p></section>';
  }
  return `<section aria-labelledby="decision-heading"><h2 id="decision-heading">Proposal decision</h2><form method="post" action="/proposals"><fieldset><legend>Record an explicit human decision</legend><input type="hidden" name="action" value="proposal-decision"><input type="hidden" name="proposalId" value="${escapeHtml(trace.proposal.id)}"><label for="proposal-actor">Reviewer</label><input id="proposal-actor" name="actor" required><label for="proposal-decision">Decision</label><select id="proposal-decision" name="decision"><option value="accepted">Accept</option><option value="rejected">Reject</option><option value="split">Split</option></select><label for="proposal-reason">Reason</label><textarea id="proposal-reason" name="reason" required></textarea><button type="submit">Record proposal decision</button></fieldset></form></section>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
