import { describe, expect, it } from 'vitest';

import {
  CONTRACT_SCHEMA_VERSION,
  rawPageAssessmentRequestSchema,
  rawPageAssessmentSchema,
} from '../src/index.js';

const now = '2026-09-28T12:00:00.000Z';

describe('RawPageAssessment contract', () => {
  it('validates a serializable loaded aggregate', () => {
    const request = rawPageAssessmentRequestSchema.parse({
      assessmentId: 'assessment-1',
      url: 'https://example.gov/form',
    });
    const aggregate = makeLoadedAggregate(request.assessmentId, request.url);

    const parsed = rawPageAssessmentSchema.parse(JSON.parse(JSON.stringify(aggregate)));

    expect(parsed.operationalResult).toEqual({ status: 'loaded' });
    expect(parsed.page.rawEvidenceIds).toEqual(['browser-1', 'scanner-1']);
  });

  it('rejects operational state and traceability mismatches', () => {
    const aggregate = makeLoadedAggregate('assessment-1', 'https://example.gov/form');

    expect(
      rawPageAssessmentSchema.safeParse({
        ...aggregate,
        page: { ...aggregate.page, rawEvidenceIds: ['scanner-1'] },
        scannerEvidence: null,
        operationalResult: {
          status: 'navigation_failed',
          error: { stage: 'navigation', name: 'Error', message: 'Navigation failed.' },
        },
      }).success,
    ).toBe(false);
  });
});

function makeLoadedAggregate(assessmentId: string, url: string) {
  return {
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    page: {
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      id: 'page-1',
      assessmentId,
      requestedUrl: url,
      finalUrl: url,
      title: 'Fixture',
      language: 'en',
      loadStatus: 'loaded',
      loadedAt: now,
      failureReason: null,
      rawEvidenceIds: ['browser-1', 'scanner-1'],
      createdAt: now,
      updatedAt: now,
    },
    browserEvidence: {
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      id: 'browser-1',
      assessmentId,
      pageId: 'page-1',
      kind: 'raw_browser_result',
      source: { type: 'browser', name: 'playwright', version: '1.63.0' },
      capturedAt: now,
      contentType: 'application/json',
      payload: { status: 'loaded', finalUrl: url },
      metadata: {},
    },
    scannerEvidence: {
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      id: 'scanner-1',
      assessmentId,
      pageId: 'page-1',
      kind: 'raw_scanner_result',
      source: { type: 'scanner', name: 'axe-core', version: '4.13.0' },
      capturedAt: now,
      contentType: 'application/json',
      payload: { violations: [] },
      metadata: {},
    },
    accessibilityEvidence: [],
    operationalResult: { status: 'loaded' },
    startedAt: now,
    completedAt: now,
  } as const;
}
