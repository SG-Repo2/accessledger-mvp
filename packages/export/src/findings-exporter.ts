import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { assertExportableApprovedTrace, type FindingReviewTrace } from '@accessledger/findings';
import {
  FINDINGS_REGISTER_EXPORT_SCHEMA_VERSION,
  findingsRegisterDocumentSchema,
  findingsRegisterExportFormatSchema,
  findingsRegisterExportManifestSchema,
  findingsRegisterRecordSchema,
  type FindingsRegisterDocument,
  type FindingsRegisterExportFormat,
  type FindingsRegisterExportManifest,
  type FindingsRegisterJourneySummary,
  type FindingsRegisterRecord,
  type FindingsRegisterValidationSummary,
  type JourneyResult,
  type ResidentJourney,
  type Validation,
} from '@accessledger/shared';

import type {
  FindingsExporter,
  FindingsExporterOptions,
  FindingsRegisterJourneySource,
  FindingsRegisterReviewSource,
} from './types.js';

export const FINDINGS_REGISTER_CSV_COLUMNS = [
  'export_schema_version',
  'assessment_id',
  'generated_at',
  'finding_contract_schema_version',
  'finding_id',
  'source_group_proposal_id',
  'status',
  'title',
  'condition',
  'cause',
  'effect',
  'recommendation',
  'validation_need',
  'severity',
  'confidence',
  'wcag_criteria_json',
  'occurrence_count',
  'affected_urls_json',
  'affected_components_json',
  'observation_ids_json',
  'source_evidence_ids_json',
  'occurrence_references_json',
  'validation_summaries_json',
  'journey_summaries_json',
] as const;

export class DeterministicFindingsExporter implements FindingsExporter {
  readonly #reviewSource: FindingsRegisterReviewSource;
  readonly #journeySource: FindingsRegisterJourneySource;
  readonly #clock: () => Date;
  readonly #overwrite: boolean;

  constructor(
    reviewSource: FindingsRegisterReviewSource,
    journeySource: FindingsRegisterJourneySource,
    options: FindingsExporterOptions = {},
  ) {
    this.#reviewSource = reviewSource;
    this.#journeySource = journeySource;
    this.#clock = options.clock ?? (() => new Date());
    this.#overwrite = options.overwrite ?? false;
  }

