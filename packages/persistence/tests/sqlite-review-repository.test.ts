import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  DeterministicFindingDrafter,
  FindingReviewService,
  GroupProposalReviewService,
} from '@accessledger/findings';
import {
  findingSchema,
  groupProposalSchema,
  wcagCandidateEvaluationSchema,
} from '@accessledger/shared';
import { describe, expect, it } from 'vitest';

import { humanEvidence, reviewFixture, reviewNow } from '../../../tests/support/review-fixture.js';
import {
  SQLITE_REVIEW_SCHEMA_VERSION,
  SqliteReviewRepository,
  reviewMigrations,
} from '../src/index.js';

describe('SqliteReviewRepository', () => {
  it('applies ordered migrations idempotently to a portable SQLite file', () => {
    const directory = mkdtempSync(join(tmpdir(), 'accessledger-review-'));
    const databasePath = join(directory, 'review.sqlite');
    try {
      new SqliteReviewRepository(databasePath, { clock: () => new Date(reviewNow) }).close();
      new SqliteReviewRepository(databasePath, { clock: () => new Date(reviewNow) }).close();
      const database = new DatabaseSync(databasePath, { readOnly: true });
      const migrations = database.prepare('SELECT version, name FROM schema_migrations').all();
      const tables = database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all()
        .map((row) => (row as { name: string }).name);
      database.close();

      expect(migrations).toEqual([
        { version: 1, name: 'create_auditor_review_store' },
        { version: 2, name: 'create_resident_journey_store' },
        {
          version: SQLITE_REVIEW_SCHEMA_VERSION,
          name: 'create_pre_finding_proposal_review_store',
        },
      ]);
      expect(reviewMigrations.map((migration) => migration.version)).toEqual([1, 2, 3]);
      expect(tables).toEqual(
        expect.arrayContaining([
          'audit_events',
          'bundle_source_records',
          'grouping_decisions',
          'journey_audit_events',
          'journey_finding_links',
          'journey_result_evidence_links',
          'journey_result_finding_links',
          'journey_results',
          'journey_revisions',
          'resident_journeys',
          'proposal_decisions',
          'proposal_draft_links',
          'proposal_reviews',
          'proposal_source_records',
          'review_bundles',
          'source_records',
          'validations',
        ]),
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('keeps migration 3 proposal originals, source links, decisions, and draft links immutable', () => {
    const directory = mkdtempSync(join(tmpdir(), 'accessledger-proposal-immutable-'));
    const databasePath = join(directory, 'review.sqlite');
    try {
      const repository = new SqliteReviewRepository(databasePath);
      const fixture = reviewFixture();
      const proposal = groupProposalSchema.parse({ ...fixture.group, reviewStatus: 'pending' });
      const service = new GroupProposalReviewService(
        repository,
        new DeterministicFindingDrafter({ clock: () => new Date(reviewNow) }),
        { clock: () => new Date(reviewNow), idFactory: sequenceIds() },
      );
      service.persistProposals([{ ...fixture, proposal }]);
      service.decide(proposal.id, 'accepted', {
        actor: 'Auditor Example',
        reason: 'The singleton has a supported WCAG criterion.',
      });
      repository.close();

      const database = new DatabaseSync(databasePath);
      expect(() =>
        database.prepare("UPDATE proposal_reviews SET original_proposal_json = '{}'").run(),
      ).toThrow(/immutable/);
      expect(() => database.prepare('DELETE FROM proposal_source_records').run()).toThrow(
        /immutable/,
      );
      expect(() =>
        database.prepare("UPDATE proposal_decisions SET status = 'split'").run(),
      ).toThrow(/append-only/);
      expect(() => database.prepare('DELETE FROM proposal_draft_links').run()).toThrow(/immutable/);
      database.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rolls back a validation transaction and its audit event on a duplicate validation ID', () => {
    const repository = new SqliteReviewRepository(':memory:');
    const ids = [
      'bundle-event',
      'review-event',
      'duplicate-validation',
      'first-validation-event',
      'duplicate-validation',
      'second-validation-event',
    ];
    const service = new FindingReviewService(repository, {
      clock: () => new Date(reviewNow),
      idFactory: () => ids.shift()!,
    });
    const fixture = reviewFixture();
    service.createReview(fixture, { actor: 'Auditor Example' });
    service.startReview(fixture.finding.id, { actor: 'Auditor Example' });
    const input = {
      method: 'manual_review' as const,
      outcome: 'supported' as const,
      claims: ['condition'] as const,
      validatedSeverity: null,
      performedBy: 'Auditor Example',
      performedAt: reviewNow,
      assistiveTechnology: null,
      notes: 'Condition confirmed by the human reviewer.',
      supportingEvidence: [humanEvidence('human-one')],
    };
    service.addValidation(fixture.finding.id, input, { actor: 'Auditor Example' });
    const before = service.loadCompleteTrace(fixture.finding.id);

    expect(() =>
      service.addValidation(
        fixture.finding.id,
        { ...input, supportingEvidence: [humanEvidence('human-two')] },
        { actor: 'Auditor Example' },
      ),
    ).toThrow();

    const after = service.loadCompleteTrace(fixture.finding.id);
    expect(after.validations).toHaveLength(1);
    expect(after.auditHistory).toHaveLength(before.auditHistory.length);
    expect(after.evidence.map((record) => record.id)).not.toContain('human-two');
    repository.close();
  });

  it('enforces immutable source rows and retains original draft and group records', () => {
    const directory = mkdtempSync(join(tmpdir(), 'accessledger-immutable-'));
    const databasePath = join(directory, 'review.sqlite');
    try {
      const repository = new SqliteReviewRepository(databasePath);
      const service = new FindingReviewService(repository, {
        clock: () => new Date(reviewNow),
        idFactory: sequenceIds(),
      });
      const fixture = reviewFixture();
      service.createReview(fixture, { actor: 'Auditor Example' });
      service.startReview(fixture.finding.id, { actor: 'Auditor Example' });
      service.editFinding(
        fixture.finding.id,
        { condition: 'Human-edited condition based on reviewed source evidence.' },
        { actor: 'Auditor Example' },
      );
      const trace = service.decideGrouping(fixture.finding.id, 'split', {
        actor: 'Auditor Example',
        reason: 'The member ledger needs separate treatment.',
      });

      expect(trace.originalFinding).toEqual(fixture.finding);
      expect(trace.originalGroup).toEqual(fixture.group);
      expect(trace.group.members).toEqual(fixture.group.members);
      expect(trace.finding.condition).not.toBe(trace.originalFinding.condition);
      repository.close();

      const database = new DatabaseSync(databasePath);
      expect(() =>
        database
          .prepare("UPDATE source_records SET record_json = '{}' WHERE record_type = 'evidence'")
          .run(),
      ).toThrow(/immutable/);
      database.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('loads only the exact WCAG evaluations linked to each review bundle', () => {
    const repository = new SqliteReviewRepository(':memory:');
    const service = new FindingReviewService(repository, {
      clock: () => new Date(reviewNow),
      idFactory: sequenceIds(),
    });
    const first = reviewFixture();
    service.createReview(first, { actor: 'Auditor Example' });
    const secondEvaluation = wcagCandidateEvaluationSchema.parse({
      ...first.wcagEvaluations[0],
      id: 'evaluation-review-second-candidate',
      criterionId: '1.1.1',
    });
    const secondGroup = groupProposalSchema.parse({
      ...first.group,
      id: 'group-review-second',
    });
    const secondFinding = findingSchema.parse({
      ...first.finding,
      id: 'finding-review-second',
      sourceGroupProposalId: secondGroup.id,
    });
    service.createReview(
      {
        ...first,
        finding: secondFinding,
        group: secondGroup,
        wcagEvaluations: [...first.wcagEvaluations, secondEvaluation],
      },
      { actor: 'Auditor Example' },
    );

    expect(service.loadCompleteTrace(first.finding.id).wcagEvaluations).toHaveLength(1);
    expect(service.loadCompleteTrace(secondFinding.id).wcagEvaluations).toHaveLength(2);
    repository.close();
  });
});

function sequenceIds(): () => string {
  let value = 0;
  return () => String(++value).padStart(4, '0');
}
