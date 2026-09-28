import type { GroupProposal, Observation, ObservationOccurrence, Page } from '@accessledger/shared';

export interface PageTemplateContext {
  pageId: string;
  templateId: string;
}

export interface GroupingContext {
  pages: readonly Page[];
  pageTemplates?: readonly PageTemplateContext[];
}

export interface GroupingEngineOptions {
  clock?: () => Date;
}

export interface GroupingEngine {
  propose(
    observations: readonly Observation[],
    occurrences: readonly ObservationOccurrence[],
    context: GroupingContext,
  ): GroupProposal[];
}
