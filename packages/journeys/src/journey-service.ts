import { randomUUID } from 'node:crypto';

import type { JourneyRepository, ReviewRepository } from '@accessledger/persistence';
import {
  CONTRACT_SCHEMA_VERSION,
  evidenceSchema,
  findingSchema,
  journeyAuditEventSchema,
  journeyEnvironmentSchema,
  journeyOutcomeSchema,
  journeyResultSchema,
  residentJourneySchema,
  reviewAuditEventSchema,
  validationSchema,
  type Evidence,
  type Finding,
  type JourneyAuditAction,
  type JourneyAuditEvent,
  type JourneyResult,
  type ResidentJourney,
  type ReviewAuditEvent,
  type Validation,
} from '@accessledger/shared';
import { z } from 'zod';

import type {
  AddJourneyResultValidationInput,
  CreateResidentJourneyInput,
  JourneyActionContext,
  RecordJourneyResultInput,
  ResidentJourneyEditPatch,
  ResidentJourneyTrace,
} from './types.js';

const actorSchema = z.string().trim().min(1);
const reasonSchema = z.string().trim().min(1).nullable().optional();
const createSchema = z.object({
  id: z.string().trim().min(1).optional(),
  assessmentId: z.string().trim().min(1),
  goal: z.string().trim().min(1),
  startingUrl: z.url(),
  preconditions: z.array(z.string().trim().min(1)),
  humanTask: z.string().trim().min(1),
  expectedObservableOutcome: z.string().trim().min(1),
  relatedFindingIds: z.array(z.string().trim().min(1)),
});
const editSchema = createSchema
  .omit({ id: true, assessmentId: true })
  .partial()
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, 'At least one journey field is required.');
const resultSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    outcome: journeyOutcomeSchema,
    environment: journeyEnvironmentSchema,
    nvdaResult: z.string().trim().min(1).nullable(),
    performedBy: z.string().trim().min(1),
    startedAt: z.iso.datetime({ offset: true }),
    completedAt: z.iso.datetime({ offset: true }).nullable(),
    notes: z.string().trim().min(1).nullable(),
    relatedFindingIds: z.array(z.string().trim().min(1)),
    supportingEvidence: z.array(z.custom<Evidence>()).min(1),
  })
  .strict();

export interface ResidentJourneyServiceOptions {
  clock?: () => Date;
  idFactory?: () => string;
}

type CombinedRepository = JourneyRepository & ReviewRepository;

export class ResidentJourneyService {
  readonly #repository: CombinedRepository;
  readonly #clock: () => Date;
  readonly #idFactory: () => string;

  constructor(repository: CombinedRepository, options: ResidentJourneyServiceOptions = {}) {
    this.#repository = repository;
    this.#clock = options.clock ?? (() => new Date());
    this.#idFactory = options.idFactory ?? randomUUID;
  }

