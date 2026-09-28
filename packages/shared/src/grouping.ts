import { z } from 'zod';

import { entityIdSchema, entityTimestampsSchema, schemaVersionSchema } from './common.js';

const uniqueEntityIdsSchema = z
  .array(entityIdSchema)
  .min(1)
  .refine((ids) => ids.length === new Set(ids).size, 'IDs must be unique.');

export const groupingProposalKindSchema = z.enum(['repeat_candidate', 'singleton', 'ambiguous']);

export const groupingReviewStatusSchema = z.enum(['pending', 'accepted', 'rejected', 'split']);

export const groupingConfidenceSchema = z.enum(['high', 'medium', 'low']);

export const groupingSignalTypeSchema = z.enum([
  'source_identity',
  'source_rule',
  'source_category',
  'component_fingerprint',
  'selector_structure',
  'component_structure',
  'role_name_pattern',
  'page_template',
  'page_url',
]);

export const groupingSignalStrengthSchema = z.enum([
  'required',
  'identity',
  'supporting',
  'context',
]);

export const groupingSignalSchema = z.object({
  type: groupingSignalTypeSchema,
  strength: groupingSignalStrengthSchema,
  value: z.string().trim().min(1),
  occurrenceIds: uniqueEntityIdsSchema,
});

export const groupProposalMemberSchema = z.object({
  observationId: entityIdSchema,
  occurrenceId: entityIdSchema,
  pageId: entityIdSchema,
  evidenceIds: uniqueEntityIdsSchema,
});

export const groupingAmbiguitySchema = z.object({
  reason: z.enum([
    'insufficient_identity_signal',
    'missing_shared_page_template',
    'missing_comparable_structure',
  ]),
  relatedOccurrenceIds: uniqueEntityIdsSchema,
});

export const groupProposalSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    groupingAlgorithmVersion: z.string().trim().min(1),
    id: entityIdSchema,
    assessmentId: entityIdSchema,
    kind: groupingProposalKindSchema,
    reviewStatus: groupingReviewStatusSchema,
    groupingConfidence: groupingConfidenceSchema,
    rationale: z.string().trim().min(1),
    members: z.array(groupProposalMemberSchema).min(1),
    memberObservationIds: uniqueEntityIdsSchema,
    memberOccurrenceIds: uniqueEntityIdsSchema,
    pageIds: uniqueEntityIdsSchema,
    evidenceIds: uniqueEntityIdsSchema,
    signals: z.array(groupingSignalSchema).min(3),
    ambiguity: groupingAmbiguitySchema.nullable(),
  })
  .extend(entityTimestampsSchema.shape)
  .superRefine((proposal, context) => {
    const expectedObservationIds = unique(proposal.members.map((member) => member.observationId));
    const expectedOccurrenceIds = proposal.members.map((member) => member.occurrenceId);
    const expectedPageIds = unique(proposal.members.map((member) => member.pageId));
    const expectedEvidenceIds = unique(proposal.members.flatMap((member) => member.evidenceIds));

    checkExactIds(
      context,
      proposal.memberObservationIds,
      expectedObservationIds,
      'memberObservationIds',
    );
    checkExactIds(
      context,
      proposal.memberOccurrenceIds,
      expectedOccurrenceIds,
      'memberOccurrenceIds',
    );
    checkExactIds(context, proposal.pageIds, expectedPageIds, 'pageIds');
    checkExactIds(context, proposal.evidenceIds, expectedEvidenceIds, 'evidenceIds');

    if (new Set(expectedOccurrenceIds).size !== expectedOccurrenceIds.length) {
      context.addIssue({
        code: 'custom',
        message: 'Proposal members must reference unique occurrence IDs.',
        path: ['members'],
      });
    }

    const isRepeat = proposal.kind === 'repeat_candidate';
    if (isRepeat !== proposal.members.length >= 2) {
      context.addIssue({
        code: 'custom',
        message: 'Repeat candidates need at least two members; other proposal kinds need one.',
        path: ['kind'],
      });
    }

    if ((proposal.kind === 'ambiguous') !== (proposal.ambiguity !== null)) {
      context.addIssue({
        code: 'custom',
        message: 'Only ambiguous proposals carry ambiguity metadata.',
        path: ['ambiguity'],
      });
    }

    const occurrenceIds = new Set(expectedOccurrenceIds);
    for (const [index, signal] of proposal.signals.entries()) {
      if (signal.occurrenceIds.some((id) => !occurrenceIds.has(id))) {
        context.addIssue({
          code: 'custom',
          message: 'Signal occurrence IDs must belong to proposal members.',
          path: ['signals', index, 'occurrenceIds'],
        });
      }
    }

    if (proposal.ambiguity?.relatedOccurrenceIds.some((id) => occurrenceIds.has(id))) {
      context.addIssue({
        code: 'custom',
        message: 'Ambiguity links must reference occurrences outside this singleton proposal.',
        path: ['ambiguity', 'relatedOccurrenceIds'],
      });
    }
  });

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function checkExactIds(
  context: z.RefinementCtx,
  actual: string[],
  expected: string[],
  path: string,
): void {
  if (actual.length !== new Set(actual).size || actual.join('\u0000') !== expected.join('\u0000')) {
    context.addIssue({
      code: 'custom',
      message: `${path} must exactly match the ordered unique member references.`,
      path: [path],
    });
  }
}

export type GroupingProposalKind = z.infer<typeof groupingProposalKindSchema>;
export type GroupingReviewStatus = z.infer<typeof groupingReviewStatusSchema>;
export type GroupingConfidence = z.infer<typeof groupingConfidenceSchema>;
export type GroupingSignal = z.infer<typeof groupingSignalSchema>;
export type GroupProposalMember = z.infer<typeof groupProposalMemberSchema>;
export type GroupProposal = z.infer<typeof groupProposalSchema>;
