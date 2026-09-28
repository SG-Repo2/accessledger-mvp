import type {
  Evidence,
  JourneyEnvironment,
  JourneyOutcome,
  JourneyResult,
  ResidentJourney,
  Severity,
  Validation,
  ValidationClaim,
} from '@accessledger/shared';

export interface JourneyActionContext {
  actor: string;
  reason?: string | null;
}

export interface CreateResidentJourneyInput {
  id?: string;
  assessmentId: string;
  goal: string;
  startingUrl: string;
  preconditions: readonly string[];
  humanTask: string;
  expectedObservableOutcome: string;
  relatedFindingIds: readonly string[];
}

export interface ResidentJourneyEditPatch {
  goal?: string;
  startingUrl?: string;
  preconditions?: readonly string[];
  humanTask?: string;
  expectedObservableOutcome?: string;
  relatedFindingIds?: readonly string[];
}

export interface RecordJourneyResultInput {
  id?: string;
  outcome: JourneyOutcome;
  environment: JourneyEnvironment;
  nvdaResult: string | null;
  performedBy: string;
  startedAt: string;
  completedAt: string | null;
  notes: string | null;
  relatedFindingIds: readonly string[];
  supportingEvidence: readonly Evidence[];
}

export interface AddJourneyResultValidationInput {
  method: Validation['method'];
  outcome: Validation['outcome'];
  claims: readonly ValidationClaim[];
  validatedSeverity: Severity | null;
  performedBy: string;
  performedAt?: string;
  assistiveTechnology: Validation['assistiveTechnology'];
  notes: string | null;
  evidenceIds: readonly string[];
}

export interface ResidentJourneyTrace {
  journey: ResidentJourney;
  results: readonly JourneyResult[];
  evidence: readonly Evidence[];
  auditHistory: readonly import('@accessledger/shared').JourneyAuditEvent[];
}
