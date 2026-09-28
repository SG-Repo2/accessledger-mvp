import type {
  Observation,
  RuleMapping,
  WCAGCriterion,
  WcagCandidateEvaluation,
} from '@accessledger/shared';

export interface WcagDatasetMetadata {
  schemaVersion: '1.0.0';
  datasetVersion: string;
  standard: {
    name: 'WCAG';
    version: '2.1';
    targetLevels: ('A' | 'AA')[];
  };
  publishedAt: string;
  publicationSources: string[];
  criteria: string[];
}

export interface WcagKnowledge {
  readonly metadata: WcagDatasetMetadata;
  getCriterion(id: string): WCAGCriterion | undefined;
  getCriteria(): WCAGCriterion[];
  findRuleMappings(
    tool: string,
    ruleId: string,
  ): Array<{
    criterion: WCAGCriterion;
    mapping: RuleMapping;
  }>;
}

export interface WcagEvaluationIdContext {
  observationId: string;
  criterionId: string | null;
  index: number;
}

export interface WcagMapperOptions {
  clock?: () => Date;
  idFactory?: (context: WcagEvaluationIdContext) => string;
}

export interface WcagMapper {
  evaluate(observation: Observation): WcagCandidateEvaluation[];
}
