import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import {
  evidenceSchema,
  findingSchema,
  groupProposalSchema,
  journeyAuditEventSchema,
  journeyResultSchema,
  observationOccurrenceSchema,
  observationSchema,
  pageSchema,
  reviewAuditEventSchema,
  residentJourneySchema,
  validationSchema,
  wcagCandidateEvaluationSchema,
  type Evidence,
  type Finding,
  type GroupProposal,
  type JourneyAuditEvent,
  type JourneyResult,
  type ResidentJourney,
  type ReviewAuditEvent,
  type Validation,
} from '@accessledger/shared';

import { reviewMigrations } from './migrations.js';
import type {
  GroupingDecisionRecord,
  JourneyRepository,
  PersistedReviewBundle,
  ReviewBundleInput,
  ReviewRepository,
} from './types.js';

interface SqliteReviewRepositoryOptions {
  clock?: () => Date;
}

interface JsonRow {
  record_json: string;
}

export class SqliteReviewRepository implements ReviewRepository, JourneyRepository {
  readonly #database: DatabaseSync;
  readonly #clock: () => Date;

  constructor(databasePath: string, options: SqliteReviewRepositoryOptions = {}) {
    this.#database = new DatabaseSync(databasePath);
    this.#clock = options.clock ?? (() => new Date());
    this.#database.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
    this.#migrate();
  }

