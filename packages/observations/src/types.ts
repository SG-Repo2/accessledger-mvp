import type { Evidence, Observation, ObservationOccurrence, Page } from '@accessledger/shared';

export interface ObservationNormalizationInput {
  page: Page;
  evidence: readonly Evidence[];
}

export interface IgnoredEvidence {
  evidenceId: string;
  reason:
    | 'not_a_supported_source'
    | 'no_covered_deterministic_fact'
    | 'collection_error'
    | 'malformed_source_payload';
}

export interface ObservationNormalizationResult {
  observations: Observation[];
  occurrences: ObservationOccurrence[];
  ignoredEvidence: IgnoredEvidence[];
  unrecognizedRules: Array<{
    evidenceId: string;
    tool: string;
    toolVersion: string | null;
    ruleId: string;
  }>;
}

export interface ObservationIdContext {
  evidenceId: string;
  sourceRuleId: string;
  index: number;
}

export interface ObservationNormalizerOptions {
  clock?: () => Date;
  idFactory?: (recordType: 'observation' | 'occurrence', context: ObservationIdContext) => string;
}

export interface ObservationNormalizer {
  normalize(input: ObservationNormalizationInput): ObservationNormalizationResult;
}
