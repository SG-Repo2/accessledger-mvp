import { createHash } from 'node:crypto';

import {
  CONTRACT_SCHEMA_VERSION,
  evidenceSchema,
  findingSchema,
  groupProposalSchema,
  observationOccurrenceSchema,
  observationSchema,
  pageSchema,
  wcagCandidateEvaluationSchema,
  type Evidence,
  type Finding,
  type GroupProposal,
  type Observation,
  type ObservationOccurrence,
  type Page,
  type WcagCandidateEvaluation,
} from '@accessledger/shared';

import type { FindingDrafter, FindingDrafterOptions, FindingEvidenceContext } from './types.js';

export const FINDING_DRAFTING_POLICY_VERSION = '1.0.0' as const;

interface ValidatedContext {
  observations: Observation[];
  occurrences: ObservationOccurrence[];
  wcagEvaluations: WcagCandidateEvaluation[];
  pages: Page[];
  evidence: Evidence[];
}

export class DeterministicFindingDrafter implements FindingDrafter {
  readonly #clock: () => Date;

  constructor(options: FindingDrafterOptions = {}) {
    this.#clock = options.clock ?? (() => new Date());
  }

  draft(groupInput: GroupProposal, evidenceContext: FindingEvidenceContext): Finding {
    const group = groupProposalSchema.parse(groupInput);
    assertEligibleReviewState(group);
    const context = validateContext(group, evidenceContext);
    const supportedCriteria = supportedCriteriaForAllObservations(
      group.memberObservationIds,
      context.wcagEvaluations,
    );

    if (group.kind === 'singleton' && supportedCriteria.length === 0) {
      throw new Error('A singleton proposal requires at least one supported WCAG criterion.');
    }

    const observationById = indexById(context.observations);
    const occurrenceById = indexById(context.occurrences);
    const pageById = indexById(context.pages);
    const firstObservation = observationById.get(group.memberObservationIds[0]!)!;
    const affectedUrls = unique(
      group.members.map((member) => {
        const page = pageById.get(member.pageId)!;
        return page.finalUrl ?? page.requestedUrl;
      }),
    );
    const affectedComponents = unique(
      group.members.map((member) => componentDescription(occurrenceById.get(member.occurrenceId)!)),
    );
    const timestamp = this.#clock().toISOString();
    const hasUnresolvedWcag = context.wcagEvaluations.some(
      (evaluation) =>
        evaluation.criterionId === null ||
        evaluation.evaluation !== 'supported' ||
        !supportedCriteria.includes(evaluation.criterionId),
    );

    return findingSchema.parse({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      id: stableFindingId(group.id),
      assessmentId: group.assessmentId,
      sourceGroupProposalId: group.id,
      title: `Review ${humanize(firstObservation.category)} evidence`,
      status: 'draft',
      wcagCriteria: supportedCriteria,
      condition: conditionFor(firstObservation, group.members.length, affectedUrls.length),
      cause: null,
      effect: null,
      recommendation: null,
      severity: null,
      confidence: null,
      validationStatus: 'required',
      validationNeed: hasUnresolvedWcag
        ? 'Human review is required to verify the grouped condition and affected scope and to resolve candidate WCAG mappings before this draft can advance.'
        : 'Human review is required to verify the grouped condition, affected scope, and supported WCAG mapping before this draft can advance.',
      affectedUrls,
      affectedComponents,
      affectedJourneys: [],
      occurrenceCount: group.members.length,
      observationIds: [...group.memberObservationIds],
      evidenceIds: [...group.evidenceIds],
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }
}

function assertEligibleReviewState(group: GroupProposal): void {
  if (group.reviewStatus === 'rejected' || group.reviewStatus === 'split') {
    throw new Error(`Cannot draft from a ${group.reviewStatus} proposal.`);
  }
  if (group.kind === 'ambiguous') {
    throw new Error('Cannot draft from an ambiguous proposal.');
  }
  if (group.reviewStatus === 'accepted') return;
  if (
    group.reviewStatus === 'pending' &&
    group.kind === 'repeat_candidate' &&
    group.groupingConfidence === 'high'
  ) {
    return;
  }
  throw new Error(
    'Drafting requires an accepted proposal or a pending high-confidence repeat candidate.',
  );
}

function validateContext(
  group: GroupProposal,
  contextInput: FindingEvidenceContext,
): ValidatedContext {
  const context: ValidatedContext = {
    observations: contextInput.observations.map((record) => observationSchema.parse(record)),
    occurrences: contextInput.occurrences.map((record) =>
      observationOccurrenceSchema.parse(record),
    ),
    wcagEvaluations: contextInput.wcagEvaluations.map((record) =>
      wcagCandidateEvaluationSchema.parse(record),
    ),
    pages: contextInput.pages.map((record) => pageSchema.parse(record)),
    evidence: contextInput.evidence.map((record) => evidenceSchema.parse(record)),
  };

  assertUniqueIds(context.observations, 'Observation');
  assertUniqueIds(context.occurrences, 'ObservationOccurrence');
  assertUniqueIds(context.wcagEvaluations, 'WcagCandidateEvaluation');
  assertUniqueIds(context.pages, 'Page');
  assertUniqueIds(context.evidence, 'Evidence');
  assertExactIds(
    context.observations.map((record) => record.id),
    group.memberObservationIds,
    'Observation',
  );
  assertExactIds(
    context.occurrences.map((record) => record.id),
    group.memberOccurrenceIds,
    'ObservationOccurrence',
  );
  assertExactIds(
    context.pages.map((record) => record.id),
    group.pageIds,
    'Page',
  );
  assertExactIds(
    context.evidence.map((record) => record.id),
    group.evidenceIds,
    'Evidence',
  );

  const observationById = indexById(context.observations);
  const occurrenceById = indexById(context.occurrences);
  const pageById = indexById(context.pages);
  const evidenceById = indexById(context.evidence);
  const issueKeys = new Set(context.observations.map(issueKey));
  if (issueKeys.size !== 1) {
    throw new Error('Group members do not share one source issue.');
  }

  for (const record of [
    ...context.observations,
    ...context.occurrences,
    ...context.wcagEvaluations,
    ...context.pages,
    ...context.evidence,
  ]) {
    if (record.assessmentId !== group.assessmentId) {
      throw new Error(`${record.id} crosses the GroupProposal assessment boundary.`);
    }
  }

  for (const member of group.members) {
    const observation = observationById.get(member.observationId)!;
    const occurrence = occurrenceById.get(member.occurrenceId)!;
    if (
      occurrence.observationId !== observation.id ||
      occurrence.pageId !== member.pageId ||
      !pageById.has(member.pageId)
    ) {
      throw new Error(`Group member ${member.occurrenceId} has broken record references.`);
    }
    const sourceEvidenceIds = unique([
      ...observation.evidenceIds,
      ...occurrence.evidenceIds,
    ]).sort();
    if (!sameIds(sourceEvidenceIds, member.evidenceIds)) {
      throw new Error(`Group member ${member.occurrenceId} has a mismatched Evidence ledger.`);
    }
  }

  const evaluationKeys = new Set<string>();
  const evaluatedObservationIds = new Set<string>();
  for (const evaluation of context.wcagEvaluations) {
    if (!observationById.has(evaluation.observationId)) {
      throw new Error(
        `WCAG evaluation ${evaluation.id} references an unrelated Observation ${evaluation.observationId}.`,
      );
    }
    const evaluationKey = `${evaluation.observationId}\u0000${evaluation.criterionId ?? '(unknown)'}`;
    if (evaluationKeys.has(evaluationKey)) {
      throw new Error(`Duplicate WCAG evaluation target for ${evaluation.observationId}.`);
    }
    evaluationKeys.add(evaluationKey);
    evaluatedObservationIds.add(evaluation.observationId);
    for (const evidenceId of evaluation.evidenceIds) {
      if (!evidenceById.has(evidenceId)) {
        throw new Error(
          `WCAG evaluation ${evaluation.id} references missing Evidence ${evidenceId}.`,
        );
      }
    }
    for (const requirement of evaluation.requirementEvaluations) {
      for (const evidenceId of requirement.evidenceIds) {
        if (!evidenceById.has(evidenceId)) {
          throw new Error(
            `WCAG evaluation ${evaluation.id} requirement ${requirement.requirementId} references missing Evidence ${evidenceId}.`,
          );
        }
      }
    }
  }
  assertExactIds([...evaluatedObservationIds], group.memberObservationIds, 'evaluated Observation');

  for (const evidence of context.evidence) {
    if (evidence.pageId !== null && !pageById.has(evidence.pageId)) {
      throw new Error(`Evidence ${evidence.id} references a Page outside the group.`);
    }
  }

  return context;
}

function supportedCriteriaForAllObservations(
  observationIds: string[],
  evaluations: WcagCandidateEvaluation[],
): string[] {
  const criterionIds = unique(
    evaluations.flatMap((evaluation) =>
      evaluation.criterionId === null ? [] : [evaluation.criterionId],
    ),
  );
  return criterionIds
    .filter((criterionId) =>
      observationIds.every((observationId) =>
        evaluations.some(
          (evaluation) =>
            evaluation.observationId === observationId &&
            evaluation.criterionId === criterionId &&
            evaluation.evaluation === 'supported',
        ),
      ),
    )
    .sort();
}

function stableFindingId(groupProposalId: string): string {
  const digest = createHash('sha256')
    .update(FINDING_DRAFTING_POLICY_VERSION)
    .update('\u0000')
    .update(groupProposalId)
    .digest('hex')
    .slice(0, 24);
  return `finding-${digest}`;
}

function conditionFor(observation: Observation, occurrenceCount: number, urlCount: number): string {
  const occurrenceNoun = occurrenceCount === 1 ? 'occurrence' : 'occurrences';
  const urlNoun = urlCount === 1 ? 'URL' : 'URLs';
  const sourceRule = observation.sourceRuleId
    ? `rule "${observation.sourceRuleId}" (${humanize(observation.category)})`
    : `the ${humanize(observation.category)} category`;
  return `Collected ${observation.source.name} evidence records ${occurrenceCount} ${occurrenceNoun} for ${sourceRule} across ${urlCount} inspected ${urlNoun}.`;
}

function componentDescription(occurrence: ObservationOccurrence): string {
  if (occurrence.componentFingerprint !== null) {
    return `fingerprint:${occurrence.componentFingerprint}`;
  }
  if (occurrence.selector !== null) return `selector:${occurrence.selector}`;
  if (occurrence.htmlSnippet !== null) return `markup:${occurrence.htmlSnippet}`;
  return `occurrence:${occurrence.id} (component locator unavailable)`;
}

function humanize(value: string): string {
  return value.normalize('NFKC').trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

function issueKey(observation: Observation): string {
  return [
    observation.source.type,
    observation.source.name,
    observation.source.version ?? '',
    observation.sourceRuleId ?? '',
    observation.category,
  ].join('\u0000');
}

function assertUniqueIds(records: Array<{ id: string }>, label: string): void {
  const seen = new Set<string>();
  for (const record of records) {
    if (seen.has(record.id)) throw new Error(`${label} ID ${record.id} is duplicated.`);
    seen.add(record.id);
  }
}

function assertExactIds(actual: string[], expected: string[], label: string): void {
  if (!sameIds(actual, expected)) {
    throw new Error(`${label} context must exactly match the GroupProposal references.`);
  }
}

function sameIds(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    [...left].sort().join('\u0000') === [...right].sort().join('\u0000')
  );
}

function indexById<T extends { id: string }>(records: T[]): Map<string, T> {
  return new Map(records.map((record) => [record.id, record]));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
