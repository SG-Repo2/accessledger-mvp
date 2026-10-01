import type {
  Evidence,
  Finding,
  GroupProposal,
  JourneyAuditEvent,
  JourneyResult,
  Observation,
  ObservationOccurrence,
  Page,
  ProposalDraftLink,
  ProposalReviewDecision,
  ReviewAuditEvent,
  ResidentJourney,
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

export interface ProposalReviewInput extends ReviewSourceContext {
  proposal: GroupProposal;
}

export interface PersistedProposalReview extends ReviewSourceContext {
  proposal: GroupProposal;
  originalProposal: GroupProposal;
  decisions: ProposalReviewDecision[];
  draftLink: ProposalDraftLink | null;
}

export interface ProposalDecisionDraft {
  reviewBundle: ReviewBundleInput;
  reviewEvent: ReviewAuditEvent;
  link: ProposalDraftLink;
}

export interface PersistedReviewBundle extends ReviewSourceContext {
  finding: Finding;
  originalFinding: Finding;
  group: GroupProposal;
  originalGroup: GroupProposal;
  validations: Validation[];
  journeyResults: JourneyResult[];
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
  listFindingIds(assessmentId?: string): string[];
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

export interface ProposalReviewRepository {
  createProposalReviews(inputs: readonly ProposalReviewInput[]): void;
  loadProposalReview(proposalId: string): PersistedProposalReview | null;
  listProposalIds(assessmentId?: string): string[];
  commitProposalDecision(
    decision: ProposalReviewDecision,
    draft: ProposalDecisionDraft | null,
  ): void;
}

export interface JourneyRepository {
  createJourney(journey: ResidentJourney, event: JourneyAuditEvent): void;
  updateJourney(previous: ResidentJourney, next: ResidentJourney, event: JourneyAuditEvent): void;
  deleteJourney(journey: ResidentJourney, event: JourneyAuditEvent): void;
  loadJourney(journeyId: string): ResidentJourney | null;
  listJourneys(assessmentId?: string): ResidentJourney[];
  recordJourneyResult(
    result: JourneyResult,
    supportingEvidence: readonly Evidence[],
    event: JourneyAuditEvent,
  ): void;
  loadJourneyResult(resultId: string): JourneyResult | null;
  loadJourneyResultEvidence(resultId: string): Evidence[];
  listJourneyResults(journeyId: string): JourneyResult[];
  listJourneyResultsForFinding(findingId: string): JourneyResult[];
  loadJourneyAuditHistory(journeyId: string): JourneyAuditEvent[];
  commitJourneyResultValidation(
    previousFinding: Finding,
    nextFinding: Finding,
    validation: Validation,
    reviewEvent: ReviewAuditEvent,
    journeyEvent: JourneyAuditEvent,
  ): void;
}
