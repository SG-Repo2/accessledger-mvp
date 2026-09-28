import { describe, expect, it } from 'vitest';

import {
  CONTRACT_SCHEMA_VERSION,
  assessmentSchema,
  evidenceSchema,
  findingSchema,
  journeyResultSchema,
  observationOccurrenceSchema,
  observationSchema,
  pageSchema,
  residentJourneySchema,
  validationSchema,
  wcagCriterionSchema,
} from '../src/index.js';

const now = '2026-09-28T12:00:00.000Z';

describe('shared domain contracts', () => {
  it('validates the complete traceability chain and nullable judgments', () => {
    const assessment = assessmentSchema.parse({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      id: 'assessment-1',
      name: 'Municipal website assessment',
      status: 'draft',
      targetUrls: ['https://example.gov/'],
      targetStandard: { name: 'WCAG', version: '2.1', levels: ['A', 'AA'] },
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    const page = pageSchema.parse({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      id: 'page-1',
      assessmentId: assessment.id,
      requestedUrl: assessment.targetUrls[0],
      finalUrl: null,
      title: null,
      language: null,
      loadStatus: 'pending',
      loadedAt: null,
      failureReason: null,
      rawEvidenceIds: ['evidence-1'],
      createdAt: now,
      updatedAt: now,
    });

    const evidence = evidenceSchema.parse({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      id: 'evidence-1',
      assessmentId: assessment.id,
      pageId: page.id,
      kind: 'raw_scanner_result',
      source: { type: 'scanner', name: 'fixture-scanner', version: null },
      capturedAt: now,
      contentType: 'application/json',
      payload: { ruleId: 'button-name', nodes: 1 },
      metadata: {},
    });

    const observation = observationSchema.parse({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      id: 'observation-1',
      assessmentId: assessment.id,
      sourceRuleId: 'button-name',
      category: 'accessible-name',
      summary: 'A button has no accessible name.',
      testability: 'deterministic',
      evaluation: 'supported',
      candidateWcagCriteria: ['4.1.2'],
      evidenceIds: [evidence.id],
      createdAt: now,
      updatedAt: now,
    });

    const occurrence = observationOccurrenceSchema.parse({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      id: 'occurrence-1',
      assessmentId: assessment.id,
      observationId: observation.id,
      pageId: page.id,
      evidenceIds: [evidence.id],
      selector: '#save',
      htmlSnippet: '<button id="save"></button>',
      componentFingerprint: null,
      observedAt: now,
    });

    const finding = findingSchema.parse({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      id: 'finding-1',
      assessmentId: assessment.id,
      title: 'Buttons lack accessible names',
      status: 'draft',
      wcagCriteria: ['4.1.2'],
      condition: 'The inspected button has no computed accessible name.',
      cause: null,
      effect: null,
      recommendation: null,
      severity: null,
      confidence: null,
      validationStatus: 'required',
      affectedUrls: [page.requestedUrl],
      affectedComponents: [],
      affectedJourneys: [],
      occurrenceCount: 1,
      observationIds: [observation.id],
      evidenceIds: occurrence.evidenceIds,
      createdAt: now,
      updatedAt: now,
    });

    expect(finding.cause).toBeNull();
    expect(finding.evidenceIds).toEqual(['evidence-1']);
  });

  it('validates WCAG knowledge and documented rule mappings', () => {
    const criterion = wcagCriterionSchema.parse({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      id: '4.1.2',
      title: 'Name, Role, Value',
      level: 'A',
      principle: 'robust',
      guideline: '4.1 Compatible',
      normativeSource: 'https://www.w3.org/TR/WCAG21/#name-role-value',
      intentSource: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html',
      automatedTestability: 'partial',
      evidenceRequirements: ['Computed accessible name and relevant source markup'],
      knownRuleMappings: [
        {
          tool: 'axe-core',
          ruleId: 'button-name',
          toolVersionRange: null,
          mappingType: 'tool_documented',
          mappingSource: null,
          verifiedAt: null,
        },
      ],
      manualValidationGuidance: 'Validate complex controls with assistive technology.',
    });

    expect(criterion.knownRuleMappings[0]?.ruleId).toBe('button-name');
  });

  it('validates human journey and validation records without simulating a resident', () => {
    const journey = residentJourneySchema.parse({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      id: 'journey-1',
      assessmentId: 'assessment-1',
      goal: 'Retrieve a meeting agenda',
      startingUrl: 'https://example.gov/',
      preconditions: ['NVDA is running on Windows.'],
      humanTask: 'Find and open the current meeting agenda.',
      expectedObservableOutcome: 'The agenda can be located and opened.',
      relatedFindingIds: [],
      createdAt: now,
      updatedAt: now,
    });

    const result = journeyResultSchema.parse({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      id: 'journey-result-1',
      assessmentId: journey.assessmentId,
      journeyId: journey.id,
      outcome: 'completed_with_difficulty',
      nvdaResult: 'The link was announced without useful destination context.',
      performedBy: 'Human auditor',
      startedAt: now,
      completedAt: now,
      notes: null,
      relatedFindingIds: ['finding-1'],
      evidenceIds: ['evidence-human-1'],
    });

    const validation = validationSchema.parse({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      id: 'validation-1',
      assessmentId: journey.assessmentId,
      subject: { type: 'journey_result', id: result.id },
      method: 'nvda',
      outcome: 'supported',
      performedBy: 'Human auditor',
      performedAt: now,
      assistiveTechnology: { name: 'NVDA', version: null, platform: 'Windows' },
      notes: null,
      evidenceIds: result.evidenceIds,
    });

    expect(validation.assistiveTechnology?.name).toBe('NVDA');
  });

  it('rejects unversioned contracts and findings without traceable evidence', () => {
    expect(
      assessmentSchema.safeParse({
        id: 'assessment-1',
        name: 'Missing version',
      }).success,
    ).toBe(false);

    expect(
      findingSchema.safeParse({
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        id: 'finding-1',
        assessmentId: 'assessment-1',
        title: 'Untraceable finding',
        status: 'draft',
        wcagCriteria: [],
        condition: 'A claim without source evidence.',
        cause: null,
        effect: null,
        recommendation: null,
        severity: null,
        confidence: null,
        validationStatus: 'required',
        affectedUrls: [],
        affectedComponents: [],
        affectedJourneys: [],
        occurrenceCount: 0,
        observationIds: [],
        evidenceIds: [],
        createdAt: now,
        updatedAt: now,
      }).success,
    ).toBe(false);
  });
});
