import { describe, expect, it } from 'vitest';

import {
  CONTRACT_SCHEMA_VERSION,
  evidenceSchema,
  findingSchema,
  groupProposalSchema,
  observationOccurrenceSchema,
  observationSchema,
  pageSchema,
  wcagCandidateEvaluationSchema,
  type Evidence,
  type GroupProposal,
  type Observation,
  type ObservationOccurrence,
  type Page,
  type WcagCandidateEvaluation,
} from '@accessledger/shared';

import {
  DeterministicFindingDrafter,
  FINDING_DRAFTING_POLICY_VERSION,
  type FindingEvidenceContext,
} from '../src/index.js';

const now = '2026-09-28T17:00:00.000Z';

describe('DeterministicFindingDrafter', () => {
  it('drafts a stable, exact, multi-page Finding from a high-confidence repeat candidate', () => {
    const fixture = repeatFixture();
    const before = JSON.stringify(fixture);

    const first = drafter().draft(fixture.group, fixture.context);
    const second = drafter().draft(fixture.group, shuffledContext(fixture.context));

    expect(second).toEqual(first);
    expect(first).toMatchObject({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      sourceGroupProposalId: fixture.group.id,
      status: 'draft',
      occurrenceCount: 2,
      observationIds: ['observation-a', 'observation-b'],
      evidenceIds: ['evidence-a', 'evidence-b'],
      wcagCriteria: ['4.1.2'],
      validationStatus: 'required',
      cause: null,
      effect: null,
      recommendation: null,
      severity: null,
      confidence: null,
    });
    expect(first.id).toMatch(/^finding-[a-f0-9]{24}$/);
    expect(first.affectedUrls).toEqual([
      'https://fixture.example/departments',
      'https://fixture.example/services',
    ]);
    expect(first.affectedComponents).toEqual(['fingerprint:shared-header-button']);
    expect(first.condition).toBe(
      'Collected axe-core evidence records 2 occurrences for rule "button-name" (accessible name) across 2 inspected URLs.',
    );
    expect(first.validationNeed).toMatch(/^Human review is required/);
    expect(JSON.stringify(fixture)).toBe(before);
    expect(FINDING_DRAFTING_POLICY_VERSION).toBe('1.0.0');
  });

  it('allows an accepted repeat proposal without promoting candidate WCAG mappings', () => {
    const fixture = repeatFixture({
      group: { reviewStatus: 'accepted', groupingConfidence: 'medium' },
      evaluationState: 'uncertain',
    });

    const finding = drafter().draft(fixture.group, fixture.context);

    expect(finding.wcagCriteria).toEqual([]);
    expect(finding.validationNeed).toContain('resolve candidate WCAG mappings');
  });

  it('includes a criterion only when it is supported for every member Observation', () => {
    const fixture = repeatFixture();
    fixture.context.wcagEvaluations[1] = fixtureEvaluation({
      id: 'evaluation-b',
      observationId: 'observation-b',
      evaluation: 'uncertain',
    });

    const finding = drafter().draft(fixture.group, fixture.context);

    expect(finding.wcagCriteria).toEqual([]);
    expect(finding.validationNeed).toContain('candidate WCAG mappings');
  });

  it('allows an accepted singleton only when its WCAG criterion is supported', () => {
    const supported = singletonFixture('supported');
    const finding = drafter().draft(supported.group, supported.context);

    expect(finding.occurrenceCount).toBe(1);
    expect(finding.wcagCriteria).toEqual(['4.1.2']);

    const unsupported = singletonFixture('unsupported');
    expect(() => drafter().draft(unsupported.group, unsupported.context)).toThrow(
      /singleton proposal requires at least one supported WCAG criterion/,
    );
  });

  it.each([
    ['rejected', { reviewStatus: 'rejected' }, /rejected proposal/],
    ['split', { reviewStatus: 'split' }, /split proposal/],
    [
      'pending medium repeat',
      { reviewStatus: 'pending', groupingConfidence: 'medium' },
      /requires/,
    ],
  ] as const)('rejects an ineligible %s proposal', (_label, override, expected) => {
    const fixture = repeatFixture({ group: override });
    expect(() => drafter().draft(fixture.group, fixture.context)).toThrow(expected);
  });

  it('rejects ambiguous and pending singleton inputs even if their records are complete', () => {
    const singleton = singletonFixture('supported');
    const pending = groupProposalSchema.parse({
      ...singleton.group,
      reviewStatus: 'pending',
      updatedAt: now,
    });
    expect(() => drafter().draft(pending, singleton.context)).toThrow(/requires/);

    const ambiguous = groupProposalSchema.parse({
      ...singleton.group,
      kind: 'ambiguous',
      ambiguity: {
        reason: 'insufficient_identity_signal',
        relatedOccurrenceIds: ['outside-occurrence'],
      },
    });
    expect(() => drafter().draft(ambiguous, singleton.context)).toThrow(/ambiguous proposal/);
  });

  it('rejects missing records and a mismatched member evidence ledger', () => {
    const missing = repeatFixture();
    missing.context.evidence.pop();
    expect(() => drafter().draft(missing.group, missing.context)).toThrow(
      /Evidence context must exactly match/,
    );

    const broken = repeatFixture();
    broken.context.occurrences[0] = fixtureOccurrence({
      id: 'occurrence-a',
      observationId: 'observation-b',
      pageId: 'page-a',
      evidenceIds: ['evidence-a'],
    });
    expect(() => drafter().draft(broken.group, broken.context)).toThrow(/broken record references/);
  });

  it('rejects missing WCAG evaluation coverage and unrelated context records', () => {
    const missingEvaluation = repeatFixture();
    missingEvaluation.context.wcagEvaluations.pop();
    expect(() => drafter().draft(missingEvaluation.group, missingEvaluation.context)).toThrow(
      /evaluated Observation context must exactly match/,
    );

    const extraObservation = repeatFixture();
    extraObservation.context.observations.push(
      fixtureObservation({ id: 'observation-extra', evidenceIds: ['evidence-a'] }),
    );
    expect(() => drafter().draft(extraObservation.group, extraObservation.context)).toThrow(
      /Observation context must exactly match/,
    );
  });

  it('round-trips through the Finding schema and rejects a different schema version', () => {
    const fixture = repeatFixture();
    const finding = drafter().draft(fixture.group, fixture.context);
    const roundTrip = JSON.parse(JSON.stringify(finding)) as unknown;

    expect(findingSchema.parse(roundTrip)).toEqual(finding);
    expect(findingSchema.safeParse({ ...finding, schemaVersion: '2.0.0' }).success).toBe(false);
  });

  it('does not turn grouping confidence or scanner impact into judgment or prohibited prose', () => {
    const fixture = repeatFixture();
    fixture.context.evidence[0] = fixtureEvidence({
      id: 'evidence-a',
      pageId: 'page-a',
      payload: { impact: 'critical', result: 'violation' },
    });

    const finding = drafter().draft(fixture.group, fixture.context);
    const prose = [finding.title, finding.condition, finding.validationNeed]
      .join(' ')
      .toLowerCase();

    expect(finding.severity).toBeNull();
    expect(finding.confidence).toBeNull();
    expect(prose).not.toMatch(
      /certif|conform|compliance|violation|critical|blocker|serious|moderate|minor/,
    );
  });
});

