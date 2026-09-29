import { describe, expect, it } from 'vitest';

import {
  CONTRACT_SCHEMA_VERSION,
  observationSchema,
  wcagCandidateEvaluationSchema,
} from '@accessledger/shared';

import { EvidenceBasedWcagMapper, JsonWcagKnowledge } from '../src/index.js';

const now = '2026-09-28T15:00:00.000Z';

describe('WCAG knowledge and evidence mapping', () => {
  it('loads and validates the small versioned WCAG 2.1 A/AA dataset', () => {
    const knowledge = new JsonWcagKnowledge();

    expect(knowledge.metadata).toMatchObject({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      datasetVersion: '2026.09.29-1',
      standard: { name: 'WCAG', version: '2.1', targetLevels: ['A', 'AA'] },
    });
    expect(knowledge.getCriteria().map((criterion) => criterion.id)).toEqual(['4.1.2']);
    expect(knowledge.getCriterion('4.1.2')).toMatchObject({
      title: 'Name, Role, Value',
      level: 'A',
      automatedTestability: 'partial',
    });
    expect(
      knowledge
        .getCriterion('4.1.2')
        ?.knownRuleMappings.map((mapping) => [mapping.tool, mapping.ruleId]),
    ).toEqual([
      ['axe-core', 'button-name'],
      ['axe-core', 'label'],
      ['axe-core', 'aria-valid-attr-value'],
      ['axe-core', 'aria-prohibited-attr'],
      ['Chrome DevTools Protocol Accessibility', 'empty-accessible-name'],
    ]);
    expect(knowledge.getCriterion('9.9.9')).toBeUndefined();
  });

  it('evaluates a documented axe candidate as supported with inspectable requirement trace', () => {
    const evaluation = mapper().evaluate(observation())[0];

    expect(evaluation).toMatchObject({
      datasetVersion: '2026.09.29-1',
      mappingStatus: 'known_rule',
      criterionId: '4.1.2',
      evaluation: 'supported',
      reason: 'requirements_satisfied',
      evidenceIds: ['scanner-evidence'],
      sourceMapping: {
        tool: 'axe-core',
        ruleId: 'button-name',
        toolVersionRange: '4.13.x',
        mappingType: 'tool_documented',
      },
    });
    expect(evaluation?.requirementEvaluations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requirementId: 'source-version-compatible',
          status: 'satisfied',
        }),
        expect.objectContaining({
          requirementId: 'scanner-result-is-violation',
          actualValue: 'violation',
          status: 'satisfied',
        }),
        expect.objectContaining({
          requirementId: 'concrete-occurrence-present',
          actualValue: 1,
          status: 'satisfied',
        }),
      ]),
    );
    expect(wcagCandidateEvaluationSchema.parse(JSON.parse(JSON.stringify(evaluation)))).toEqual(
      evaluation,
    );
  });

  it('retains an unsupported candidate when explicit facts contradict requirements', () => {
    const evaluation = mapper().evaluate(
      observation({ facts: { result: 'pass', occurrenceCount: 0 } }),
    )[0];

    expect(evaluation).toMatchObject({
      criterionId: '4.1.2',
      evaluation: 'unsupported',
      reason: 'requirements_contradicted',
    });
    expect(evaluation?.requirementEvaluations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requirementId: 'scanner-result-is-violation',
          status: 'contradicted',
        }),
      ]),
    );
  });

  it('retains uncertainty when a mapped candidate lacks required evidence', () => {
    const evaluation = mapper().evaluate(observation({ facts: { result: 'violation' } }))[0];

    expect(evaluation).toMatchObject({
      criterionId: '4.1.2',
      evaluation: 'uncertain',
      reason: 'insufficient_evidence',
    });
    expect(evaluation?.requirementEvaluations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requirementId: 'concrete-occurrence-present',
          status: 'insufficient',
          actualValue: null,
        }),
      ]),
    );
  });

  it('preserves unknown rules as uncertain evaluations rather than discarding them', () => {
    const evaluation = mapper().evaluate(
      observation({ sourceRuleId: 'future-axe-rule', candidateWcagCriteria: ['4.1.2'] }),
    )[0];

    expect(evaluation).toEqual(
      expect.objectContaining({
        mappingStatus: 'unknown_rule',
        criterionId: null,
        sourceMapping: null,
        evaluation: 'uncertain',
        reason: 'unknown_rule',
        requirementEvaluations: [],
        evidenceIds: ['scanner-evidence'],
      }),
    );
  });

  it('marks an out-of-scope tool version uncertain without changing the observation', () => {
    const input = observation({
      source: { type: 'scanner', name: 'axe-core', version: '5.0.0' },
    });
    const before = JSON.parse(JSON.stringify(input));
    const evaluation = mapper().evaluate(input)[0];

    expect(evaluation).toMatchObject({
      evaluation: 'uncertain',
      reason: 'insufficient_evidence',
    });
    expect(evaluation?.requirementEvaluations[0]).toMatchObject({
      requirementId: 'source-version-compatible',
      expectedValue: '4.13.x',
      actualValue: '5.0.0',
      status: 'insufficient',
    });
    expect(input).toEqual(before);
  });

  it('supports the reviewed aria-prohibited-attr candidate only with complete criterion-specific facts', () => {
    const evaluation = mapper().evaluate(
      ariaProhibitedObservation({
        wcag412: {
          userInterfaceComponent: true,
          prohibitedAttributeRelevant: true,
          programmaticInformationAvailable: false,
        },
      }),
    )[0];

    expect(evaluation).toMatchObject({
      datasetVersion: '2026.09.29-1',
      mappingStatus: 'known_rule',
      criterionId: '4.1.2',
      evaluation: 'supported',
      reason: 'requirements_satisfied',
      evidenceIds: ['scanner-evidence', 'component-evidence'],
      sourceMapping: {
        tool: 'axe-core',
        ruleId: 'aria-prohibited-attr',
        toolVersionRange: '4.13.x',
        mappingType: 'reviewed',
        mappingSource: 'https://www.w3.org/WAI/standards-guidelines/act/rules/5c01ea/proposed/',
      },
    });
    expect(
      evaluation?.requirementEvaluations.every((requirement) =>
        requirement.evidenceIds.every(
          (id, index) => id === ['scanner-evidence', 'component-evidence'][index],
        ),
      ),
    ).toBe(true);
    expect(evaluation?.requirementEvaluations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requirementId: 'prohibited-attribute-facts-complete',
          actualValue: 'complete',
          status: 'satisfied',
        }),
        expect.objectContaining({
          requirementId: 'user-interface-component-established',
          actualValue: true,
          status: 'satisfied',
        }),
        expect.objectContaining({
          requirementId: 'programmatic-information-unavailable',
          actualValue: false,
          status: 'satisfied',
        }),
      ]),
    );
  });

  it('retains aria-prohibited-attr as uncertain when WCAG applicability and exposure facts are absent', () => {
    const evaluation = mapper().evaluate(ariaProhibitedObservation())[0];

    expect(evaluation).toMatchObject({
      criterionId: '4.1.2',
      evaluation: 'uncertain',
      reason: 'insufficient_evidence',
    });
    expect(evaluation?.requirementEvaluations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requirementId: 'user-interface-component-established',
          actualValue: null,
          status: 'insufficient',
        }),
        expect.objectContaining({
          requirementId: 'prohibited-attribute-relevance-established',
          actualValue: null,
          status: 'insufficient',
        }),
        expect.objectContaining({
          requirementId: 'programmatic-information-unavailable',
          actualValue: null,
          status: 'insufficient',
        }),
      ]),
    );
  });

  it('retains aria-prohibited-attr as unsupported when evidence contradicts criterion applicability', () => {
    const evaluation = mapper().evaluate(
      ariaProhibitedObservation({
        wcag412: {
          userInterfaceComponent: false,
          prohibitedAttributeRelevant: false,
          programmaticInformationAvailable: true,
        },
      }),
    )[0];

    expect(evaluation).toMatchObject({
      criterionId: '4.1.2',
      evaluation: 'unsupported',
      reason: 'requirements_contradicted',
    });
    expect(evaluation?.requirementEvaluations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requirementId: 'user-interface-component-established',
          status: 'contradicted',
        }),
        expect.objectContaining({
          requirementId: 'programmatic-information-unavailable',
          status: 'contradicted',
        }),
      ]),
    );
  });

  it('keeps aria-prohibited-attr uncertain outside the reviewed axe source version', () => {
    const input = ariaProhibitedObservation(
      {
        wcag412: {
          userInterfaceComponent: true,
          prohibitedAttributeRelevant: true,
          programmaticInformationAvailable: false,
        },
      },
      '5.0.0',
    );
    const evaluation = mapper().evaluate(input)[0];

    expect(evaluation).toMatchObject({
      criterionId: '4.1.2',
      evaluation: 'uncertain',
      reason: 'insufficient_evidence',
    });
    expect(evaluation?.requirementEvaluations[0]).toMatchObject({
      requirementId: 'source-version-compatible',
      expectedValue: '4.13.x',
      actualValue: '5.0.0',
      status: 'insufficient',
    });
  });
});

