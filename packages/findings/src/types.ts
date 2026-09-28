import type {
  Evidence,
  Finding,
  GroupProposal,
  Observation,
  ObservationOccurrence,
  Page,
  WcagCandidateEvaluation,
  ReviewAuditEvent,
  Validation,
  ValidationClaim,
  Confidence,
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

export interface FindingReviewTrace extends FindingEvidenceContext {
  finding: Finding;
  originalFinding: Finding;
  group: GroupProposal;
  originalGroup: GroupProposal;
  validations: readonly Validation[];
  auditHistory: readonly ReviewAuditEvent[];
  missingJudgmentFields: readonly string[];
  approvalBlockers: readonly string[];
}

export interface FindingEditPatch {
  title?: string;
  condition?: string;
  cause?: string | null;
  effect?: string | null;
  recommendation?: string | null;
  confidence?: Confidence | null;
  wcagCriteria?: readonly string[];
}

export interface ReviewActionContext {
  actor: string;
  reason?: string | null;
}

export interface AddFindingValidationInput {
  method: Validation['method'];
  outcome: Validation['outcome'];
  claims: readonly ValidationClaim[];
  validatedSeverity: Validation['validatedSeverity'];
  performedBy: string;
  performedAt?: string;
  assistiveTechnology: Validation['assistiveTechnology'];
  notes: string | null;
  supportingEvidence: readonly Evidence[];
}
