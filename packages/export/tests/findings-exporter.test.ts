import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';

import { FindingReviewService, type FindingReviewTrace } from '@accessledger/findings';
import { ResidentJourneyService, type RecordJourneyResultInput } from '@accessledger/journeys';
import { SqliteReviewRepository } from '@accessledger/persistence';
import {
  CONTRACT_SCHEMA_VERSION,
  FINDINGS_REGISTER_EXPORT_SCHEMA_VERSION,
  evidenceSchema,
  findingsRegisterDocumentSchema,
  findingsRegisterExportManifestSchema,
  type JourneyOutcome,
} from '@accessledger/shared';
import { describe, expect, it } from 'vitest';

import { humanEvidence, reviewFixture, reviewNow } from '../../../tests/support/review-fixture.js';
import {
  DeterministicFindingsExporter,
  FINDINGS_REGISTER_CSV_COLUMNS,
  serializeFindingsRegisterCsv,
  serializeFindingsRegisterJson,
  type FindingsRegisterJourneySource,
  type FindingsRegisterReviewSource,
} from '../src/index.js';

const generatedAt = '2026-09-28T20:00:00.000Z';
const completedAt = '2026-09-28T18:15:00.000Z';

describe('DeterministicFindingsExporter', () => {
  it('writes stable, schema-valid JSON with complete trace and exact approved content', () => {
    const context = setupApproved();
    const directory = mkdtempSync(join(tmpdir(), 'accessledger-export-json-'));
    try {
      const destination = join(directory, 'nested', 'findings.json');
      const exporter = createExporter(context, false);
      expect(context.reviewService.listFindingIds('assessment-review')).toEqual([
        context.trace.finding.id,
      ]);
      expect(context.reviewService.listFindingIds('another-assessment')).toEqual([]);
      const firstDocument = exporter.buildDocument('assessment-review');
      const secondDocument = exporter.buildDocument('assessment-review');
      expect(secondDocument).toEqual(firstDocument);

      const manifest = exporter.export('assessment-review', 'json', destination);
      const contents = readFileSync(destination, 'utf8');
      const document = findingsRegisterDocumentSchema.parse(JSON.parse(contents));

      expect(manifest).toEqual(findingsRegisterExportManifestSchema.parse(manifest));
      expect(
        findingsRegisterDocumentSchema.safeParse({ ...document, schemaVersion: '2.0.0' }).success,
      ).toBe(false);
      expect(
        findingsRegisterExportManifestSchema.safeParse({ ...manifest, schemaVersion: '2.0.0' })
          .success,
      ).toBe(false);
      expect(manifest).toMatchObject({
        schemaVersion: FINDINGS_REGISTER_EXPORT_SCHEMA_VERSION,
        format: 'json',
        assessmentId: 'assessment-review',
        generatedAt,
        recordCount: 1,
      });
      expect(manifest.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(manifest.byteLength).toBe(Buffer.byteLength(contents, 'utf8'));
      expect(contents).toBe(serializeFindingsRegisterJson(document));
      expect(document.findings[0]).toMatchObject({
        schemaVersion: FINDINGS_REGISTER_EXPORT_SCHEMA_VERSION,
        findingId: context.trace.finding.id,
        assessmentId: 'assessment-review',
        status: 'approved',
        content: {
          title: context.trace.finding.title,
          condition: context.trace.finding.condition,
          cause: context.trace.finding.cause,
          effect: context.trace.finding.effect,
          recommendation: context.trace.finding.recommendation,
        },
        severity: 'moderate',
        confidence: 'high',
        wcagCriteria: ['4.1.2'],
        occurrenceCount: 1,
        affectedUrls: ['https://fixture.example/form'],
        affectedComponents: ['fingerprint:fixture-submit-button'],
        trace: {
          observationIds: ['observation-review'],
          sourceEvidenceIds: ['evidence-review-source'],
          occurrences: [
            {
              occurrenceId: 'occurrence-review',
              observationId: 'observation-review',
              pageId: 'page-review',
              url: 'https://fixture.example/form',
              component: 'fingerprint:fixture-submit-button',
              evidenceIds: ['evidence-review-source'],
            },
          ],
        },
        journeys: [],
      });
      expect(document.findings[0]?.validations[0]).toMatchObject({
        outcome: 'supported',
        validatedSeverity: 'moderate',
        evidenceIds: ['human-export-validation'],
      });
      expect(() => exporter.export('assessment-review', 'json', destination)).toThrow(
        /already exists/,
      );
    } finally {
      context.repository.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('uses deterministic Finding ordering and excludes non-approved records', () => {
    const context = setupApproved();
    try {
      const traceB = cloneTraceWithFindingId(context.trace, 'finding-b');
      const traceA = cloneTraceWithFindingId(context.trace, 'finding-a');
      const draft = cloneTraceWithFindingId(context.trace, 'finding-draft', 'draft');
      const rejected = cloneTraceWithFindingId(context.trace, 'finding-rejected', 'rejected');
      const inReview = cloneTraceWithFindingId(context.trace, 'finding-reviewing', 'in_review');
      const traces = new Map(
        [traceB, draft, rejected, traceA, inReview].map((trace) => [trace.finding.id, trace]),
      );
      const source: FindingsRegisterReviewSource = {
        listFindingIds: () => [...traces.keys()],
        loadCompleteTrace: (id) => traces.get(id)!,
      };
      const document = new DeterministicFindingsExporter(source, context.journeyService, {
        clock: () => new Date(generatedAt),
      }).buildDocument('assessment-review');

      expect(document.findings.map((finding) => finding.findingId)).toEqual([
        'finding-a',
        'finding-b',
      ]);
    } finally {
      context.repository.close();
    }
  });

  it('emits RFC-style escaped UTF-8 CSV and round-trips nested trace identifiers', () => {
    const context = setupApproved({
      title: 'Quoted, "Finding"\nCafé',
      condition: 'Line one,\nline "two" — résumé.',
      cause: 'Cause, with comma.',
      effect: 'Effect says "stop".',
      recommendation: 'Use Unicode: Łódź.',
    });
    const directory = mkdtempSync(join(tmpdir(), 'accessledger-export-csv-'));
    try {
      const destination = join(directory, 'findings.csv');
      const exporter = createExporter(context, false);
      exporter.export('assessment-review', 'csv', destination);
      const contents = readFileSync(destination, 'utf8');
      const rows = parseCsv(contents);

      expect(contents).toContain('"Quoted, ""Finding""\nCafé"');
      expect(contents).toContain('résumé');
      expect(contents.endsWith('\r\n')).toBe(true);
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual(FINDINGS_REGISTER_CSV_COLUMNS);
      const values = Object.fromEntries(rows[0]!.map((column, index) => [column, rows[1]![index]]));
      expect(values['finding_id']).toBe(context.trace.finding.id);
      expect(JSON.parse(values['observation_ids_json']!)).toEqual(['observation-review']);
      expect(JSON.parse(values['source_evidence_ids_json']!)).toEqual(['evidence-review-source']);
      expect(JSON.parse(values['occurrence_references_json']!)[0].occurrenceId).toBe(
        'occurrence-review',
      );
      expect(JSON.parse(values['validation_summaries_json']!)[0].evidenceIds).toEqual([
        'human-export-validation',
      ]);
    } finally {
      context.repository.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('exports an empty assessment as valid deterministic JSON and CSV', () => {
    const reviewSource: FindingsRegisterReviewSource = {
      listFindingIds: () => [],
      loadCompleteTrace: () => {
        throw new Error('not called');
      },
    };
    const journeySource: FindingsRegisterJourneySource = {
      loadProtocol: () => {
        throw new Error('not called');
      },
    };
    const exporter = new DeterministicFindingsExporter(reviewSource, journeySource, {
      clock: () => new Date(generatedAt),
    });
    const document = exporter.buildDocument('assessment-empty');

    expect(document).toEqual({
      schemaVersion: FINDINGS_REGISTER_EXPORT_SCHEMA_VERSION,
      assessmentId: 'assessment-empty',
      generatedAt,
      recordCount: 0,
      findings: [],
    });
    expect(serializeFindingsRegisterCsv(document)).toBe(
      `${FINDINGS_REGISTER_CSV_COLUMNS.map((column) => `"${column}"`).join(',')}\r\n`,
    );
  });

  it('refuses approved records with broken trace, incomplete content, or unsupported claims', () => {
    const context = setupApproved();
    try {
      const cases: FindingReviewTrace[] = [
        {
          ...context.trace,
          finding: { ...context.trace.finding, evidenceIds: ['missing-evidence'] },
        },
        {
          ...context.trace,
          finding: { ...context.trace.finding, cause: null },
        },
        {
          ...context.trace,
          validations: context.trace.validations.map((validation) => ({
            ...validation,
            outcome: 'unsupported' as const,
            validatedSeverity: null,
          })),
        },
      ];

      for (const trace of cases) {
        const source: FindingsRegisterReviewSource = {
          listFindingIds: () => [trace.finding.id],
          loadCompleteTrace: () => trace,
        };
        expect(() =>
          new DeterministicFindingsExporter(source, context.journeyService, {
            clock: () => new Date(generatedAt),
          }).buildDocument('assessment-review'),
        ).toThrow();
      }
    } finally {
      context.repository.close();
    }
  });

  it('preserves every journey outcome, protocol context, Evidence, and explicit result Validation', () => {
    const context = setupApproved({ journeys: true });
    try {
      const document = createExporter(context, false).buildDocument('assessment-review');
      const finding = document.findings[0]!;
      const journey = finding.journeys[0]!;

      expect(finding.severity).toBe('moderate');
      expect(journey).toMatchObject({
        journeyId: 'journey-export',
        goal: 'Complete a civic task',
        humanTask: 'Locate the form and identify the required control.',
      });
      expect(journey.results.map((result) => result.outcome).sort()).toEqual(
        [
          'completed',
          'completed_with_difficulty',
          'unable_to_complete',
          'not_attempted',
          'inconclusive',
        ].sort(),
      );
      expect(journey.results.every((result) => result.evidenceIds.length === 1)).toBe(true);
      expect(
        journey.results.find((result) => result.outcome === 'not_attempted')?.completedAt,
      ).toBe(null);
      const validatedResult = journey.results.find((result) => result.outcome === 'completed')!;
      expect(validatedResult.validationIds).toHaveLength(1);
      expect(
        finding.validations.find(
          (validation) => validation.validationId === validatedResult.validationIds[0],
        ),
      ).toMatchObject({
        subject: { type: 'journey_result', id: validatedResult.resultId },
        outcome: 'supported',
        evidenceIds: validatedResult.evidenceIds,
      });

      const brokenTrace: FindingReviewTrace = {
        ...context.trace,
        journeyResults: context.trace.journeyResults.map((result, index) =>
          index === 0 ? { ...result, evidenceIds: ['missing-journey-evidence'] } : result,
        ),
      };
      const brokenSource: FindingsRegisterReviewSource = {
        listFindingIds: () => [brokenTrace.finding.id],
        loadCompleteTrace: () => brokenTrace,
      };
      expect(() =>
        new DeterministicFindingsExporter(brokenSource, context.journeyService, {
          clock: () => new Date(generatedAt),
        }).buildDocument('assessment-review'),
      ).toThrow(/invalid supporting human Evidence/);
    } finally {
      context.repository.close();
    }
  });

  it('permits an explicit overwrite without changing deterministic bytes', () => {
    const context = setupApproved();
    const directory = mkdtempSync(join(tmpdir(), 'accessledger-export-overwrite-'));
    try {
      const destination = join(directory, 'findings.json');
      const exporter = createExporter(context, true);
      const first = exporter.export('assessment-review', 'json', destination);
      const firstBytes = readFileSync(destination);
      const second = exporter.export('assessment-review', 'json', destination);
      const secondBytes = readFileSync(destination);
      expect(second.sha256).toBe(first.sha256);
      expect(secondBytes).toEqual(firstBytes);
    } finally {
      context.repository.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

interface ApprovedSetup {
  repository: SqliteReviewRepository;
  reviewService: FindingReviewService;
  journeyService: ResidentJourneyService;
  trace: FindingReviewTrace;
}

function setupApproved(
  options: {
    title?: string;
    condition?: string;
    cause?: string;
    effect?: string;
    recommendation?: string;
    journeys?: boolean;
  } = {},
): ApprovedSetup {
  const repository = new SqliteReviewRepository(':memory:');
  const reviewService = new FindingReviewService(repository, {
    clock: () => new Date(reviewNow),
    idFactory: sequenceIds('review'),
  });
  const journeyService = new ResidentJourneyService(repository, {
    clock: () => new Date(reviewNow),
    idFactory: sequenceIds('journey'),
  });
  const fixture = reviewFixture();
  reviewService.createReview(fixture, { actor: 'Auditor Example' });
  reviewService.startReview(fixture.finding.id, { actor: 'Auditor Example' });
  reviewService.editFinding(
    fixture.finding.id,
    {
      title: options.title ?? 'Approved accessible-name finding',
      condition: options.condition ?? 'The reviewed button has no computed accessible name.',
      cause: options.cause ?? 'The control has no naming content.',
      effect: options.effect ?? 'A human reviewer could not determine the control purpose.',
      recommendation: options.recommendation ?? 'Add a concise programmatic name.',
      confidence: 'high',
    },
    { actor: 'Auditor Example' },
  );

  if (options.journeys === true) {
    const protocol = journeyService.createProtocol(
      {
        id: 'journey-export',
        assessmentId: fixture.finding.assessmentId,
        goal: 'Complete a civic task',
        startingUrl: 'https://fixture.example/form',
        preconditions: ['Use the recorded browser configuration.'],
        humanTask: 'Locate the form and identify the required control.',
        expectedObservableOutcome: 'The control can be identified and used.',
        relatedFindingIds: [fixture.finding.id],
      },
      { actor: 'Auditor Example' },
    ).journey;
    const outcomes: JourneyOutcome[] = [
      'completed_with_difficulty',
      'unable_to_complete',
      'not_attempted',
      'inconclusive',
      'completed',
    ];
    let completedResultId = '';
    let completedEvidenceId = '';
    outcomes.forEach((outcome, index) => {
      const evidenceId = `journey-evidence-${index + 1}`;
      const result = journeyService.recordResult(
        protocol.id,
        journeyResultInput(outcome, index + 1, evidenceId, fixture.finding.id),
        { actor: 'Auditor Example' },
      );
      if (outcome === 'completed') {
        completedResultId = result.id;
        completedEvidenceId = evidenceId;
      }
    });
    expect(reviewService.loadCompleteTrace(fixture.finding.id).finding.severity).toBeNull();
    journeyService.addResultValidation(
      fixture.finding.id,
      completedResultId,
      {
        method: 'manual_review',
        outcome: 'supported',
        claims: ['condition'],
        validatedSeverity: null,
        performedBy: 'Auditor Example',
        performedAt: reviewNow,
        assistiveTechnology: null,
        notes: 'The recorded result supports the condition only.',
        evidenceIds: [completedEvidenceId],
      },
      { actor: 'Auditor Example' },
    );
  }

  reviewService.addValidation(
    fixture.finding.id,
    {
      method: 'manual_review',
      outcome: 'supported',
      claims: ['grouping', 'condition', 'wcag', 'cause', 'effect', 'recommendation', 'severity'],
      validatedSeverity: 'moderate',
      performedBy: 'Auditor Example',
      performedAt: reviewNow,
      assistiveTechnology: null,
      notes: 'Human review supports every approved claim at exactly moderate severity.',
      supportingEvidence: [humanEvidence('human-export-validation')],
    },
    { actor: 'Auditor Example' },
  );
  reviewService.assignSeverity(fixture.finding.id, 'moderate', { actor: 'Auditor Example' });
  const trace = reviewService.approve(fixture.finding.id, { actor: 'Auditor Example' });
  return { repository, reviewService, journeyService, trace };
}

function createExporter(context: ApprovedSetup, overwrite: boolean) {
  return new DeterministicFindingsExporter(context.reviewService, context.journeyService, {
    clock: () => new Date(generatedAt),
    overwrite,
  });
}

function journeyResultInput(
  outcome: JourneyOutcome,
  index: number,
  evidenceId: string,
  findingId: string,
): RecordJourneyResultInput {
  return {
    id: `result-${String(index).padStart(2, '0')}-${outcome}`,
    outcome,
    environment: {
      platform: 'Windows 11',
      browser: { name: 'Firefox', version: '143' },
      assistiveTechnology: null,
    },
    nvdaResult: null,
    performedBy: 'Auditor Example',
    startedAt: reviewNow,
    completedAt: outcome === 'not_attempted' ? null : completedAt,
    notes: `The auditor explicitly recorded ${outcome}.`,
    relatedFindingIds: [findingId],
    supportingEvidence: [
      evidenceSchema.parse({
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        id: evidenceId,
        assessmentId: 'assessment-review',
        pageId: null,
        kind: 'human_note',
        source: { type: 'human', name: 'Auditor Example', version: null },
        capturedAt: reviewNow,
        contentType: 'application/json',
        payload: { outcome, recordedByHuman: true },
        metadata: {},
      }),
    ],
  };
}

function cloneTraceWithFindingId(
  trace: FindingReviewTrace,
  findingId: string,
  status: FindingReviewTrace['finding']['status'] = 'approved',
): FindingReviewTrace {
  return {
    ...trace,
    finding: { ...trace.finding, id: findingId, status },
    originalFinding: { ...trace.originalFinding, id: findingId },
    validations: trace.validations.map((validation) => ({
      ...validation,
      subject:
        validation.subject.type === 'finding'
          ? { type: 'finding' as const, id: findingId }
          : validation.subject,
    })),
  };
}

function sequenceIds(prefix: string): () => string {
  let value = 0;
  return () => `${prefix}-${String(++value).padStart(4, '0')}`;
}

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]!;
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(value);
      value = '';
    } else if (character === '\r' && input[index + 1] === '\n') {
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
      index += 1;
    } else {
      value += character;
    }
  }
  return rows;
}