function mapper(): EvidenceBasedWcagMapper {
  return new EvidenceBasedWcagMapper(new JsonWcagKnowledge(), {
    clock: () => new Date(now),
    idFactory: ({ observationId, criterionId }) =>
      `evaluation-${observationId}-${criterionId ?? 'unknown'}`,
  });
}

function observation(overrides: Record<string, unknown> = {}) {
  return observationSchema.parse({
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    id: 'observation-button-name',
    assessmentId: 'assessment-fixture',
    source: { type: 'scanner', name: 'axe-core', version: '4.13.0' },
    sourceRuleId: 'button-name',
    category: 'accessible_name',
    summary: 'A button does not have a discernible accessible name.',
    testability: 'deterministic',
    evaluation: 'supported',
    candidateWcagCriteria: ['4.1.2'],
    evidenceIds: ['scanner-evidence'],
    facts: { result: 'violation', occurrenceCount: 1 },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

function ariaProhibitedObservation(
  additionalFacts: Record<string, unknown> = {},
  sourceVersion = '4.13.0',
) {
  return observationSchema.parse({
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    id: 'observation-aria-prohibited-attr',
    assessmentId: 'assessment-fixture',
    source: { type: 'scanner', name: 'axe-core', version: sourceVersion },
    sourceRuleId: 'aria-prohibited-attr',
    category: 'aria_semantics',
    summary: 'An element uses a prohibited ARIA attribute.',
    testability: 'deterministic',
    evaluation: 'supported',
    candidateWcagCriteria: ['4.1.2'],
    evidenceIds: ['scanner-evidence', 'component-evidence'],
    facts: {
      result: 'violation',
      occurrenceCount: 1,
      sourceEngineName: 'axe-core',
      sourceEngineVersion: sourceVersion,
      sourceVersionMatchesPayload: true,
      deterministicFactCoverage: 'complete',
      elementNames: ['time'],
      computedRoles: ['(no computed role)'],
      prohibitedAttributes: ['aria-label'],
      prohibitedAttributeOccurrenceCount: 1,
      ...additionalFacts,
    },
    createdAt: now,
    updatedAt: now,
  });
}
