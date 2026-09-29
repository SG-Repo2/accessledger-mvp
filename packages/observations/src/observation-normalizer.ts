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
  candidateWcagCriteria?: readonly string[];
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
  'aria-prohibited-attr': {
    category: 'aria_semantics',
    summary:
      'An element uses a non-empty ARIA attribute that axe-core identifies as prohibited for its computed role or native semantics.',
    candidateWcagCriteria: ['4.1.2'],
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
    if (!payload || !Array.isArray(payload.violations)) return null;
    const violations = payload.violations;

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
      if (!violation || !ruleId || !coveredRule || concreteNodes.length === 0) continue;

      const facts =
        ruleId === 'aria-prohibited-attr'
          ? ariaProhibitedAttributeFacts(
              payload,
              evidence,
              concreteNodes.map(({ node }) => node),
            )
          : genericScannerFacts(violation, concreteNodes.length);
      if (facts === null) continue;

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
        candidateWcagCriteria:
          coveredRule.candidateWcagCriteria ?? candidateCriteriaFromTags(violation?.tags),
        evidenceIds: [evidence.id],
        facts,
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

function genericScannerFacts(
  violation: Record<string, JsonValue>,
  occurrenceCount: number,
): Record<string, JsonValue> {
  return {
    result: 'violation',
    occurrenceCount,
    help: stringOrNull(violation.help),
    helpUrl: stringOrNull(violation.helpUrl),
  };
}

function ariaProhibitedAttributeFacts(
  payload: Record<string, JsonValue>,
  evidence: Evidence,
  nodes: Array<Record<string, JsonValue>>,
): Record<string, JsonValue> | null {
  const engine = asObject(payload.testEngine);
  const engineName = asNonEmptyString(engine?.name);
  const engineVersion = asNonEmptyString(engine?.version);
  if (
    evidence.source.name !== 'axe-core' ||
    evidence.source.version === null ||
    engineName !== evidence.source.name ||
    engineVersion !== evidence.source.version
  ) {
    return null;
  }

  const nodeFacts = nodes.map(ariaProhibitedAttributeNodeFacts);
  if (nodeFacts.some((facts) => facts === null)) return null;
  const completeFacts = nodeFacts.flatMap((facts) => (facts === null ? [] : [facts]));

  return {
    result: 'violation',
    occurrenceCount: nodes.length,
    sourceEngineName: engineName,
    sourceEngineVersion: engineVersion,
    sourceVersionMatchesPayload: true,
    deterministicFactCoverage: 'complete',
    elementNames: unique(completeFacts.map((facts) => facts.elementName)).sort(),
    computedRoles: unique(
      completeFacts.map((facts) => facts.computedRole ?? '(no computed role)'),
    ).sort(),
    prohibitedAttributes: unique(
      completeFacts.flatMap((facts) => facts.prohibitedAttributes),
    ).sort(),
    prohibitedAttributeOccurrenceCount: completeFacts.reduce(
      (count, facts) => count + facts.prohibitedAttributes.length,
      0,
    ),
  };
}

function ariaProhibitedAttributeNodeFacts(node: Record<string, JsonValue>): {
  elementName: string;
  computedRole: string | null;
  prohibitedAttributes: string[];
} | null {
  if (selectorFromTarget(node.target) === null) return null;
  const html = asNonEmptyString(node.html);
  if (html === null) return null;

  const checks = Array.isArray(node.none) ? node.none : [];
  const check = checks
    .map((value) => asObject(value))
    .find((value) => value?.id === 'aria-prohibited-attr');
  const data = asObject(check?.data);
  const elementName = asNonEmptyString(data?.nodeName)?.toLowerCase() ?? null;
  const prohibitedAttributes = stringArray(data?.prohibited)
    .map((value) => value.toLowerCase())
    .filter((value) => /^aria-[\w-]+$/.test(value));
  const roleValue = data?.role;
  const computedRole = roleValue === null ? null : asNonEmptyString(roleValue);
  if (
    elementName === null ||
    prohibitedAttributes.length === 0 ||
    !data ||
    !Object.hasOwn(data, 'role') ||
    (roleValue !== null && computedRole === null)
  ) {
    return null;
  }

  const htmlElement = openingElement(html);
  if (htmlElement === null || htmlElement.name !== elementName) return null;
  if (
    prohibitedAttributes.some((attribute) => {
      const value = htmlElement.attributes.get(attribute);
      return value === undefined || value.trim().length === 0;
    })
  ) {
    return null;
  }

  return {
    elementName,
    computedRole,
    prohibitedAttributes: unique(prohibitedAttributes),
  };
}

function openingElement(value: string): {
  name: string;
  attributes: Map<string, string>;
} | null {
  const openingTag = /^\s*<\s*([a-z][\w-]*)\b([^>]*)>/i.exec(value);
  if (!openingTag) return null;
  const attributes = new Map<string, string>();
  const pattern = /([:@a-zA-Z_][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(openingTag[2] ?? '')) !== null) {
    attributes.set(match[1]!.toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '');
  }
  return { name: openingTag[1]!.toLowerCase(), attributes };
}

function stringArray(value: JsonValue | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const string = asNonEmptyString(item);
    return string === null ? [] : [string];
  });
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
