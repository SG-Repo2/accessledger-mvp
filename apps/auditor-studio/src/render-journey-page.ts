import type { ResidentJourneyTrace } from '@accessledger/journeys';
import type { ResidentJourney } from '@accessledger/shared';

export function renderJourneyIndexPage(journeys: readonly ResidentJourney[]): string {
  return document(
    'Resident journeys',
    `<a href="#journey-main">Skip to resident journeys</a><header><h1>Resident journey protocols</h1><p>Human-authored protocols and manual results only; browser or agent failure never selects an outcome.</p></header><main id="journey-main"><p><a href="/">Return to findings</a></p><section aria-labelledby="protocols-heading"><h2 id="protocols-heading">Protocols</h2>${journeys.length === 0 ? '<p>No journey protocols have been created.</p>' : `<ul>${journeys.map((journey) => `<li><a href="/journeys?journeyId=${encodeURIComponent(journey.id)}">${escapeHtml(journey.goal)}</a> (${escapeHtml(journey.id)})</li>`).join('')}</ul>`}</section>${createForm()}</main>`,
  );
}

export function renderJourneyPage(trace: ResidentJourneyTrace): string {
  const journey = trace.journey;
  return document(
    `${journey.goal} — Resident journeys`,
    `<a href="#journey-main">Skip to journey protocol</a><header><h1>Resident journey protocol</h1><p>Record only what a named human observed.</p></header><main id="journey-main"><p><a href="/journeys">All journey protocols</a> · <a href="/">Findings</a></p><section aria-labelledby="journey-heading"><h2 id="journey-heading">${escapeHtml(journey.goal)}</h2><dl><dt>Journey ID</dt><dd>${escapeHtml(journey.id)}</dd><dt>Assessment</dt><dd>${escapeHtml(journey.assessmentId)}</dd><dt>Starting URL</dt><dd><a href="${escapeHtml(journey.startingUrl)}">${escapeHtml(journey.startingUrl)}</a></dd><dt>Human task</dt><dd>${escapeHtml(journey.humanTask)}</dd><dt>Expected observable outcome</dt><dd>${escapeHtml(journey.expectedObservableOutcome)}</dd><dt>Related Findings</dt><dd>${escapeHtml(journey.relatedFindingIds.join(', ') || 'None')}</dd></dl><h3>Preconditions</h3>${list(journey.preconditions)}</section>${editForm(journey)}${resultForm(journey)}${results(trace)}<section aria-labelledby="journey-history-heading"><h2 id="journey-history-heading">Journey audit history</h2><ol>${trace.auditHistory.map((event) => `<li><time datetime="${escapeHtml(event.occurredAt)}">${escapeHtml(event.occurredAt)}</time> — ${escapeHtml(event.action)} by ${escapeHtml(event.actor)}${event.reason === null ? '' : `: ${escapeHtml(event.reason)}`}</li>`).join('')}</ol></section></main>`,
  );
}

function createForm(): string {
  return `<section aria-labelledby="create-journey-heading"><h2 id="create-journey-heading">Create a generic protocol</h2><form method="post" action="/journeys"><fieldset><legend>Human-authored journey definition</legend><input type="hidden" name="action" value="create-journey"><label for="create-actor">Author</label><input id="create-actor" name="actor" required><label for="create-assessment">Assessment ID</label><input id="create-assessment" name="assessmentId" required><label for="create-goal">Goal</label><input id="create-goal" name="goal" required><label for="create-url">Starting URL</label><input id="create-url" name="startingUrl" type="url" required><label for="create-preconditions">Preconditions (one per line)</label><textarea id="create-preconditions" name="preconditions"></textarea><label for="create-task">Human task</label><textarea id="create-task" name="humanTask" required></textarea><label for="create-expected">Expected observable outcome</label><textarea id="create-expected" name="expectedObservableOutcome" required></textarea><label for="create-findings">Related Finding IDs (comma separated)</label><input id="create-findings" name="relatedFindingIds"><label for="create-reason">Authoring reason</label><textarea id="create-reason" name="reason"></textarea><button type="submit">Create journey protocol</button></fieldset></form></section>`;
}

