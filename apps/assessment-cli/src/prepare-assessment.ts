import { createHash } from 'node:crypto';

import {
  DeterministicFindingDrafter,
  FindingReviewService,
  type FindingDrafter,
  type FindingEvidenceContext,
} from '@accessledger/findings';
import { ConservativeGroupingEngine, type GroupingEngine } from '@accessledger/grouping';
import {
  DeterministicObservationNormalizer,
  type ObservationNormalizer,
} from '@accessledger/observations';
import type { ReviewRepository } from '@accessledger/persistence';
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
  ignoredNormalizationInputs: number;
  unrecognizedRules: number;
}

export interface AssessmentPreparationStages {
  normalizer: ObservationNormalizer;
  wcagMapper: WcagMapper;
  groupingEngine: GroupingEngine;
  findingDrafter: FindingDrafter;
  reviewService: Pick<FindingReviewService, 'createReview' | 'listFindingIds'>;
}

export function createAssessmentPreparationStages(
  assessmentInput: RawPageAssessment,
  repository: ReviewRepository,
  overrides: Partial<Omit<AssessmentPreparationStages, 'reviewService'>> = {},
): AssessmentPreparationStages {
  const assessment = rawPageAssessmentSchema.parse(assessmentInput);
  const timestamp = assessment.completedAt;
  const clock = () => new Date(timestamp);
  const assessmentDigest = digest(JSON.stringify(assessment));
  let auditIdSequence = 0;

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
    findingDrafter: overrides.findingDrafter ?? new DeterministicFindingDrafter({ clock }),
    reviewService: new FindingReviewService(repository, {
      clock,
      idFactory: () => {
        auditIdSequence += 1;
        return stableId('preparation', [assessmentDigest, String(auditIdSequence)]);
      },
    }),
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
  const eligibleDrafts = groups.flatMap((group) => {
    const context = contextForGroup(group, {
      observations: normalized.observations,
      occurrences: normalized.occurrences,
      wcagEvaluations,
      pages: [assessment.page],
      evidence,
    });
    try {
      return [{ finding: stages.findingDrafter.draft(group, context), group, context }];
    } catch (error) {
      if (isDraftIneligibility(error)) return [];
      throw error;
    }
  });

  const existingFindingIds = new Set(
    stages.reviewService.listFindingIds(assessment.page.assessmentId),
  );
  const duplicates = eligibleDrafts
    .map(({ finding }) => finding.id)
    .filter((findingId) => existingFindingIds.has(findingId));
  if (duplicates.length > 0) {
    throw new Error(
      `Review database already contains prepared Finding IDs: ${duplicates.join(', ')}.`,
    );
  }

  for (const { finding, group, context } of eligibleDrafts) {
    stages.reviewService.createReview(
      { finding, group, ...context },
      {
        actor: 'AccessLedger assessment preparation CLI',
        reason: 'Prepared from a saved RawPageAssessment through the existing pipeline.',
      },
    );
  }

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
    ineligibleGroupingProposals: groups.length - eligibleDrafts.length,
    draftFindings: eligibleDrafts.length,
    persistedReviewBundles: eligibleDrafts.length,
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

function isDraftIneligibility(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return [
    /^Cannot draft from a (rejected|split) proposal\.$/,
    /^Cannot draft from an ambiguous proposal\.$/,
    /^Drafting requires an accepted proposal or a pending high-confidence repeat candidate\.$/,
    /^A singleton proposal requires at least one supported WCAG criterion\.$/,
  ].some((pattern) => pattern.test(error.message));
}

function stableId(prefix: string, parts: readonly string[]): string {
  return `${prefix}-${digest(parts.join('\u0000')).slice(0, 24)}`;
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