function drafter(): DeterministicFindingDrafter {
  return new DeterministicFindingDrafter({ clock: () => new Date(now) });
}

function repeatFixture(
  options: {
    group?: Partial<GroupProposal>;
    evaluationState?: 'supported' | 'uncertain';
  } = {},
): { group: GroupProposal; context: MutableContext } {
  const observations = [
    fixtureObservation({ id: 'observation-a', evidenceIds: ['evidence-a'] }),
    fixtureObservation({ id: 'observation-b', evidenceIds: ['evidence-b'] }),
  ];
  const occurrences = [
    fixtureOccurrence({
      id: 'occurrence-a',
      observationId: 'observation-a',
      pageId: 'page-a',
      evidenceIds: ['evidence-a'],
      componentFingerprint: 'shared-header-button',
    }),
    fixtureOccurrence({
      id: 'occurrence-b',
      observationId: 'observation-b',
      pageId: 'page-b',
      evidenceIds: ['evidence-b'],
      componentFingerprint: 'shared-header-button',
    }),
  ];
  const pages = [
    fixturePage({ id: 'page-a', requestedUrl: 'https://fixture.example/departments' }),
    fixturePage({ id: 'page-b', requestedUrl: 'https://fixture.example/services' }),
  ];
  const evidence = [
    fixtureEvidence({ id: 'evidence-a', pageId: 'page-a' }),
    fixtureEvidence({ id: 'evidence-b', pageId: 'page-b' }),
  ];
  const evaluationState = options.evaluationState ?? 'supported';
  const wcagEvaluations = [
    fixtureEvaluation({
      id: 'evaluation-a',
      observationId: 'observation-a',
      evaluation: evaluationState,
      evidenceIds: ['evidence-a'],
    }),
    fixtureEvaluation({
      id: 'evaluation-b',
      observationId: 'observation-b',
      evaluation: evaluationState,
      evidenceIds: ['evidence-b'],
    }),
  ];
  const group = fixtureGroup({ ...options.group });
  return { group, context: { observations, occurrences, wcagEvaluations, pages, evidence } };
}