  createReviewBundle(input: ReviewBundleInput, eventInput: ReviewAuditEvent): void {
    const finding = findingSchema.parse(input.finding);
    const group = groupProposalSchema.parse(input.group);
    const event = reviewAuditEventSchema.parse(eventInput);
    this.#transaction(() => {
      this.#database
        .prepare(
          `INSERT INTO review_bundles
            (finding_id, assessment_id, original_finding_json, current_finding_json,
             original_group_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          finding.id,
          finding.assessmentId,
          serialize(finding),
          serialize(finding),
          serialize(group),
          event.occurredAt,
        );
      this.#insertBundleSources(finding.id, 'observation', input.observations);
      this.#insertBundleSources(finding.id, 'occurrence', input.occurrences);
      this.#insertBundleSources(finding.id, 'wcag_evaluation', input.wcagEvaluations);
      this.#insertBundleSources(finding.id, 'page', input.pages);
      this.#insertBundleSources(finding.id, 'evidence', input.evidence);
      this.#insertAudit(event);
    });
  }

  loadReviewBundle(findingId: string): PersistedReviewBundle | null {
    const row = this.#database
      .prepare(
        `SELECT original_finding_json, current_finding_json, original_group_json
         FROM review_bundles WHERE finding_id = ?`,
      )
      .get(findingId) as
      | {
          original_finding_json: string;
          current_finding_json: string;
          original_group_json: string;
        }
      | undefined;
    if (row === undefined) return null;

    const originalFinding = findingSchema.parse(parseJson(row.original_finding_json));
    const finding = findingSchema.parse(parseJson(row.current_finding_json));
    const originalGroup = groupProposalSchema.parse(parseJson(row.original_group_json));
    const decision = this.#database
      .prepare(
        `SELECT status, decided_at FROM grouping_decisions
         WHERE finding_id = ? ORDER BY decided_at DESC, rowid DESC LIMIT 1`,
      )
      .get(findingId) as { status: GroupProposal['reviewStatus']; decided_at: string } | undefined;
    const group = groupProposalSchema.parse(
      decision === undefined
        ? originalGroup
        : { ...originalGroup, reviewStatus: decision.status, updatedAt: decision.decided_at },
    );
    const validations = this.#database
      .prepare(
        `SELECT validation_json FROM validations
         WHERE finding_id = ? ORDER BY created_at, rowid`,
      )
      .all(findingId)
      .map((validationRow) =>
        validationSchema.parse(
          parseJson((validationRow as { validation_json: string }).validation_json),
        ),
      );
    const journeyResults = this.listJourneyResultsForFinding(findingId);
    const evidenceIds = [
      ...new Set([
        ...originalGroup.evidenceIds,
        ...validations.flatMap((validation) => validation.evidenceIds),
        ...journeyResults.flatMap((result) => result.evidenceIds),
      ]),
    ];

    return {
      finding,
      originalFinding,
      group,
      originalGroup,
      observations: this.#loadBundleSources(findingId, 'observation').map((record) =>
        observationSchema.parse(record),
      ),
      occurrences: this.#loadBundleSources(findingId, 'occurrence').map((record) =>
        observationOccurrenceSchema.parse(record),
      ),
      wcagEvaluations: this.#loadBundleSources(findingId, 'wcag_evaluation').map((record) =>
        wcagCandidateEvaluationSchema.parse(record),
      ),
      pages: this.#loadBundleSources(findingId, 'page').map((record) => pageSchema.parse(record)),
      evidence: evidenceIds.map((id) => evidenceSchema.parse(this.#loadSource('evidence', id))),
      validations,
      journeyResults,
      auditHistory: this.#database
        .prepare(
          `SELECT event_json FROM audit_events
           WHERE finding_id = ? ORDER BY occurred_at, rowid`,
        )
        .all(findingId)
        .map((auditRow) =>
          reviewAuditEventSchema.parse(parseJson((auditRow as { event_json: string }).event_json)),
        ),
    };
  }

  listFindingIds(assessmentId?: string): string[] {
    const rows =
      assessmentId === undefined
        ? this.#database.prepare('SELECT finding_id FROM review_bundles ORDER BY finding_id').all()
        : this.#database
            .prepare(
              'SELECT finding_id FROM review_bundles WHERE assessment_id = ? ORDER BY finding_id',
            )
            .all(assessmentId);
    return rows.map((row) => (row as { finding_id: string }).finding_id);
  }

  commitFinding(previousInput: Finding, nextInput: Finding, eventInput: ReviewAuditEvent): void {
    const previous = findingSchema.parse(previousInput);
    const next = findingSchema.parse(nextInput);
    const event = reviewAuditEventSchema.parse(eventInput);
    this.#transaction(() => {
      const result = this.#database
        .prepare(
          `UPDATE review_bundles SET current_finding_json = ?
           WHERE finding_id = ? AND current_finding_json = ?`,
        )
        .run(serialize(next), previous.id, serialize(previous));
      if (result.changes !== 1) throw new Error('Finding changed since it was loaded.');
      this.#insertAudit(event);
    });
  }

  commitGroupingDecision(decision: GroupingDecisionRecord, eventInput: ReviewAuditEvent): void {
    const event = reviewAuditEventSchema.parse(eventInput);
    this.#transaction(() => {
      this.#database
        .prepare(
          `INSERT INTO grouping_decisions
            (id, finding_id, group_proposal_id, status, actor, reason, decided_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          decision.id,
          decision.findingId,
          decision.groupProposalId,
          decision.status,
          decision.actor,
          decision.reason,
          decision.decidedAt,
        );
      this.#insertAudit(event);
    });
  }

  commitValidation(
    previousFindingInput: Finding,
    nextFindingInput: Finding,
    validationInput: Validation,
    supportingEvidenceInput: readonly Evidence[],
    eventInput: ReviewAuditEvent,
  ): void {
    const previousFinding = findingSchema.parse(previousFindingInput);
    const nextFinding = findingSchema.parse(nextFindingInput);
    const validation = validationSchema.parse(validationInput);
    const supportingEvidence = supportingEvidenceInput.map((record) =>
      evidenceSchema.parse(record),
    );
    const event = reviewAuditEventSchema.parse(eventInput);
    this.#transaction(() => {
      for (const evidence of supportingEvidence) this.#insertSource('evidence', evidence);
      this.#database
        .prepare(
          `INSERT INTO validations (id, finding_id, validation_json, created_at)
           VALUES (?, ?, ?, ?)`,
        )
        .run(validation.id, previousFinding.id, serialize(validation), validation.performedAt);
      const result = this.#database
        .prepare(
          `UPDATE review_bundles SET current_finding_json = ?
           WHERE finding_id = ? AND current_finding_json = ?`,
        )
        .run(serialize(nextFinding), previousFinding.id, serialize(previousFinding));
      if (result.changes !== 1) throw new Error('Finding changed since it was loaded.');
      this.#insertAudit(event);
    });
  }

  createJourney(journeyInput: ResidentJourney, eventInput: JourneyAuditEvent): void {
    const journey = residentJourneySchema.parse(journeyInput);
    const event = journeyAuditEventSchema.parse(eventInput);
    this.#assertJourneyEventScope(event, journey.assessmentId, journey.id);
    this.#transaction(() => {
      this.#assertFindingLinks(journey.assessmentId, journey.relatedFindingIds);
      this.#database
        .prepare(
          `INSERT INTO resident_journeys
            (journey_id, assessment_id, current_journey_json, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, NULL)`,
        )
        .run(
          journey.id,
          journey.assessmentId,
          serialize(journey),
          journey.createdAt,
          journey.updatedAt,
        );
      this.#insertJourneyRevision(journey, event);
      this.#replaceJourneyFindingLinks(journey.id, journey.relatedFindingIds);
      this.#insertJourneyAudit(event);
    });
  }

  updateJourney(
    previousInput: ResidentJourney,
    nextInput: ResidentJourney,
    eventInput: JourneyAuditEvent,
  ): void {
    const previous = residentJourneySchema.parse(previousInput);
    const next = residentJourneySchema.parse(nextInput);
    const event = journeyAuditEventSchema.parse(eventInput);
    this.#assertJourneyEventScope(event, next.assessmentId, next.id);
    if (
      previous.id !== next.id ||
      previous.assessmentId !== next.assessmentId ||
      previous.createdAt !== next.createdAt
    ) {
      throw new Error('Journey identity and creation time cannot be changed.');
    }
    this.#transaction(() => {
      this.#assertFindingLinks(next.assessmentId, next.relatedFindingIds);
      const retainedResultFindingIds = this.#database
        .prepare(
          `SELECT DISTINCT journey_result_finding_links.finding_id
           FROM journey_results
           JOIN journey_result_finding_links USING (result_id)
           WHERE journey_results.journey_id = ?`,
        )
        .all(next.id)
        .map((row) => (row as { finding_id: string }).finding_id);
      if (!retainedResultFindingIds.every((id) => next.relatedFindingIds.includes(id))) {
        throw new Error('A protocol cannot remove a Finding link retained by a JourneyResult.');
      }
      const result = this.#database
        .prepare(
          `UPDATE resident_journeys SET current_journey_json = ?, updated_at = ?
           WHERE journey_id = ? AND current_journey_json = ? AND deleted_at IS NULL`,
        )
        .run(serialize(next), next.updatedAt, previous.id, serialize(previous));
      if (result.changes !== 1) throw new Error('Journey changed since it was loaded.');
      this.#replaceJourneyFindingLinks(next.id, next.relatedFindingIds);
      this.#insertJourneyRevision(next, event);
      this.#insertJourneyAudit(event);
    });
  }

  deleteJourney(journeyInput: ResidentJourney, eventInput: JourneyAuditEvent): void {
    const journey = residentJourneySchema.parse(journeyInput);
    const event = journeyAuditEventSchema.parse(eventInput);
    this.#assertJourneyEventScope(event, journey.assessmentId, journey.id);
    this.#transaction(() => {
      const resultCount = this.#database
        .prepare('SELECT COUNT(*) AS count FROM journey_results WHERE journey_id = ?')
        .get(journey.id) as { count: number };
      if (resultCount.count > 0) {
        throw new Error('A journey protocol with recorded results cannot be deleted.');
      }
      const result = this.#database
        .prepare(
          `UPDATE resident_journeys SET deleted_at = ?, updated_at = ?
           WHERE journey_id = ? AND current_journey_json = ? AND deleted_at IS NULL`,
        )
        .run(event.occurredAt, event.occurredAt, journey.id, serialize(journey));
      if (result.changes !== 1)
        throw new Error('Journey changed or was deleted since it was loaded.');
      this.#database
        .prepare('DELETE FROM journey_finding_links WHERE journey_id = ?')
        .run(journey.id);
      this.#insertJourneyAudit(event);
    });
  }

  loadJourney(journeyId: string): ResidentJourney | null {
    const row = this.#database
      .prepare(
        `SELECT current_journey_json FROM resident_journeys
         WHERE journey_id = ? AND deleted_at IS NULL`,
      )
      .get(journeyId) as { current_journey_json: string } | undefined;
    return row === undefined
      ? null
      : residentJourneySchema.parse(parseJson(row.current_journey_json));
  }

  listJourneys(assessmentId?: string): ResidentJourney[] {
    const rows =
      assessmentId === undefined
        ? this.#database
            .prepare(
              `SELECT current_journey_json FROM resident_journeys
               WHERE deleted_at IS NULL ORDER BY journey_id`,
            )
            .all()
        : this.#database
            .prepare(
              `SELECT current_journey_json FROM resident_journeys
               WHERE assessment_id = ? AND deleted_at IS NULL ORDER BY journey_id`,
            )
            .all(assessmentId);
    return rows.map((row) =>
      residentJourneySchema.parse(
        parseJson((row as { current_journey_json: string }).current_journey_json),
      ),
    );
  }

  recordJourneyResult(
    resultInput: JourneyResult,
    supportingEvidenceInput: readonly Evidence[],
    eventInput: JourneyAuditEvent,
  ): void {
    const result = journeyResultSchema.parse(resultInput);
    const supportingEvidence = supportingEvidenceInput.map((record) =>
      evidenceSchema.parse(record),
    );
    const event = journeyAuditEventSchema.parse(eventInput);
    this.#assertJourneyEventScope(event, result.assessmentId, result.journeyId);
    this.#transaction(() => {
      const journey = this.loadJourney(result.journeyId);
      if (journey === null) throw new Error(`ResidentJourney ${result.journeyId} does not exist.`);
      if (journey.assessmentId !== result.assessmentId) {
        throw new Error('JourneyResult assessment does not match its ResidentJourney.');
      }
      if (!result.relatedFindingIds.every((id) => journey.relatedFindingIds.includes(id))) {
        throw new Error('JourneyResult Finding links must belong to its ResidentJourney protocol.');
      }
      this.#assertFindingLinks(result.assessmentId, result.relatedFindingIds);
      const evidenceIds = supportingEvidence.map((record) => record.id);
      if (!sameOrderedValues(evidenceIds, result.evidenceIds)) {
        throw new Error('JourneyResult Evidence IDs must exactly match supporting Evidence.');
      }
      for (const evidence of supportingEvidence) {
        if (
          evidence.assessmentId !== result.assessmentId ||
          evidence.source.type !== 'human' ||
          !['human_note', 'interaction_trace', 'screenshot'].includes(evidence.kind)
        ) {
          throw new Error('JourneyResult support must be human Evidence in the same assessment.');
        }
        this.#insertSource('evidence', evidence);
      }
      this.#database
        .prepare(
          `INSERT INTO journey_results
            (result_id, journey_id, assessment_id, result_json, recorded_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(result.id, result.journeyId, result.assessmentId, serialize(result), event.occurredAt);
      for (const findingId of result.relatedFindingIds) {
        this.#database
          .prepare('INSERT INTO journey_result_finding_links (result_id, finding_id) VALUES (?, ?)')
          .run(result.id, findingId);
      }
      result.evidenceIds.forEach((evidenceId, position) => {
        this.#database
          .prepare(
            `INSERT INTO journey_result_evidence_links
              (result_id, record_type, evidence_id, position) VALUES (?, 'evidence', ?, ?)`,
          )
          .run(result.id, evidenceId, position);
      });
      this.#insertJourneyAudit(event);
    });
  }

  loadJourneyResult(resultId: string): JourneyResult | null {
    const row = this.#database
      .prepare('SELECT result_json FROM journey_results WHERE result_id = ?')
      .get(resultId) as { result_json: string } | undefined;
    return row === undefined ? null : journeyResultSchema.parse(parseJson(row.result_json));
  }

  loadJourneyResultEvidence(resultId: string): Evidence[] {
    return this.#database
      .prepare(
        `SELECT source_records.record_json
         FROM journey_result_evidence_links
         JOIN source_records
           ON source_records.record_type = journey_result_evidence_links.record_type
          AND source_records.record_id = journey_result_evidence_links.evidence_id
         WHERE journey_result_evidence_links.result_id = ?
         ORDER BY journey_result_evidence_links.position`,
      )
      .all(resultId)
      .map((row) => evidenceSchema.parse(parseJson((row as unknown as JsonRow).record_json)));
  }

  listJourneyResults(journeyId: string): JourneyResult[] {
    return this.#database
      .prepare(
        `SELECT result_json FROM journey_results
         WHERE journey_id = ? ORDER BY recorded_at, rowid`,
      )
      .all(journeyId)
      .map((row) =>
        journeyResultSchema.parse(parseJson((row as { result_json: string }).result_json)),
      );
  }

  listJourneyResultsForFinding(findingId: string): JourneyResult[] {
    return this.#database
      .prepare(
        `SELECT journey_results.result_json
         FROM journey_result_finding_links
         JOIN journey_results USING (result_id)
         WHERE journey_result_finding_links.finding_id = ?
         ORDER BY journey_results.recorded_at, journey_results.rowid`,
      )
      .all(findingId)
      .map((row) =>
        journeyResultSchema.parse(parseJson((row as { result_json: string }).result_json)),
      );
  }

  loadJourneyAuditHistory(journeyId: string): JourneyAuditEvent[] {
    return this.#database
      .prepare(
        `SELECT event_json FROM journey_audit_events
         WHERE journey_id = ? ORDER BY occurred_at, rowid`,
      )
      .all(journeyId)
      .map((row) =>
        journeyAuditEventSchema.parse(parseJson((row as { event_json: string }).event_json)),
      );
  }

  commitJourneyResultValidation(
    previousFindingInput: Finding,
    nextFindingInput: Finding,
    validationInput: Validation,
    reviewEventInput: ReviewAuditEvent,
    journeyEventInput: JourneyAuditEvent,
  ): void {
    const previousFinding = findingSchema.parse(previousFindingInput);
    const nextFinding = findingSchema.parse(nextFindingInput);
    const validation = validationSchema.parse(validationInput);
    const reviewEvent = reviewAuditEventSchema.parse(reviewEventInput);
    const journeyEvent = journeyAuditEventSchema.parse(journeyEventInput);
    this.#transaction(() => {
      if (validation.subject.type !== 'journey_result') {
        throw new Error('Journey result validation must target a JourneyResult.');
      }
      const result = this.loadJourneyResult(validation.subject.id);
      if (result === null)
        throw new Error(`JourneyResult ${validation.subject.id} does not exist.`);
      if (!result.relatedFindingIds.includes(previousFinding.id)) {
        throw new Error('JourneyResult is not linked to the Finding being validated.');
      }
      this.#assertJourneyEventScope(journeyEvent, result.assessmentId, result.journeyId);
      if (
        reviewEvent.findingId !== previousFinding.id ||
        reviewEvent.entityId !== validation.id ||
        journeyEvent.entityId !== validation.id
      ) {
        throw new Error('JourneyResult Validation audit links do not match the committed records.');
      }
      if (
        result.assessmentId !== previousFinding.assessmentId ||
        validation.assessmentId !== previousFinding.assessmentId
      ) {
        throw new Error('JourneyResult Validation must remain in one assessment.');
      }
      if (!validation.evidenceIds.every((id) => result.evidenceIds.includes(id))) {
        throw new Error('JourneyResult Validation Evidence must come from the recorded result.');
      }
      this.#database
        .prepare(
          `INSERT INTO validations (id, finding_id, validation_json, created_at)
           VALUES (?, ?, ?, ?)`,
        )
        .run(validation.id, previousFinding.id, serialize(validation), validation.performedAt);
      const update = this.#database
        .prepare(
          `UPDATE review_bundles SET current_finding_json = ?
           WHERE finding_id = ? AND current_finding_json = ?`,
        )
        .run(serialize(nextFinding), previousFinding.id, serialize(previousFinding));
      if (update.changes !== 1) throw new Error('Finding changed since it was loaded.');
      this.#insertAudit(reviewEvent);
      this.#insertJourneyAudit(journeyEvent);
    });
  }

  close(): void {
    this.#database.close();
  }

  #migrate(): void {
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);
    const applied = new Set(
      this.#database
        .prepare('SELECT version FROM schema_migrations')
        .all()
        .map((row) => (row as { version: number }).version),
    );
    for (const migration of reviewMigrations) {
      if (applied.has(migration.version)) continue;
      this.#transaction(() => {
        this.#database.exec(migration.sql);
        this.#database
          .prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
          .run(migration.version, migration.name, this.#clock().toISOString());
      });
    }
  }

  #insertSource(recordType: string, record: { id: string; assessmentId: string }): void {
    const serialized = serialize(record);
    const existing = this.#database
      .prepare('SELECT record_json FROM source_records WHERE record_type = ? AND record_id = ?')
      .get(recordType, record.id) as JsonRow | undefined;
    if (existing !== undefined) {
      if (existing.record_json !== serialized) {
        throw new Error(`Immutable ${recordType} ${record.id} does not match its stored value.`);
      }
      return;
    }
    this.#database
      .prepare(
        `INSERT INTO source_records (record_type, record_id, assessment_id, record_json)
         VALUES (?, ?, ?, ?)`,
      )
      .run(recordType, record.id, record.assessmentId, serialized);
  }

  #insertBundleSources(
    findingId: string,
    recordType: string,
    records: readonly { id: string; assessmentId: string }[],
  ): void {
    records.forEach((record, position) => {
      this.#insertSource(recordType, record);
      this.#database
        .prepare(
          `INSERT INTO bundle_source_records (finding_id, record_type, record_id, position)
           VALUES (?, ?, ?, ?)`,
        )
        .run(findingId, recordType, record.id, position);
    });
  }

  #loadBundleSources(findingId: string, recordType: string): unknown[] {
    return this.#database
      .prepare(
        `SELECT source_records.record_json
         FROM bundle_source_records
         JOIN source_records USING (record_type, record_id)
         WHERE bundle_source_records.finding_id = ? AND bundle_source_records.record_type = ?
         ORDER BY bundle_source_records.position`,
      )
      .all(findingId, recordType)
      .map((row) => parseJson((row as unknown as JsonRow).record_json));
  }

  #loadSource(recordType: string, recordId: string): unknown {
    const row = this.#database
      .prepare('SELECT record_json FROM source_records WHERE record_type = ? AND record_id = ?')
      .get(recordType, recordId) as JsonRow | undefined;
    if (row === undefined) throw new Error(`Missing immutable ${recordType} ${recordId}.`);
    return parseJson(row.record_json);
  }

  #insertAudit(event: ReviewAuditEvent): void {
    this.#database
      .prepare(
        `INSERT INTO audit_events (id, finding_id, event_json, occurred_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(event.id, event.findingId, serialize(event), event.occurredAt);
  }

  #insertJourneyRevision(journey: ResidentJourney, event: JourneyAuditEvent): void {
    this.#database
      .prepare(
        `INSERT INTO journey_revisions
          (revision_id, journey_id, journey_json, actor, reason, changed_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(event.id, journey.id, serialize(journey), event.actor, event.reason, event.occurredAt);
  }

  #replaceJourneyFindingLinks(journeyId: string, findingIds: readonly string[]): void {
    this.#database.prepare('DELETE FROM journey_finding_links WHERE journey_id = ?').run(journeyId);
    for (const findingId of findingIds) {
      this.#database
        .prepare('INSERT INTO journey_finding_links (journey_id, finding_id) VALUES (?, ?)')
        .run(journeyId, findingId);
    }
  }

  #assertFindingLinks(assessmentId: string, findingIds: readonly string[]): void {
    for (const findingId of findingIds) {
      const row = this.#database
        .prepare('SELECT assessment_id FROM review_bundles WHERE finding_id = ?')
        .get(findingId) as { assessment_id: string } | undefined;
      if (row === undefined) throw new Error(`Related Finding ${findingId} does not exist.`);
      if (row.assessment_id !== assessmentId) {
        throw new Error(`Related Finding ${findingId} belongs to another assessment.`);
      }
    }
  }

  #insertJourneyAudit(event: JourneyAuditEvent): void {
    this.#database
      .prepare(
        `INSERT INTO journey_audit_events (event_id, journey_id, event_json, occurred_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(event.id, event.journeyId, serialize(event), event.occurredAt);
  }

  #assertJourneyEventScope(
    event: JourneyAuditEvent,
    assessmentId: string,
    journeyId: string,
  ): void {
    if (event.assessmentId !== assessmentId || event.journeyId !== journeyId) {
      throw new Error('Journey audit event scope does not match its record.');
    }
  }

  #transaction<T>(operation: () => T): T {
    this.#database.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      this.#database.exec('COMMIT');
      return result;
    } catch (error) {
      this.#database.exec('ROLLBACK');
      throw error;
    }
  }
}

function serialize(value: unknown): string {
  return JSON.stringify(value);
}

function parseJson(value: string): unknown {
  return JSON.parse(value) as unknown;
}

function sameOrderedValues(actual: readonly string[], expected: readonly string[]): boolean {
  return (
    actual.length === expected.length && actual.every((value, index) => value === expected[index])
  );
}

export type { SQLInputValue };
