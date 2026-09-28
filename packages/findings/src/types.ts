import type {
  Evidence,
  Finding,
  GroupProposal,
  Observation,
  ObservationOccurrence,
  Page,
  WcagCandidateEvaluation,
} from '@accessledger/shared';

export interface FindingEvidenceContext {
  observations: readonly Observation[];
  occurrences: readonly ObservationOccurrence[];
  wcagEvaluations: readonly WcagCandidateEvaluation[];
  pages: readonly Page[];
  evidence: readonly Evidence[];
}

export interface FindingDrafterOptions {
  clock?: () => Date;
}

export interface FindingDrafter {
  draft(group: GroupProposal, evidenceContext: FindingEvidenceContext): Finding;
}
