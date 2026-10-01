import { describe, expect, it } from 'vitest';

import {
  CONTRACT_SCHEMA_VERSION,
  assessmentSchema,
  evidenceSchema,
  findingSchema,
  groupProposalSchema,
  journeyResultSchema,
  observationOccurrenceSchema,
  observationSchema,
  pageSchema,
  proposalDraftLinkSchema,
  proposalReviewDecisionSchema,
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
      source: evidence.source,
      sourceRuleId: 'button-name',
      category: 'accessible-name',
      summary: 'A button has no accessible name.',
      testability: 'deterministic',
      evaluation: 'supported',
      candidateWcagCriteria: ['4.1.2'],
      evidenceIds: [evidence.id],
      facts: { result: 'violation', occurrenceCount: 1 },
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
      sourceDetail: { kind: 'axe_node', target: ['#save'] },
      observedAt: now,
    });

    const finding = findingSchema.parse({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      id: 'finding-1',
      assessmentId: assessment.id,
      sourceGroupProposalId: 'group-proposal-1',
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
      validationNeed: 'A human must verify the condition and WCAG applicability.',
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
          evidenceRequirements: [
            {
              id: 'scanner-violation',
              description: 'The scanner result is a violation.',
              factPath: 'result',
              operator: 'equals',
              expectedValue: 'violation',
            },
          ],
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
      environment: {
        platform: 'Windows 11',
        browser: { name: 'Chrome', version: '140' },
        assistiveTechnology: { name: 'NVDA', version: '2026.1' },
      },
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
      claims: ['condition'],
      validatedSeverity: null,
      performedBy: 'Human auditor',
      performedAt: now,
      assistiveTechnology: { name: 'NVDA', version: null, platform: 'Windows' },
      notes: null,
      evidenceIds: result.evidenceIds,
    });

    expect(validation.assistiveTechnology?.name).toBe('NVDA');
    expect(
      validationSchema.safeParse({
        ...validation,
        assistiveTechnology: { name: 'NVDA', version: null, platform: null },
      }).success,
    ).toBe(false);
    expect(
      validationSchema.safeParse({
        ...validation,
        claims: ['severity'],
        validatedSeverity: null,
      }).success,
    ).toBe(false);
    expect(journeyResultSchema.safeParse({ ...result, schemaVersion: '2.0.0' }).success).toBe(
      false,
    );
    expect(
      journeyResultSchema.safeParse({
        ...result,
        outcome: 'not_attempted',
        completedAt: now,
      }).success,
    ).toBe(false);
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
        sourceGroupProposalId: 'group-proposal-1',
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
        validationNeed: 'A human must verify the condition and WCAG applicability.',
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

  it('validates an inspectable grouping proposal without collapsing occurrence traceability', () => {
    const proposal = groupProposalSchema.parse({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      groupingAlgorithmVersion: '1.0.0',
      id: 'group-proposal-1',
      assessmentId: 'assessment-1',
      kind: 'repeat_candidate',
      reviewStatus: 'pending',
      groupingConfidence: 'high',
      rationale: 'Members share a reviewed deterministic identity signal.',
      members: [
        {
          observationId: 'observation-1',
          occurrenceId: 'occurrence-1',
          pageId: 'page-1',
          evidenceIds: ['evidence-1'],
        },
        {
          observationId: 'observation-2',
          occurrenceId: 'occurrence-2',
          pageId: 'page-2',
          evidenceIds: ['evidence-2'],
        },
      ],
      memberObservationIds: ['observation-1', 'observation-2'],
      memberOccurrenceIds: ['occurrence-1', 'occurrence-2'],
      pageIds: ['page-1', 'page-2'],
      evidenceIds: ['evidence-1', 'evidence-2'],
      signals: [
        {
          type: 'source_identity',
          strength: 'required',
          value: 'scanner:axe-core:4.13.0',
          occurrenceIds: ['occurrence-1', 'occurrence-2'],
        },
        {
          type: 'source_rule',
          strength: 'required',
          value: 'button-name',
          occurrenceIds: ['occurrence-1', 'occurrence-2'],
        },
        {
          type: 'component_fingerprint',
          strength: 'identity',
          value: 'header-action',
          occurrenceIds: ['occurrence-1', 'occurrence-2'],
        },
      ],
      ambiguity: null,
      createdAt: now,
      updatedAt: now,
    });

    expect(proposal.members).toHaveLength(2);
    expect(
      groupProposalSchema.safeParse({ ...proposal, memberOccurrenceIds: ['occurrence-1'] }).success,
    ).toBe(false);
  });

  it('serializes explicit pre-Finding decisions and proposal-to-draft links', () => {
    const decision = proposalReviewDecisionSchema.parse({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      id: 'proposal-decision-1',
      assessmentId: 'assessment-1',
      proposalId: 'group-proposal-1',
      status: 'accepted',
      actor: 'Human auditor',
      reason: 'The repeated members share the inspected structure.',
      decidedAt: now,
    });
    const link = proposalDraftLinkSchema.parse({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      proposalId: decision.proposalId,
      findingId: 'finding-1',
      linkedAt: now,
    });

    expect(proposalReviewDecisionSchema.parse(JSON.parse(JSON.stringify(decision)))).toEqual(
      decision,
    );
    expect(proposalDraftLinkSchema.parse(JSON.parse(JSON.stringify(link)))).toEqual(link);
    expect(proposalReviewDecisionSchema.safeParse({ ...decision, status: 'pending' }).success).toBe(
      false,
    );
  });
});
