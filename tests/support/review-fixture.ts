import { DeterministicFindingDrafter } from '@accessledger/findings';
import {
  CONTRACT_SCHEMA_VERSION,
  evidenceSchema,
  groupProposalSchema,
  observationOccurrenceSchema,
  observationSchema,
  pageSchema,
  wcagCandidateEvaluationSchema,
  type Evidence,
  type Finding,
  type GroupProposal,
  type Observation,
  type ObservationOccurrence,
  type Page,
  type WcagCandidateEvaluation,
} from '@accessledger/shared';

export const reviewNow = '2026-09-28T18:00:00.000Z';

export interface ReviewFixture {
  finding: Finding;
  group: GroupProposal;
  observations: Observation[];
  occurrences: ObservationOccurrence[];
  wcagEvaluations: WcagCandidateEvaluation[];
  pages: Page[];
  evidence: Evidence[];
}

export function reviewFixture(): ReviewFixture {
  const evidence = evidenceSchema.parse({
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    id: 'evidence-review-source',
    assessmentId: 'assessment-review',
    pageId: 'page-review',
    kind: 'raw_scanner_result',
    source: { type: 'scanner', name: 'axe-core', version: '4.13.0' },
    capturedAt: reviewNow,
    contentType: 'application/json',
    payload: { result: 'violation', impact: 'critical' },
    metadata: {},
  });
  const page = pageSchema.parse({
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    id: 'page-review',
    assessmentId: 'assessment-review',
    requestedUrl: 'https://fixture.example/form',
    finalUrl: 'https://fixture.example/form',
    title: 'Form fixture',
    language: 'en',
    loadStatus: 'loaded',
    loadedAt: reviewNow,
    failureReason: null,
    rawEvidenceIds: [evidence.id],
    createdAt: reviewNow,
    updatedAt: reviewNow,
  });
  const observation = observationSchema.parse({
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    id: 'observation-review',
    assessmentId: 'assessment-review',
    source: evidence.source,
    sourceRuleId: 'button-name',
    category: 'accessible_name',
    summary: 'A button does not have a discernible accessible name.',
    testability: 'deterministic',
    evaluation: 'supported',
    candidateWcagCriteria: ['4.1.2'],
    evidenceIds: [evidence.id],
    facts: { result: 'violation', occurrenceCount: 1 },
    createdAt: reviewNow,
    updatedAt: reviewNow,
  });
  const occurrence = observationOccurrenceSchema.parse({
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    id: 'occurrence-review',
    assessmentId: 'assessment-review',
    observationId: observation.id,
    pageId: page.id,
    evidenceIds: [evidence.id],
    selector: '#submit',
    htmlSnippet: '<button id="submit"></button>',
    componentFingerprint: 'fixture-submit-button',
    sourceDetail: { kind: 'axe_node', target: ['#submit'] },
    observedAt: reviewNow,
  });
  const evaluation = wcagCandidateEvaluationSchema.parse({
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    id: 'evaluation-review',
    assessmentId: 'assessment-review',
    observationId: observation.id,
    datasetVersion: '2026.09.28-1',
    standard: { name: 'WCAG', version: '2.1' },
    mappingStatus: 'known_rule',
    criterionId: '4.1.2',
    sourceMapping: {
      tool: 'axe-core',
      ruleId: 'button-name',
      toolVersionRange: '4.13.x',
      mappingType: 'tool_documented',
      mappingSource: 'https://dequeuniversity.com/rules/axe/4.13/button-name',
      verifiedAt: reviewNow,
      evidenceRequirements: [
        {
          id: 'scanner-result-is-violation',
          description: 'Scanner result must identify the covered result.',
          factPath: 'result',
          operator: 'equals',
          expectedValue: 'violation',
        },
      ],
    },
    evaluation: 'supported',
    reason: 'requirements_satisfied',
    requirementEvaluations: [
      {
        requirementId: 'scanner-result-is-violation',
        description: 'Scanner result must identify the covered result.',
        status: 'satisfied',
        factPath: 'result',
        operator: 'equals',
        expectedValue: 'violation',
        actualValue: 'violation',
        evidenceIds: [evidence.id],
      },
    ],
    evidenceIds: [evidence.id],
    evaluatedAt: reviewNow,
  });
  const group = groupProposalSchema.parse({
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    groupingAlgorithmVersion: '1.0.0',
    id: 'group-review',
    assessmentId: 'assessment-review',
    kind: 'singleton',
    reviewStatus: 'accepted',
    groupingConfidence: 'low',
    rationale: 'A supported singleton remains reviewable.',
    members: [
      {
        observationId: observation.id,
        occurrenceId: occurrence.id,
        pageId: page.id,
        evidenceIds: [evidence.id],
      },
    ],
    memberObservationIds: [observation.id],
    memberOccurrenceIds: [occurrence.id],
    pageIds: [page.id],
    evidenceIds: [evidence.id],
    signals: [
      {
        type: 'source_identity',
        strength: 'required',
        value: 'scanner:axe-core:4.13.0',
        occurrenceIds: [occurrence.id],
      },
      {
        type: 'source_rule',
        strength: 'required',
        value: 'button-name',
        occurrenceIds: [occurrence.id],
      },
      {
        type: 'source_category',
        strength: 'required',
        value: 'accessible_name',
        occurrenceIds: [occurrence.id],
      },
    ],
    ambiguity: null,
    createdAt: reviewNow,
    updatedAt: reviewNow,
  });
  const context = {
    observations: [observation],
    occurrences: [occurrence],
    wcagEvaluations: [evaluation],
    pages: [page],
    evidence: [evidence],
  };
  const finding = new DeterministicFindingDrafter({ clock: () => new Date(reviewNow) }).draft(
    group,
    context,
  );
  return { finding, group, ...context };
}

export function humanEvidence(id: string, notes = 'Human review confirmed the observable claim.') {
  return evidenceSchema.parse({
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    id,
    assessmentId: 'assessment-review',
    pageId: null,
    kind: 'human_note',
    source: { type: 'human', name: 'Auditor Example', version: null },
    capturedAt: reviewNow,
    contentType: 'application/json',
    payload: { notes },
    metadata: { fixture: true },
  });
}
