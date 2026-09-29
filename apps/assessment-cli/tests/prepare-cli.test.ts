import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { FindingReviewService } from '@accessledger/findings';
import { SqliteReviewRepository } from '@accessledger/persistence';
import {
  CONTRACT_SCHEMA_VERSION,
  rawPageAssessmentSchema,
  wcagCandidateEvaluationSchema,
  type RawPageAssessment,
} from '@accessledger/shared';
import { describe, expect, it, vi } from 'vitest';

import {
  createAssessmentPreparationStages,
  prepareAssessmentForReview,
} from '../src/prepare-assessment.js';
import { runAssessmentPrepareCli } from '../src/prepare-cli.js';

describe('assessment preparation CLI', () => {
  it('validates, composes the default pipeline, initializes a portable database, and prints stable counts', () => {
    const directory = mkdtempSync(join(tmpdir(), 'accessledger-prepare-valid-'));
    try {
      const inputPath = join(directory, 'input folder', 'scan.json');
      const databasePath = join(directory, 'review folder', 'review.sqlite');
      writeJson(inputPath, loadedAssessment());
      const firstOutput: string[] = [];

      expect(
        runAssessmentPrepareCli([inputPath, databasePath], {
          stdout: (text) => firstOutput.push(text),
        }),
      ).toBe(0);
      expect(existsSync(databasePath)).toBe(true);
      const firstManifest = JSON.parse(firstOutput.join('')) as Record<string, unknown>;
      expect(firstManifest).toMatchObject({
        assessmentId: 'assessment-prepare',
        inputPath,
        databasePath,
        observations: 1,
        occurrences: 2,
        wcagEvaluations: 1,
        supportedWcagEvaluations: 1,
        unsupportedWcagEvaluations: 0,
        uncertainWcagEvaluations: 0,
        groupingProposals: 2,
        ineligibleGroupingProposals: 2,
        draftFindings: 0,
        persistedReviewBundles: 0,
        ignoredNormalizationInputs: 1,
        unrecognizedRules: 1,
      });

      const database = new DatabaseSync(databasePath, { readOnly: true });
      expect(
        database.prepare('SELECT version FROM schema_migrations ORDER BY version').all(),
      ).toEqual([{ version: 1 }, { version: 2 }]);
      database.close();

      const secondDatabasePath = join(directory, 'second', 'review.sqlite');
      const secondOutput: string[] = [];
      expect(
        runAssessmentPrepareCli([inputPath, secondDatabasePath], {
          stdout: (text) => secondOutput.push(text),
        }),
      ).toBe(0);
      const secondManifest = JSON.parse(secondOutput.join('')) as Record<string, unknown>;
      expect({ ...secondManifest, databasePath }).toEqual(firstManifest);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it.each([
    ['malformed JSON', '{not json', /valid JSON/],
    [
      'contract-invalid JSON',
      JSON.stringify({ schemaVersion: CONTRACT_SCHEMA_VERSION }),
      /contract validation/,
    ],
  ])('refuses %s before opening a database', (_label, contents, expected) => {
    const directory = mkdtempSync(join(tmpdir(), 'accessledger-prepare-invalid-'));
    try {
      const inputPath = join(directory, 'scan.json');
      const databasePath = join(directory, 'review.sqlite');
      writeFileSync(inputPath, contents, 'utf8');
      const errors: string[] = [];
      const createSession = vi.fn();

      expect(
        runAssessmentPrepareCli([inputPath, databasePath], {
          createSession,
          stderr: (text) => errors.push(text),
        }),
      ).toBe(1);
      expect(errors.join('')).toMatch(expected);
      expect(createSession).not.toHaveBeenCalled();
      expect(existsSync(databasePath)).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it.each(['navigation_failed', 'scan_failed'] as const)(
    'refuses a valid %s assessment before opening a database',
    (status) => {
      const directory = mkdtempSync(join(tmpdir(), 'accessledger-prepare-failure-'));
      try {
        const inputPath = join(directory, 'scan.json');
        const databasePath = join(directory, 'review.sqlite');
        writeJson(inputPath, failedAssessment(status));
        const errors: string[] = [];
        const createSession = vi.fn();

        expect(
          runAssessmentPrepareCli([inputPath, databasePath], {
            createSession,
            stderr: (text) => errors.push(text),
          }),
        ).toBe(1);
        expect(errors.join('')).toContain(status);
        expect(createSession).not.toHaveBeenCalled();
        expect(existsSync(databasePath)).toBe(false);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );

  it('persists a complete eligible trace while preserving unsupported WCAG and no-inference fields', () => {
    const assessment = loadedAssessment();
    const repository = new SqliteReviewRepository(':memory:');
    try {
      const defaults = createAssessmentPreparationStages(assessment, repository);
      const stages = {
        ...defaults,
        normalizer: {
          normalize: (input: Parameters<typeof defaults.normalizer.normalize>[0]) => {
            const result = defaults.normalizer.normalize(input);
            return {
              ...result,
              occurrences: result.occurrences.map((occurrence) => ({
                ...occurrence,
                componentFingerprint: 'fixture-shared-button',
              })),
            };
          },
        },
        wcagMapper: {
          evaluate: (observation: Parameters<typeof defaults.wcagMapper.evaluate>[0]) =>
            defaults.wcagMapper.evaluate(observation).map((evaluation) =>
              wcagCandidateEvaluationSchema.parse({
                ...evaluation,
                evaluation: 'unsupported',
                reason: 'requirements_contradicted',
                requirementEvaluations: evaluation.requirementEvaluations.map(
                  (requirement, index) => ({
                    ...requirement,
                    status: index === 0 ? 'contradicted' : requirement.status,
                  }),
                ),
              }),
            ),
        },
      };

      const manifest = prepareAssessmentForReview(assessment, stages);

      expect(manifest).toMatchObject({
        groupingProposals: 1,
        ineligibleGroupingProposals: 0,
        draftFindings: 1,
        persistedReviewBundles: 1,
        supportedWcagEvaluations: 0,
        unsupportedWcagEvaluations: 1,
      });
      const service = new FindingReviewService(repository);
      const [findingId] = service.listFindingIds(assessment.page.assessmentId);
      expect(findingId).toBeDefined();
      const trace = service.loadCompleteTrace(findingId!);
      expect(trace.finding).toMatchObject({
        status: 'draft',
        severity: null,
        confidence: null,
        validationStatus: 'required',
        wcagCriteria: [],
        cause: null,
        effect: null,
        recommendation: null,
      });
      expect(trace.group).toMatchObject({
        reviewStatus: 'pending',
        groupingConfidence: 'high',
      });
      expect(trace.validations).toEqual([]);
      expect(trace.observations).toHaveLength(1);
      expect(trace.occurrences).toHaveLength(2);
      expect(trace.wcagEvaluations[0]?.evaluation).toBe('unsupported');
      expect(trace.pages).toEqual([assessment.page]);
      expect(trace.evidence.map((record) => record.id)).toEqual(['scanner-evidence']);

      expect(() => prepareAssessmentForReview(assessment, stages)).toThrow(
        /already contains prepared Finding IDs/,
      );
      expect(service.listFindingIds(assessment.page.assessmentId)).toHaveLength(1);
    } finally {
      repository.close();
    }
  });

  it('closes the preparation session when persistence fails', () => {
    const directory = mkdtempSync(join(tmpdir(), 'accessledger-prepare-close-'));
    try {
      const inputPath = join(directory, 'scan.json');
      writeJson(inputPath, loadedAssessment());
      const close = vi.fn();
      const errors: string[] = [];

      expect(
        runAssessmentPrepareCli([inputPath, join(directory, 'review.sqlite')], {
          createSession: () => ({
            prepare: () => {
              throw new Error('persistence failed');
            },
            close,
          }),
          stderr: (text) => errors.push(text),
        }),
      ).toBe(1);
      expect(errors.join('')).toContain('persistence failed');
      expect(close).toHaveBeenCalledOnce();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('closes the preparation session after successful persistence', () => {
    const directory = mkdtempSync(join(tmpdir(), 'accessledger-prepare-success-close-'));
    try {
      const inputPath = join(directory, 'scan.json');
      writeJson(inputPath, loadedAssessment());
      const close = vi.fn();

      expect(
        runAssessmentPrepareCli([inputPath, join(directory, 'review.sqlite')], {
          createSession: () => ({ prepare: () => emptyCounts(), close }),
          stdout: () => undefined,
        }),
      ).toBe(0);
      expect(close).toHaveBeenCalledOnce();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

function emptyCounts() {
  return {
    observations: 0,
    occurrences: 0,
    wcagEvaluations: 0,
    supportedWcagEvaluations: 0,
    unsupportedWcagEvaluations: 0,
    uncertainWcagEvaluations: 0,
    groupingProposals: 0,
    ineligibleGroupingProposals: 0,
    draftFindings: 0,
    persistedReviewBundles: 0,
    ignoredNormalizationInputs: 0,
    unrecognizedRules: 0,
  };
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function loadedAssessment(): RawPageAssessment {
  const timestamp = '2026-09-29T12:00:00.000Z';
  return rawPageAssessmentSchema.parse({
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    page: {
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      id: 'page-prepare',
      assessmentId: 'assessment-prepare',
      requestedUrl: 'https://fixture.example/services',
      finalUrl: 'https://fixture.example/services',
      title: 'Services',
      language: 'en',
      loadStatus: 'loaded',
      loadedAt: timestamp,
      failureReason: null,
      rawEvidenceIds: ['browser-evidence', 'scanner-evidence'],
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    browserEvidence: {
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      id: 'browser-evidence',
      assessmentId: 'assessment-prepare',
      pageId: 'page-prepare',
      kind: 'raw_browser_result',
      source: { type: 'browser', name: 'playwright', version: '1.63.0' },
      capturedAt: timestamp,
      contentType: 'application/json',
      payload: { status: 'loaded' },
      metadata: {},
    },
    scannerEvidence: {
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      id: 'scanner-evidence',
      assessmentId: 'assessment-prepare',
      pageId: 'page-prepare',
      kind: 'raw_scanner_result',
      source: { type: 'scanner', name: 'axe-core', version: '4.13.0' },
      capturedAt: timestamp,
      contentType: 'application/json',
      payload: {
        violations: [
          {
            id: 'button-name',
            tags: ['wcag412'],
            nodes: [
              { target: ['#first'], html: '<button></button>' },
              { target: ['#second'], html: '<button></button>' },
            ],
          },
          { id: 'color-contrast', tags: ['wcag143'], nodes: [{ target: ['main'] }] },
        ],
      },
      metadata: {},
    },
    accessibilityEvidence: [],
    operationalResult: { status: 'loaded' },
    startedAt: timestamp,
    completedAt: timestamp,
  });
}

function failedAssessment(status: 'navigation_failed' | 'scan_failed'): RawPageAssessment {
  const loaded = loadedAssessment();
  const error = {
    stage: status === 'navigation_failed' ? ('navigation' as const) : ('axe_execution' as const),
    name: 'Error',
    message: `${status} fixture`,
  };
  if (status === 'scan_failed') {
    return rawPageAssessmentSchema.parse({
      ...loaded,
      operationalResult: { status, error },
    });
  }
  return rawPageAssessmentSchema.parse({
    ...loaded,
    page: {
      ...loaded.page,
      finalUrl: null,
      title: null,
      language: null,
      loadStatus: 'failed',
      loadedAt: null,
      failureReason: error.message,
      rawEvidenceIds: ['browser-evidence'],
    },
    scannerEvidence: null,
    operationalResult: { status, error },
  });
}
