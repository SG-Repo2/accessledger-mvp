import type { FindingReviewTrace } from '@accessledger/findings';

export function renderReviewPage(trace: FindingReviewTrace, message: string | null = null): string {
  const { finding, group } = trace;
  const representative = trace.occurrences[0];
  const observationById = new Map(trace.observations.map((record) => [record.id, record]));
  const pageById = new Map(trace.pages.map((record) => [record.id, record]));
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(finding.title)} — Auditor Studio</title></head>
<body>
<a href="#review-main">Skip to finding review</a>
<header><h1>AccessLedger Auditor Studio</h1><p>Internal evidence review; not certification or legal advice.</p></header>
<main id="review-main">
${message === null ? '' : `<p role="alert">${escapeHtml(message)}</p>`}
<section aria-labelledby="finding-heading">
<h2 id="finding-heading">${escapeHtml(finding.title)}</h2>
<dl><dt>Status</dt><dd>${escapeHtml(finding.status)}</dd><dt>Grouping decision</dt><dd>${escapeHtml(group.reviewStatus)}</dd><dt>Validation status</dt><dd>${escapeHtml(finding.validationStatus)}</dd><dt>Occurrence count</dt><dd>${finding.occurrenceCount}</dd></dl>
<h3>Grouping rationale</h3><p>${escapeHtml(group.rationale)}</p><details><summary>Grouping signals</summary><ul>${group.signals.map((signal) => `<li>${escapeHtml(signal.type)} (${escapeHtml(signal.strength)}): ${escapeHtml(signal.value)}</li>`).join('')}</ul></details>
<h3>Validation need</h3><p>${escapeHtml(finding.validationNeed)}</p>
<h3>Missing judgment fields</h3>${renderList(trace.missingJudgmentFields)}
<h3>Approval blockers</h3>${renderList(trace.approvalBlockers)}
</section>
<section aria-labelledby="representative-heading"><h2 id="representative-heading">Representative occurrence</h2>
${representative === undefined ? '<p>No occurrence is available.</p>' : renderOccurrence(representative, observationById.get(representative.observationId)?.summary ?? '', pageById.get(representative.pageId)?.finalUrl ?? pageById.get(representative.pageId)?.requestedUrl ?? '')}
</section>
<section aria-labelledby="occurrences-heading"><h2 id="occurrences-heading">All occurrences</h2>
<table><caption>Every retained member of the source grouping proposal</caption><thead><tr><th scope="col">Occurrence</th><th scope="col">Observation</th><th scope="col">Page</th><th scope="col">Selector or fingerprint</th></tr></thead><tbody>
${trace.occurrences.map((occurrence) => `<tr><th scope="row">${escapeHtml(occurrence.id)}</th><td>${escapeHtml(observationById.get(occurrence.observationId)?.summary ?? occurrence.observationId)}</td><td>${escapeHtml(pageById.get(occurrence.pageId)?.finalUrl ?? pageById.get(occurrence.pageId)?.requestedUrl ?? occurrence.pageId)}</td><td>${escapeHtml(occurrence.componentFingerprint ?? occurrence.selector ?? 'Locator unavailable')}</td></tr>`).join('')}
</tbody></table></section>
<section aria-labelledby="evidence-heading"><h2 id="evidence-heading">Raw and human evidence</h2>${trace.evidence.map((evidence) => `<details><summary>${escapeHtml(evidence.id)} — ${escapeHtml(evidence.kind)} — ${escapeHtml(evidence.source.name)}</summary><pre>${escapeHtml(JSON.stringify(evidence, null, 2))}</pre></details>`).join('')}</section>
<section aria-labelledby="wcag-heading"><h2 id="wcag-heading">WCAG support and candidates</h2><table><caption>Candidate evaluations remain separate from finding judgment</caption><thead><tr><th scope="col">Observation</th><th scope="col">Criterion</th><th scope="col">Evaluation</th><th scope="col">Reason</th></tr></thead><tbody>${trace.wcagEvaluations.map((evaluation) => `<tr><th scope="row">${escapeHtml(evaluation.observationId)}</th><td>${escapeHtml(evaluation.criterionId ?? 'Unknown')}</td><td>${escapeHtml(evaluation.evaluation)}</td><td>${escapeHtml(evaluation.reason)}</td></tr>`).join('')}</tbody></table></section>
<section aria-labelledby="validations-heading"><h2 id="validations-heading">Human validations</h2>${trace.validations.length === 0 ? '<p>No human Validation records yet.</p>' : `<table><caption>Append-only human review outcomes</caption><thead><tr><th scope="col">Validation</th><th scope="col">Method</th><th scope="col">Outcome</th><th scope="col">Claims</th><th scope="col">Validated severity</th><th scope="col">Performed by</th></tr></thead><tbody>${trace.validations.map((validation) => `<tr><th scope="row">${escapeHtml(validation.id)}</th><td>${escapeHtml(validation.method)}</td><td>${escapeHtml(validation.outcome)}</td><td>${escapeHtml(validation.claims.join(', '))}</td><td>${escapeHtml(validation.validatedSeverity ?? 'None')}</td><td>${escapeHtml(validation.performedBy)}</td></tr>`).join('')}</tbody></table>`}</section>
${renderActions(trace)}
<section aria-labelledby="history-heading"><h2 id="history-heading">Audit history</h2><ol>${trace.auditHistory.map((event) => `<li><time datetime="${escapeHtml(event.occurredAt)}">${escapeHtml(event.occurredAt)}</time> — ${escapeHtml(event.action)} by ${escapeHtml(event.actor)}${event.reason === null ? '' : `: ${escapeHtml(event.reason)}`}</li>`).join('')}</ol></section>
</main></body></html>`;
}

function renderActions(trace: FindingReviewTrace): string {
  const finding = trace.finding;
  if (finding.status === 'draft') {
    return `<section aria-labelledby="actions-heading"><h2 id="actions-heading">Review actions</h2><form method="post"><input type="hidden" name="findingId" value="${escapeHtml(finding.id)}"><input type="hidden" name="action" value="start-review"><label for="start-actor">Reviewer</label><input id="start-actor" name="actor" required><button type="submit">Start review</button></form></section>`;
  }
  if (finding.status !== 'in_review') return '';
  const criteria = finding.wcagCriteria.join(', ');
  return `<section aria-labelledby="actions-heading"><h2 id="actions-heading">Review actions</h2>
