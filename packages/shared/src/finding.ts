import { z } from 'zod';

import {
  entityIdSchema,
  entityTimestampsSchema,
  schemaVersionSchema,
  urlSchema,
} from './common.js';

export const findingStatusSchema = z.enum([
  'draft',
  'in_review',
  'approved',
  'rejected',
  'archived',
]);

export const severitySchema = z.enum(['blocker', 'serious', 'moderate', 'minor']);
export const confidenceSchema = z.enum(['low', 'medium', 'high']);
export const validationStatusSchema = z.enum([
  'not_required',
  'required',
  'in_progress',
  'validated',
  'inconclusive',
]);

export const findingSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    id: entityIdSchema,
    assessmentId: entityIdSchema,
    title: z.string().trim().min(1),
    status: findingStatusSchema,
    wcagCriteria: z.array(z.string().regex(/^\d+\.\d+\.\d+$/)),
    condition: z.string().trim().min(1),
    cause: z.string().trim().min(1).nullable(),
    effect: z.string().trim().min(1).nullable(),
    recommendation: z.string().trim().min(1).nullable(),
    severity: severitySchema.nullable(),
    confidence: confidenceSchema.nullable(),
    validationStatus: validationStatusSchema,
    affectedUrls: z.array(urlSchema),
    affectedComponents: z.array(z.string().trim().min(1)),
    affectedJourneys: z.array(entityIdSchema),
    occurrenceCount: z.number().int().nonnegative(),
    observationIds: z.array(entityIdSchema).min(1),
    evidenceIds: z.array(entityIdSchema).min(1),
  })
  .extend(entityTimestampsSchema.shape);

export type FindingStatus = z.infer<typeof findingStatusSchema>;
export type Severity = z.infer<typeof severitySchema>;
export type Confidence = z.infer<typeof confidenceSchema>;
export type ValidationStatus = z.infer<typeof validationStatusSchema>;
export type Finding = z.infer<typeof findingSchema>;
