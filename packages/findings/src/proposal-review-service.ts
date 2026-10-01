import { randomUUID } from 'node:crypto';

import type { ProposalReviewInput, ProposalReviewRepository } from '@accessledger/persistence';
import {
  CONTRACT_SCHEMA_VERSION,
  groupProposalSchema,
  proposalDraftLinkSchema,
  proposalReviewDecisionSchema,
  reviewAuditEventSchema,
  type ProposalReviewDecisionStatus,
} from '@accessledger/shared';
import { z } from 'zod';

import { assertValidFindingEvidenceContext } from './finding-drafter.js';
import type { FindingDrafter, GroupProposalReviewTrace, ReviewActionContext } from './types.js';

const actorSchema = z.string().trim().min(1);
const reasonSchema = z.string().trim().min(1);

export interface GroupProposalReviewServiceOptions {
  clock?: () => Date;
  idFactory?: () => string;
}

export class GroupProposalReviewService {
  readonly #repository: ProposalReviewRepository;
  readonly #drafter: FindingDrafter;
  readonly #clock: () => Date;
  readonly #idFactory: () => string;

  constructor(
    repository: ProposalReviewRepository,
    drafter: FindingDrafter,
    options: GroupProposalReviewServiceOptions = {},
  ) {
    this.#repository = repository;
    this.#drafter = drafter;
    this.#clock = options.clock ?? (() => new Date());
    this.#idFactory = options.idFactory ?? randomUUID;
  }

  persistProposals(inputs: readonly ProposalReviewInput[]): GroupProposalReviewTrace[] {
    const proposalIds = new Set<string>();
    for (const input of inputs) {
      const proposal = groupProposalSchema.parse(input.proposal);
      if (proposal.reviewStatus !== 'pending') {
        throw new Error('Preparation may persist only original pending GroupProposal records.');
      }
      if (proposalIds.has(proposal.id)) {
        throw new Error(`Preparation contains duplicate GroupProposal ${proposal.id}.`);
      }
      proposalIds.add(proposal.id);
      assertValidFindingEvidenceContext(proposal, input);
    }
    const existing = new Set(this.#repository.listProposalIds());
    const duplicates = [...proposalIds].filter((proposalId) => existing.has(proposalId));
    if (duplicates.length > 0) {
      throw new Error(
        `Review database already contains prepared GroupProposal IDs: ${duplicates.join(', ')}.`,
      );
    }
    this.#repository.createProposalReviews(inputs);
    return inputs.map((input) => this.load(input.proposal.id));
  }

  load(proposalId: string): GroupProposalReviewTrace {
    const trace = this.#repository.loadProposalReview(proposalId);
    if (trace === null) throw new Error(`GroupProposal ${proposalId} is not persisted.`);
    assertValidFindingEvidenceContext(trace.originalProposal, trace);
    return trace;
  }

  listProposalIds(assessmentId?: string): string[] {
    return this.#repository.listProposalIds(assessmentId);
  }

  decide(
    proposalId: string,
    status: ProposalReviewDecisionStatus,
    context: ReviewActionContext,
  ): GroupProposalReviewTrace {
    const trace = this.load(proposalId);
    const actor = actorSchema.parse(context.actor);
    const reason = reasonSchema.parse(context.reason);
    if (trace.draftLink !== null) {
      throw new Error('A GroupProposal linked to a draft Finding cannot be decided again.');
    }
    const decidedAt = this.#clock().toISOString();
    const decision = proposalReviewDecisionSchema.parse({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      id: `proposal-decision-${this.#idFactory()}`,
      assessmentId: trace.originalProposal.assessmentId,
      proposalId: trace.originalProposal.id,
      status,
      actor,
      reason,
      decidedAt,
    });

    const acceptedProposal = groupProposalSchema.parse({
      ...trace.originalProposal,
      reviewStatus: status,
      updatedAt: decidedAt,
    });
    let draft = null;
    if (status === 'accepted') {
      try {
        const finding = this.#drafter.draft(acceptedProposal, trace);
        const reviewEvent = reviewAuditEventSchema.parse({
          schemaVersion: CONTRACT_SCHEMA_VERSION,
          id: `review-event-${this.#idFactory()}`,
          assessmentId: finding.assessmentId,
          findingId: finding.id,
          entityType: 'review_bundle',
          entityId: finding.id,
          action: 'review_bundle_created',
          actor,
          reason,
          before: null,
          after: { findingId: finding.id, groupProposalId: acceptedProposal.id },
          occurredAt: decidedAt,
        });
        draft = {
          reviewBundle: { finding, group: acceptedProposal, ...sourceContext(trace) },
          reviewEvent,
          link: proposalDraftLinkSchema.parse({
            schemaVersion: CONTRACT_SCHEMA_VERSION,
            proposalId: acceptedProposal.id,
            findingId: finding.id,
            linkedAt: decidedAt,
          }),
        };
      } catch (error) {
        if (!isAcceptedDraftIneligibility(error)) throw error;
      }
    }

    this.#repository.commitProposalDecision(decision, draft);
    return this.load(proposalId);
  }
}

function sourceContext(trace: GroupProposalReviewTrace) {
  return {
    observations: trace.observations,
    occurrences: trace.occurrences,
    wcagEvaluations: trace.wcagEvaluations,
    pages: trace.pages,
    evidence: trace.evidence,
  };
}

function isAcceptedDraftIneligibility(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return [
    'Cannot draft from an ambiguous proposal.',
    'A singleton proposal requires at least one supported WCAG criterion.',
  ].includes(error.message);
}