function editForm(journey: ResidentJourney): string {
  return `<section aria-labelledby="edit-journey-heading"><h2 id="edit-journey-heading">Edit protocol</h2><form method="post" action="/journeys"><fieldset><legend>Protocol fields</legend>${journeyHidden(journey.id, 'edit-journey')}<label for="edit-journey-actor">Editor</label><input id="edit-journey-actor" name="actor" required><label for="edit-journey-goal">Goal</label><input id="edit-journey-goal" name="goal" value="${escapeHtml(journey.goal)}" required><label for="edit-journey-url">Starting URL</label><input id="edit-journey-url" name="startingUrl" type="url" value="${escapeHtml(journey.startingUrl)}" required><label for="edit-journey-preconditions">Preconditions (one per line)</label><textarea id="edit-journey-preconditions" name="preconditions">${escapeHtml(journey.preconditions.join('\n'))}</textarea><label for="edit-journey-task">Human task</label><textarea id="edit-journey-task" name="humanTask" required>${escapeHtml(journey.humanTask)}</textarea><label for="edit-journey-expected">Expected observable outcome</label><textarea id="edit-journey-expected" name="expectedObservableOutcome" required>${escapeHtml(journey.expectedObservableOutcome)}</textarea><label for="edit-journey-findings">Related Finding IDs (comma separated)</label><input id="edit-journey-findings" name="relatedFindingIds" value="${escapeHtml(journey.relatedFindingIds.join(', '))}"><label for="edit-journey-reason">Edit reason</label><textarea id="edit-journey-reason" name="reason" required></textarea><button type="submit">Save protocol revision</button></fieldset></form></section>`;
}

function resultForm(journey: ResidentJourney): string {
  return `<section aria-labelledby="record-result-heading"><h2 id="record-result-heading">Record a manual result</h2><p id="outcome-help"><code>not_attempted</code> means no attempt occurred; <code>inconclusive</code> covers interruption or ambiguity; <code>unable_to_complete</code> is only an observed human task outcome.</p><form method="post" action="/journeys"><fieldset><legend>Human performance, environment, timing, and observation</legend>${journeyHidden(journey.id, 'record-journey-result')}<label for="result-performer">Performed by</label><input id="result-performer" name="actor" required><label for="result-outcome">Outcome</label><select id="result-outcome" name="outcome" aria-describedby="outcome-help">${options(['completed', 'completed_with_difficulty', 'unable_to_complete', 'not_attempted', 'inconclusive'])}</select><label for="result-platform">Platform</label><input id="result-platform" name="platform" required><label for="result-browser">Browser</label><input id="result-browser" name="browserName" required><label for="result-browser-version">Browser version</label><input id="result-browser-version" name="browserVersion"><label for="result-at">Assistive technology</label><input id="result-at" name="assistiveTechnologyName"><label for="result-at-version">Assistive technology version</label><input id="result-at-version" name="assistiveTechnologyVersion"><label for="result-started">Started at (ISO 8601 with offset)</label><input id="result-started" name="startedAt" placeholder="2026-09-28T18:00:00.000Z" required><label for="result-completed">Ended at (leave empty only for not_attempted)</label><input id="result-completed" name="completedAt" placeholder="2026-09-28T18:15:00.000Z"><label for="result-nvda">Optional human NVDA observations (requires NVDA on Windows environment)</label><textarea id="result-nvda" name="nvdaResult"></textarea><label for="result-notes">Observed behavior / interruption reason</label><textarea id="result-notes" name="notes" required></textarea><label for="result-findings">Related Finding IDs (comma separated; must be protocol links)</label><input id="result-findings" name="relatedFindingIds" value="${escapeHtml(journey.relatedFindingIds.join(', '))}"><button type="submit">Record manual journey result</button></fieldset></form></section>`;
}

