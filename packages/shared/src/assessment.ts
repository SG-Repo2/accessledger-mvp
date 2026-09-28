import { z } from 'zod';

import {
  entityIdSchema,
  entityTimestampsSchema,
  schemaVersionSchema,
  timestampSchema,
  urlSchema,
} from './common.js';

export const assessmentStatusSchema = z.enum([
  'draft',
  'in_progress',
  'in_review',
  'complete',
  'archived',
]);

export const conformanceLevelSchema = z.enum(['A', 'AA', 'AAA']);

export const targetStandardSchema = z.object({
  name: z.literal('WCAG'),
  version: z.string().trim().min(1),
  levels: z.array(conformanceLevelSchema).min(1),
});

export const assessmentSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    id: entityIdSchema,
    name: z.string().trim().min(1),
    status: assessmentStatusSchema,
    targetUrls: z.array(urlSchema).min(1),
    targetStandard: targetStandardSchema,
    startedAt: timestampSchema.nullable(),
    completedAt: timestampSchema.nullable(),
  })
  .extend(entityTimestampsSchema.shape);

export type AssessmentStatus = z.infer<typeof assessmentStatusSchema>;
export type ConformanceLevel = z.infer<typeof conformanceLevelSchema>;
export type TargetStandard = z.infer<typeof targetStandardSchema>;
export type Assessment = z.infer<typeof assessmentSchema>;
