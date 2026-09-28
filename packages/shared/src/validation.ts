import { z } from 'zod';

import { entityIdSchema, schemaVersionSchema, timestampSchema } from './common.js';
import { severitySchema } from './finding.js';

export const validationMethodSchema = z.enum([
  'manual_review',
  'nvda',
  'keyboard',
  'visual',
  'contextual',
]);

export const validationOutcomeSchema = z.enum(['supported', 'unsupported', 'inconclusive']);

export const validationClaimSchema = z.enum([
  'grouping',
  'condition',
  'wcag',
  'cause',
  'effect',
  'recommendation',
  'severity',
]);

export const validationSubjectSchema = z.object({
  type: z.enum(['observation', 'finding', 'journey_result']),
  id: entityIdSchema,
});

export const validationSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    id: entityIdSchema,
    assessmentId: entityIdSchema,
    subject: validationSubjectSchema,
    method: validationMethodSchema,
    outcome: validationOutcomeSchema,
    claims: z.array(validationClaimSchema).min(1),
    validatedSeverity: severitySchema.nullable(),
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
  })
  .superRefine((validation, context) => {
    if (validation.claims.length !== new Set(validation.claims).size) {
      context.addIssue({
        code: 'custom',
        path: ['claims'],
        message: 'Validation claims must be unique.',
      });
    }
    if (
      validation.method === 'nvda' &&
      (validation.assistiveTechnology === null || validation.assistiveTechnology.platform === null)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['assistiveTechnology'],
        message: 'NVDA validation requires assistive-technology and platform details.',
      });
    }
    const supportsSeverity =
      validation.outcome === 'supported' && validation.claims.includes('severity');
    if (supportsSeverity !== (validation.validatedSeverity !== null)) {
      context.addIssue({
        code: 'custom',
        path: ['validatedSeverity'],
        message:
          'A supported severity claim requires one exact validated severity, and no other validation may set it.',
      });
    }
  });

export type ValidationMethod = z.infer<typeof validationMethodSchema>;
export type ValidationOutcome = z.infer<typeof validationOutcomeSchema>;
export type ValidationClaim = z.infer<typeof validationClaimSchema>;
export type ValidationSubject = z.infer<typeof validationSubjectSchema>;
export type Validation = z.infer<typeof validationSchema>;
