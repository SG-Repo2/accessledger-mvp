import { z } from 'zod';

import { entityIdSchema, jsonValueSchema, schemaVersionSchema, timestampSchema } from './common.js';

export const evidenceKindSchema = z.enum([
  'raw_browser_result',
  'raw_scanner_result',
  'dom_snapshot',
  'accessibility_semantics',
  'interaction_trace',
  'screenshot',
  'human_note',
]);

export const evidenceSourceSchema = z.object({
  type: z.enum(['browser', 'scanner', 'accessibility_api', 'human']),
  name: z.string().trim().min(1),
  version: z.string().trim().min(1).nullable(),
});

export const evidenceSchema = z.object({
  schemaVersion: schemaVersionSchema,
  id: entityIdSchema,
  assessmentId: entityIdSchema,
  pageId: entityIdSchema.nullable(),
  kind: evidenceKindSchema,
  source: evidenceSourceSchema,
  capturedAt: timestampSchema,
  contentType: z.string().trim().min(1),
  payload: jsonValueSchema,
  metadata: z.record(z.string(), jsonValueSchema),
});

export type EvidenceKind = z.infer<typeof evidenceKindSchema>;
export type EvidenceSource = z.infer<typeof evidenceSourceSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
