import {
  DeterministicFindingDrafter,
  FindingReviewService,
  GroupProposalReviewService,
} from '@accessledger/findings';
import { ResidentJourneyService } from '@accessledger/journeys';
import { SqliteReviewRepository } from '@accessledger/persistence';
import { describe, expect, it } from 'vitest';

import { groupProposalSchema } from '@accessledger/shared';

import { reviewFixture, reviewNow } from '../../../tests/support/review-fixture.js';
import {
  AuditorStudio,
  renderJourneyPage,
  renderProposalIndexPage,
  renderProposalPage,
  renderReviewPage,
} from '../src/index.js';

describe('Auditor Studio', () => {
  it('renders an evidence-first, keyboard-operable semantic review page', () => {
    const { repository, service, studio } = setup();
    const fixture = reviewFixture();
    service.createReview(fixture, { actor: 'Auditor Example' });
    service.startReview(fixture.finding.id, { actor: 'Auditor Example' });
    const html = renderReviewPage(studio.load(fixture.finding.id));

    expect(html).toContain('<main id="review-main">');
    expect(html).toContain('href="#review-main">Skip to finding review');
    expect(html).toContain('<h2 id="representative-heading">Representative occurrence</h2>');
    expect(html).toContain(
      '<caption>Every retained member of the source grouping proposal</caption>',
    );
    expect(html).toContain('<h2 id="evidence-heading">Raw and human evidence</h2>');
    expect(html).toContain('<h2 id="wcag-heading">WCAG support and candidates</h2>');
    expect(html).toContain('<h2 id="validations-heading">Human validations</h2>');
    expect(html).toContain('<summary>Grouping signals</summary>');
    expect(html).toContain('<h2 id="history-heading">Audit history</h2>');
    expect(html).toContain('<button type="submit">Approve finding</button>');
    expect(html).not.toMatch(/onclick=|tabindex="[1-9]|accesskey=/i);

    const labelTargets = [...html.matchAll(/<label for="([^"]+)"/g)].map((match) => match[1]);
    expect(labelTargets.length).toBeGreaterThan(10);
    for (const target of labelTargets) expect(html).toContain(`id="${target}"`);
    repository.close();
  });

  it('renders semantic journey controls, distinct uncertainty outcomes, and linked results', () => {
    const { repository, service, studio } = setup();
    const fixture = reviewFixture();
    service.createReview(fixture, { actor: 'Auditor Example' });
    service.startReview(fixture.finding.id, { actor: 'Auditor Example' });
    const protocol = studio.handleJourney('create-journey', {
      actor: 'Auditor Example',
      assessmentId: fixture.finding.assessmentId,
      goal: 'Locate a public meeting agenda',
      startingUrl: 'https://fixture.example/',
      preconditions: 'Use a clean browser profile.',
      humanTask: 'Find and open the current public meeting agenda.',
      expectedObservableOutcome: 'The current agenda opens.',
      relatedFindingIds: fixture.finding.id,
    });
    studio.handleJourney('record-journey-result', {
      journeyId: protocol.journey.id,
      actor: 'Auditor Example',
      outcome: 'inconclusive',
      platform: 'macOS 26',
      browserName: 'Firefox',
      browserVersion: '143',
      assistiveTechnologyName: '',
      assistiveTechnologyVersion: '',
      startedAt: reviewNow,
      completedAt: reviewNow,
      nvdaResult: '',
      notes: 'The network disconnected before the human test could isolate site behavior.',
      relatedFindingIds: fixture.finding.id,
    });

    const html = renderJourneyPage(studio.loadJourney(protocol.journey.id));
    expect(html).toContain('<main id="journey-main">');
    expect(html).toContain('value="not_attempted"');
    expect(html).toContain('value="inconclusive"');
    expect(html).toContain('value="unable_to_complete"');
    expect(html).toContain('Add separate Validation record');
    expect(html).not.toMatch(/onclick=|tabindex="[1-9]|accesskey=/i);
    for (const target of [...html.matchAll(/<label for="([^"]+)"/g)].map((match) => match[1])) {
      expect(html).toContain(`id="${target}"`);
    }

    const findingHtml = renderReviewPage(studio.load(fixture.finding.id));
    expect(findingHtml).toContain('Linked resident journey results');
    expect(findingHtml).toContain('inconclusive');
    repository.close();
  });

  it('routes native form actions through the service and stores authored human evidence', () => {
    const { repository, service, studio } = setup();
    const fixture = reviewFixture();
    service.createReview(fixture, { actor: 'Auditor Example' });
    studio.handle(fixture.finding.id, 'start-review', { actor: 'Auditor Example' });
    studio.handle(fixture.finding.id, 'add-validation', {
      actor: 'Auditor Example',
      method: 'keyboard',
      outcome: 'supported',
      claims: 'condition,severity',
      validatedSeverity: 'minor',
      notes: 'Keyboard review observed a lesser but reproducible impact.',
      assistiveTechnologyName: '',
      assistiveTechnologyVersion: '',
      platform: '',
    });
    const trace = studio.handle(fixture.finding.id, 'assign-severity', {
      actor: 'Auditor Example',
      severity: 'minor',
    });

    expect(trace.finding.severity).toBe('minor');
    expect(trace.validations[0]).toMatchObject({
      method: 'keyboard',
      claims: ['condition', 'severity'],
      validatedSeverity: 'minor',
    });
    expect(trace.evidence.some((record) => record.source.type === 'human')).toBe(true);
    repository.close();
  });

  it('renders the proposal queue and detail, then routes native accept actions without auto-acceptance', () => {
    const { repository, service, studio, proposalService } = setup();
    const fixture = reviewFixture();
    const proposal = groupProposalSchema.parse({ ...fixture.group, reviewStatus: 'pending' });
    proposalService.persistProposals([{ ...fixture, proposal }]);

    const pending = studio.loadProposal(proposal.id);
    const queueHtml = renderProposalIndexPage([pending]);
    const detailHtml = renderProposalPage(pending);
    expect(queueHtml).toContain('Pre-Finding proposal queue');
    expect(queueHtml).toContain('pending');
    expect(detailHtml).toContain('<caption>Immutable proposal member ledger</caption>');
    expect(detailHtml).toContain('WCAG candidate status');
    expect(detailHtml).toContain('Evidence and source metadata');
    expect(detailHtml).toContain('Append-only decision history');
    expect(detailHtml).toContain('<form method="post" action="/proposals">');
    expect(detailHtml).toContain('<button type="submit">Record proposal decision</button>');
    expect(service.listFindingIds()).toEqual([]);

    const accepted = studio.handleProposal('proposal-decision', {
      proposalId: proposal.id,
      decision: 'accepted',
      actor: 'Auditor Example',
      reason: 'The supported singleton membership was inspected.',
    });
    expect(accepted.proposal.reviewStatus).toBe('accepted');
    expect(accepted.originalProposal.reviewStatus).toBe('pending');
    expect(accepted.draftLink).not.toBeNull();
    expect(service.listFindingIds()).toEqual([accepted.draftLink!.findingId]);
    repository.close();
  });
});

function setup(): {
  repository: SqliteReviewRepository;
  service: FindingReviewService;
  proposalService: GroupProposalReviewService;
  studio: AuditorStudio;
} {
  const repository = new SqliteReviewRepository(':memory:');
  const service = new FindingReviewService(repository, {
    clock: () => new Date(reviewNow),
    idFactory: sequenceIds(),
  });
  const journeyService = new ResidentJourneyService(repository, {
    clock: () => new Date(reviewNow),
    idFactory: sequenceIds(),
  });
  const proposalService = new GroupProposalReviewService(
    repository,
    new DeterministicFindingDrafter(),
    {
      clock: () => new Date(reviewNow),
      idFactory: sequenceIds(),
    },
  );
  return {
    repository,
    service,
    proposalService,
    studio: new AuditorStudio(service, journeyService, proposalService, {
      clock: () => new Date(reviewNow),
      idFactory: sequenceIds(),
    }),
  };
}

function sequenceIds(): () => string {
  let value = 0;
  return () => String(++value).padStart(4, '0');
}
