import { randomUUID } from 'node:crypto';

import {
  CONTRACT_SCHEMA_VERSION,
  findingSchema,
  reviewAuditEventSchema,
  validationSchema,
  type Evidence,
  type Finding,
  type GroupProposal,
  type ReviewAuditAction,
  type ReviewAuditEvent,
  type Severity,
  type Validation,
  type ValidationClaim,
} from '@accessledger/shared';
import type {
  GroupingDecisionRecord,
  ReviewBundleInput,
  ReviewRepository,
} from '@accessledger/persistence';
import { z } from 'zod';

import { assertValidFindingEvidenceContext } from './finding-drafter.js';
import type {
  AddFindingValidationInput,
  FindingEditPatch,
  FindingReviewTrace,
  ReviewActionContext,
} from './types.js';

const editableFindingPatchSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    condition: z.string().trim().min(1).optional(),
    cause: z.string().trim().min(1).nullable().optional(),
    effect: z.string().trim().min(1).nullable().optional(),
    recommendation: z.string().trim().min(1).nullable().optional(),
    confidence: z.enum(['low', 'medium', 'high']).nullable().optional(),
    wcagCriteria: z.array(z.string().regex(/^\d+\.\d+\.\d+$/)).optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, 'At least one editable field is required.');

const reviewActorSchema = z.string().trim().min(1);
const reviewReasonSchema = z.string().trim().min(1);

export interface FindingReviewServiceOptions {
  clock?: () => Date;
  idFactory?: () => string;
}

export class FindingReviewService {
  readonly #repository: ReviewRepository;
  readonly #clock: () => Date;
  readonly #idFactory: () => string;

  constructor(repository: ReviewRepository, options: FindingReviewServiceOptions = {}) {
    this.#repository = repository;
    this.#clock = options.clock ?? (() => new Date());
    this.#idFactory = options.idFactory ?? randomUUID;
  }

