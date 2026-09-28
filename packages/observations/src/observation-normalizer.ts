import { randomUUID } from 'node:crypto';

import {
  CONTRACT_SCHEMA_VERSION,
  accessibilitySemanticsEvidenceSchema,
  evidenceSchema,
  observationOccurrenceSchema,
  observationSchema,
  pageSchema,
  type Evidence,
  type JsonValue,
  type Observation,
  type ObservationOccurrence,
} from '@accessledger/shared';

import type {
  IgnoredEvidence,
  ObservationIdContext,
  ObservationNormalizationInput,
  ObservationNormalizationResult,
  ObservationNormalizer,
  ObservationNormalizerOptions,
} from './types.js';

interface CoveredScannerRule {
  category: string;
  summary: string;
}

const COVERED_SCANNER_RULES: Readonly<Record<string, CoveredScannerRule>> = {
  'button-name': {
    category: 'accessible_name',
    summary: 'A button does not have a discernible accessible name.',
  },
  label: {
    category: 'programmatic_label',
    summary: 'A form control does not have a programmatically associated label.',
  },
  'aria-valid-attr-value': {
    category: 'aria_validity',
    summary: 'An ARIA attribute has an invalid value.',
  },
};

export class DeterministicObservationNormalizer implements ObservationNormalizer {
  readonly #clock: () => Date;
  readonly #idFactory: (
    recordType: 'observation' | 'occurrence',
    context: ObservationIdContext,
  ) => string;

  constructor(options: ObservationNormalizerOptions = {}) {
    this.#clock = options.clock ?? (() => new Date());
    this.#idFactory = options.idFactory ?? ((recordType) => `${recordType}-${randomUUID()}`);
  }

  normalize(input: ObservationNormalizationInput): ObservationNormalizationResult {
    const page = pageSchema.parse(input.page);
    const evidence = input.evidence.map((item) => evidenceSchema.parse(item));
    this.#assertScope(page.assessmentId, page.id, page.rawEvidenceIds, evidence);

    const observations: Observation[] = [];
    const occurrences: ObservationOccurrence[] = [];
    const ignoredEvidence: IgnoredEvidence[] = [];
    const unrecognizedRules: ObservationNormalizationResult['unrecognizedRules'] = [];

    for (const item of evidence) {
      if (item.kind === 'raw_scanner_result' && item.source.type === 'scanner') {
        const result = this.#normalizeScannerEvidence(item, observations.length);
        if (result === null) {
          ignoredEvidence.push({
            evidenceId: item.id,
            reason: scannerPayloadHasViolations(item.payload)
              ? 'no_covered_deterministic_fact'
              : 'malformed_source_payload',
          });
          continue;
        }
        observations.push(...result.observations);
        occurrences.push(...result.occurrences);
        unrecognizedRules.push(
          ...result.unrecognizedRuleIds.map((ruleId) => ({
            evidenceId: item.id,
            tool: item.source.name,
            toolVersion: item.source.version,
            ruleId,
          })),
        );
        if (result.observations.length === 0) {
          ignoredEvidence.push({
            evidenceId: item.id,
            reason: 'no_covered_deterministic_fact',
          });
        }
        continue;
      }

      if (item.kind === 'accessibility_semantics') {
        const specialized = accessibilitySemanticsEvidenceSchema.parse(item);
        if (specialized.payload.collectionStatus === 'error') {
          ignoredEvidence.push({ evidenceId: item.id, reason: 'collection_error' });
          continue;
        }
        const result = this.#normalizeAccessibilityEvidence(specialized, observations.length);
        if (result === null) {
          ignoredEvidence.push({
            evidenceId: item.id,
            reason: 'no_covered_deterministic_fact',
          });
          continue;
        }
        observations.push(result.observation);
        occurrences.push(result.occurrence);
        continue;
      }

      ignoredEvidence.push({ evidenceId: item.id, reason: 'not_a_supported_source' });
    }

    return { observations, occurrences, ignoredEvidence, unrecognizedRules };
  }

  #assertScope(
    assessmentId: string,
    pageId: string,
    pageEvidenceIds: string[],
    evidence: Evidence[],
  ): void {
    for (const item of evidence) {
      if (
        item.assessmentId !== assessmentId ||
        item.pageId !== pageId ||
        !pageEvidenceIds.includes(item.id)
      ) {
        throw new Error(
          `Evidence ${item.id} does not belong to assessment ${assessmentId} and Page ${pageId}'s raw evidence chain.`,
        );
      }
    }
  }

  #normalizeScannerEvidence(
    evidence: Evidence,
    observationOffset: number,
  ): {
    observations: Observation[];
    occurrences: ObservationOccurrence[];
    unrecognizedRuleIds: string[];
  } | null {
    const payload = asObject(evidence.payload);
    const violations = payload?.violations;
    if (!Array.isArray(violations)) return null;

    const observations: Observation[] = [];
    const occurrences: ObservationOccurrence[] = [];
    const unrecognizedRuleIds: string[] = [];
    for (const rawViolation of violations) {
      const violation = asObject(rawViolation);
      const ruleId = asNonEmptyString(violation?.id);
      const nodes = violation?.nodes;
      const coveredRule = ruleId ? COVERED_SCANNER_RULES[ruleId] : undefined;
      if (ruleId && !coveredRule) unrecognizedRuleIds.push(ruleId);
      const concreteNodes = Array.isArray(nodes)
        ? nodes.flatMap((rawNode) => {
            const node = asObject(rawNode);
            return node ? [{ rawNode, node }] : [];
          })
        : [];
      if (!ruleId || !coveredRule || concreteNodes.length === 0) continue;

      const context: ObservationIdContext = {
        evidenceId: evidence.id,
        sourceRuleId: ruleId,
        index: observationOffset + observations.length,
      };
      const observationId = this.#idFactory('observation', context);
      const timestamp = this.#clock().toISOString();
      const observation = observationSchema.parse({
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        id: observationId,
        assessmentId: evidence.assessmentId,
        source: evidence.source,
        sourceRuleId: ruleId,
        category: coveredRule.category,
        summary: coveredRule.summary,
        testability: 'deterministic',
        evaluation: 'supported',
        candidateWcagCriteria: candidateCriteriaFromTags(violation?.tags),
        evidenceIds: [evidence.id],
        facts: {
          result: 'violation',
          occurrenceCount: concreteNodes.length,
          help: stringOrNull(violation?.help),
          helpUrl: stringOrNull(violation?.helpUrl),
        },
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      observations.push(observation);

      concreteNodes.forEach(({ rawNode, node }, nodeIndex) => {
        const occurrenceContext = { ...context, index: nodeIndex };
        occurrences.push(
          observationOccurrenceSchema.parse({
            schemaVersion: CONTRACT_SCHEMA_VERSION,
            id: this.#idFactory('occurrence', occurrenceContext),
            assessmentId: evidence.assessmentId,
            observationId,
            pageId: evidence.pageId,
            evidenceIds: [evidence.id],
            selector: selectorFromTarget(node.target),
            htmlSnippet: asNonEmptyString(node.html),
            componentFingerprint: null,
            sourceDetail: {
              kind: 'axe_node',
              rule: rawViolation,
              node: rawNode,
            },
            observedAt: evidence.capturedAt,
          }),
        );
      });
    }

    return { observations, occurrences, unrecognizedRuleIds: unique(unrecognizedRuleIds) };
  }

  #normalizeAccessibilityEvidence(
    evidence: ReturnType<typeof accessibilitySemanticsEvidenceSchema.parse>,
    observationIndex: number,
  ): { observation: Observation; occurrence: ObservationOccurrence } | null {
    if (evidence.payload.collectionStatus !== 'collected') return null;
    const { role, name } = evidence.payload.semantics;
    if (
      role.status !== 'available' ||
      role.value !== 'button' ||
      name.status !== 'available' ||
      name.value !== ''
    ) {
      return null;
    }

    const sourceRuleId = 'empty-accessible-name';
    const context: ObservationIdContext = {
      evidenceId: evidence.id,
      sourceRuleId,
      index: observationIndex,
    };
    const observationId = this.#idFactory('observation', context);
    const timestamp = this.#clock().toISOString();
    const evidenceIds = unique([...evidence.metadata.rawEvidenceIds, evidence.id]);
    const observation = observationSchema.parse({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      id: observationId,
      assessmentId: evidence.assessmentId,
      source: evidence.source,
      sourceRuleId,
      category: 'accessible_name',
      summary: 'A browser-exposed button has an available but empty computed accessible name.',
      testability: 'deterministic',
      evaluation: 'supported',
      candidateWcagCriteria: [],
      evidenceIds,
      facts: {
        collectionStatus: 'collected',
        role: role.value,
        name: name.value,
        targetId: evidence.metadata.targetId,
        assistiveTechnologyOutput: evidence.payload.provenance.assistiveTechnologyOutput,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const occurrence = observationOccurrenceSchema.parse({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      id: this.#idFactory('occurrence', { ...context, index: 0 }),
      assessmentId: evidence.assessmentId,
      observationId,
      pageId: evidence.pageId,
      evidenceIds,
      selector: evidence.payload.target.selector,
      htmlSnippet: null,
      componentFingerprint: null,
      sourceDetail: {
        kind: 'accessibility_semantics',
        target: evidence.payload.target,
        semantics: evidence.payload.semantics,
        provenance: evidence.payload.provenance,
      },
      observedAt: evidence.capturedAt,
    });
    return { observation, occurrence };
  }
}

function scannerPayloadHasViolations(value: JsonValue): boolean {
  return Array.isArray(asObject(value)?.violations);
}

function asObject(value: JsonValue | undefined): Record<string, JsonValue> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value;
}

function asNonEmptyString(value: JsonValue | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function stringOrNull(value: JsonValue | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

function selectorFromTarget(value: JsonValue | undefined): string | null {
  if (typeof value === 'string') return asNonEmptyString(value);
  if (!Array.isArray(value)) return null;
  const parts = flattenStrings(value);
  return parts.length > 0 ? parts.join(' >>> ') : null;
}

function flattenStrings(value: JsonValue[]): string[] {
  const result: string[] = [];
  for (const item of value) {
    if (typeof item === 'string' && item.trim().length > 0) result.push(item);
    else if (Array.isArray(item)) result.push(...flattenStrings(item));
  }
  return result;
}

function candidateCriteriaFromTags(value: JsonValue | undefined): string[] {
  if (!Array.isArray(value)) return [];
  const candidates = value.flatMap((tag) => {
    if (typeof tag !== 'string') return [];
    const match = /^wcag(\d)(\d)(\d)$/.exec(tag);
    return match ? [`${match[1]}.${match[2]}.${match[3]}`] : [];
  });
  return unique(candidates);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
