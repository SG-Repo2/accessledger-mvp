import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FindingReviewService } from '@accessledger/findings';
import { SqliteReviewRepository } from '@accessledger/persistence';
import {
  CONTRACT_SCHEMA_VERSION,
  evidenceSchema,
  journeyAuditEventSchema,
  journeyResultSchema,
  residentJourneySchema,
} from '@accessledger/shared';
import { describe, expect, it } from 'vitest';

import { reviewFixture, reviewNow } from '../../../tests/support/review-fixture.js';
import { ResidentJourneyService, type RecordJourneyResultInput } from '../src/index.js';

const later = '2026-09-28T18:15:00.000Z';

describe('ResidentJourneyService', () => {
  it('creates and edits generic protocols with retained audit history and Finding link integrity', () => {
    const { repository, reviewService, journeyService } = setup();
    const fixture = reviewFixture();
    reviewService.createReview(fixture, { actor: 'Auditor Example' });

    const created = createProtocol(journeyService, fixture.finding.id);
    const edited = journeyService.editProtocol(
      created.journey.id,
      {
        goal: 'Submit a public comment',
        humanTask: 'Find the public-comment form and prepare it for submission without submitting.',
      },
      { actor: 'Auditor Example', reason: 'Clarified the non-submission boundary.' },
    );

    expect(edited.journey).toMatchObject({
      goal: 'Submit a public comment',
      relatedFindingIds: [fixture.finding.id],
    });
    expect(edited.auditHistory.map((event) => event.action)).toEqual([
      'journey_created',
      'journey_edited',
    ]);
    expect(residentJourneySchema.parse(JSON.parse(JSON.stringify(edited.journey)))).toEqual(
      edited.journey,
    );
    expect(
      journeyAuditEventSchema.parse(JSON.parse(JSON.stringify(edited.auditHistory[1]))),
    ).toEqual(edited.auditHistory[1]);

    expect(() =>
      journeyService.createProtocol(
        {
          assessmentId: fixture.finding.assessmentId,
          goal: 'Broken link',
          startingUrl: 'https://fixture.example/',
          preconditions: [],
          humanTask: 'Attempt a task.',
          expectedObservableOutcome: 'Observe it.',
          relatedFindingIds: ['missing-finding'],
        },
        { actor: 'Auditor Example' },
      ),
    ).toThrow(/does not exist/);
    expect(journeyService.listProtocols()).toHaveLength(1);
    journeyService.deleteProtocol(created.journey.id, {
      actor: 'Auditor Example',
      reason: 'Protocol was created only to verify CRUD behavior.',
    });
    expect(journeyService.listProtocols()).toEqual([]);
    expect(() => journeyService.loadProtocol(created.journey.id)).toThrow(/does not exist/);
    expect(
      repository.loadJourneyAuditHistory(created.journey.id).map((event) => event.action),
    ).toEqual(['journey_created', 'journey_edited', 'journey_deleted']);
    repository.close();
  });

  it('records every explicit outcome with required performer, environment, timing, and evidence', () => {
    const { repository, reviewService, journeyService } = setup();
    const fixture = reviewFixture();
    reviewService.createReview(fixture, { actor: 'Auditor Example' });
    const journey = createProtocol(journeyService, fixture.finding.id).journey;
    const outcomes = [
      'completed',
      'completed_with_difficulty',
      'unable_to_complete',
      'not_attempted',
      'inconclusive',
    ] as const;

    for (const [index, outcome] of outcomes.entries()) {
      const result = journeyService.recordResult(
        journey.id,
        resultInput(outcome, `journey-evidence-${index}`, fixture.finding.id),
        { actor: 'Auditor Example' },
      );
      expect(result.outcome).toBe(outcome);
      expect(result.performedBy).toBe('Auditor Example');
      expect(result.environment.browser.name).toBe('Firefox');
      expect(result.completedAt).toBe(outcome === 'not_attempted' ? null : later);
    }

    expect(journeyService.loadProtocol(journey.id).results).toHaveLength(5);
    expect(journeyService.loadProtocol(journey.id).evidence).toHaveLength(5);
    expect(reviewService.loadCompleteTrace(fixture.finding.id).journeyResults).toHaveLength(5);
    expect(
      reviewService
        .loadCompleteTrace(fixture.finding.id)
        .evidence.filter((record) => record.source.type === 'human'),
    ).toHaveLength(5);
    expect(() =>
      journeyService.editProtocol(
        journey.id,
        { relatedFindingIds: [] },
        { actor: 'Auditor Example', reason: 'Attempt to break retained result links.' },
      ),
    ).toThrow(/cannot remove/);
    expect(journeyService.loadProtocol(journey.id).journey.relatedFindingIds).toEqual([
      fixture.finding.id,
    ]);
    expect(() =>
      journeyService.deleteProtocol(journey.id, {
        actor: 'Auditor Example',
        reason: 'Attempt to delete retained result history.',
      }),
    ).toThrow(/recorded results/);
    expect(() =>
      journeyService.recordResult(
        journey.id,
        {
          ...resultInput('inconclusive', 'missing-performer', fixture.finding.id),
          performedBy: '',
        },
        { actor: 'Auditor Example' },
      ),
    ).toThrow();
    expect(() =>
      journeyService.recordResult(
        journey.id,
        {
          ...resultInput('unable_to_complete', 'no-explicit-outcome', fixture.finding.id),
          outcome: undefined,
        } as unknown as RecordJourneyResultInput,
        { actor: 'Auditor Example' },
      ),
    ).toThrow();
    repository.close();
  });

  it('keeps interrupted/inconclusive distinct and permits optional human NVDA observations only in an NVDA Windows environment', () => {
    const { repository, reviewService, journeyService } = setup();
    const fixture = reviewFixture();
    reviewService.createReview(fixture, { actor: 'Auditor Example' });
    const journey = createProtocol(journeyService, fixture.finding.id).journey;
    const interrupted = journeyService.recordResult(
      journey.id,
      {
        ...resultInput('inconclusive', 'interrupted-evidence', fixture.finding.id),
        notes: 'The test network disconnected before the behavior could be isolated.',
      },
      { actor: 'Auditor Example' },
    );
    const nvda = journeyService.recordResult(
      journey.id,
      {
        ...resultInput('completed_with_difficulty', 'nvda-evidence', fixture.finding.id),
        environment: {
          platform: 'Windows 11',
          browser: { name: 'Firefox', version: '143' },
          assistiveTechnology: { name: 'NVDA', version: '2026.1' },
        },
        nvdaResult: 'The human auditor heard an unlabeled control announcement.',
      },
      { actor: 'Auditor Example' },
    );

    expect(interrupted.outcome).toBe('inconclusive');
    expect(nvda.nvdaResult).toContain('human auditor');
    expect(() =>
      journeyService.recordResult(
        journey.id,
        {
          ...resultInput('completed', 'invalid-nvda', fixture.finding.id),
          nvdaResult: 'Synthetic claim.',
        },
        { actor: 'Auditor Example' },
      ),
    ).toThrow(/NVDA-on-Windows/);
    repository.close();
  });

  it('rolls back duplicate result writes, including new supporting Evidence and audit history', () => {
    const directory = mkdtempSync(join(tmpdir(), 'accessledger-journey-transaction-'));
    const databasePath = join(directory, 'review.sqlite');
    try {
      const { repository, reviewService, journeyService } = setup(databasePath);
      const fixture = reviewFixture();
      reviewService.createReview(fixture, { actor: 'Auditor Example' });
      const journey = createProtocol(journeyService, fixture.finding.id).journey;
      const first = journeyService.recordResult(
        journey.id,
        { ...resultInput('completed', 'first-evidence', fixture.finding.id), id: 'fixed-result' },
        { actor: 'Auditor Example' },
      );
      expect(first.id).toBe('fixed-result');
      expect(() =>
        journeyService.recordResult(
          journey.id,
          {
            ...resultInput('completed', 'rolled-back-evidence', fixture.finding.id),
            id: 'fixed-result',
          },
          { actor: 'Auditor Example' },
        ),
      ).toThrow();
      expect(journeyService.loadProtocol(journey.id).results).toHaveLength(1);
      expect(journeyService.loadProtocol(journey.id).auditHistory).toHaveLength(2);
      repository.close();

      const database = new DatabaseSync(databasePath, { readOnly: true });
      const rolledBack = database
        .prepare(
          `SELECT record_id FROM source_records
           WHERE record_type = 'evidence' AND record_id = 'rolled-back-evidence'`,
        )
        .get();
      database.close();
      expect(rolledBack).toBeUndefined();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('adds separate JourneyResult Validation and integrates exact severity without treating the journey outcome as a claim', () => {
    const { repository, reviewService, journeyService } = setup();
    const fixture = reviewFixture();
    reviewService.createReview(fixture, { actor: 'Auditor Example' });
    reviewService.startReview(fixture.finding.id, { actor: 'Auditor Example' });
    const journey = createProtocol(journeyService, fixture.finding.id).journey;
    const result = journeyService.recordResult(
      journey.id,
      resultInput('unable_to_complete', 'severity-evidence', fixture.finding.id),
      { actor: 'Auditor Example' },
    );

    expect(() =>
      reviewService.assignSeverity(fixture.finding.id, 'blocker', { actor: 'Auditor Example' }),
    ).toThrow(/lacks a matching/);
    const validation = journeyService.addResultValidation(
      fixture.finding.id,
      result.id,
      {
        method: 'keyboard',
        outcome: 'supported',
        claims: ['effect', 'severity'],
        validatedSeverity: 'blocker',
        performedBy: 'Auditor Example',
        performedAt: reviewNow,
        assistiveTechnology: null,
        notes: 'Human task execution supports the exact impact claim.',
        evidenceIds: result.evidenceIds,
      },
      { actor: 'Auditor Example' },
    );
    const trace = reviewService.assignSeverity(fixture.finding.id, 'blocker', {
      actor: 'Auditor Example',
    });

    expect(validation.subject).toEqual({ type: 'journey_result', id: result.id });
    expect(trace.finding.severity).toBe('blocker');
    expect(trace.journeyResults).toEqual([result]);
    expect(trace.validations).toContainEqual(validation);
    expect(journeyResultSchema.parse(JSON.parse(JSON.stringify(result)))).toEqual(result);
    repository.close();
  });
});

function setup(databasePath = ':memory:') {
  const repository = new SqliteReviewRepository(databasePath, { clock: () => new Date(reviewNow) });
  return {
    repository,
    reviewService: new FindingReviewService(repository, {
      clock: () => new Date(reviewNow),
      idFactory: sequenceIds(),
    }),
    journeyService: new ResidentJourneyService(repository, {
      clock: () => new Date(reviewNow),
      idFactory: sequenceIds(),
    }),
  };
}

function createProtocol(service: ResidentJourneyService, findingId: string) {
  return service.createProtocol(
    {
      id: 'journey-public-comment',
      assessmentId: 'assessment-review',
      goal: 'Prepare a public comment',
      startingUrl: 'https://fixture.example/',
      preconditions: ['Use a clean browser profile.', 'Do not submit the form.'],
      humanTask: 'Find the public-comment form and identify every required field.',
      expectedObservableOutcome: 'The form and required fields can be identified.',
      relatedFindingIds: [findingId],
    },
    { actor: 'Auditor Example' },
  );
}

function resultInput(
  outcome: RecordJourneyResultInput['outcome'],
  evidenceId: string,
  findingId: string,
): RecordJourneyResultInput {
  return {
    outcome,
    environment: {
      platform: 'macOS 26',
      browser: { name: 'Firefox', version: '143' },
      assistiveTechnology: null,
    },
    nvdaResult: null,
    performedBy: 'Auditor Example',
    startedAt: reviewNow,
    completedAt: outcome === 'not_attempted' ? null : later,
    notes:
      outcome === 'inconclusive'
        ? 'The human test was interrupted before a conclusion was possible.'
        : 'The human auditor recorded the selected outcome.',
    relatedFindingIds: [findingId],
    supportingEvidence: [
      evidenceSchema.parse({
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        id: evidenceId,
        assessmentId: 'assessment-review',
        pageId: null,
        kind: 'human_note',
        source: { type: 'human', name: 'Auditor Example', version: null },
        capturedAt: reviewNow,
        contentType: 'application/json',
        payload: { observation: 'Human-authored fixture evidence.' },
        metadata: { fixture: true },
      }),
    ],
  };
}

function sequenceIds(): () => string {
  let value = 0;
  return () => String(++value).padStart(4, '0');
}
