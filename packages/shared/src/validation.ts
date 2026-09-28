import { z } from 'zod';

import { entityIdSchema, schemaVersionSchema, timestampSchema } from './common.js';

export const validationMethodSchema = z.enum([
  'manual_review',
  'nvda',
  'keyboard',
  'visual',
  'contextual',
]);

export const validationOutcomeSchema = z.enum(['supported', 'unsupported', 'inconclusive']);

export const validationSubjectSchema = z.object({
  type: z.enum(['observation', 'finding', 'journey_result']),
  id: entityIdSchema,
});

export const validationSchema = z.object({
  schemaVersion: schemaVersionSchema,
  id: entityIdSchema,
  assessmentId: entityIdSchema,
  subject: validationSubjectSchema,
  method: validationMethodSchema,
  outcome: validationOutcomeSchema,
  performedBy: z.string().trim().min(1),
  performedAt: timestampSchema,
  assistiveTechnology: z
    .object({
      name: z.string().trim().min(1),
      version: z.string().trim().min(1).nullable(),
      platform: z.string().trim().min(1).nullable(),
    })
    .nullable(),
  notes: z.string().trim().min(1).nullable(),
  evidenceIds: z.array(entityIdSchema),
});

export type ValidationMethod = z.infer<typeof validationMethodSchema>;
export type ValidationOutcome = z.infer<typeof validationOutcomeSchema>;
export type ValidationSubject = z.infer<typeof validationSubjectSchema>;
export type Validation = z.infer<typeof validationSchema>;
