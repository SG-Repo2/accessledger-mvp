import type {
  Evidence,
  Finding,
  GroupProposal,
  Observation,
  ObservationOccurrence,
  Page,
  ReviewAuditEvent,
  Validation,
  WcagCandidateEvaluation,
} from '@accessledger/shared';

export interface ReviewSourceContext {
  observations: readonly Observation[];
  occurrences: readonly ObservationOccurrence[];
  wcagEvaluations: readonly WcagCandidateEvaluation[];
  pages: readonly Page[];
  evidence: readonly Evidence[];
}

export interface ReviewBundleInput extends ReviewSourceContext {
  finding: Finding;
  group: GroupProposal;
}

export interface PersistedReviewBundle extends ReviewSourceContext {
  finding: Finding;
  originalFinding: Finding;
  group: GroupProposal;
  originalGroup: GroupProposal;
  validations: Validation[];
  auditHistory: ReviewAuditEvent[];
}

export interface GroupingDecisionRecord {
  id: string;
  findingId: string;
  groupProposalId: string;
  status: GroupProposal['reviewStatus'];
  actor: string;
  reason: string;
  decidedAt: string;
}

export interface ReviewRepository {
  createReviewBundle(input: ReviewBundleInput, event: ReviewAuditEvent): void;
  loadReviewBundle(findingId: string): PersistedReviewBundle | null;
  listFindingIds(): string[];
  commitFinding(previous: Finding, next: Finding, event: ReviewAuditEvent): void;
  commitGroupingDecision(decision: GroupingDecisionRecord, event: ReviewAuditEvent): void;
  commitValidation(
    previousFinding: Finding,
    nextFinding: Finding,
    validation: Validation,
    supportingEvidence: readonly Evidence[],
    event: ReviewAuditEvent,
  ): void;
  close(): void;
}
