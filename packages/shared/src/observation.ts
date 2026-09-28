import { z } from 'zod';

import { entityIdSchema, entityTimestampsSchema, schemaVersionSchema } from './common.js';

export const testabilitySchema = z.enum(['deterministic', 'contextual', 'human_validation']);

export const evidenceEvaluationSchema = z.enum([
  'candidate',
  'supported',
  'unsupported',
  'uncertain',
]);

export const observationSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    id: entityIdSchema,
    assessmentId: entityIdSchema,
    sourceRuleId: z.string().trim().min(1).nullable(),
    category: z.string().trim().min(1),
    summary: z.string().trim().min(1),
    testability: testabilitySchema,
    evaluation: evidenceEvaluationSchema,
    candidateWcagCriteria: z.array(z.string().trim().min(1)),
    evidenceIds: z.array(entityIdSchema).min(1),
  })
  .extend(entityTimestampsSchema.shape);

export const observationOccurrenceSchema = z.object({
  schemaVersion: schemaVersionSchema,
  id: entityIdSchema,
  assessmentId: entityIdSchema,
  observationId: entityIdSchema,
  pageId: entityIdSchema,
  evidenceIds: z.array(entityIdSchema).min(1),
  selector: z.string().trim().min(1).nullable(),
  htmlSnippet: z.string().trim().min(1).nullable(),
  componentFingerprint: z.string().trim().min(1).nullable(),
  observedAt: z.iso.datetime({ offset: true }),
});

export type Testability = z.infer<typeof testabilitySchema>;
export type EvidenceEvaluation = z.infer<typeof evidenceEvaluationSchema>;
export type Observation = z.infer<typeof observationSchema>;
export type ObservationOccurrence = z.infer<typeof observationOccurrenceSchema>;