function singletonFixture(evaluation: 'supported' | 'unsupported'): {
  group: GroupProposal;
  context: MutableContext;
} {
  const observation = fixtureObservation({ id: 'observation-a', evidenceIds: ['evidence-a'] });
  const occurrence = fixtureOccurrence({
    id: 'occurrence-a',
    observationId: observation.id,
    pageId: 'page-a',
    evidenceIds: ['evidence-a'],
  });
  return {
    group: fixtureGroup({
      id: 'group-singleton',
      kind: 'singleton',
      reviewStatus: 'accepted',
      groupingConfidence: 'low',
      members: [member('observation-a', 'occurrence-a', 'page-a', 'evidence-a')],
      memberObservationIds: ['observation-a'],
      memberOccurrenceIds: ['occurrence-a'],
      pageIds: ['page-a'],
      evidenceIds: ['evidence-a'],
      signals: fixtureSignals(['occurrence-a']),
    }),
    context: {
      observations: [observation],
      occurrences: [occurrence],
      wcagEvaluations: [
        fixtureEvaluation({
          id: 'evaluation-a',
          observationId: 'observation-a',
          evaluation,
          evidenceIds: ['evidence-a'],
        }),
      ],
      pages: [fixturePage({ id: 'page-a' })],
      evidence: [fixtureEvidence({ id: 'evidence-a', pageId: 'page-a' })],
    },
  };
}

interface MutableContext {
  observations: Observation[];
  occurrences: ObservationOccurrence[];
  wcagEvaluations: WcagCandidateEvaluation[];
  pages: Page[];
  evidence: Evidence[];
}

function shuffledContext(context: FindingEvidenceContext): FindingEvidenceContext {
  return {
    observations: [...context.observations].reverse(),
    occurrences: [...context.occurrences].reverse(),
    wcagEvaluations: [...context.wcagEvaluations].reverse(),
    pages: [...context.pages].reverse(),
    evidence: [...context.evidence].reverse(),
  };
}