  createReview(input: ReviewBundleInput, context: ReviewActionContext): FindingReviewTrace {
    const actor = reviewActorSchema.parse(context.actor);
    if (input.finding.status !== 'draft')
      throw new Error('A review bundle must start from a draft.');
    assertCompleteTrace(input.finding, input.group, input);
    const occurredAt = this.#now();
    this.#repository.createReviewBundle(
      input,
      this.#event({
        input: input.finding,
        action: 'review_bundle_created',
        entityType: 'review_bundle',
        entityId: input.finding.id,
        actor,
        reason: context.reason ?? null,
        before: null,
        after: { findingId: input.finding.id, groupProposalId: input.group.id },
        occurredAt,
      }),
    );
    return this.loadCompleteTrace(input.finding.id);
  }

  loadCompleteTrace(findingId: string): FindingReviewTrace {
    const bundle = this.#repository.loadReviewBundle(findingId);
    if (bundle === null) throw new Error(`Finding ${findingId} is not in the review repository.`);
    assertCompleteTrace(bundle.finding, bundle.group, bundle);
    return {
      ...bundle,
      missingJudgmentFields: missingJudgmentFields(bundle.finding),
      approvalBlockers: approvalBlockers(bundle),
    };
  }

  listFindingIds(assessmentId?: string): string[] {
    return this.#repository.listFindingIds(assessmentId);
  }

  startReview(findingId: string, context: ReviewActionContext): FindingReviewTrace {
    const trace = this.loadCompleteTrace(findingId);
    if (trace.finding.status !== 'draft') {
      throw new Error('Only a draft Finding can enter review.');
    }
    return this.#changeFinding(
      trace,
      { ...trace.finding, status: 'in_review', updatedAt: this.#now() },
      'review_started',
      context,
    );
  }

  decideGrouping(
    findingId: string,
    status: 'accepted' | 'rejected' | 'split',
    context: ReviewActionContext,
  ): FindingReviewTrace {
    const trace = this.#requireInReview(findingId);
    const actor = reviewActorSchema.parse(context.actor);
    const reason = reviewReasonSchema.parse(context.reason);
    const decidedAt = this.#now();
    const after = { ...trace.group, reviewStatus: status, updatedAt: decidedAt };
    const decision: GroupingDecisionRecord = {
      id: `group-decision-${this.#idFactory()}`,
      findingId,
      groupProposalId: trace.group.id,
      status,
      actor,
      reason,
      decidedAt,
    };
    this.#repository.commitGroupingDecision(
      decision,
      this.#event({
        input: trace.finding,
        action: 'grouping_decided',
        entityType: 'group_proposal',
        entityId: trace.group.id,
        actor,
        reason,
        before: trace.group,
        after,
        occurredAt: decidedAt,
      }),
    );
    return this.loadCompleteTrace(findingId);
  }

  editFinding(
    findingId: string,
    patchInput: FindingEditPatch,
    context: ReviewActionContext,
  ): FindingReviewTrace {
    const trace = this.#requireInReview(findingId);
    const patch = editableFindingPatchSchema.parse(patchInput);
    if (patch.wcagCriteria !== undefined) {
      const uniqueCriteria = new Set(patch.wcagCriteria);
      if (uniqueCriteria.size !== patch.wcagCriteria.length) {
        throw new Error('WCAG criteria must be unique.');
      }
      const reviewableCriteria = new Set(
        trace.wcagEvaluations.flatMap((evaluation) =>
          evaluation.criterionId === null ? [] : [evaluation.criterionId],
        ),
      );
      for (const criterion of patch.wcagCriteria) {
        if (!reviewableCriteria.has(criterion)) {
          throw new Error(`WCAG criterion ${criterion} is not present in the source candidates.`);
        }
      }
    }
    const next = findingSchema.parse({ ...trace.finding, ...patch, updatedAt: this.#now() });
    return this.#changeFinding(trace, next, 'finding_edited', context);
  }

  addValidation(
    findingId: string,
    input: AddFindingValidationInput,
    context: ReviewActionContext,
  ): FindingReviewTrace {
    const trace = this.#requireInReview(findingId);
    const actor = reviewActorSchema.parse(context.actor);
    const performedAt = input.performedAt ?? this.#now();
    if (input.supportingEvidence.length === 0) {
      throw new Error('A Validation requires supporting human Evidence.');
    }
    const evidenceIds = input.supportingEvidence.map((evidence) => evidence.id);
    if (evidenceIds.length !== new Set(evidenceIds).size) {
      throw new Error('Supporting Evidence IDs must be unique.');
    }
    for (const evidence of input.supportingEvidence) {
      if (
        evidence.assessmentId !== trace.finding.assessmentId ||
        evidence.source.type !== 'human' ||
        !['human_note', 'interaction_trace', 'screenshot'].includes(evidence.kind)
      ) {
        throw new Error('Validation support must be human Evidence in the same assessment.');
      }
    }
    const validation = validationSchema.parse({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      id: `validation-${this.#idFactory()}`,
      assessmentId: trace.finding.assessmentId,
      subject: { type: 'finding', id: findingId },
      method: input.method,
      outcome: input.outcome,
      claims: [...input.claims],
      validatedSeverity: input.validatedSeverity,
      performedBy: input.performedBy,
      performedAt,
      assistiveTechnology: input.assistiveTechnology,
      notes: input.notes,
      evidenceIds,
    });
    const validationStatus = deriveValidationStatus([...trace.validations, validation]);
    const next = findingSchema.parse({
      ...trace.finding,
      validationStatus,
      updatedAt: performedAt,
    });
    this.#repository.commitValidation(
      trace.finding,
      next,
      validation,
      input.supportingEvidence,
      this.#event({
        input: trace.finding,
        action: 'validation_added',
        entityType: 'validation',
        entityId: validation.id,
        actor,
        reason: context.reason ?? null,
        before: null,
        after: validation,
        occurredAt: performedAt,
      }),
    );
    return this.loadCompleteTrace(findingId);
  }

  assignSeverity(
    findingId: string,
    severity: Severity,
    context: ReviewActionContext,
  ): FindingReviewTrace {
    const trace = this.#requireInReview(findingId);
    const supported = trace.validations.some(
      (validation) =>
        validation.outcome === 'supported' &&
        validation.claims.includes('severity') &&
        validation.validatedSeverity === severity &&
        validation.evidenceIds.length > 0,
    );
    if (!supported) {
      throw new Error(`Severity ${severity} lacks a matching supported human Validation.`);
    }
    const next = findingSchema.parse({ ...trace.finding, severity, updatedAt: this.#now() });
    return this.#changeFinding(trace, next, 'severity_assigned', context);
  }

  approve(findingId: string, context: ReviewActionContext): FindingReviewTrace {
    const trace = this.#requireInReview(findingId);
    const blockers = approvalBlockers(trace);
    if (blockers.length > 0) {
      throw new Error(`Finding cannot be approved: ${blockers.join('; ')}`);
    }
    return this.#changeFinding(
      trace,
      { ...trace.finding, status: 'approved', updatedAt: this.#now() },
      'finding_approved',
      context,
    );
  }

  reject(findingId: string, context: ReviewActionContext): FindingReviewTrace {
    const trace = this.#requireInReview(findingId);
    reviewReasonSchema.parse(context.reason);
    return this.#changeFinding(
      trace,
      { ...trace.finding, status: 'rejected', updatedAt: this.#now() },
      'finding_rejected',
      context,
    );
  }

  #requireInReview(findingId: string): FindingReviewTrace {
    const trace = this.loadCompleteTrace(findingId);
    if (trace.finding.status !== 'in_review') {
      throw new Error('This operation requires a Finding with status in_review.');
    }
    return trace;
  }

  #changeFinding(
    trace: FindingReviewTrace,
    nextInput: Finding,
    action: ReviewAuditAction,
    context: ReviewActionContext,
  ): FindingReviewTrace {
    const next = findingSchema.parse(nextInput);
    const actor = reviewActorSchema.parse(context.actor);
    this.#repository.commitFinding(
      trace.finding,
      next,
      this.#event({
        input: trace.finding,
        action,
        entityType: 'finding',
        entityId: trace.finding.id,
        actor,
        reason: context.reason ?? null,
        before: trace.finding,
        after: next,
        occurredAt: next.updatedAt,
      }),
    );
    return this.loadCompleteTrace(trace.finding.id);
  }

  #event(details: {
    input: Finding;
    action: ReviewAuditAction;
    entityType: ReviewAuditEvent['entityType'];
    entityId: string;
    actor: string;
    reason: string | null;
    before: unknown;
    after: unknown;
    occurredAt: string;
  }): ReviewAuditEvent {
    return reviewAuditEventSchema.parse({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      id: `review-event-${this.#idFactory()}`,
      assessmentId: details.input.assessmentId,
      findingId: details.input.id,
      entityType: details.entityType,
      entityId: details.entityId,
      action: details.action,
      actor: details.actor,
      reason: details.reason,
      before: details.before,
      after: details.after,
      occurredAt: details.occurredAt,
    });
  }

  #now(): string {
    return this.#clock().toISOString();
  }
}

