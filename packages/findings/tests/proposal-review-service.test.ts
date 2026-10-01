import { SqliteReviewRepository } from '@accessledger/persistence';
import {
  groupProposalSchema,
  observationOccurrenceSchema,
  wcagCandidateEvaluationSchema,
} from '@accessledger/shared';
import { describe, expect, it } from 'vitest';

import { reviewFixture, reviewNow } from '../../../tests/support/review-fixture.js';
import {
  DeterministicFindingDrafter,
  FindingReviewService,
  GroupProposalReviewService,
} from '../src/index.js';

describe('GroupProposalReviewService', () => {
  it('persists a pending repeat with its full immutable trace and drafts only after acceptance', () => {
    const repository = new SqliteReviewRepository(':memory:');
    try {
      const service = proposalService(repository);
      const input = repeatProposalInput();
      const pending = service.persistProposals([input])[0]!;

      expect(pending).toMatchObject({
        proposal: { reviewStatus: 'pending', kind: 'repeat_candidate' },
        originalProposal: { reviewStatus: 'pending' },
        decisions: [],
        draftLink: null,
      });
      expect(pending.occurrences.map((record) => record.id)).toEqual([
        'occurrence-review',
        'occurrence-review-second',
      ]);
      expect(pending.evidence[0]?.source).toEqual({
        type: 'scanner',
        name: 'axe-core',
        version: '4.13.0',
      });
      expect(new FindingReviewService(repository).listFindingIds()).toEqual([]);
      const fresh = repeatProposalInput('fresh-repeat-in-failed-rerun');
      expect(() => service.persistProposals([fresh, input])).toThrow(
        /already contains prepared GroupProposal IDs/,
      );
      expect(service.listProposalIds()).toEqual([input.proposal.id]);

      const accepted = service.decide(input.proposal.id, 'accepted', {
        actor: 'Auditor Example',
        reason: 'Both retained occurrences share the inspected component structure.',
      });

      expect(accepted.originalProposal).toEqual(input.proposal);
      expect(accepted.proposal.reviewStatus).toBe('accepted');
      expect(accepted.decisions).toHaveLength(1);
      expect(accepted.draftLink).not.toBeNull();
      const findingTrace = new FindingReviewService(repository).loadCompleteTrace(
        accepted.draftLink!.findingId,
      );
      expect(findingTrace.finding.occurrenceCount).toBe(2);
      expect(findingTrace.occurrences.map((record) => record.id)).toEqual(
        pending.occurrences.map((record) => record.id),
      );
      expect(() =>
        service.decide(input.proposal.id, 'rejected', {
          actor: 'Auditor Example',
          reason: 'A later destructive reversal is not permitted after drafting.',
        }),
      ).toThrow(/linked to a draft Finding/);
    } finally {
      repository.close();
    }
  });

  it('drafts an accepted singleton only when a WCAG criterion is supported', () => {
    const repository = new SqliteReviewRepository(':memory:');
    try {
      const service = proposalService(repository);
      const supported = singletonProposalInput('supported-singleton', true);
      const unsupported = singletonProposalInput('unsupported-singleton', false);
      service.persistProposals([supported, unsupported]);

      const drafted = service.decide(supported.proposal.id, 'accepted', {
        actor: 'Auditor Example',
        reason: 'The singleton and its supported WCAG evaluation were inspected.',
      });
      const ineligible = service.decide(unsupported.proposal.id, 'accepted', {
        actor: 'Auditor Example',
        reason: 'Membership is accepted, but WCAG support remains insufficient.',
      });

      expect(drafted.draftLink).not.toBeNull();
      expect(ineligible.proposal.reviewStatus).toBe('accepted');
      expect(ineligible.decisions).toHaveLength(1);
      expect(ineligible.draftLink).toBeNull();
      const reconsidered = service.decide(unsupported.proposal.id, 'rejected', {
        actor: 'Auditor Example',
        reason: 'The unsupported singleton should not proceed to Finding review.',
      });
      expect(reconsidered.decisions.map((decision) => decision.status)).toEqual([
        'accepted',
        'rejected',
      ]);
      expect(reconsidered.draftLink).toBeNull();
      expect(new FindingReviewService(repository).listFindingIds()).toEqual([
        drafted.draftLink!.findingId,
      ]);
    } finally {
      repository.close();
    }
  });

  it.each(['rejected', 'split'] as const)(
    'records an append-only %s decision without drafting',
    (status) => {
      const repository = new SqliteReviewRepository(':memory:');
      try {
        const service = proposalService(repository);
        const input = repeatProposalInput(`${status}-repeat`);
        service.persistProposals([input]);
        const decided = service.decide(input.proposal.id, status, {
          actor: 'Auditor Example',
          reason: `The reviewer explicitly selected ${status}.`,
        });

        expect(decided.proposal.reviewStatus).toBe(status);
        expect(decided.decisions.map((decision) => decision.status)).toEqual([status]);
        expect(decided.draftLink).toBeNull();
        expect(new FindingReviewService(repository).listFindingIds()).toEqual([]);
      } finally {
        repository.close();
      }
    },
  );

  it('retains an accepted ambiguous proposal without creating a draft', () => {
    const repository = new SqliteReviewRepository(':memory:');
    try {
      const service = proposalService(repository);
      const input = singletonProposalInput('ambiguous-proposal', true, true);
      service.persistProposals([input]);
      const accepted = service.decide(input.proposal.id, 'accepted', {
        actor: 'Auditor Example',
        reason: 'The member is retained, but the ambiguity still prevents drafting.',
      });

      expect(accepted.proposal.reviewStatus).toBe('accepted');
      expect(accepted.draftLink).toBeNull();
    } finally {
      repository.close();
    }
  });
});

