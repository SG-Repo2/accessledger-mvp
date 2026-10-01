import { randomUUID } from 'node:crypto';

import {
  type FindingReviewService,
  type FindingReviewTrace,
  type GroupProposalReviewService,
  type GroupProposalReviewTrace,
} from '@accessledger/findings';
import { type ResidentJourneyService, type ResidentJourneyTrace } from '@accessledger/journeys';
import {
  CONTRACT_SCHEMA_VERSION,
  evidenceSchema,
  type ValidationClaim,
} from '@accessledger/shared';

export type AuditorAction =
  | 'start-review'
  | 'group-decision'
  | 'edit-finding'
  | 'add-validation'
  | 'assign-severity'
  | 'approve'
  | 'reject';

export type JourneyAction =
  'create-journey' | 'edit-journey' | 'record-journey-result' | 'add-journey-validation';

export type ProposalAction = 'proposal-decision';

export interface AuditorStudioOptions {
  clock?: () => Date;
  idFactory?: () => string;
}

export class AuditorStudio {
  readonly #service: FindingReviewService;
  readonly #journeyService: ResidentJourneyService;
  readonly #proposalService: GroupProposalReviewService;
  readonly #clock: () => Date;
  readonly #idFactory: () => string;

  constructor(
    service: FindingReviewService,
    journeyService: ResidentJourneyService,
    proposalService: GroupProposalReviewService,
    options: AuditorStudioOptions = {},
  ) {
    this.#service = service;
    this.#journeyService = journeyService;
    this.#proposalService = proposalService;
    this.#clock = options.clock ?? (() => new Date());
    this.#idFactory = options.idFactory ?? randomUUID;
  }

  load(findingId: string): FindingReviewTrace {
    return this.#service.loadCompleteTrace(findingId);
  }

  listFindingIds(): string[] {
    return this.#service.listFindingIds();
  }

  listProposalIds(): string[] {
    return this.#proposalService.listProposalIds();
  }

  loadProposal(proposalId: string): GroupProposalReviewTrace {
    return this.#proposalService.load(proposalId);
  }