function fixtureGroup(overrides: Partial<GroupProposal> = {}): GroupProposal {
  const occurrenceIds = ['occurrence-a', 'occurrence-b'];
  return groupProposalSchema.parse({
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    groupingAlgorithmVersion: '1.0.0',
    id: 'group-repeat',
    assessmentId: 'assessment-fixture',
    kind: 'repeat_candidate',
    reviewStatus: 'pending',
    groupingConfidence: 'high',
    rationale: 'Members share the exact normalized component fingerprint.',
    members: [
      member('observation-a', 'occurrence-a', 'page-a', 'evidence-a'),
      member('observation-b', 'occurrence-b', 'page-b', 'evidence-b'),
    ],
    memberObservationIds: ['observation-a', 'observation-b'],
    memberOccurrenceIds: occurrenceIds,
    pageIds: ['page-a', 'page-b'],
    evidenceIds: ['evidence-a', 'evidence-b'],
    signals: fixtureSignals(occurrenceIds),
    ambiguity: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

function member(observationId: string, occurrenceId: string, pageId: string, evidenceId: string) {
  return { observationId, occurrenceId, pageId, evidenceIds: [evidenceId] };
}

function fixtureSignals(occurrenceIds: string[]) {
  return [
    {
      type: 'source_identity' as const,
      strength: 'required' as const,
      value: 'scanner:axe-core:4.13.0',
      occurrenceIds,
    },
    {
      type: 'source_rule' as const,
      strength: 'required' as const,
      value: 'button-name',
      occurrenceIds,
    },
    {
      type: 'source_category' as const,
      strength: 'required' as const,
      value: 'accessible_name',
      occurrenceIds,
    },
  ];
}

function fixtureObservation(
  overrides: Partial<Observation> & Pick<Observation, 'id'>,
): Observation {
  const { id, ...rest } = overrides;
  return observationSchema.parse({
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    id,
    assessmentId: 'assessment-fixture',
    source: { type: 'scanner', name: 'axe-core', version: '4.13.0' },
    sourceRuleId: 'button-name',
    category: 'accessible_name',
    summary: 'A button does not have a discernible accessible name.',
    testability: 'deterministic',
    evaluation: 'supported',
    candidateWcagCriteria: ['4.1.2'],
    evidenceIds: ['evidence-a'],
    facts: { result: 'violation', occurrenceCount: 1 },
    createdAt: now,
    updatedAt: now,
    ...rest,
  });
}

function fixtureOccurrence(
  overrides: Partial<ObservationOccurrence> & Pick<ObservationOccurrence, 'id' | 'observationId'>,
): ObservationOccurrence {
  const { id, observationId, ...rest } = overrides;
  return observationOccurrenceSchema.parse({
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    id,
    assessmentId: 'assessment-fixture',
    observationId,
    pageId: 'page-a',
    evidenceIds: ['evidence-a'],
    selector: '#save',
    htmlSnippet: '<button id="save"></button>',
    componentFingerprint: null,
    sourceDetail: { kind: 'axe_node' },
    observedAt: now,
    ...rest,
  });
}

function fixturePage(overrides: Partial<Page> & Pick<Page, 'id'>): Page {
  const { id, ...rest } = overrides;
  const requestedUrl = overrides.requestedUrl ?? 'https://fixture.example/page';
  return pageSchema.parse({
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    id,
    assessmentId: 'assessment-fixture',
    requestedUrl,
    finalUrl: requestedUrl,
    title: 'Fixture',
    language: 'en',
    loadStatus: 'loaded',
    loadedAt: now,
    failureReason: null,
    rawEvidenceIds: [],
    createdAt: now,
    updatedAt: now,
    ...rest,
  });
}

function fixtureEvidence(overrides: Partial<Evidence> & Pick<Evidence, 'id' | 'pageId'>): Evidence {
  const { id, pageId, ...rest } = overrides;
  return evidenceSchema.parse({
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    id,
    assessmentId: 'assessment-fixture',
    pageId,
    kind: 'raw_scanner_result',
    source: { type: 'scanner', name: 'axe-core', version: '4.13.0' },
    capturedAt: now,
    contentType: 'application/json',
    payload: { result: 'violation' },
    metadata: {},
    ...rest,
  });
}

function fixtureEvaluation(overrides: {
  id: string;
  observationId: string;
  evaluation: 'supported' | 'unsupported' | 'uncertain';
  evidenceIds?: string[];
}): WcagCandidateEvaluation {
  const reason = {
    supported: 'requirements_satisfied',
    unsupported: 'requirements_contradicted',
    uncertain: 'insufficient_evidence',
  } as const;
  const status = {
    supported: 'satisfied',
    unsupported: 'contradicted',
    uncertain: 'insufficient',
  } as const;
  return wcagCandidateEvaluationSchema.parse({
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    id: overrides.id,
    assessmentId: 'assessment-fixture',
    observationId: overrides.observationId,
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
      verifiedAt: now,
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
    evaluation: overrides.evaluation,
    reason: reason[overrides.evaluation],
    requirementEvaluations: [
      {
        requirementId: 'scanner-result-is-violation',
        description: 'Scanner result must identify the covered result.',
        status: status[overrides.evaluation],
        factPath: 'result',
        operator: 'equals',
        expectedValue: 'violation',
        actualValue: overrides.evaluation === 'uncertain' ? null : 'violation',
        evidenceIds: overrides.evidenceIds ?? ['evidence-a'],
      },
    ],
    evidenceIds: overrides.evidenceIds ?? ['evidence-a'],
    evaluatedAt: now,
  });
}
