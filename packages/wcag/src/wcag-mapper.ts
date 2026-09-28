import { randomUUID } from 'node:crypto';

import {
  CONTRACT_SCHEMA_VERSION,
  observationSchema,
  wcagCandidateEvaluationSchema,
  type JsonValue,
  type Observation,
  type RuleEvidenceRequirement,
  type RuleMapping,
  type WcagCandidateEvaluation,
  type WcagRequirementEvaluation,
} from '@accessledger/shared';

import type {
  WcagEvaluationIdContext,
  WcagKnowledge,
  WcagMapper,
  WcagMapperOptions,
} from './types.js';

export class EvidenceBasedWcagMapper implements WcagMapper {
  readonly #knowledge: WcagKnowledge;
  readonly #clock: () => Date;
  readonly #idFactory: (context: WcagEvaluationIdContext) => string;

  constructor(knowledge: WcagKnowledge, options: WcagMapperOptions = {}) {
    this.#knowledge = knowledge;
    this.#clock = options.clock ?? (() => new Date());
    this.#idFactory = options.idFactory ?? (() => `wcag-evaluation-${randomUUID()}`);
  }

  evaluate(input: Observation): WcagCandidateEvaluation[] {
    const observation = observationSchema.parse(input);
    const ruleId = observation.sourceRuleId;
    const mappings = ruleId
      ? this.#knowledge.findRuleMappings(observation.source.name, ruleId)
      : [];

    if (mappings.length === 0) {
      return [
        wcagCandidateEvaluationSchema.parse({
          schemaVersion: CONTRACT_SCHEMA_VERSION,
          id: this.#idFactory({
            observationId: observation.id,
            criterionId: null,
            index: 0,
          }),
          assessmentId: observation.assessmentId,
          observationId: observation.id,
          datasetVersion: this.#knowledge.metadata.datasetVersion,
          standard: { name: 'WCAG', version: '2.1' },
          mappingStatus: 'unknown_rule',
          criterionId: null,
          sourceMapping: null,
          evaluation: 'uncertain',
          reason: 'unknown_rule',
          requirementEvaluations: [],
          evidenceIds: observation.evidenceIds,
          evaluatedAt: this.#clock().toISOString(),
        }),
      ];
    }

    return mappings.map(({ criterion, mapping }, index) => {
      const requirementEvaluations = [
        versionRequirement(observation, mapping),
        ...mapping.evidenceRequirements.map((requirement) =>
          evaluateRequirement(observation, requirement),
        ),
      ];
      const evaluation = conclusion(requirementEvaluations);
      return wcagCandidateEvaluationSchema.parse({
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        id: this.#idFactory({
          observationId: observation.id,
          criterionId: criterion.id,
          index,
        }),
        assessmentId: observation.assessmentId,
        observationId: observation.id,
        datasetVersion: this.#knowledge.metadata.datasetVersion,
        standard: { name: 'WCAG', version: '2.1' },
        mappingStatus: 'known_rule',
        criterionId: criterion.id,
        sourceMapping: mapping,
        evaluation: evaluation.state,
        reason: evaluation.reason,
        requirementEvaluations,
        evidenceIds: observation.evidenceIds,
        evaluatedAt: this.#clock().toISOString(),
      });
    });
  }
}

function versionRequirement(
  observation: Observation,
  mapping: RuleMapping,
): WcagRequirementEvaluation {
  const actual = observation.source.version;
  const range = mapping.toolVersionRange;
  let status: WcagRequirementEvaluation['status'] = 'satisfied';
  if (range !== null && (actual === null || !versionMatches(actual, range))) {
    status = 'insufficient';
  }
  return {
    requirementId: 'source-version-compatible',
    description: 'The evidence source version is within the reviewed rule-mapping scope.',
    status,
    factPath: 'source.version',
    operator: 'equals',
    expectedValue: range,
    actualValue: actual,
    evidenceIds: observation.evidenceIds,
  };
}

function evaluateRequirement(
  observation: Observation,
  requirement: RuleEvidenceRequirement,
): WcagRequirementEvaluation {
  const resolution = resolveFact(observation.facts, requirement.factPath);
  const status = resolution.found
    ? requirementSatisfied(resolution.value, requirement)
      ? 'satisfied'
      : 'contradicted'
    : 'insufficient';
  return {
    requirementId: requirement.id,
    description: requirement.description,
    status,
    factPath: requirement.factPath,
    operator: requirement.operator,
    expectedValue: requirement.expectedValue,
    actualValue: resolution.found ? resolution.value : null,
    evidenceIds: observation.evidenceIds,
  };
}

function resolveFact(
  facts: Record<string, JsonValue>,
  path: string,
): { found: true; value: JsonValue } | { found: false } {
  let current: JsonValue = facts;
  for (const part of path.split('.')) {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) {
      return { found: false };
    }
    if (!(part in current)) return { found: false };
    current = current[part] as JsonValue;
  }
  return { found: true, value: current };
}

function requirementSatisfied(actual: JsonValue, requirement: RuleEvidenceRequirement): boolean {
  if (requirement.operator === 'equals') {
    return JSON.stringify(actual) === JSON.stringify(requirement.expectedValue);
  }
  if (requirement.operator === 'greater_than') {
    return (
      typeof actual === 'number' &&
      typeof requirement.expectedValue === 'number' &&
      actual > requirement.expectedValue
    );
  }
  return (
    (typeof actual === 'string' && actual.trim().length > 0) ||
    (Array.isArray(actual) && actual.length > 0)
  );
}

function conclusion(requirements: WcagRequirementEvaluation[]): {
  state: 'supported' | 'unsupported' | 'uncertain';
  reason: 'requirements_satisfied' | 'requirements_contradicted' | 'insufficient_evidence';
} {
  if (requirements.some((requirement) => requirement.status === 'contradicted')) {
    return { state: 'unsupported', reason: 'requirements_contradicted' };
  }
  if (requirements.some((requirement) => requirement.status === 'insufficient')) {
    return { state: 'uncertain', reason: 'insufficient_evidence' };
  }
  return { state: 'supported', reason: 'requirements_satisfied' };
}

function versionMatches(version: string, range: string): boolean {
  if (range.endsWith('.x')) return version.startsWith(range.slice(0, -1));
  return version === range;
}