export function assertCompleteTrace(
  finding: Finding,
  group: GroupProposal,
  context: {
    observations: readonly FindingReviewTrace['observations'][number][];
    occurrences: readonly FindingReviewTrace['occurrences'][number][];
    wcagEvaluations: readonly FindingReviewTrace['wcagEvaluations'][number][];
    pages: readonly FindingReviewTrace['pages'][number][];
    evidence: readonly Evidence[];
  },
): void {
  if (
    finding.assessmentId !== group.assessmentId ||
    finding.sourceGroupProposalId !== group.id ||
    finding.occurrenceCount !== group.members.length ||
    !sameIds(finding.observationIds, group.memberObservationIds) ||
    !sameIds(finding.evidenceIds, group.evidenceIds)
  ) {
    throw new Error('Finding-to-GroupProposal traceability is broken.');
  }
  const groupEvidence = context.evidence.filter((record) => group.evidenceIds.includes(record.id));
  assertValidFindingEvidenceContext(group, { ...context, evidence: groupEvidence });
  const pageById = new Map(context.pages.map((page) => [page.id, page]));
  const expectedUrls = unique(
    group.members.map((member) => {
      const page = pageById.get(member.pageId);
      if (page === undefined) throw new Error(`Trace is missing Page ${member.pageId}.`);
      return page.finalUrl ?? page.requestedUrl;
    }),
  );
  if (!sameIds(finding.affectedUrls, expectedUrls)) {
    throw new Error('Finding affected URLs do not match its GroupProposal trace.');
  }
  const occurrenceById = new Map(
    context.occurrences.map((occurrence) => [occurrence.id, occurrence]),
  );
  const expectedComponents = unique(
    group.members.map((member) => {
      const occurrence = occurrenceById.get(member.occurrenceId);
      if (occurrence === undefined) {
        throw new Error(`Trace is missing ObservationOccurrence ${member.occurrenceId}.`);
      }
      if (occurrence.componentFingerprint !== null) {
        return `fingerprint:${occurrence.componentFingerprint}`;
      }
      if (occurrence.selector !== null) return `selector:${occurrence.selector}`;
      if (occurrence.htmlSnippet !== null) return `markup:${occurrence.htmlSnippet}`;
      return `occurrence:${occurrence.id} (source locator unavailable)`;
    }),
  );
  if (!sameIds(finding.affectedComponents, expectedComponents)) {
    throw new Error('Finding affected components do not match its occurrence trace.');
  }
}

