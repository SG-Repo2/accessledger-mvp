import { createHash } from 'node:crypto';

import {
  DeterministicFindingDrafter,
  GroupProposalReviewService,
  type FindingDrafter,
  type FindingEvidenceContext,
} from '@accessledger/findings';
import { ConservativeGroupingEngine, type GroupingEngine } from '@accessledger/grouping';
import {
  DeterministicObservationNormalizer,
  type ObservationNormalizer,
} from '@accessledger/observations';
import type { ProposalReviewRepository, ReviewRepository } from '@accessledger/persistence';
import {
  rawPageAssessmentSchema,
  type Evidence,
  type GroupProposal,
  type RawPageAssessment,
} from '@accessledger/shared';
import { EvidenceBasedWcagMapper, JsonWcagKnowledge, type WcagMapper } from '@accessledger/wcag';

export interface AssessmentPreparationCounts {
  observations: number;
  occurrences: number;
  wcagEvaluations: number;
  supportedWcagEvaluations: number;
  unsupportedWcagEvaluations: number;
  uncertainWcagEvaluations: number;
  groupingProposals: number;
  ineligibleGroupingProposals: number;
  draftFindings: number;
  persistedReviewBundles: number;
  persistedProposals: number;
  ignoredNormalizationInputs: number;
  unrecognizedRules: number;
}

export interface AssessmentPreparationStages {
  normalizer: ObservationNormalizer;
  wcagMapper: WcagMapper;
  groupingEngine: GroupingEngine;
  findingDrafter: FindingDrafter;
  proposalReviewService: Pick<GroupProposalReviewService, 'persistProposals'>;
}

export function createAssessmentPreparationStages(
  assessmentInput: RawPageAssessment,
  repository: ReviewRepository & ProposalReviewRepository,
  overrides: Partial<Omit<AssessmentPreparationStages, 'proposalReviewService'>> = {},
): AssessmentPreparationStages {
  const assessment = rawPageAssessmentSchema.parse(assessmentInput);
  const timestamp = assessment.completedAt;
  const clock = () => new Date(timestamp);
  const findingDrafter = overrides.findingDrafter ?? new DeterministicFindingDrafter({ clock });
  const proposalReviewService = new GroupProposalReviewService(repository, findingDrafter, {
    clock,
  });

  return {
    normalizer:
      overrides.normalizer ??
      new DeterministicObservationNormalizer({
        clock,
        idFactory: (recordType, context) =>
          stableId(recordType, [
            assessment.page.assessmentId,
            context.evidenceId,
            context.sourceRuleId,
            String(context.index),
          ]),
      }),
    wcagMapper:
      overrides.wcagMapper ??
      new EvidenceBasedWcagMapper(new JsonWcagKnowledge(), {
        clock,
        idFactory: (context) =>
          stableId('wcag-evaluation', [
            assessment.page.assessmentId,
            context.observationId,
            context.criterionId ?? 'unknown',
            String(context.index),
          ]),
      }),
    groupingEngine: overrides.groupingEngine ?? new ConservativeGroupingEngine({ clock }),
    findingDrafter,
    proposalReviewService,
  };
}

export function prepareAssessmentForReview(
  assessmentInput: RawPageAssessment,
  stages: AssessmentPreparationStages,
): AssessmentPreparationCounts {
  const assessment = rawPageAssessmentSchema.parse(assessmentInput);
  if (assessment.operationalResult.status !== 'loaded') {
    throw new Error(
      `Cannot prepare an assessment with operational status ${assessment.operationalResult.status}.`,
    );
  }

  const evidence = assessmentEvidence(assessment);
  const normalized = stages.normalizer.normalize({ page: assessment.page, evidence });
  const wcagEvaluations = normalized.observations.flatMap((observation) =>
    stages.wcagMapper.evaluate(observation),
  );
  const groups = stages.groupingEngine.propose(normalized.observations, normalized.occurrences, {
    pages: [assessment.page],
  });
  const proposals = groups.map((group) => {
    const context = contextForGroup(group, {
      observations: normalized.observations,
      occurrences: normalized.occurrences,
      wcagEvaluations,
      pages: [assessment.page],
      evidence,
    });
    return { proposal: group, ...context };
  });
  stages.proposalReviewService.persistProposals(proposals);

  return {
    observations: normalized.observations.length,
    occurrences: normalized.occurrences.length,
    wcagEvaluations: wcagEvaluations.length,
    supportedWcagEvaluations: wcagEvaluations.filter(
      (evaluation) => evaluation.evaluation === 'supported',
    ).length,
    unsupportedWcagEvaluations: wcagEvaluations.filter(
      (evaluation) => evaluation.evaluation === 'unsupported',
    ).length,
    uncertainWcagEvaluations: wcagEvaluations.filter(
      (evaluation) => evaluation.evaluation === 'uncertain',
    ).length,
    groupingProposals: groups.length,
    ineligibleGroupingProposals: groups.length,
    persistedProposals: groups.length,
    draftFindings: 0,
    persistedReviewBundles: 0,
    ignoredNormalizationInputs: normalized.ignoredEvidence.length,
    unrecognizedRules: normalized.unrecognizedRules.length,
  };
}

function assessmentEvidence(assessment: RawPageAssessment): Evidence[] {
  return [
    assessment.browserEvidence,
    ...(assessment.scannerEvidence === null ? [] : [assessment.scannerEvidence]),
    ...assessment.accessibilityEvidence,
  ];
}

function contextForGroup(
  group: GroupProposal,
  context: FindingEvidenceContext,
): FindingEvidenceContext {
  const observationIds = new Set(group.memberObservationIds);
  const occurrenceIds = new Set(group.memberOccurrenceIds);
  const pageIds = new Set(group.pageIds);
  const evidenceIds = new Set(group.evidenceIds);
  return {
    observations: context.observations.filter((record) => observationIds.has(record.id)),
    occurrences: context.occurrences.filter((record) => occurrenceIds.has(record.id)),
    wcagEvaluations: context.wcagEvaluations.filter((record) =>
      observationIds.has(record.observationId),
    ),
    pages: context.pages.filter((record) => pageIds.has(record.id)),
    evidence: context.evidence.filter((record) => evidenceIds.has(record.id)),
  };
}

function stableId(prefix: string, parts: readonly string[]): string {
  return `${prefix}-${digest(parts.join('\u0000')).slice(0, 24)}`;
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
