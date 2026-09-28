import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SqliteReviewRepository } from '@accessledger/persistence';
import { findingSchema, reviewAuditEventSchema, validationSchema } from '@accessledger/shared';
import { describe, expect, it } from 'vitest';

import { humanEvidence, reviewFixture, reviewNow } from '../../../tests/support/review-fixture.js';
import { FindingReviewService, type FindingEditPatch } from '../src/index.js';

describe('FindingReviewService', () => {
  it('loads the complete source and Validation trace and persists only allowed edits', () => {
    const { repository, service } = setup();
    const fixture = reviewFixture();
    service.createReview(fixture, { actor: 'Auditor Example' });
    service.startReview(fixture.finding.id, { actor: 'Auditor Example' });
    service.editFinding(
      fixture.finding.id,
      {
        title: 'Button has no programmatic name',
        condition: 'The reviewed submit button has no computed accessible name.',
        cause: 'The button has neither visible text nor another naming mechanism.',
        effect: 'The control purpose is not available programmatically.',
        recommendation: 'Give the button a concise accessible name.',
        confidence: 'high',
        wcagCriteria: ['4.1.2'],
      },
      { actor: 'Auditor Example', reason: 'Completed evidence-backed finding text.' },
    );

    const trace = service.loadCompleteTrace(fixture.finding.id);
    expect(trace).toMatchObject({
      finding: { title: 'Button has no programmatic name', confidence: 'high' },
      group: { id: fixture.group.id },
    });
    expect(trace.observations).toHaveLength(1);
    expect(trace.occurrences).toHaveLength(1);
    expect(trace.wcagEvaluations).toHaveLength(1);
    expect(trace.pages).toHaveLength(1);
    expect(trace.evidence).toHaveLength(1);
    expect(trace.auditHistory.map((event) => event.action)).toEqual([
      'review_bundle_created',
      'review_started',
      'finding_edited',
    ]);
    expect(() =>
      service.editFinding(
        fixture.finding.id,
        { severity: 'blocker' } as unknown as FindingEditPatch,
        { actor: 'Auditor Example' },
      ),
    ).toThrow();
    repository.close();
  });

  it('records accepted, rejected, and split grouping decisions without deleting members', () => {
    const { repository, service } = setup();
    const fixture = reviewFixture();
    service.createReview(fixture, { actor: 'Auditor Example' });
    service.startReview(fixture.finding.id, { actor: 'Auditor Example' });
    for (const status of ['rejected', 'split', 'accepted'] as const) {
      const trace = service.decideGrouping(fixture.finding.id, status, {
        actor: 'Auditor Example',
        reason: `Reviewed grouping as ${status}.`,
      });
      expect(trace.group.reviewStatus).toBe(status);
      expect(trace.group.members).toEqual(fixture.group.members);
    }
    expect(
      service
        .loadCompleteTrace(fixture.finding.id)
        .auditHistory.filter((event) => event.action === 'grouping_decided'),
    ).toHaveLength(3);
    repository.close();
  });

  it('gates severity and approval on supported human evidence and required claims', () => {
    const { repository, service } = setup();
    const fixture = reviewFixture();
    service.createReview(fixture, { actor: 'Auditor Example' });
    service.startReview(fixture.finding.id, { actor: 'Auditor Example' });
    service.editFinding(
      fixture.finding.id,
      {
        cause: 'The control has no naming content.',
        effect: 'A human reviewer could not determine its purpose from the exposed name.',
        recommendation: 'Add a concise programmatic name.',
        confidence: 'high',
      },
      { actor: 'Auditor Example' },
    );
    service.decideGrouping(fixture.finding.id, 'split', {
      actor: 'Auditor Example',
      reason: 'Test unresolved grouping gate.',
    });

    expect(() =>
      service.assignSeverity(fixture.finding.id, 'moderate', { actor: 'Auditor Example' }),
    ).toThrow(/lacks a matching/);
    expect(() => service.approve(fixture.finding.id, { actor: 'Auditor Example' })).toThrow(
      /grouping is unresolved/,
    );
    service.decideGrouping(fixture.finding.id, 'accepted', {
      actor: 'Auditor Example',
      reason: 'Source ledger confirmed as one finding.',
    });
    service.addValidation(
      fixture.finding.id,
      {
        method: 'manual_review',
        outcome: 'unsupported',
        claims: ['condition'],
        validatedSeverity: null,
        performedBy: 'Auditor Example',
        performedAt: reviewNow,
        assistiveTechnology: null,
        notes: 'This record does not support the required condition claim.',
        supportingEvidence: [humanEvidence('human-unsupported')],
      },
      { actor: 'Auditor Example' },
    );
    expect(() => service.approve(fixture.finding.id, { actor: 'Auditor Example' })).toThrow(
      /lacks supported human validation/,
    );

    service.addValidation(
      fixture.finding.id,
      {
        method: 'keyboard',
        outcome: 'supported',
        claims: ['grouping', 'condition', 'wcag', 'cause', 'effect', 'recommendation', 'severity'],
        validatedSeverity: 'moderate',
        performedBy: 'Auditor Example',
        performedAt: reviewNow,
        assistiveTechnology: null,
        notes: 'Human keyboard review confirmed the condition, effect, and moderate impact.',
        supportingEvidence: [humanEvidence('human-complete')],
      },
      { actor: 'Auditor Example' },
    );
    service.assignSeverity(fixture.finding.id, 'moderate', { actor: 'Auditor Example' });
    const approved = service.approve(fixture.finding.id, { actor: 'Auditor Example' });

    expect(approved.finding).toMatchObject({
      status: 'approved',
      severity: 'moderate',
      validationStatus: 'validated',
    });
    expect(approved.approvalBlockers).toEqual([]);
    expect(approved.evidence.map((record) => record.id)).toContain('human-complete');
    repository.close();
  });

  it('rejects invalid transitions and approval when persisted traceability is broken', () => {
    const repository = new SqliteReviewRepository(':memory:');
    const service = new FindingReviewService(repository, {
      clock: () => new Date(reviewNow),
      idFactory: sequenceIds(),
    });
    const fixture = reviewFixture();
    service.createReview(fixture, { actor: 'Auditor Example' });
    expect(() => service.approve(fixture.finding.id, { actor: 'Auditor Example' })).toThrow(
      /requires a Finding with status in_review/,
    );
    service.startReview(fixture.finding.id, { actor: 'Auditor Example' });
    expect(() => service.startReview(fixture.finding.id, { actor: 'Auditor Example' })).toThrow(
      /Only a draft/,
    );
    const rejected = service.reject(fixture.finding.id, {
      actor: 'Auditor Example',
      reason: 'The finding is not supportable after review.',
    });
    expect(rejected.finding.status).toBe('rejected');
    expect(() =>
      service.editFinding(
        fixture.finding.id,
        { condition: 'A late edit must not be accepted.' },
        { actor: 'Auditor Example' },
      ),
    ).toThrow(/requires a Finding with status in_review/);
    repository.close();

    const directory = mkdtempSync(join(tmpdir(), 'accessledger-broken-trace-'));
    const databasePath = join(directory, 'review.sqlite');
    const fileRepository = new SqliteReviewRepository(databasePath);
    const fileService = new FindingReviewService(fileRepository, {
      clock: () => new Date(reviewNow),
      idFactory: sequenceIds(),
    });
    try {
      fileService.createReview(fixture, { actor: 'Auditor Example' });
      fileService.startReview(fixture.finding.id, { actor: 'Auditor Example' });
      fileRepository.close();
      const database = new DatabaseSync(databasePath);
      const row = database
        .prepare('SELECT current_finding_json FROM review_bundles WHERE finding_id = ?')
        .get(fixture.finding.id) as { current_finding_json: string };
      const finding = findingSchema.parse(JSON.parse(row.current_finding_json));
      database
        .prepare('UPDATE review_bundles SET current_finding_json = ? WHERE finding_id = ?')
        .run(JSON.stringify({ ...finding, evidenceIds: ['wrong-evidence'] }), finding.id);
      database.close();
      const reopened = new SqliteReviewRepository(databasePath);
      const reopenedService = new FindingReviewService(reopened);
      expect(() => reopenedService.approve(finding.id, { actor: 'Auditor Example' })).toThrow(
        /traceability is broken/,
      );
      reopened.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('keeps review records versioned and JSON serializable', () => {
    const { repository, service } = setup();
    const fixture = reviewFixture();
    service.createReview(fixture, { actor: 'Auditor Example' });
    service.startReview(fixture.finding.id, { actor: 'Auditor Example' });
    service.addValidation(
      fixture.finding.id,
      {
        method: 'manual_review',
        outcome: 'supported',
        claims: ['condition'],
        validatedSeverity: null,
        performedBy: 'Auditor Example',
        performedAt: reviewNow,
        assistiveTechnology: null,
        notes: 'Condition supported.',
        supportingEvidence: [humanEvidence('human-versioned')],
      },
      { actor: 'Auditor Example' },
    );
    const trace = service.loadCompleteTrace(fixture.finding.id);
    const audit = trace.auditHistory.at(-1)!;
    const validation = trace.validations[0]!;
    expect(reviewAuditEventSchema.parse(JSON.parse(JSON.stringify(audit)))).toEqual(audit);
    expect(validationSchema.parse(JSON.parse(JSON.stringify(validation)))).toEqual(validation);
    expect(reviewAuditEventSchema.safeParse({ ...audit, schemaVersion: '2.0.0' }).success).toBe(
      false,
    );
    repository.close();
  });
});

function setup(): { repository: SqliteReviewRepository; service: FindingReviewService } {
  const repository = new SqliteReviewRepository(':memory:');
  return {
    repository,
    service: new FindingReviewService(repository, {
      clock: () => new Date(reviewNow),
      idFactory: sequenceIds(),
    }),
  };
}

function sequenceIds(): () => string {
  let value = 0;
  return () => String(++value).padStart(4, '0');
}