export function assertExportableApprovedTrace(trace: FindingReviewTrace): void {
  assertCompleteTrace(trace.finding, trace.group, trace);
  const finding = trace.finding;
  if (finding.status !== 'approved') {
    throw new Error(`Finding ${finding.id} is not approved and cannot be exported.`);
  }
  if (trace.group.reviewStatus !== 'accepted') {
    throw new Error(`Approved Finding ${finding.id} does not have an accepted source group.`);
  }
  const missing = missingJudgmentFields(finding);
  if (missing.length > 0) {
    throw new Error(`Approved Finding ${finding.id} is incomplete: ${missing.join(', ')}.`);
  }
  if (finding.validationStatus !== 'validated') {
    throw new Error(`Approved Finding ${finding.id} does not have validated review status.`);
  }

  const evidenceById = new Map(trace.evidence.map((evidence) => [evidence.id, evidence]));
  const validSupportedClaims = new Set<ValidationClaim>();
  for (const validation of trace.validations) {
    if (validation.subject.type === 'observation') {
      throw new Error(`Finding ${finding.id} has an unsupported Validation subject.`);
    }
    if (validation.subject.type === 'finding' && validation.subject.id !== finding.id) {
      throw new Error(`Finding ${finding.id} has a Validation linked to another Finding.`);
    }
    if (
      validation.subject.type === 'journey_result' &&
      !trace.journeyResults.some((result) => result.id === validation.subject.id)
    ) {
      throw new Error(
        `Finding ${finding.id} has a Validation linked to an unrecorded journey result.`,
      );
    }
    if (validation.evidenceIds.length === 0) {
      throw new Error(`Finding ${finding.id} has a Validation without supporting Evidence.`);
    }
    for (const evidenceId of validation.evidenceIds) {
      const evidence = evidenceById.get(evidenceId);
      if (
        evidence === undefined ||
        evidence.assessmentId !== finding.assessmentId ||
        evidence.source.type !== 'human'
      ) {
        throw new Error(`Finding ${finding.id} has a Validation with invalid human Evidence.`);
      }
    }
    if (validation.outcome === 'supported') {
      for (const claim of validation.claims) validSupportedClaims.add(claim);
    }
  }

  const requiredClaims: ValidationClaim[] = [
    'grouping',
    'condition',
    'cause',
    'effect',
    'recommendation',
    'severity',
  ];
  if (finding.wcagCriteria.length > 0) requiredClaims.push('wcag');
  const missingClaims = requiredClaims.filter((claim) => !validSupportedClaims.has(claim));
  if (missingClaims.length > 0) {
    throw new Error(
      `Approved Finding ${finding.id} lacks supported human Validation for: ${missingClaims.join(', ')}.`,
    );
  }
  if (
    finding.severity === null ||
    !trace.validations.some(
      (validation) =>
        validation.outcome === 'supported' &&
        validation.claims.includes('severity') &&
        validation.validatedSeverity === finding.severity &&
        validation.evidenceIds.length > 0,
    )
  ) {
    throw new Error(`Approved Finding ${finding.id} lacks exact supported severity Validation.`);
  }
}

