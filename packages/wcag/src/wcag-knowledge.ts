import { readFileSync } from 'node:fs';

import {
  CONTRACT_SCHEMA_VERSION,
  wcagCriterionSchema,
  type RuleMapping,
  type WCAGCriterion,
} from '@accessledger/shared';
import { z } from 'zod';

import type { WcagDatasetMetadata, WcagKnowledge } from './types.js';

const datasetMetadataSchema = z.object({
  schemaVersion: z.literal(CONTRACT_SCHEMA_VERSION),
  datasetVersion: z.string().trim().min(1),
  standard: z.object({
    name: z.literal('WCAG'),
    version: z.literal('2.1'),
    targetLevels: z.array(z.enum(['A', 'AA'])).min(1),
  }),
  publishedAt: z.iso.datetime({ offset: true }),
  publicationSources: z.array(z.url()).min(1),
  criteria: z.array(z.string().regex(/^criteria\/[\d.]+\.json$/)).min(1),
});

const DEFAULT_DATASET_ROOT = new URL('../../../data/wcag/', import.meta.url);

export class JsonWcagKnowledge implements WcagKnowledge {
  readonly metadata: WcagDatasetMetadata;
  readonly #criteria: Map<string, WCAGCriterion>;

  constructor(datasetRoot: URL = DEFAULT_DATASET_ROOT) {
    const metadata = datasetMetadataSchema.parse(readJson(new URL('index.json', datasetRoot)));
    const criteria = metadata.criteria.map((relativePath) =>
      wcagCriterionSchema.parse(readJson(new URL(relativePath, datasetRoot))),
    );
    if (new Set(criteria.map((criterion) => criterion.id)).size !== criteria.length) {
      throw new Error('WCAG dataset contains duplicate criterion IDs.');
    }
    this.metadata = metadata;
    this.#criteria = new Map(criteria.map((criterion) => [criterion.id, criterion]));
  }

  getCriterion(id: string): WCAGCriterion | undefined {
    return this.#criteria.get(id);
  }

  getCriteria(): WCAGCriterion[] {
    return [...this.#criteria.values()];
  }

  findRuleMappings(
    tool: string,
    ruleId: string,
  ): Array<{ criterion: WCAGCriterion; mapping: RuleMapping }> {
    return this.getCriteria().flatMap((criterion) =>
      criterion.knownRuleMappings
        .filter((mapping) => mapping.tool === tool && mapping.ruleId === ruleId)
        .map((mapping) => ({ criterion, mapping })),
    );
  }
}

function readJson(url: URL): unknown {
  return JSON.parse(readFileSync(url, 'utf8')) as unknown;
}
