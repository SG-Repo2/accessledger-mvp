import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import {
  evidenceSchema,
  findingSchema,
  groupProposalSchema,
  observationOccurrenceSchema,
  observationSchema,
  pageSchema,
  reviewAuditEventSchema,
  validationSchema,
  wcagCandidateEvaluationSchema,
  type Evidence,
  type Finding,
  type GroupProposal,
  type ReviewAuditEvent,
  type Validation,
} from '@accessledger/shared';

import { reviewMigrations } from './migrations.js';
import type {
  GroupingDecisionRecord,
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

export class SqliteReviewRepository implements ReviewRepository {
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
    const evidenceIds = [
      ...new Set([
        ...originalGroup.evidenceIds,
        ...validations.flatMap((validation) => validation.evidenceIds),
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

  listFindingIds(): string[] {
    return this.#database
      .prepare('SELECT finding_id FROM review_bundles ORDER BY finding_id')
      .all()
      .map((row) => (row as { finding_id: string }).finding_id);
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

export type { SQLInputValue };
