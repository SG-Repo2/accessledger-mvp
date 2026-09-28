import { createHash } from 'node:crypto';

import {
  CONTRACT_SCHEMA_VERSION,
  groupProposalSchema,
  observationOccurrenceSchema,
  observationSchema,
  pageSchema,
  type GroupProposal,
  type GroupProposalMember,
  type GroupingSignal,
  type JsonValue,
  type Observation,
  type ObservationOccurrence,
  type Page,
} from '@accessledger/shared';

import type {
  GroupingContext,
  GroupingEngine,
  GroupingEngineOptions,
  PageTemplateContext,
} from './types.js';

export const GROUPING_ALGORITHM_VERSION = '1.0.0' as const;

interface Candidate {
  observation: Observation;
  occurrence: ObservationOccurrence;
  page: Page;
  issueKey: string;
  normalizedFingerprint: string | null;
  selectorStructure: string | null;
  componentStructure: string | null;
  roleNamePattern: string | null;
  templateId: string | null;
}

interface CandidateGroup {
  candidates: Candidate[];
  method: 'fingerprint' | 'structure' | 'singleton';
}

export class ConservativeGroupingEngine implements GroupingEngine {
  readonly #clock: () => Date;

  constructor(options: GroupingEngineOptions = {}) {
    this.#clock = options.clock ?? (() => new Date());
  }

