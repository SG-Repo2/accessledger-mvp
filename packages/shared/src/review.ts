import { z } from 'zod';

import { entityIdSchema, jsonValueSchema, schemaVersionSchema, timestampSchema } from './common.js';

export const reviewAuditActionSchema = z.enum([
  'review_bundle_created',
  'review_started',
  'grouping_decided',
  'finding_edited',
  'validation_added',
  'severity_assigned',
  'finding_approved',
  'finding_rejected',
]);

export const reviewAuditEventSchema = z.object({
  schemaVersion: schemaVersionSchema,
  id: entityIdSchema,
  assessmentId: entityIdSchema,
  findingId: entityIdSchema,
  entityType: z.enum(['review_bundle', 'group_proposal', 'finding', 'validation']),
  entityId: entityIdSchema,
  action: reviewAuditActionSchema,
  actor: z.string().trim().min(1),
  reason: z.string().trim().min(1).nullable(),
  before: jsonValueSchema.nullable(),
  after: jsonValueSchema,
  occurredAt: timestampSchema,
});

export type ReviewAuditAction = z.infer<typeof reviewAuditActionSchema>;
export type ReviewAuditEvent = z.infer<typeof reviewAuditEventSchema>;
