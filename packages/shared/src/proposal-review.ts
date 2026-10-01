import { z } from 'zod';

import { entityIdSchema, schemaVersionSchema, timestampSchema } from './common.js';

export const proposalReviewDecisionStatusSchema = z.enum(['accepted', 'rejected', 'split']);

export const proposalReviewDecisionSchema = z.object({
  schemaVersion: schemaVersionSchema,
  id: entityIdSchema,
  assessmentId: entityIdSchema,
  proposalId: entityIdSchema,
  status: proposalReviewDecisionStatusSchema,
  actor: z.string().trim().min(1),
  reason: z.string().trim().min(1),
  decidedAt: timestampSchema,
});

export const proposalDraftLinkSchema = z.object({
  schemaVersion: schemaVersionSchema,
  proposalId: entityIdSchema,
  findingId: entityIdSchema,
  linkedAt: timestampSchema,
});

export type ProposalReviewDecisionStatus = z.infer<typeof proposalReviewDecisionStatusSchema>;
export type ProposalReviewDecision = z.infer<typeof proposalReviewDecisionSchema>;
export type ProposalDraftLink = z.infer<typeof proposalDraftLinkSchema>;
