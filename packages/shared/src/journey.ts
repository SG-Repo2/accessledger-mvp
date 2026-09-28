import { z } from 'zod';

import {
  entityIdSchema,
  entityTimestampsSchema,
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
  .extend(entityTimestampsSchema.shape);

export const journeyResultSchema = z.object({
  schemaVersion: schemaVersionSchema,
  id: entityIdSchema,
  assessmentId: entityIdSchema,
  journeyId: entityIdSchema,
  outcome: journeyOutcomeSchema,
  nvdaResult: z.string().trim().min(1).nullable(),
  performedBy: z.string().trim().min(1),
  startedAt: timestampSchema,
  completedAt: timestampSchema.nullable(),
  notes: z.string().trim().min(1).nullable(),
  relatedFindingIds: z.array(entityIdSchema),
  evidenceIds: z.array(entityIdSchema),
});

export type JourneyOutcome = z.infer<typeof journeyOutcomeSchema>;
export type ResidentJourney = z.infer<typeof residentJourneySchema>;
export type JourneyResult = z.infer<typeof journeyResultSchema>;