  export(
    assessmentIdInput: string,
    formatInput: FindingsRegisterExportFormat,
    destination: string,
  ): FindingsRegisterExportManifest {
    const assessmentId = parseNonEmpty(assessmentIdInput, 'Assessment ID');
    const format = findingsRegisterExportFormatSchema.parse(formatInput);
    const artifactPath = resolve(parseNonEmpty(destination, 'Export destination'));
    const document = this.buildDocument(assessmentId);
    const contents =
      format === 'json'
        ? serializeFindingsRegisterJson(document)
        : serializeFindingsRegisterCsv(document);
    const bytes = Buffer.from(contents, 'utf8');

    if (!this.#overwrite && existsSync(artifactPath)) {
      throw new Error(`Export destination already exists: ${artifactPath}`);
    }
    mkdirSync(dirname(artifactPath), { recursive: true });
    writeFileSync(artifactPath, bytes, { flag: this.#overwrite ? 'w' : 'wx' });

    return findingsRegisterExportManifestSchema.parse({
      schemaVersion: FINDINGS_REGISTER_EXPORT_SCHEMA_VERSION,
      format,
      assessmentId,
      generatedAt: document.generatedAt,
      recordCount: document.recordCount,
      artifactPath,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      byteLength: bytes.byteLength,
    });
  }

  buildDocument(assessmentIdInput: string): FindingsRegisterDocument {
    const assessmentId = parseNonEmpty(assessmentIdInput, 'Assessment ID');
    const traces = this.#reviewSource
      .listFindingIds(assessmentId)
      .map((findingId) => this.#reviewSource.loadCompleteTrace(findingId))
      .filter((trace) => trace.finding.status === 'approved')
      .sort((left, right) => compareText(left.finding.id, right.finding.id));
    const findings = traces.map((trace) => this.#buildRecord(trace, assessmentId));
    return findingsRegisterDocumentSchema.parse({
      schemaVersion: FINDINGS_REGISTER_EXPORT_SCHEMA_VERSION,
      assessmentId,
      generatedAt: this.#clock().toISOString(),
      recordCount: findings.length,
      findings,
    });
  }

  #buildRecord(trace: FindingReviewTrace, assessmentId: string): FindingsRegisterRecord {
    if (trace.finding.assessmentId !== assessmentId) {
      throw new Error(`Finding ${trace.finding.id} does not belong to assessment ${assessmentId}.`);
    }
    assertExportableApprovedTrace(trace);
    const finding = trace.finding;
    if (
      finding.cause === null ||
      finding.effect === null ||
      finding.recommendation === null ||
      finding.severity === null ||
      finding.confidence === null
    ) {
      throw new Error(`Approved Finding ${finding.id} is incomplete.`);
    }

    const pageById = new Map(trace.pages.map((page) => [page.id, page]));
    const occurrenceById = new Map(
      trace.occurrences.map((occurrence) => [occurrence.id, occurrence]),
    );
    const occurrences = trace.group.members
      .map((member) => {
        const occurrence = occurrenceById.get(member.occurrenceId);
        const page = pageById.get(member.pageId);
        if (occurrence === undefined || page === undefined) {
          throw new Error(`Finding ${finding.id} has an incomplete occurrence trace.`);
        }
        return {
          occurrenceId: occurrence.id,
          observationId: occurrence.observationId,
          pageId: page.id,
          url: page.finalUrl ?? page.requestedUrl,
          component: componentReference(occurrence),
          evidenceIds: sorted(occurrence.evidenceIds),
        };
      })
      .sort((left, right) => compareText(left.occurrenceId, right.occurrenceId));

    const validations = trace.validations
      .map(toValidationSummary)
      .sort(
        (left, right) =>
          compareText(left.performedAt, right.performedAt) ||
          compareText(left.validationId, right.validationId),
      );
    const journeys = this.#buildJourneySummaries(trace, validations);

    return findingsRegisterRecordSchema.parse({
      schemaVersion: FINDINGS_REGISTER_EXPORT_SCHEMA_VERSION,
      findingContractSchemaVersion: finding.schemaVersion,
      findingId: finding.id,
      assessmentId: finding.assessmentId,
      sourceGroupProposalId: finding.sourceGroupProposalId,
      status: finding.status,
      content: {
        title: finding.title,
        condition: finding.condition,
        cause: finding.cause,
        effect: finding.effect,
        recommendation: finding.recommendation,
      },
      validationNeed: finding.validationNeed,
      severity: finding.severity,
      confidence: finding.confidence,
      wcagCriteria: [...finding.wcagCriteria].sort(compareWcag),
      occurrenceCount: finding.occurrenceCount,
      affectedUrls: sorted(finding.affectedUrls),
      affectedComponents: sorted(finding.affectedComponents),
      trace: {
        observationIds: sorted(finding.observationIds),
        sourceEvidenceIds: sorted(finding.evidenceIds),
        occurrences,
      },
      validations,
      journeys,
    });
  }

  #buildJourneySummaries(
    trace: FindingReviewTrace,
    validations: readonly FindingsRegisterValidationSummary[],
  ): FindingsRegisterJourneySummary[] {
    const resultsByJourney = new Map<string, JourneyResult[]>();
    const evidenceById = new Map(trace.evidence.map((evidence) => [evidence.id, evidence]));
    for (const result of trace.journeyResults) {
      if (
        result.assessmentId !== trace.finding.assessmentId ||
        !result.relatedFindingIds.includes(trace.finding.id)
      ) {
        throw new Error(`Finding ${trace.finding.id} has an invalid linked JourneyResult.`);
      }
      for (const evidenceId of result.evidenceIds) {
        const evidence = evidenceById.get(evidenceId);
        if (
          evidence === undefined ||
          evidence.assessmentId !== trace.finding.assessmentId ||
          evidence.source.type !== 'human'
        ) {
          throw new Error(
            `JourneyResult ${result.id} has invalid supporting human Evidence ${evidenceId}.`,
          );
        }
      }
      const current = resultsByJourney.get(result.journeyId) ?? [];
      current.push(result);
      resultsByJourney.set(result.journeyId, current);
    }

    return [...resultsByJourney.entries()]
      .map(([journeyId, results]) => {
        const protocolTrace = this.#journeySource.loadProtocol(journeyId);
        const protocol = protocolTrace.journey;
        assertJourneyProtocolLink(protocol, trace.finding.id, trace.finding.assessmentId);
        for (const result of results) {
          if (!protocolTrace.results.some((record) => record.id === result.id)) {
            throw new Error(`Journey ${journeyId} does not retain linked result ${result.id}.`);
          }
        }
        return {
          journeyId: protocol.id,
          goal: protocol.goal,
          startingUrl: protocol.startingUrl,
          preconditions: [...protocol.preconditions],
          humanTask: protocol.humanTask,
          expectedObservableOutcome: protocol.expectedObservableOutcome,
          relatedFindingIds: sorted(protocol.relatedFindingIds),
          results: results
            .sort(
              (left, right) =>
                compareText(left.startedAt, right.startedAt) || compareText(left.id, right.id),
            )
            .map((result) => ({
              resultId: result.id,
              outcome: result.outcome,
              environment: {
                platform: result.environment.platform,
                browser: { ...result.environment.browser },
                assistiveTechnology:
                  result.environment.assistiveTechnology === null
                    ? null
                    : { ...result.environment.assistiveTechnology },
              },
              nvdaResult: result.nvdaResult,
              performedBy: result.performedBy,
              startedAt: result.startedAt,
              completedAt: result.completedAt,
              notes: result.notes,
              relatedFindingIds: sorted(result.relatedFindingIds),
              evidenceIds: sorted(result.evidenceIds),
              validationIds: validations
                .filter(
                  (validation) =>
                    validation.subject.type === 'journey_result' &&
                    validation.subject.id === result.id,
                )
                .map((validation) => validation.validationId)
                .sort(compareText),
            })),
        };
      })
      .sort((left, right) => compareText(left.journeyId, right.journeyId));
  }
}

export function serializeFindingsRegisterJson(documentInput: FindingsRegisterDocument): string {
  const document = findingsRegisterDocumentSchema.parse(documentInput);
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function serializeFindingsRegisterCsv(documentInput: FindingsRegisterDocument): string {
  const document = findingsRegisterDocumentSchema.parse(documentInput);
  const lines = [FINDINGS_REGISTER_CSV_COLUMNS.map(escapeCsv).join(',')];
  for (const finding of document.findings) {
    const values = [
      document.schemaVersion,
      document.assessmentId,
      document.generatedAt,
      finding.findingContractSchemaVersion,
      finding.findingId,
      finding.sourceGroupProposalId,
      finding.status,
      finding.content.title,
      finding.content.condition,
      finding.content.cause,
      finding.content.effect,
      finding.content.recommendation,
      finding.validationNeed,
      finding.severity,
      finding.confidence,
      JSON.stringify(finding.wcagCriteria),
      String(finding.occurrenceCount),
      JSON.stringify(finding.affectedUrls),
      JSON.stringify(finding.affectedComponents),
      JSON.stringify(finding.trace.observationIds),
      JSON.stringify(finding.trace.sourceEvidenceIds),
      JSON.stringify(finding.trace.occurrences),
      JSON.stringify(finding.validations),
      JSON.stringify(finding.journeys),
    ];
    lines.push(values.map(escapeCsv).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}

function toValidationSummary(validation: Validation): FindingsRegisterValidationSummary {
  if (validation.subject.type === 'observation') {
    throw new Error(`Validation ${validation.id} does not directly support a Finding export.`);
  }
  return {
    validationId: validation.id,
    subject: { type: validation.subject.type, id: validation.subject.id },
    method: validation.method,
    outcome: validation.outcome,
    claims: [...validation.claims].sort(compareText),
    validatedSeverity: validation.validatedSeverity,
    performedBy: validation.performedBy,
    performedAt: validation.performedAt,
    assistiveTechnology:
      validation.assistiveTechnology === null ? null : { ...validation.assistiveTechnology },
    notes: validation.notes,
    evidenceIds: sorted(validation.evidenceIds),
  };
}

function assertJourneyProtocolLink(
  protocol: ResidentJourney,
  findingId: string,
  assessmentId: string,
): void {
  if (protocol.assessmentId !== assessmentId || !protocol.relatedFindingIds.includes(findingId)) {
    throw new Error(`Journey ${protocol.id} is not linked to Finding ${findingId}.`);
  }
}

function componentReference(occurrence: FindingReviewTrace['occurrences'][number]): string {
  if (occurrence.componentFingerprint !== null) {
    return `fingerprint:${occurrence.componentFingerprint}`;
  }
  if (occurrence.selector !== null) return `selector:${occurrence.selector}`;
  if (occurrence.htmlSnippet !== null) return `markup:${occurrence.htmlSnippet}`;
  return `occurrence:${occurrence.id} (source locator unavailable)`;
}

function escapeCsv(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function sorted(values: readonly string[]): string[] {
  return [...values].sort(compareText);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareWcag(left: string, right: string): number {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function parseNonEmpty(value: string, label: string): string {
  const parsed = value.trim();
  if (parsed.length === 0) throw new Error(`${label} must not be empty.`);
  return parsed;
}
