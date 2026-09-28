import { z } from 'zod';

import {
  entityIdSchema,
  entityTimestampsSchema,
  jsonValueSchema,
  schemaVersionSchema,
  timestampSchema,
  urlSchema,
} from './common.js';

export const journeyOutcomeSchema = z.enum([
  'completed',
  'completed_with_difficulty',
  'unable_to_complete',
  'not_attempted',
  'inconclusive',
]);

export const residentJourneySchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    id: entityIdSchema,
    assessmentId: entityIdSchema,
    goal: z.string().trim().min(1),
    startingUrl: urlSchema,
    preconditions: z.array(z.string().trim().min(1)),
    humanTask: z.string().trim().min(1),
    expectedObservableOutcome: z.string().trim().min(1),
    relatedFindingIds: z.array(entityIdSchema),
  })
  .extend(entityTimestampsSchema.shape)
  .superRefine((journey, context) => {
    if (journey.relatedFindingIds.length !== new Set(journey.relatedFindingIds).size) {
      context.addIssue({
        code: 'custom',
        path: ['relatedFindingIds'],
        message: 'Related Finding IDs must be unique.',
      });
    }
  });

export const journeyEnvironmentSchema = z.object({
  platform: z.string().trim().min(1),
  browser: z.object({
    name: z.string().trim().min(1),
    version: z.string().trim().min(1).nullable(),
  }),
  assistiveTechnology: z
    .object({
      name: z.string().trim().min(1),
      version: z.string().trim().min(1).nullable(),
    })
    .nullable(),
});

export const journeyResultSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    id: entityIdSchema,
    assessmentId: entityIdSchema,
    journeyId: entityIdSchema,
    outcome: journeyOutcomeSchema,
    environment: journeyEnvironmentSchema,
    nvdaResult: z.string().trim().min(1).nullable(),
    performedBy: z.string().trim().min(1),
    startedAt: timestampSchema,
    completedAt: timestampSchema.nullable(),
    notes: z.string().trim().min(1).nullable(),
    relatedFindingIds: z.array(entityIdSchema),
    evidenceIds: z.array(entityIdSchema).min(1),
  })
  .superRefine((result, context) => {
    if (result.relatedFindingIds.length !== new Set(result.relatedFindingIds).size) {
      context.addIssue({
        code: 'custom',
        path: ['relatedFindingIds'],
        message: 'Related Finding IDs must be unique.',
      });
    }
    if (result.evidenceIds.length !== new Set(result.evidenceIds).size) {
      context.addIssue({
        code: 'custom',
        path: ['evidenceIds'],
        message: 'Journey-result Evidence IDs must be unique.',
      });
    }
    if (result.outcome === 'not_attempted' && result.completedAt !== null) {
      context.addIssue({
        code: 'custom',
        path: ['completedAt'],
        message: 'A not-attempted journey has no completion time.',
      });
    }
    if (result.outcome !== 'not_attempted' && result.completedAt === null) {
      context.addIssue({
        code: 'custom',
        path: ['completedAt'],
        message: 'An attempted journey result requires an end time.',
      });
    }
    if (
      result.completedAt !== null &&
      new Date(result.completedAt).getTime() < new Date(result.startedAt).getTime()
    ) {
      context.addIssue({
        code: 'custom',
        path: ['completedAt'],
        message: 'Journey-result end time cannot precede its start time.',
      });
    }
    if (
      result.nvdaResult !== null &&
      (result.environment.assistiveTechnology === null ||
        result.environment.assistiveTechnology.name.toLowerCase() !== 'nvda' ||
        !result.environment.platform.toLowerCase().includes('windows'))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['nvdaResult'],
        message: 'NVDA observations require an NVDA-on-Windows environment.',
      });
    }
  });

export const journeyAuditActionSchema = z.enum([
  'journey_created',
  'journey_edited',
  'journey_deleted',
  'journey_result_recorded',
  'journey_result_validation_added',
]);

export const journeyAuditEventSchema = z.object({
  schemaVersion: schemaVersionSchema,
  id: entityIdSchema,
  assessmentId: entityIdSchema,
  journeyId: entityIdSchema,
  entityType: z.enum(['resident_journey', 'journey_result', 'validation']),
  entityId: entityIdSchema,
  action: journeyAuditActionSchema,
  actor: z.string().trim().min(1),
  reason: z.string().trim().min(1).nullable(),
  before: jsonValueSchema.nullable(),
  after: jsonValueSchema,
  occurredAt: timestampSchema,
});

export type JourneyOutcome = z.infer<typeof journeyOutcomeSchema>;
export type JourneyEnvironment = z.infer<typeof journeyEnvironmentSchema>;
export type ResidentJourney = z.infer<typeof residentJourneySchema>;
export type JourneyResult = z.infer<typeof journeyResultSchema>;
export type JourneyAuditAction = z.infer<typeof journeyAuditActionSchema>;
export type JourneyAuditEvent = z.infer<typeof journeyAuditEventSchema>;