  handleProposal(
    action: ProposalAction,
    fields: Readonly<Record<string, string>>,
  ): GroupProposalReviewTrace {
    if (action !== 'proposal-decision') {
      throw new Error(`Unsupported proposal action: ${String(action)}`);
    }
    return this.#proposalService.decide(
      required(fields, 'proposalId'),
      oneOf(required(fields, 'decision'), ['accepted', 'rejected', 'split']),
      { actor: required(fields, 'actor'), reason: required(fields, 'reason') },
    );
  }

  listJourneys() {
    return this.#journeyService.listProtocols();
  }

  loadJourney(journeyId: string): ResidentJourneyTrace {
    return this.#journeyService.loadProtocol(journeyId);
  }

  handleJourney(
    action: JourneyAction,
    fields: Readonly<Record<string, string>>,
  ): ResidentJourneyTrace {
    const actor = required(fields, 'actor');
    const reason = nullable(fields.reason);
    switch (action) {
      case 'create-journey':
        return this.#journeyService.createProtocol(
          {
            assessmentId: required(fields, 'assessmentId'),
            goal: required(fields, 'goal'),
            startingUrl: required(fields, 'startingUrl'),
            preconditions: lines(fields.preconditions),
            humanTask: required(fields, 'humanTask'),
            expectedObservableOutcome: required(fields, 'expectedObservableOutcome'),
            relatedFindingIds: commaValues(fields.relatedFindingIds),
          },
          { actor, reason },
        );
      case 'edit-journey': {
        const journeyId = required(fields, 'journeyId');
        return this.#journeyService.editProtocol(
          journeyId,
          {
            goal: required(fields, 'goal'),
            startingUrl: required(fields, 'startingUrl'),
            preconditions: lines(fields.preconditions),
            humanTask: required(fields, 'humanTask'),
            expectedObservableOutcome: required(fields, 'expectedObservableOutcome'),
            relatedFindingIds: commaValues(fields.relatedFindingIds),
          },
          { actor, reason },
        );
      }
      case 'record-journey-result': {
        const journeyId = required(fields, 'journeyId');
        const recordedAt = this.#clock().toISOString();
        const outcome = oneOf(required(fields, 'outcome'), [
          'completed',
          'completed_with_difficulty',
          'unable_to_complete',
          'not_attempted',
          'inconclusive',
        ]);
        const notes = required(fields, 'notes');
        const evidence = evidenceSchema.parse({
          schemaVersion: CONTRACT_SCHEMA_VERSION,
          id: `journey-evidence-${this.#idFactory()}`,
          assessmentId: this.loadJourney(journeyId).journey.assessmentId,
          pageId: null,
          kind: 'human_note',
          source: { type: 'human', name: actor, version: null },
          capturedAt: recordedAt,
          contentType: 'application/json',
          payload: { notes, manuallySelectedOutcome: outcome },
          metadata: { authoredThrough: 'auditor_studio', journeyId },
        });
        const assistiveTechnologyName = nullable(fields.assistiveTechnologyName);
        this.#journeyService.recordResult(
          journeyId,
          {
            outcome,
            environment: {
              platform: required(fields, 'platform'),
              browser: {
                name: required(fields, 'browserName'),
                version: nullable(fields.browserVersion),
              },
              assistiveTechnology:
                assistiveTechnologyName === null
                  ? null
                  : {
                      name: assistiveTechnologyName,
                      version: nullable(fields.assistiveTechnologyVersion),
                    },
            },
            nvdaResult: nullable(fields.nvdaResult),
            performedBy: actor,
            startedAt: required(fields, 'startedAt'),
            completedAt: nullable(fields.completedAt),
            notes,
            relatedFindingIds: commaValues(fields.relatedFindingIds),
            supportingEvidence: [evidence],
          },
          { actor, reason },
        );
        return this.loadJourney(journeyId);
      }
      case 'add-journey-validation': {
        const journeyId = required(fields, 'journeyId');
        const result = this.#journeyService.loadResult(required(fields, 'resultId'));
        const method = oneOf(required(fields, 'method'), [
          'manual_review',
          'nvda',
          'keyboard',
          'visual',
          'contextual',
        ]);
        const claims = parseClaims(fields.claims);
        const outcome = oneOf(required(fields, 'validationOutcome'), [
          'supported',
          'unsupported',
          'inconclusive',
        ]);
        this.#journeyService.addResultValidation(
          required(fields, 'findingId'),
          result.id,
          {
            method,
            outcome,
            claims,
            validatedSeverity:
              outcome === 'supported' && claims.includes('severity')
                ? oneOf(required(fields, 'validatedSeverity'), [
                    'blocker',
                    'serious',
                    'moderate',
                    'minor',
                  ])
                : null,
            performedBy: actor,
            assistiveTechnology:
              method === 'nvda' && result.environment.assistiveTechnology !== null
                ? {
                    ...result.environment.assistiveTechnology,
                    platform: result.environment.platform,
                  }
                : null,
            notes: required(fields, 'validationNotes'),
            evidenceIds: commaValues(fields.evidenceIds),
          },
          { actor, reason },
        );
        return this.loadJourney(journeyId);
      }
      default:
        throw new Error(`Unsupported journey action: ${String(action)}`);
    }
  }

  handle(
    findingId: string,
    action: AuditorAction,
    fields: Readonly<Record<string, string>>,
  ): FindingReviewTrace {
    const actor = required(fields, 'actor');
    const reason = nullable(fields.reason);
    switch (action) {
      case 'start-review':
        return this.#service.startReview(findingId, { actor, reason });
      case 'group-decision':
        return this.#service.decideGrouping(
          findingId,
          oneOf(required(fields, 'decision'), ['accepted', 'rejected', 'split']),
          { actor, reason },
        );
      case 'edit-finding':
        return this.#service.editFinding(
          findingId,
          {
            title: required(fields, 'title'),
            condition: required(fields, 'condition'),
            cause: nullable(fields.cause),
            effect: nullable(fields.effect),
            recommendation: nullable(fields.recommendation),
            confidence:
              fields.confidence === '' || fields.confidence === undefined
                ? null
                : oneOf(fields.confidence, ['low', 'medium', 'high']),
            wcagCriteria: (fields.wcagCriteria ?? '')
              .split(',')
              .map((value) => value.trim())
              .filter((value) => value.length > 0),
          },
          { actor, reason },
        );
      case 'add-validation': {
        const claims = parseClaims(fields.claims);
        const outcome = oneOf(required(fields, 'outcome'), [
          'supported',
          'unsupported',
          'inconclusive',
        ]);
        const severity =
          outcome === 'supported' && claims.includes('severity')
            ? oneOf(required(fields, 'validatedSeverity'), [
                'blocker',
                'serious',
                'moderate',
                'minor',
              ])
            : null;
        const performedAt = this.#clock().toISOString();
        const note = required(fields, 'notes');
        const evidence = evidenceSchema.parse({
          schemaVersion: CONTRACT_SCHEMA_VERSION,
          id: `human-evidence-${this.#idFactory()}`,
          assessmentId: this.load(findingId).finding.assessmentId,
          pageId: null,
          kind: 'human_note',
          source: { type: 'human', name: actor, version: null },
          capturedAt: performedAt,
          contentType: 'application/json',
          payload: { notes: note, claims, outcome },
          metadata: { authoredThrough: 'auditor_studio' },
        });
        const assistiveTechnology = nullable(fields.assistiveTechnologyName);
        return this.#service.addValidation(
          findingId,
          {
            method: oneOf(required(fields, 'method'), [
              'manual_review',
              'nvda',
              'keyboard',
              'visual',
              'contextual',
            ]),
            outcome,
            claims,
            validatedSeverity: severity,
            performedBy: actor,
            performedAt,
            assistiveTechnology:
              assistiveTechnology === null
                ? null
                : {
                    name: assistiveTechnology,
                    version: nullable(fields.assistiveTechnologyVersion),
                    platform: nullable(fields.platform),
                  },
            notes: note,
            supportingEvidence: [evidence],
          },
          { actor, reason },
        );
      }
      case 'assign-severity':
        return this.#service.assignSeverity(
          findingId,
          oneOf(required(fields, 'severity'), ['blocker', 'serious', 'moderate', 'minor']),
          { actor, reason },
        );
      case 'approve':
        return this.#service.approve(findingId, { actor, reason });
      case 'reject':
        return this.#service.reject(findingId, { actor, reason });
      default:
        throw new Error(`Unsupported auditor action: ${String(action)}`);
    }
  }
}