  propose(
    observationsInput: readonly Observation[],
    occurrencesInput: readonly ObservationOccurrence[],
    contextInput: GroupingContext,
  ): GroupProposal[] {
    const observations = observationsInput.map((item) => observationSchema.parse(item));
    const occurrences = occurrencesInput.map((item) => observationOccurrenceSchema.parse(item));
    const pages = contextInput.pages.map((item) => pageSchema.parse(item));
    const templates = validateTemplates(contextInput.pageTemplates ?? []);

    const candidates = buildCandidates(observations, occurrences, pages, templates);
    const groups = partitionCandidates(candidates);
    const timestamp = this.#clock().toISOString();

    return groups
      .map((group) => this.#toProposal(group, candidates, timestamp))
      .sort((left, right) =>
        left.memberOccurrenceIds[0]!.localeCompare(right.memberOccurrenceIds[0]!),
      );
  }

  #toProposal(group: CandidateGroup, allCandidates: Candidate[], timestamp: string): GroupProposal {
    const candidates = [...group.candidates].sort(compareCandidates);
    const related =
      candidates.length === 1
        ? allCandidates.filter(
            (candidate) => candidate !== candidates[0] && weaklyRelated(candidates[0]!, candidate),
          )
        : [];
    const isAmbiguous = candidates.length === 1 && related.length > 0;
    const kind =
      candidates.length > 1 ? 'repeat_candidate' : isAmbiguous ? 'ambiguous' : 'singleton';
    const members = candidates.map(toMember);
    const memberOccurrenceIds = members.map((member) => member.occurrenceId);
    const memberObservationIds = unique(members.map((member) => member.observationId));
    const pageIds = unique(members.map((member) => member.pageId));
    const evidenceIds = unique(members.flatMap((member) => member.evidenceIds));
    const ambiguity = isAmbiguous
      ? {
          reason: ambiguityReason(candidates[0]!, related),
          relatedOccurrenceIds: related.map((candidate) => candidate.occurrence.id).sort(),
        }
      : null;

    return groupProposalSchema.parse({
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      groupingAlgorithmVersion: GROUPING_ALGORITHM_VERSION,
      id: stableProposalId(
        candidates[0]!.observation.assessmentId,
        memberObservationIds,
        memberOccurrenceIds,
      ),
      assessmentId: candidates[0]!.observation.assessmentId,
      kind,
      reviewStatus: 'pending',
      groupingConfidence:
        group.method === 'fingerprint' && candidates.length > 1
          ? 'high'
          : group.method === 'structure' && candidates.length > 1
            ? 'medium'
            : 'low',
      rationale: rationaleFor(group.method, kind),
      members,
      memberObservationIds,
      memberOccurrenceIds,
      pageIds,
      evidenceIds,
      signals: signalsFor(candidates),
      ambiguity,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }
}

function buildCandidates(
  observations: Observation[],
  occurrences: ObservationOccurrence[],
  pages: Page[],
  templates: Map<string, string>,
): Candidate[] {
  assertUniqueIds(observations, 'Observation');
  assertUniqueIds(occurrences, 'ObservationOccurrence');
  assertUniqueIds(pages, 'Page');

  const observationById = new Map(observations.map((item) => [item.id, item]));
  const pageById = new Map(pages.map((item) => [item.id, item]));
  const assessmentIds = new Set([
    ...observations.map((item) => item.assessmentId),
    ...occurrences.map((item) => item.assessmentId),
    ...pages.map((item) => item.assessmentId),
  ]);
  if (assessmentIds.size > 1) {
    throw new Error('Grouping inputs must belong to one assessment.');
  }

  const seenObservationIds = new Set<string>();
  const candidates = occurrences.map((occurrence) => {
    const observation = observationById.get(occurrence.observationId);
    if (!observation) {
      throw new Error(
        `Occurrence ${occurrence.id} references missing Observation ${occurrence.observationId}.`,
      );
    }
    const page = pageById.get(occurrence.pageId);
    if (!page) {
      throw new Error(`Occurrence ${occurrence.id} references missing Page ${occurrence.pageId}.`);
    }
    if (
      observation.assessmentId !== occurrence.assessmentId ||
      page.assessmentId !== occurrence.assessmentId
    ) {
      throw new Error(`Occurrence ${occurrence.id} crosses assessment boundaries.`);
    }
    seenObservationIds.add(observation.id);
    return {
      observation,
      occurrence,
      page,
      issueKey: issueKey(observation),
      normalizedFingerprint: normalizeFingerprint(occurrence.componentFingerprint),
      selectorStructure: normalizeSelectorStructure(occurrence.selector),
      componentStructure: componentStructure(occurrence.htmlSnippet),
      roleNamePattern: roleNamePattern(occurrence.sourceDetail),
      templateId: templates.get(page.id) ?? null,
    };
  });

  const observationsWithoutOccurrences = observations
    .filter((observation) => !seenObservationIds.has(observation.id))
    .map((observation) => observation.id);
  if (observationsWithoutOccurrences.length > 0) {
    throw new Error(
      `Grouping cannot silently drop Observations without occurrences: ${observationsWithoutOccurrences.join(', ')}.`,
    );
  }
  for (const pageId of templates.keys()) {
    if (!pageById.has(pageId))
      throw new Error(`Template context references missing Page ${pageId}.`);
  }

  return candidates.sort(compareCandidates);
}

function partitionCandidates(candidates: Candidate[]): CandidateGroup[] {
  const assigned = new Set<string>();
  const result: CandidateGroup[] = [];

  const fingerprintBuckets = bucket(
    candidates.filter((candidate) => candidate.normalizedFingerprint !== null),
    (candidate) => `${candidate.issueKey}\u0000${candidate.normalizedFingerprint}`,
  );
  for (const values of fingerprintBuckets.values()) {
    if (values.length < 2) continue;
    values.forEach((candidate) => assigned.add(candidate.occurrence.id));
    result.push({ candidates: values, method: 'fingerprint' });
  }

  const structuralCandidates = candidates.filter(
    (candidate) =>
      !assigned.has(candidate.occurrence.id) &&
      candidate.normalizedFingerprint === null &&
      candidate.selectorStructure !== null &&
      candidate.componentStructure !== null,
  );
  const structureBuckets = bucket(structuralCandidates, (candidate) => {
    const pageContext = candidate.templateId
      ? `template:${candidate.templateId}`
      : `page:${candidate.page.id}`;
    return [
      candidate.issueKey,
      pageContext,
      candidate.selectorStructure,
      candidate.componentStructure,
      candidate.roleNamePattern ?? '',
    ].join('\u0000');
  });
  for (const values of structureBuckets.values()) {
    if (values.length < 2) continue;
    values.forEach((candidate) => assigned.add(candidate.occurrence.id));
    result.push({ candidates: values, method: 'structure' });
  }

  for (const candidate of candidates) {
    if (!assigned.has(candidate.occurrence.id)) {
      result.push({ candidates: [candidate], method: 'singleton' });
    }
  }
  return result;
}

function weaklyRelated(left: Candidate, right: Candidate): boolean {
  if (left.issueKey !== right.issueKey) return false;
  if (
    left.normalizedFingerprint !== null &&
    right.normalizedFingerprint !== null &&
    left.normalizedFingerprint !== right.normalizedFingerprint
  ) {
    return false;
  }
  return Boolean(
    (left.componentStructure && left.componentStructure === right.componentStructure) ||
    (left.selectorStructure && left.selectorStructure === right.selectorStructure) ||
    (left.roleNamePattern && left.roleNamePattern === right.roleNamePattern),
  );
}

function ambiguityReason(
  candidate: Candidate,
  related: Candidate[],
):
  'insufficient_identity_signal' | 'missing_shared_page_template' | 'missing_comparable_structure' {
  if (
    related.some(
      (item) =>
        item.page.id !== candidate.page.id &&
        (!item.templateId || item.templateId !== candidate.templateId),
    )
  ) {
    return 'missing_shared_page_template';
  }
  if (!candidate.selectorStructure || !candidate.componentStructure) {
    return 'missing_comparable_structure';
  }
  return 'insufficient_identity_signal';
}

function toMember(candidate: Candidate): GroupProposalMember {
  return {
    observationId: candidate.observation.id,
    occurrenceId: candidate.occurrence.id,
    pageId: candidate.page.id,
    evidenceIds: unique([
      ...candidate.observation.evidenceIds,
      ...candidate.occurrence.evidenceIds,
    ]).sort(),
  };
}

function signalsFor(candidates: Candidate[]): GroupingSignal[] {
  const occurrenceIds = candidates.map((candidate) => candidate.occurrence.id);
  const first = candidates[0]!;
  const signals: GroupingSignal[] = [
    {
      type: 'source_identity',
      strength: 'required',
      value: sourceIdentity(first.observation),
      occurrenceIds,
    },
    {
      type: 'source_rule',
      strength: 'required',
      value: first.observation.sourceRuleId ?? '(no source rule)',
      occurrenceIds,
    },
    {
      type: 'source_category',
      strength: 'required',
      value: first.observation.category,
      occurrenceIds,
    },
  ];

  pushSharedSignal(
    signals,
    candidates,
    'component_fingerprint',
    'identity',
    (item) => item.normalizedFingerprint,
  );
  pushSharedSignal(
    signals,
    candidates,
    'selector_structure',
    'supporting',
    (item) => item.selectorStructure,
  );
  pushSharedSignal(
    signals,
    candidates,
    'component_structure',
    'supporting',
    (item) => item.componentStructure,
  );
  pushSharedSignal(
    signals,
    candidates,
    'role_name_pattern',
    'supporting',
    (item) => item.roleNamePattern,
  );
  pushSharedSignal(signals, candidates, 'page_template', 'context', (item) => item.templateId);

  for (const [url, members] of bucket(
    candidates,
    (item) => item.page.finalUrl ?? item.page.requestedUrl,
  )) {
    signals.push({
      type: 'page_url',
      strength: 'context',
      value: url,
      occurrenceIds: members.map((member) => member.occurrence.id),
    });
  }
  return signals;
}

function pushSharedSignal(
  signals: GroupingSignal[],
  candidates: Candidate[],
  type: GroupingSignal['type'],
  strength: GroupingSignal['strength'],
  valueFor: (candidate: Candidate) => string | null,
): void {
  const value = valueFor(candidates[0]!);
  if (value === null || candidates.some((candidate) => valueFor(candidate) !== value)) return;
  signals.push({
    type,
    strength,
    value,
    occurrenceIds: candidates.map((candidate) => candidate.occurrence.id),
  });
}

function rationaleFor(method: CandidateGroup['method'], kind: GroupProposal['kind']): string {
  if (method === 'fingerprint' && kind === 'repeat_candidate') {
    return 'Members share the exact source issue and normalized component fingerprint.';
  }
  if (method === 'structure' && kind === 'repeat_candidate') {
    return 'Members share the exact source issue, selector structure, component structure, and page or template context.';
  }
  if (kind === 'ambiguous') {
    return 'Related occurrences share partial structure, but deterministic identity signals are insufficient for a safe merge.';
  }
  return 'No other occurrence met the conservative deterministic grouping requirements.';
}

function stableProposalId(
  assessmentId: string,
  observationIds: string[],
  occurrenceIds: string[],
): string {
  const digest = createHash('sha256')
    .update(GROUPING_ALGORITHM_VERSION)
    .update('\u0000')
    .update(assessmentId)
    .update('\u0000')
    .update([...observationIds].sort().join('\u0000'))
    .update('\u0000')
    .update([...occurrenceIds].sort().join('\u0000'))
    .digest('hex')
    .slice(0, 24);
  return `group-proposal-${digest}`;
}

function issueKey(observation: Observation): string {
  return [sourceIdentity(observation), observation.sourceRuleId ?? '', observation.category].join(
    '\u0000',
  );
}

function sourceIdentity(observation: Observation): string {
  return [
    observation.source.type,
    observation.source.name.trim(),
    observation.source.version ?? '(unknown version)',
  ].join(':');
}

function normalizeFingerprint(value: string | null): string | null {
  if (value === null) return null;
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeSelectorStructure(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value
    .normalize('NFKC')
    .trim()
    .replace(/:nth-(child|of-type)\(\s*[+-]?\d+\s*\)/gi, ':nth-$1(*)')
    .replace(/#([a-z_-]*?)\d+(?=[\s>+~.:#[\]]|$)/gi, '#$1*')
    .replace(/\s*([>+~])\s*/g, ' $1 ')
    .replace(/\s+/g, ' ');
  return normalized.length > 0 ? normalized : null;
}

function componentStructure(value: string | null): string | null {
  if (value === null) return null;
  const openingTag = /^\s*<\s*([a-z][\w-]*)\b([^>]*)>/i.exec(value);
  if (!openingTag) return null;
  const tag = openingTag[1]!.toLowerCase();
  const attributes = parseAttributes(openingTag[2] ?? '')
    .filter(([name]) => name !== 'id' && name !== 'data-reactid')
    .map(([name, rawValue]) => {
      if (name === 'class' && rawValue) {
        return `${name}=${rawValue.split(/\s+/).filter(Boolean).sort().join('.')}`;
      }
      return rawValue === null ? name : `${name}=${rawValue.trim().replace(/\s+/g, ' ')}`;
    })
    .sort();
  return [tag, ...attributes].join('|');
}

function parseAttributes(value: string): Array<[string, string | null]> {
  const attributes: Array<[string, string | null]> = [];
  const pattern = /([:@a-zA-Z_][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value)) !== null) {
    attributes.push([match[1]!.toLowerCase(), match[2] ?? match[3] ?? match[4] ?? null]);
  }
  return attributes;
}

function roleNamePattern(value: JsonValue): string | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const detail = value as Record<string, JsonValue>;
  if (detail.kind !== 'accessibility_semantics') return null;
  const semantics = asRecord(detail.semantics);
  const role = availableField(semantics?.role);
  const name = availableField(semantics?.name);
  if (role === null && name === null) return null;
  return `role=${role ?? '(unavailable)'}|name=${name ?? '(unavailable)'}`;
}

function asRecord(value: JsonValue | undefined): Record<string, JsonValue> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : null;
}

function availableField(value: JsonValue | undefined): string | null {
  const field = asRecord(value);
  return field?.status === 'available' && typeof field.value === 'string' ? field.value : null;
}

function validateTemplates(contexts: readonly PageTemplateContext[]): Map<string, string> {
  const templates = new Map<string, string>();
  for (const context of contexts) {
    const pageId = context.pageId.trim();
    const templateId = context.templateId.normalize('NFKC').trim();
    if (!pageId || !templateId) throw new Error('Page template context needs non-empty IDs.');
    if (templates.has(pageId)) throw new Error(`Page ${pageId} has duplicate template context.`);
    templates.set(pageId, templateId);
  }
  return templates;
}

function assertUniqueIds(records: Array<{ id: string }>, label: string): void {
  const seen = new Set<string>();
  for (const record of records) {
    if (seen.has(record.id)) throw new Error(`${label} ID ${record.id} is duplicated.`);
    seen.add(record.id);
  }
}

function bucket<T>(values: T[], keyFor: (value: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const value of values) {
    const key = keyFor(value);
    const entries = result.get(key) ?? [];
    entries.push(value);
    result.set(key, entries);
  }
  return result;
}

function compareCandidates(left: Candidate, right: Candidate): number {
  return (
    (left.page.finalUrl ?? left.page.requestedUrl).localeCompare(
      right.page.finalUrl ?? right.page.requestedUrl,
    ) ||
    (left.occurrence.selector ?? '').localeCompare(right.occurrence.selector ?? '') ||
    left.occurrence.id.localeCompare(right.occurrence.id)
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
