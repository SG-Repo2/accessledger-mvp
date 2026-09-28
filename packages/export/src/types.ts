import type { FindingReviewTrace } from '@accessledger/findings';
import type { ResidentJourneyTrace } from '@accessledger/journeys';
import type {
  FindingsRegisterExportFormat,
  FindingsRegisterExportManifest,
} from '@accessledger/shared';

export interface FindingsRegisterReviewSource {
  listFindingIds(assessmentId?: string): string[];
  loadCompleteTrace(findingId: string): FindingReviewTrace;
}

export interface FindingsRegisterJourneySource {
  loadProtocol(journeyId: string): ResidentJourneyTrace;
}

export interface FindingsExporter {
  export(
    assessmentId: string,
    format: FindingsRegisterExportFormat,
    destination: string,
  ): FindingsRegisterExportManifest;
}

export interface FindingsExporterOptions {
  clock?: () => Date;
  overwrite?: boolean;
}
