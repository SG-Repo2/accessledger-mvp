import { z } from 'zod';

import { entityIdSchema, schemaVersionSchema, timestampSchema, urlSchema } from './common.js';
import { evidenceSchema } from './evidence.js';
import { pageSchema } from './page.js';

export const rawPageAssessmentRequestSchema = z.object({
  assessmentId: entityIdSchema,
  url: urlSchema,
});

export const rawPageAssessmentErrorSchema = z.object({
  stage: z.enum([
    'browser_launch',
    'navigation',
    'page_metadata',
    'axe_injection',
    'axe_execution',
  ]),
  name: z.string().trim().min(1),
  message: z.string().trim().min(1),
});

export const rawPageAssessmentOperationalResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('loaded') }),
  z.object({
    status: z.literal('navigation_failed'),
    error: rawPageAssessmentErrorSchema,
  }),
  z.object({
    status: z.literal('scan_failed'),
    error: rawPageAssessmentErrorSchema,
  }),
]);

export const rawPageAssessmentSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    page: pageSchema,
    browserEvidence: evidenceSchema,
    scannerEvidence: evidenceSchema.nullable(),
    operationalResult: rawPageAssessmentOperationalResultSchema,
    startedAt: timestampSchema,
    completedAt: timestampSchema,
  })
  .superRefine((result, context) => {
    const evidence = [result.browserEvidence, result.scannerEvidence].filter(
      (item) => item !== null,
    );
    const evidenceIds = evidence.map((item) => item.id);

    if (
      result.browserEvidence.kind !== 'raw_browser_result' ||
      result.browserEvidence.source.type !== 'browser'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['browserEvidence'],
        message: 'Browser evidence must have browser source and kind raw_browser_result.',
      });
    }

    if (
      result.scannerEvidence !== null &&
      (result.scannerEvidence.kind !== 'raw_scanner_result' ||
        result.scannerEvidence.source.type !== 'scanner')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['scannerEvidence'],
        message: 'Scanner evidence must have scanner source and kind raw_scanner_result.',
      });
    }

    for (const item of evidence) {
      if (item.assessmentId !== result.page.assessmentId || item.pageId !== result.page.id) {
        context.addIssue({
          code: 'custom',
          path: ['page'],
          message: 'All evidence must use the assessment and page IDs from Page.',
        });
      }
    }

    if (JSON.stringify(result.page.rawEvidenceIds) !== JSON.stringify(evidenceIds)) {
      context.addIssue({
        code: 'custom',
        path: ['page', 'rawEvidenceIds'],
        message: 'Page rawEvidenceIds must list the aggregate evidence records in order.',
      });
    }

    if (result.operationalResult.status === 'navigation_failed') {
      if (
        result.page.loadStatus !== 'failed' ||
        result.scannerEvidence !== null ||
        !['browser_launch', 'navigation', 'page_metadata'].includes(
          result.operationalResult.error.stage,
        )
      ) {
        context.addIssue({
          code: 'custom',
          path: ['operationalResult'],
          message: 'Navigation failure requires a failed Page and no scanner evidence.',
        });
      }
      return;
    }

    if (
      result.page.loadStatus !== 'loaded' ||
      result.scannerEvidence === null ||
      (result.operationalResult.status === 'scan_failed' &&
        !['axe_injection', 'axe_execution'].includes(result.operationalResult.error.stage))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['operationalResult'],
        message: 'Loaded and scan-failed results require a loaded Page and scanner evidence.',
      });
    }
  });

export type RawPageAssessmentRequest = z.infer<typeof rawPageAssessmentRequestSchema>;
export type RawPageAssessmentError = z.infer<typeof rawPageAssessmentErrorSchema>;
export type RawPageAssessmentOperationalResult = z.infer<
  typeof rawPageAssessmentOperationalResultSchema
>;
export type RawPageAssessment = z.infer<typeof rawPageAssessmentSchema>;
