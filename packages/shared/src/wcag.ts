import { z } from 'zod';

import { conformanceLevelSchema } from './assessment.js';
import { schemaVersionSchema, timestampSchema, urlSchema } from './common.js';

export const wcagPrincipleSchema = z.enum(['perceivable', 'operable', 'understandable', 'robust']);

export const automatedTestabilitySchema = z.enum(['automated', 'partial', 'manual']);

export const ruleMappingSchema = z.object({
  tool: z.string().trim().min(1),
  ruleId: z.string().trim().min(1),
  toolVersionRange: z.string().trim().min(1).nullable(),
  mappingType: z.enum(['tool_documented', 'reviewed']),
  mappingSource: urlSchema.nullable(),
  verifiedAt: timestampSchema.nullable(),
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

export type WcagPrinciple = z.infer<typeof wcagPrincipleSchema>;
export type AutomatedTestability = z.infer<typeof automatedTestabilitySchema>;
export type RuleMapping = z.infer<typeof ruleMappingSchema>;
export type WCAGCriterion = z.infer<typeof wcagCriterionSchema>;
