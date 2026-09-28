import { z } from 'zod';

import { conformanceLevelSchema } from './assessment.js';
import {
  entityIdSchema,
  jsonValueSchema,
  schemaVersionSchema,
  timestampSchema,
  urlSchema,
} from './common.js';

export const wcagPrincipleSchema = z.enum(['perceivable', 'operable', 'understandable', 'robust']);

export const automatedTestabilitySchema = z.enum(['automated', 'partial', 'manual']);

export const ruleEvidenceRequirementSchema = z.object({
  id: z.string().trim().min(1),
  description: z.string().trim().min(1),
  factPath: z.string().trim().min(1),
  operator: z.enum(['equals', 'greater_than', 'non_empty']),
  expectedValue: jsonValueSchema.nullable(),
});

export const ruleMappingSchema = z.object({
  tool: z.string().trim().min(1),
  ruleId: z.string().trim().min(1),
  toolVersionRange: z.string().trim().min(1).nullable(),
  mappingType: z.enum(['tool_documented', 'reviewed']),
  mappingSource: urlSchema.nullable(),
  verifiedAt: timestampSchema.nullable(),
  evidenceRequirements: z.array(ruleEvidenceRequirementSchema).min(1),
});

export const wcagCriterionSchema = z.object({
  schemaVersion: schemaVersionSchema,
  id: z.string().regex(/^\d+\.\d+\.\d+$/),
  title: z.string().trim().min(1),
  level: conformanceLevelSchema,
  principle: wcagPrincipleSchema,
  guideline: z.string().trim().min(1),
  normativeSource: urlSchema,
  intentSource: urlSchema.nullable(),
  automatedTestability: automatedTestabilitySchema,
  evidenceRequirements: z.array(z.string().trim().min(1)).min(1),
  knownRuleMappings: z.array(ruleMappingSchema),
  manualValidationGuidance: z.string().trim().min(1).nullable(),
});

export const wcagRequirementEvaluationSchema = z.object({
  requirementId: z.string().trim().min(1),
  description: z.string().trim().min(1),
  status: z.enum(['satisfied', 'contradicted', 'insufficient']),
  factPath: z.string().trim().min(1),
  operator: z.enum(['equals', 'greater_than', 'non_empty']),
  expectedValue: jsonValueSchema.nullable(),
  actualValue: jsonValueSchema.nullable(),
  evidenceIds: z.array(entityIdSchema).min(1),
});

export const wcagCandidateEvaluationSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    id: entityIdSchema,
    assessmentId: entityIdSchema,
    observationId: entityIdSchema,
    datasetVersion: z.string().trim().min(1),
    standard: z.object({
      name: z.literal('WCAG'),
      version: z.literal('2.1'),
    }),
    mappingStatus: z.enum(['known_rule', 'unknown_rule']),
    criterionId: z
      .string()
      .regex(/^\d+\.\d+\.\d+$/)
      .nullable(),
    sourceMapping: ruleMappingSchema.nullable(),
    evaluation: z.enum(['supported', 'unsupported', 'uncertain']),
    reason: z.enum([
      'requirements_satisfied',
      'requirements_contradicted',
      'insufficient_evidence',
      'unknown_rule',
    ]),
    requirementEvaluations: z.array(wcagRequirementEvaluationSchema),
    evidenceIds: z.array(entityIdSchema).min(1),
    evaluatedAt: timestampSchema,
  })
  .superRefine((evaluation, context) => {
    const known = evaluation.mappingStatus === 'known_rule';
    if (
      known !== (evaluation.criterionId !== null) ||
      known !== (evaluation.sourceMapping !== null) ||
      (!known &&
        (evaluation.reason !== 'unknown_rule' ||
          evaluation.evaluation !== 'uncertain' ||
          evaluation.requirementEvaluations.length !== 0))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['mappingStatus'],
        message: 'Known mappings require criterion trace; unknown rules must remain uncertain.',
      });
    }
    if (known) {
      const expectedReason = {
        supported: 'requirements_satisfied',
        unsupported: 'requirements_contradicted',
        uncertain: 'insufficient_evidence',
      }[evaluation.evaluation];
      const statuses = evaluation.requirementEvaluations.map((requirement) => requirement.status);
      const statusTraceMatches =
        evaluation.evaluation === 'supported'
          ? statuses.length > 0 && statuses.every((status) => status === 'satisfied')
          : evaluation.evaluation === 'unsupported'
            ? statuses.includes('contradicted')
            : statuses.includes('insufficient');
      if (evaluation.reason !== expectedReason || !statusTraceMatches) {
        context.addIssue({
          code: 'custom',
          path: ['evaluation'],
          message: 'Known evaluation state must agree with its reason and requirement trace.',
        });
      }
    }
  });

export type WcagPrinciple = z.infer<typeof wcagPrincipleSchema>;
export type AutomatedTestability = z.infer<typeof automatedTestabilitySchema>;
export type RuleEvidenceRequirement = z.infer<typeof ruleEvidenceRequirementSchema>;
export type RuleMapping = z.infer<typeof ruleMappingSchema>;
export type WCAGCriterion = z.infer<typeof wcagCriterionSchema>;
export type WcagRequirementEvaluation = z.infer<typeof wcagRequirementEvaluationSchema>;
export type WcagCandidateEvaluation = z.infer<typeof wcagCandidateEvaluationSchema>;