function proposalService(repository: SqliteReviewRepository): GroupProposalReviewService {
  return new GroupProposalReviewService(
    repository,
    new DeterministicFindingDrafter({ clock: () => new Date(reviewNow) }),
    { clock: () => new Date(reviewNow), idFactory: sequenceIds() },
  );
}

function repeatProposalInput(id = 'pending-repeat') {
  const fixture = reviewFixture();
  const secondOccurrence = observationOccurrenceSchema.parse({
    ...fixture.occurrences[0],
    id: 'occurrence-review-second',
    selector: '#submit-second',
  });
  const occurrenceIds = [fixture.occurrences[0]!.id, secondOccurrence.id];
  const proposal = groupProposalSchema.parse({
    ...fixture.group,
    id,
    kind: 'repeat_candidate',
    reviewStatus: 'pending',
    groupingConfidence: 'medium',
    members: [
      fixture.group.members[0],
      { ...fixture.group.members[0], occurrenceId: secondOccurrence.id },
    ],
    memberOccurrenceIds: occurrenceIds,
    signals: fixture.group.signals.map((signal) => ({ ...signal, occurrenceIds })),
    createdAt: reviewNow,
    updatedAt: reviewNow,
  });
  return { ...fixture, proposal, occurrences: [fixture.occurrences[0]!, secondOccurrence] };
}

function singletonProposalInput(id: string, supported: boolean, ambiguous = false) {
  const fixture = reviewFixture();
  const evaluation = supported
    ? wcagCandidateEvaluationSchema.parse({
        ...fixture.wcagEvaluations[0],
        id: `${id}-evaluation`,
      })
    : wcagCandidateEvaluationSchema.parse({
        ...fixture.wcagEvaluations[0],
        id: `${id}-evaluation`,
        evaluation: 'unsupported',
        reason: 'requirements_contradicted',
        requirementEvaluations: fixture.wcagEvaluations[0]!.requirementEvaluations.map(
          (requirement) => ({ ...requirement, status: 'contradicted' }),
        ),
      });
  const proposal = groupProposalSchema.parse({
    ...fixture.group,
    id,
    kind: ambiguous ? 'ambiguous' : 'singleton',
    reviewStatus: 'pending',
    ambiguity: ambiguous
      ? {
          reason: 'insufficient_identity_signal',
          relatedOccurrenceIds: ['related-occurrence-outside-ledger'],
        }
      : null,
    createdAt: reviewNow,
    updatedAt: reviewNow,
  });
  return { ...fixture, proposal, wcagEvaluations: [evaluation] };
}

function sequenceIds(): () => string {
  let value = 0;
  return () => String(++value).padStart(4, '0');
}
