import { z } from 'zod';

import {
  entityIdSchema,
  entityTimestampsSchema,
  schemaVersionSchema,
  timestampSchema,
  urlSchema,
} from './common.js';

export const pageLoadStatusSchema = z.enum(['pending', 'loaded', 'failed']);

export const pageSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    id: entityIdSchema,
    assessmentId: entityIdSchema,
    requestedUrl: urlSchema,
    finalUrl: urlSchema.nullable(),
    title: z.string().nullable(),
    language: z.string().trim().min(1).nullable(),
    loadStatus: pageLoadStatusSchema,
    loadedAt: timestampSchema.nullable(),
    failureReason: z.string().trim().min(1).nullable(),
    rawEvidenceIds: z.array(entityIdSchema),
  })
  .extend(entityTimestampsSchema.shape);

export type PageLoadStatus = z.infer<typeof pageLoadStatusSchema>;
export type Page = z.infer<typeof pageSchema>;
