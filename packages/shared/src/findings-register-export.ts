import { z } from 'zod';

import { entityIdSchema, timestampSchema, urlSchema } from './common.js';
import { confidenceSchema, severitySchema } from './finding.js';
import { journeyEnvironmentSchema, journeyOutcomeSchema } from './journey.js';
import {
  validationClaimSchema,
  validationMethodSchema,
  validationOutcomeSchema,
} from './validation.js';

export const FINDINGS_REGISTER_EXPORT_SCHEMA_VERSION = '1.0.0' as const;

export const findingsRegisterExportSchemaVersionSchema = z.literal(
  FINDINGS_REGISTER_EXPORT_SCHEMA_VERSION,
);

export const findingsRegisterExportFormatSchema = z.enum(['json', 'csv']);

export const findingsRegisterAssistiveTechnologySchema = z
  .object({
    name: z.string().trim().min(1),
    version: z.string().trim().min(1).nullable(),
    platform: z.string().trim().min(1).nullable(),
  })
  .nullable();

export const findingsRegisterValidationSummarySchema = z.object({
  validationId: entityIdSchema,
  subject: z.object({
    type: z.enum(['finding', 'journey_result']),
    id: entityIdSchema,
  }),
  method: validationMethodSchema,
  outcome: validationOutcomeSchema,
  claims: z.array(validationClaimSchema).min(1),
  validatedSeverity: severitySchema.nullable(),
  performedBy: z.string().trim().min(1),
  performedAt: timestampSchema,
  assistiveTechnology: findingsRegisterAssistiveTechnologySchema,
  notes: z.string().trim().min(1).nullable(),
  evidenceIds: z.array(entityIdSchema).min(1),
});

export const findingsRegisterOccurrenceReferenceSchema = z.object({
  occurrenceId: entityIdSchema,
  observationId: entityIdSchema,
  pageId: entityIdSchema,
  url: urlSchema,
  component: z.string().trim().min(1),
  evidenceIds: z.array(entityIdSchema).min(1),
});

export const findingsRegisterJourneyResultSummarySchema = z.object({
  resultId: entityIdSchema,
  outcome: journeyOutcomeSchema,
  environment: journeyEnvironmentSchema,
  nvdaResult: z.string().trim().min(1).nullable(),
  performedBy: z.string().trim().min(1),
  startedAt: timestampSchema,
  completedAt: timestampSchema.nullable(),
  notes: z.string().trim().min(1).nullable(),
  relatedFindingIds: z.array(entityIdSchema).min(1),
  evidenceIds: z.array(entityIdSchema).min(1),
  validationIds: z.array(entityIdSchema),
});

export const findingsRegisterJourneySummarySchema = z.object({
  journeyId: entityIdSchema,
  goal: z.string().trim().min(1),
  startingUrl: urlSchema,
  preconditions: z.array(z.string().trim().min(1)),
  humanTask: z.string().trim().min(1),
  expectedObservableOutcome: z.string().trim().min(1),
  relatedFindingIds: z.array(entityIdSchema).min(1),
  results: z.array(findingsRegisterJourneyResultSummarySchema).min(1),
});

export const findingsRegisterRecordSchema = z.object({
  schemaVersion: findingsRegisterExportSchemaVersionSchema,
  findingContractSchemaVersion: z.string().trim().min(1),
  findingId: entityIdSchema,
  assessmentId: entityIdSchema,
  sourceGroupProposalId: entityIdSchema,
  status: z.literal('approved'),
  content: z.object({
    title: z.string().trim().min(1),
    condition: z.string().trim().min(1),
    cause: z.string().trim().min(1),
    effect: z.string().trim().min(1),
    recommendation: z.string().trim().min(1),
  }),
  validationNeed: z.string().trim().min(1),
  severity: severitySchema,
  confidence: confidenceSchema,
  wcagCriteria: z.array(z.string().regex(/^\d+\.\d+\.\d+$/)),
  occurrenceCount: z.number().int().positive(),
  affectedUrls: z.array(urlSchema).min(1),
  affectedComponents: z.array(z.string().trim().min(1)).min(1),
  trace: z.object({
    observationIds: z.array(entityIdSchema).min(1),
    sourceEvidenceIds: z.array(entityIdSchema).min(1),
    occurrences: z.array(findingsRegisterOccurrenceReferenceSchema).min(1),
  }),
  validations: z.array(findingsRegisterValidationSummarySchema).min(1),
  journeys: z.array(findingsRegisterJourneySummarySchema),
});

export const findingsRegisterDocumentSchema = z
  .object({
    schemaVersion: findingsRegisterExportSchemaVersionSchema,
    assessmentId: entityIdSchema,
    generatedAt: timestampSchema,
    recordCount: z.number().int().nonnegative(),
    findings: z.array(findingsRegisterRecordSchema),
  })
  .superRefine((document, context) => {
    if (document.recordCount !== document.findings.length) {
      context.addIssue({
        code: 'custom',
        path: ['recordCount'],
        message: 'Record count must equal the number of exported Findings.',
      });
    }
    if (document.findings.some((finding) => finding.assessmentId !== document.assessmentId)) {
      context.addIssue({
        code: 'custom',
        path: ['findings'],
        message: 'Every exported Finding must belong to the document assessment.',
      });
    }
    const findingIds = document.findings.map((finding) => finding.findingId);
    if (findingIds.length !== new Set(findingIds).size) {
      context.addIssue({
        code: 'custom',
        path: ['findings'],
        message: 'Exported Finding IDs must be unique.',
      });
    }
  });

export const findingsRegisterExportManifestSchema = z.object({
  schemaVersion: findingsRegisterExportSchemaVersionSchema,
  format: findingsRegisterExportFormatSchema,
  assessmentId: entityIdSchema,
  generatedAt: timestampSchema,
  recordCount: z.number().int().nonnegative(),
  artifactPath: z.string().trim().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  byteLength: z.number().int().nonnegative(),
});

export type FindingsRegisterExportFormat = z.infer<typeof findingsRegisterExportFormatSchema>;
export type FindingsRegisterValidationSummary = z.infer<
  typeof findingsRegisterValidationSummarySchema
>;
export type FindingsRegisterOccurrenceReference = z.infer<
  typeof findingsRegisterOccurrenceReferenceSchema
>;
export type FindingsRegisterJourneyResultSummary = z.infer<
  typeof findingsRegisterJourneyResultSummarySchema
>;
export type FindingsRegisterJourneySummary = z.infer<typeof findingsRegisterJourneySummarySchema>;
export type FindingsRegisterRecord = z.infer<typeof findingsRegisterRecordSchema>;
export type FindingsRegisterDocument = z.infer<typeof findingsRegisterDocumentSchema>;
export type FindingsRegisterExportManifest = z.infer<typeof findingsRegisterExportManifestSchema>;