<form method="post"><fieldset><legend>Grouping decision</legend>${hidden(finding.id, 'group-decision')}<label for="group-actor">Reviewer</label><input id="group-actor" name="actor" required><label for="group-decision">Decision</label><select id="group-decision" name="decision"><option value="accepted">Accept</option><option value="rejected">Reject</option><option value="split">Split</option></select><label for="group-reason">Reason</label><textarea id="group-reason" name="reason" required></textarea><button type="submit">Record grouping decision</button></fieldset></form>
<form method="post"><fieldset><legend>Edit finding fields</legend>${hidden(finding.id, 'edit-finding')}<label for="edit-actor">Reviewer</label><input id="edit-actor" name="actor" required><label for="finding-title">Title</label><input id="finding-title" name="title" value="${escapeHtml(finding.title)}" required><label for="condition">Condition</label><textarea id="condition" name="condition" required>${escapeHtml(finding.condition)}</textarea><label for="cause">Cause</label><textarea id="cause" name="cause">${escapeHtml(finding.cause ?? '')}</textarea><label for="effect">Effect</label><textarea id="effect" name="effect">${escapeHtml(finding.effect ?? '')}</textarea><label for="recommendation">Recommendation</label><textarea id="recommendation" name="recommendation">${escapeHtml(finding.recommendation ?? '')}</textarea><label for="confidence">Finding confidence</label><select id="confidence" name="confidence"><option value="">Unassigned</option>${options(['low', 'medium', 'high'], finding.confidence)}</select><label for="wcag-criteria">WCAG criteria (comma separated source candidates only)</label><input id="wcag-criteria" name="wcagCriteria" value="${escapeHtml(criteria)}"><button type="submit">Save finding edits</button></fieldset></form>
<form method="post"><fieldset><legend>Add human validation</legend>${hidden(finding.id, 'add-validation')}<label for="validation-actor">Performed by</label><input id="validation-actor" name="actor" required><label for="validation-method">Method</label><select id="validation-method" name="method">${options(['manual_review', 'keyboard', 'visual', 'contextual', 'nvda'], null)}</select><label for="validation-outcome">Outcome</label><select id="validation-outcome" name="outcome">${options(['supported', 'unsupported', 'inconclusive'], null)}</select><label for="validation-claims">Claims (comma separated)</label><input id="validation-claims" name="claims" aria-describedby="claims-help" required><p id="claims-help">Allowed: grouping, condition, wcag, cause, effect, recommendation, severity.</p><label for="validated-severity">Exact supported severity (required for a supported severity claim)</label><select id="validated-severity" name="validatedSeverity"><option value="">None</option>${options(['blocker', 'serious', 'moderate', 'minor'], null)}</select><label for="validation-notes">Observed human evidence</label><textarea id="validation-notes" name="notes" required></textarea><label for="at-name">Assistive technology</label><input id="at-name" name="assistiveTechnologyName"><label for="at-version">Assistive technology version</label><input id="at-version" name="assistiveTechnologyVersion"><label for="platform">Platform</label><input id="platform" name="platform"><button type="submit">Add validation record</button></fieldset></form>
<form method="post"><fieldset><legend>Assign evidence-supported severity</legend>${hidden(finding.id, 'assign-severity')}<label for="severity-actor">Reviewer</label><input id="severity-actor" name="actor" required><label for="severity">Severity</label><select id="severity" name="severity">${options(['blocker', 'serious', 'moderate', 'minor'], finding.severity)}</select><button type="submit">Assign severity</button></fieldset></form>
<form method="post">${hidden(finding.id, 'approve')}<label for="approve-actor">Reviewer</label><input id="approve-actor" name="actor" required><button type="submit">Approve finding</button></form>
<form method="post">${hidden(finding.id, 'reject')}<label for="reject-actor">Reviewer</label><input id="reject-actor" name="actor" required><label for="reject-reason">Rejection reason</label><textarea id="reject-reason" name="reason" required></textarea><button type="submit">Reject finding</button></form>
</section>`;
}

function renderOccurrence(
  occurrence: FindingReviewTrace['occurrences'][number],
  summary: string,
  url: string,
): string {
  return `<article><h3>${escapeHtml(occurrence.id)}</h3><p>${escapeHtml(summary)}</p><dl><dt>Page</dt><dd>${escapeHtml(url)}</dd><dt>Selector</dt><dd>${escapeHtml(occurrence.selector ?? 'Unavailable')}</dd><dt>Component fingerprint</dt><dd>${escapeHtml(occurrence.componentFingerprint ?? 'Unavailable')}</dd></dl><details><summary>Occurrence source detail</summary><pre>${escapeHtml(JSON.stringify(occurrence.sourceDetail, null, 2))}</pre></details></article>`;
}

function hidden(findingId: string, action: string): string {
  return `<input type="hidden" name="findingId" value="${escapeHtml(findingId)}"><input type="hidden" name="action" value="${escapeHtml(action)}">`;
}

function options(values: readonly string[], selected: string | null): string {
  return values
    .map(
      (value) =>
        `<option value="${escapeHtml(value)}"${value === selected ? ' selected' : ''}>${escapeHtml(value)}</option>`,
    )
    .join('');
}

function renderList(values: readonly string[]): string {
  return values.length === 0
    ? '<p>None.</p>'
    : `<ul>${values.map((value) => `<li>${escapeHtml(value)}</li>`).join('')}</ul>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