  createProtocol(
    inputValue: CreateResidentJourneyInput,
    context: JourneyActionContext,
  ): ResidentJourneyTrace {
    const input = createSchema.parse(inputValue);
    const actor = actorSchema.parse(context.actor);
    const occurredAt = this.#now();
    const journey = residentJourneySchema.parse({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      id: input.id ?? `journey-${this.#idFactory()}`,
      assessmentId: input.assessmentId,
      goal: input.goal,
      startingUrl: input.startingUrl,
      preconditions: input.preconditions,
      humanTask: input.humanTask,
      expectedObservableOutcome: input.expectedObservableOutcome,
      relatedFindingIds: input.relatedFindingIds,
      createdAt: occurredAt,
      updatedAt: occurredAt,
    });
    this.#repository.createJourney(
      journey,
      this.#journeyEvent(
        journey,
        'journey_created',
        'resident_journey',
        journey.id,
        actor,
        context.reason ?? null,
        null,
        journey,
        occurredAt,
      ),
    );
    return this.loadProtocol(journey.id);
  }

  editProtocol(
    journeyId: string,
    patchValue: ResidentJourneyEditPatch,
    context: JourneyActionContext,
  ): ResidentJourneyTrace {
    const current = this.#requireJourney(journeyId);
    const patch = editSchema.parse(patchValue);
    const actor = actorSchema.parse(context.actor);
    const updatedAt = this.#now();
    const next = residentJourneySchema.parse({ ...current, ...patch, updatedAt });
    this.#repository.updateJourney(
      current,
      next,
      this.#journeyEvent(
        current,
        'journey_edited',
        'resident_journey',
        current.id,
        actor,
        context.reason ?? null,
        current,
        next,
        updatedAt,
      ),
    );
    return this.loadProtocol(journeyId);
  }

  deleteProtocol(journeyId: string, context: JourneyActionContext): void {
    const journey = this.#requireJourney(journeyId);
    const actor = actorSchema.parse(context.actor);
    const reason = z.string().trim().min(1).parse(context.reason);
    const occurredAt = this.#now();
    this.#repository.deleteJourney(
      journey,
      this.#journeyEvent(
        journey,
        'journey_deleted',
        'resident_journey',
        journey.id,
        actor,
        reason,
        journey,
        { journeyId: journey.id, deleted: true },
        occurredAt,
      ),
    );
  }

  loadProtocol(journeyId: string): ResidentJourneyTrace {
    const journey = this.#requireJourney(journeyId);
    const results = this.#repository.listJourneyResults(journeyId);
    const evidenceById = new Map(
      results
        .flatMap((result) => this.#repository.loadJourneyResultEvidence(result.id))
        .map((evidence) => [evidence.id, evidence]),
    );
    return {
      journey,
      results,
      evidence: [...evidenceById.values()],
      auditHistory: this.#repository.loadJourneyAuditHistory(journeyId),
    };
  }

  listProtocols(assessmentId?: string): ResidentJourney[] {
    return this.#repository.listJourneys(assessmentId);
  }

  loadResult(resultId: string): JourneyResult {
    const result = this.#repository.loadJourneyResult(resultId);
    if (result === null) throw new Error(`JourneyResult ${resultId} does not exist.`);
    return result;
  }

  recordResult(
    journeyId: string,
    inputValue: RecordJourneyResultInput,
    context: JourneyActionContext,
  ): JourneyResult {
    const journey = this.#requireJourney(journeyId);
    const input = resultSchema.parse(inputValue);
    const actor = actorSchema.parse(context.actor);
    reasonSchema.parse(context.reason);
    const supportingEvidence = input.supportingEvidence.map((evidence) =>
      this.#assertHumanEvidence(evidence, journey.assessmentId),
    );
    const result = journeyResultSchema.parse({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      id: input.id ?? `journey-result-${this.#idFactory()}`,
      assessmentId: journey.assessmentId,
      journeyId,
      outcome: input.outcome,
      environment: input.environment,
      nvdaResult: input.nvdaResult,
      performedBy: input.performedBy,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      notes: input.notes,
      relatedFindingIds: input.relatedFindingIds,
      evidenceIds: supportingEvidence.map((record) => record.id),
    });
    const occurredAt = this.#now();
    this.#repository.recordJourneyResult(
      result,
      supportingEvidence,
      this.#journeyEvent(
        journey,
        'journey_result_recorded',
        'journey_result',
        result.id,
        actor,
        context.reason ?? null,
        null,
        result,
        occurredAt,
      ),
    );
    return result;
  }

  addResultValidation(
    findingId: string,
    resultId: string,
    input: AddJourneyResultValidationInput,
    context: JourneyActionContext,
  ): Validation {
    const result = this.loadResult(resultId);
    if (!result.relatedFindingIds.includes(findingId)) {
      throw new Error('JourneyResult is not linked to the requested Finding.');
    }
    const bundle = this.#repository.loadReviewBundle(findingId);
    if (bundle === null) throw new Error(`Finding ${findingId} is not in the review repository.`);
    if (bundle.finding.status !== 'in_review') {
      throw new Error('JourneyResult validation requires a Finding with status in_review.');
    }
    const actor = actorSchema.parse(context.actor);
    const performedAt = input.performedAt ?? this.#now();
    if (input.evidenceIds.length === 0) {
      throw new Error('JourneyResult Validation requires supporting result Evidence.');
    }
    if (input.evidenceIds.length !== new Set(input.evidenceIds).size) {
      throw new Error('JourneyResult Validation Evidence IDs must be unique.');
    }
    if (!input.evidenceIds.every((id) => result.evidenceIds.includes(id))) {
      throw new Error('JourneyResult Validation Evidence must come from the recorded result.');
    }
    const validation = validationSchema.parse({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      id: `validation-${this.#idFactory()}`,
      assessmentId: result.assessmentId,
      subject: { type: 'journey_result', id: result.id },
      method: input.method,
      outcome: input.outcome,
      claims: input.claims,
      validatedSeverity: input.validatedSeverity,
      performedBy: input.performedBy,
      performedAt,
      assistiveTechnology: input.assistiveTechnology,
      notes: input.notes,
      evidenceIds: input.evidenceIds,
    });
    const nextFinding = findingSchema.parse({
      ...bundle.finding,
      validationStatus: deriveValidationStatus([...bundle.validations, validation]),
      updatedAt: performedAt,
    });
    const journey = this.#requireJourney(result.journeyId);
    this.#repository.commitJourneyResultValidation(
      bundle.finding,
      nextFinding,
      validation,
      this.#reviewEvent(bundle.finding, validation, actor, context.reason ?? null, performedAt),
      this.#journeyEvent(
        journey,
        'journey_result_validation_added',
        'validation',
        validation.id,
        actor,
        context.reason ?? null,
        null,
        validation,
        performedAt,
      ),
    );
    return validation;
  }

  #requireJourney(journeyId: string): ResidentJourney {
    const journey = this.#repository.loadJourney(journeyId);
    if (journey === null) throw new Error(`ResidentJourney ${journeyId} does not exist.`);
    return journey;
  }

  #assertHumanEvidence(evidence: Evidence, assessmentId: string): Evidence {
    const parsed = evidenceSchema.parse(evidence);
    if (
      parsed.assessmentId !== assessmentId ||
      parsed.source.type !== 'human' ||
      !['human_note', 'interaction_trace', 'screenshot'].includes(parsed.kind)
    ) {
      throw new Error('Journey support must be human Evidence in the same assessment.');
    }
    return parsed;
  }

  #journeyEvent(
    journey: ResidentJourney,
    action: JourneyAuditAction,
    entityType: JourneyAuditEvent['entityType'],
    entityId: string,
    actor: string,
    reason: string | null,
    before: unknown,
    after: unknown,
    occurredAt: string,
  ): JourneyAuditEvent {
    return journeyAuditEventSchema.parse({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      id: `journey-event-${this.#idFactory()}`,
      assessmentId: journey.assessmentId,
      journeyId: journey.id,
      entityType,
      entityId,
      action,
      actor,
      reason,
      before,
      after,
      occurredAt,
    });
  }

  #reviewEvent(
    finding: Finding,
    validation: Validation,
    actor: string,
    reason: string | null,
    occurredAt: string,
  ): ReviewAuditEvent {
    return reviewAuditEventSchema.parse({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      id: `review-event-${this.#idFactory()}`,
      assessmentId: finding.assessmentId,
      findingId: finding.id,
      entityType: 'validation',
      entityId: validation.id,
      action: 'validation_added',
      actor,
      reason,
      before: null,
      after: validation,
      occurredAt,
    });
  }

  #now(): string {
    return this.#clock().toISOString();
  }
}

function deriveValidationStatus(validations: readonly Validation[]): Finding['validationStatus'] {
  if (validations.some((validation) => validation.outcome === 'supported')) return 'validated';
  if (validations.some((validation) => validation.outcome === 'inconclusive'))
    return 'inconclusive';
  return 'in_progress';
}