function results(trace: ResidentJourneyTrace): string {
  if (trace.results.length === 0) {
    return '<section aria-labelledby="results-heading"><h2 id="results-heading">Recorded results</h2><p>No manual results recorded.</p></section>';
  }
  const evidenceById = new Map(trace.evidence.map((evidence) => [evidence.id, evidence]));
  return `<section aria-labelledby="results-heading"><h2 id="results-heading">Recorded results</h2>${trace.results
    .map(
      (result, index) =>
        `<article id="${escapeHtml(result.id)}"><h3>${escapeHtml(result.id)} — ${escapeHtml(result.outcome)}</h3><dl><dt>Performed by</dt><dd>${escapeHtml(result.performedBy)}</dd><dt>Environment</dt><dd>${escapeHtml(`${result.environment.platform}; ${result.environment.browser.name}${result.environment.browser.version === null ? '' : ` ${result.environment.browser.version}`}${result.environment.assistiveTechnology === null ? '' : `; ${result.environment.assistiveTechnology.name}${result.environment.assistiveTechnology.version === null ? '' : ` ${result.environment.assistiveTechnology.version}`}`}`)}</dd><dt>Started</dt><dd>${escapeHtml(result.startedAt)}</dd><dt>Ended</dt><dd>${escapeHtml(result.completedAt ?? 'Not attempted')}</dd><dt>Notes</dt><dd>${escapeHtml(result.notes ?? 'None')}</dd><dt>NVDA observations</dt><dd>${escapeHtml(result.nvdaResult ?? 'Not recorded')}</dd></dl><h4>Immutable supporting Evidence</h4>${result.evidenceIds
          .map((id) => {
            const evidence = evidenceById.get(id);
            return evidence === undefined
              ? `<p>Missing Evidence ${escapeHtml(id)}</p>`
              : `<details><summary>${escapeHtml(evidence.id)} — ${escapeHtml(evidence.kind)}</summary><pre>${escapeHtml(JSON.stringify(evidence, null, 2))}</pre></details>`;
          })
          .join('')}${validationForm(result, index)}</article>`,
    )
    .join('')}</section>`;
}

function validationForm(result: ResidentJourneyTrace['results'][number], index: number): string {
  const prefix = `journey-validation-${index}`;
  return `<form method="post" action="/journeys"><fieldset><legend>Add separate Finding Validation from this result</legend>${journeyHidden(result.journeyId, 'add-journey-validation')}<input type="hidden" name="resultId" value="${escapeHtml(result.id)}"><input type="hidden" name="evidenceIds" value="${escapeHtml(result.evidenceIds.join(','))}"><label for="${prefix}-finding">Finding ID</label><input id="${prefix}-finding" name="findingId" value="${escapeHtml(result.relatedFindingIds[0] ?? '')}" required><label for="${prefix}-actor">Performed by</label><input id="${prefix}-actor" name="actor" value="${escapeHtml(result.performedBy)}" required><label for="${prefix}-method">Validation method</label><select id="${prefix}-method" name="method">${options(['manual_review', 'keyboard', 'visual', 'contextual', 'nvda'])}</select><label for="${prefix}-outcome">Validation outcome</label><select id="${prefix}-outcome" name="validationOutcome">${options(['supported', 'unsupported', 'inconclusive'])}</select><label for="${prefix}-claims">Finding claims (comma separated)</label><input id="${prefix}-claims" name="claims" required><label for="${prefix}-severity">Exact severity (only for supported severity claim)</label><select id="${prefix}-severity" name="validatedSeverity"><option value="">None</option>${options(['blocker', 'serious', 'moderate', 'minor'])}</select><label for="${prefix}-notes">Validation notes</label><textarea id="${prefix}-notes" name="validationNotes" required></textarea><button type="submit">Add separate Validation record</button></fieldset></form>`;
}

function journeyHidden(journeyId: string, action: string): string {
  return `<input type="hidden" name="journeyId" value="${escapeHtml(journeyId)}"><input type="hidden" name="action" value="${escapeHtml(action)}">`;
}

function options(values: readonly string[]): string {
  return values
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
    .join('');
}

function list(values: readonly string[]): string {
  return values.length === 0
    ? '<p>None.</p>'
    : `<ul>${values.map((value) => `<li>${escapeHtml(value)}</li>`).join('')}</ul>`;
}

function document(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title></head><body>${body}</body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
