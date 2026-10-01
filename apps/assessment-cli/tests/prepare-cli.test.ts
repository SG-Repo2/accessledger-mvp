import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  DeterministicFindingDrafter,
  FindingReviewService,
  GroupProposalReviewService,
} from '@accessledger/findings';
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
        persistedProposals: 2,
        ignoredNormalizationInputs: 1,
        unrecognizedRules: 1,
      });

      const database = new DatabaseSync(databasePath, { readOnly: true });
      expect(
        database.prepare('SELECT version FROM schema_migrations ORDER BY version').all(),
      ).toEqual([{ version: 1 }, { version: 2 }, { version: 3 }]);
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

  it('persists a complete proposal trace and drafts only after explicit acceptance', () => {
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
        ineligibleGroupingProposals: 1,
        persistedProposals: 1,
        draftFindings: 0,
        persistedReviewBundles: 0,
        supportedWcagEvaluations: 0,
        unsupportedWcagEvaluations: 1,
      });
      const proposalService = new GroupProposalReviewService(
        repository,
        new DeterministicFindingDrafter({ clock: () => new Date(assessment.completedAt) }),
        { clock: () => new Date(assessment.completedAt), idFactory: sequenceIds() },
      );
      const [proposalId] = proposalService.listProposalIds(assessment.page.assessmentId);
      expect(proposalId).toBeDefined();
      const pending = proposalService.load(proposalId!);
      expect(pending.proposal.reviewStatus).toBe('pending');
      expect(pending.draftLink).toBeNull();
      expect(new FindingReviewService(repository).listFindingIds()).toEqual([]);

      const accepted = proposalService.decide(proposalId!, 'accepted', {
        actor: 'Auditor Example',
        reason: 'The repeated member structure was inspected and confirmed.',
      });
      expect(accepted.originalProposal.reviewStatus).toBe('pending');
      expect(accepted.proposal.reviewStatus).toBe('accepted');
      expect(accepted.decisions).toHaveLength(1);
      expect(accepted.draftLink).not.toBeNull();
      const trace = new FindingReviewService(repository).loadCompleteTrace(
        accepted.draftLink!.findingId,
      );
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
        reviewStatus: 'accepted',
        groupingConfidence: 'high',
      });
      expect(trace.validations).toEqual([]);
      expect(trace.observations).toHaveLength(1);
      expect(trace.occurrences).toHaveLength(2);
      expect(trace.wcagEvaluations[0]?.evaluation).toBe('unsupported');
      expect(trace.pages).toEqual([assessment.page]);
      expect(trace.evidence.map((record) => record.id)).toEqual(['scanner-evidence']);

      expect(() => prepareAssessmentForReview(assessment, stages)).toThrow(
        /already contains prepared GroupProposal IDs/,
      );
      expect(proposalService.listProposalIds(assessment.page.assessmentId)).toHaveLength(1);
    } finally {
      repository.close();
    }
  });

  it('preserves an uncertain aria-prohibited-attr trace without drafting or accepting its singleton', () => {
    const loaded = loadedAssessment();
    const assessment = rawPageAssessmentSchema.parse({
      ...loaded,
      scannerEvidence: {
        ...loaded.scannerEvidence!,
        payload: {
          testEngine: { name: 'axe-core', version: '4.13.0' },
          violations: [
            {
              id: 'aria-prohibited-attr',
              nodes: [
                {
                  any: [],
                  all: [],
                  none: [
                    {
                      id: 'aria-prohibited-attr',
                      data: {
                        role: null,
                        nodeName: 'time',
                        messageKey: 'noRoleSingular',
                        prohibited: ['aria-label'],
                      },
                    },
                  ],
                  target: ['#event-date'],
                  html: '<time id="event-date" tabindex="0" aria-label="Date, Sep. 28">Sep. 28</time>',
                },
              ],
            },
            {
              id: 'region',
              nodes: [
                {
                  any: [{ id: 'region', data: { isIframe: false } }],
                  all: [],
                  none: [],
                  target: ['a[href$="#site-nav"]'],
                  html: '<a href="#site-nav">Back to navigation</a>',
                },
              ],
            },
          ],
        },
      },
    });
    const repository = new SqliteReviewRepository(':memory:');
    try {
      const counts = prepareAssessmentForReview(
        assessment,
        createAssessmentPreparationStages(assessment, repository),
      );

      expect(counts).toEqual({
        observations: 1,
        occurrences: 1,
        wcagEvaluations: 1,
        supportedWcagEvaluations: 0,
        unsupportedWcagEvaluations: 0,
        uncertainWcagEvaluations: 1,
        groupingProposals: 1,
        ineligibleGroupingProposals: 1,
        draftFindings: 0,
        persistedReviewBundles: 0,
        persistedProposals: 1,
        ignoredNormalizationInputs: 1,
        unrecognizedRules: 1,
      });
      expect(new FindingReviewService(repository).listFindingIds('assessment-prepare')).toEqual([]);
      expect(
        new GroupProposalReviewService(
          repository,
          new DeterministicFindingDrafter(),
        ).listProposalIds('assessment-prepare'),
      ).toHaveLength(1);
    } finally {
      repository.close();
    }
  });

  it('persists all five Naperville proposals, then drafts only the two explicitly accepted repeats', () => {
    const savedOutput = readFileSync(
      new URL('../../../naperville-scan.json', import.meta.url),
      'utf8',
    );
    const assessment = rawPageAssessmentSchema.parse(
      JSON.parse(savedOutput.slice(savedOutput.indexOf('{'))) as unknown,
    );
    const repository = new SqliteReviewRepository(':memory:');
    try {
      const counts = prepareAssessmentForReview(
        assessment,
        createAssessmentPreparationStages(assessment, repository),
      );
      expect(counts).toMatchObject({
        observations: 1,
        occurrences: 8,
        groupingProposals: 5,
        persistedProposals: 5,
        draftFindings: 0,
        persistedReviewBundles: 0,
      });

      const proposalService = new GroupProposalReviewService(
        repository,
        new DeterministicFindingDrafter({ clock: () => new Date(assessment.completedAt) }),
        { clock: () => new Date(assessment.completedAt), idFactory: sequenceIds() },
      );
      const findingService = new FindingReviewService(repository);
      const initial = proposalService
        .listProposalIds(assessment.page.assessmentId)
        .map((id) => proposalService.load(id));
      expect(initial).toHaveLength(5);
      expect(initial.every((trace) => trace.proposal.reviewStatus === 'pending')).toBe(true);
      expect(initial.every((trace) => trace.decisions.length === 0)).toBe(true);
      expect(initial.every((trace) => trace.draftLink === null)).toBe(true);
      expect(findingService.listFindingIds(assessment.page.assessmentId)).toEqual([]);

      const repeats = initial.filter(
        (trace) =>
          trace.proposal.kind === 'repeat_candidate' &&
          trace.proposal.groupingConfidence === 'medium',
      );
      expect(repeats.map((trace) => trace.occurrences.length).sort()).toEqual([2, 3]);
      for (const trace of repeats) {
        proposalService.decide(trace.proposal.id, 'accepted', {
          actor: 'Naperville fixture auditor',
          reason: 'The repeat membership and retained occurrence evidence were inspected.',
        });
      }

      const after = proposalService
        .listProposalIds(assessment.page.assessmentId)
        .map((id) => proposalService.load(id));
      expect(after.filter((trace) => trace.proposal.reviewStatus === 'accepted')).toHaveLength(2);
      expect(after.filter((trace) => trace.proposal.reviewStatus === 'pending')).toHaveLength(3);
      expect(after.filter((trace) => trace.draftLink !== null)).toHaveLength(2);
      expect(findingService.listFindingIds(assessment.page.assessmentId)).toHaveLength(2);
      const draftTraces = findingService
        .listFindingIds(assessment.page.assessmentId)
        .map((id) => findingService.loadCompleteTrace(id));
      expect(draftTraces.map((trace) => trace.finding.occurrenceCount).sort()).toEqual([2, 3]);
      expect(
        draftTraces.every(
          (trace) =>
            trace.finding.status === 'draft' &&
            trace.group.kind === 'repeat_candidate' &&
            trace.group.reviewStatus === 'accepted' &&
            trace.finding.wcagCriteria.length === 0,
        ),
      ).toBe(true);
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
    persistedProposals: 0,
    ignoredNormalizationInputs: 0,
    unrecognizedRules: 0,
  };
}

function sequenceIds(): () => string {
  let value = 0;
  return () => String(++value).padStart(4, '0');
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