function approvalBlockers(trace: {
  finding: Finding;
  group: GroupProposal;
  validations: readonly Validation[];
  wcagEvaluations: FindingReviewTrace['wcagEvaluations'];
}): string[] {
  if (trace.finding.status === 'approved' || trace.finding.status === 'rejected') return [];
  const blockers: string[] = [];
  if (trace.finding.status !== 'in_review') blockers.push('finding is not in_review');
  if (trace.group.reviewStatus !== 'accepted') blockers.push('grouping is unresolved');
  for (const field of missingJudgmentFields(trace.finding)) {
    blockers.push(`${field} is missing`);
  }
  const requiredClaims: ValidationClaim[] = [
    'grouping',
    'condition',
    'cause',
    'effect',
    'recommendation',
    'severity',
  ];
  if (trace.finding.wcagCriteria.length > 0) requiredClaims.push('wcag');
  const supportedClaims = new Set(
    trace.validations.flatMap((validation) =>
      validation.outcome === 'supported' ? validation.claims : [],
    ),
  );
  for (const claim of requiredClaims) {
    if (!supportedClaims.has(claim)) blockers.push(`${claim} lacks supported human validation`);
  }
  if (
    trace.finding.severity !== null &&
    !trace.validations.some(
      (validation) =>
        validation.outcome === 'supported' &&
        validation.validatedSeverity === trace.finding.severity,
    )
  ) {
    blockers.push('assigned severity lacks exact supporting human validation');
  }
  for (const criterion of trace.finding.wcagCriteria) {
    const deterministicSupport = trace.finding.observationIds.every((observationId) =>
      trace.wcagEvaluations.some(
        (evaluation) =>
          evaluation.observationId === observationId &&
          evaluation.criterionId === criterion &&
          evaluation.evaluation === 'supported',
      ),
    );
    if (!deterministicSupport && !supportedClaims.has('wcag')) {
      blockers.push(`WCAG criterion ${criterion} lacks source or human support`);
    }
  }
  return unique(blockers);
}

function missingJudgmentFields(finding: Finding): string[] {
  return (['cause', 'effect', 'recommendation', 'severity', 'confidence'] as const).filter(
    (field) => finding[field] === null,
  );
}

function deriveValidationStatus(validations: readonly Validation[]): Finding['validationStatus'] {
  if (validations.some((validation) => validation.outcome === 'supported')) return 'validated';
  if (validations.some((validation) => validation.outcome === 'inconclusive'))
    return 'inconclusive';
  return 'in_progress';
}

function sameIds(actual: readonly string[], expected: readonly string[]): boolean {
  return (
    actual.length === expected.length && actual.every((value, index) => value === expected[index])
  );
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
