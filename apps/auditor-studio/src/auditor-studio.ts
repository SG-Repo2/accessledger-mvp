import { randomUUID } from 'node:crypto';

import { type FindingReviewService, type FindingReviewTrace } from '@accessledger/findings';
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

export interface AuditorStudioOptions {
  clock?: () => Date;
  idFactory?: () => string;
}

export class AuditorStudio {
  readonly #service: FindingReviewService;
  readonly #clock: () => Date;
  readonly #idFactory: () => string;

  constructor(service: FindingReviewService, options: AuditorStudioOptions = {}) {
    this.#service = service;
    this.#clock = options.clock ?? (() => new Date());
    this.#idFactory = options.idFactory ?? randomUUID;
  }

  load(findingId: string): FindingReviewTrace {
    return this.#service.loadCompleteTrace(findingId);
  }

  listFindingIds(): string[] {
    return this.#service.listFindingIds();
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