function required(fields: Readonly<Record<string, string>>, name: string): string {
  const value = fields[name]?.trim();
  if (value === undefined || value.length === 0) throw new Error(`${name} is required.`);
  return value;
}

function nullable(value: string | undefined): string | null {
  const normalized = value?.trim() ?? '';
  return normalized.length === 0 ? null : normalized;
}

function oneOf<const T extends string>(value: string, allowed: readonly T[]): T {
  if (!allowed.includes(value as T)) throw new Error(`Unsupported value: ${value}`);
  return value as T;
}

function parseClaims(value: string | undefined): ValidationClaim[] {
  const allowed: ValidationClaim[] = [
    'grouping',
    'condition',
    'wcag',
    'cause',
    'effect',
    'recommendation',
    'severity',
  ];
  const requestedClaims = (value ?? '')
    .split(',')
    .map((claim) => claim.trim())
    .filter((claim) => claim.length > 0);
  const unknown = requestedClaims.filter((claim) => !allowed.includes(claim as ValidationClaim));
  if (unknown.length > 0) throw new Error(`Unsupported validation claims: ${unknown.join(', ')}`);
  const claims = requestedClaims as ValidationClaim[];
  if (claims.length === 0) throw new Error('At least one validation claim is required.');
  return [...new Set(claims)];
}

function commaValues(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function lines(value: string | undefined): string[] {
  return (value ?? '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
