export interface SqliteMigration {
  version: number;
  name: string;
  sql: string;
}

export const SQLITE_REVIEW_SCHEMA_VERSION = 2 as const;

export const reviewMigrations: readonly SqliteMigration[] = [
  {
    version: 1,
    name: 'create_auditor_review_store',
    sql: `
      CREATE TABLE review_bundles (
        finding_id TEXT PRIMARY KEY,
        assessment_id TEXT NOT NULL,
        original_finding_json TEXT NOT NULL,
        current_finding_json TEXT NOT NULL,
        original_group_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE source_records (
        record_type TEXT NOT NULL,
        record_id TEXT NOT NULL,
        assessment_id TEXT NOT NULL,
        record_json TEXT NOT NULL,
        PRIMARY KEY (record_type, record_id)
      );

      CREATE TABLE bundle_source_records (
        finding_id TEXT NOT NULL REFERENCES review_bundles(finding_id),
        record_type TEXT NOT NULL,
        record_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        PRIMARY KEY (finding_id, record_type, record_id),
        UNIQUE (finding_id, record_type, position),
        FOREIGN KEY (record_type, record_id) REFERENCES source_records(record_type, record_id)
      );

      CREATE TABLE grouping_decisions (
        id TEXT PRIMARY KEY,
        finding_id TEXT NOT NULL REFERENCES review_bundles(finding_id),
        group_proposal_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('accepted', 'rejected', 'split')),
        actor TEXT NOT NULL,
        reason TEXT NOT NULL,
        decided_at TEXT NOT NULL
      );

      CREATE INDEX grouping_decisions_finding_order
        ON grouping_decisions(finding_id, decided_at, id);

      CREATE TABLE validations (
        id TEXT PRIMARY KEY,
        finding_id TEXT NOT NULL REFERENCES review_bundles(finding_id),
        validation_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX validations_finding_order ON validations(finding_id, created_at, id);

      CREATE TABLE audit_events (
        id TEXT PRIMARY KEY,
        finding_id TEXT NOT NULL REFERENCES review_bundles(finding_id),
        event_json TEXT NOT NULL,
        occurred_at TEXT NOT NULL
      );

      CREATE INDEX audit_events_finding_order ON audit_events(finding_id, occurred_at, id);

      CREATE TRIGGER source_records_no_update
        BEFORE UPDATE ON source_records BEGIN SELECT RAISE(ABORT, 'source records are immutable'); END;
      CREATE TRIGGER source_records_no_delete
        BEFORE DELETE ON source_records BEGIN SELECT RAISE(ABORT, 'source records are immutable'); END;
      CREATE TRIGGER bundle_source_records_no_update
        BEFORE UPDATE ON bundle_source_records BEGIN SELECT RAISE(ABORT, 'bundle source links are immutable'); END;
      CREATE TRIGGER bundle_source_records_no_delete
        BEFORE DELETE ON bundle_source_records BEGIN SELECT RAISE(ABORT, 'bundle source links are immutable'); END;
      CREATE TRIGGER validations_no_update
        BEFORE UPDATE ON validations BEGIN SELECT RAISE(ABORT, 'validations are append-only'); END;
      CREATE TRIGGER validations_no_delete
        BEFORE DELETE ON validations BEGIN SELECT RAISE(ABORT, 'validations are append-only'); END;
      CREATE TRIGGER audit_events_no_update
        BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT, 'audit history is append-only'); END;
      CREATE TRIGGER audit_events_no_delete
        BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT, 'audit history is append-only'); END;
      CREATE TRIGGER grouping_decisions_no_update
        BEFORE UPDATE ON grouping_decisions BEGIN SELECT RAISE(ABORT, 'group decisions are append-only'); END;
      CREATE TRIGGER grouping_decisions_no_delete
        BEFORE DELETE ON grouping_decisions BEGIN SELECT RAISE(ABORT, 'group decisions are append-only'); END;
      CREATE TRIGGER review_originals_no_update
        BEFORE UPDATE OF assessment_id, original_finding_json, original_group_json, created_at
        ON review_bundles BEGIN SELECT RAISE(ABORT, 'original review records are immutable'); END;
    `,
  },
  {
    version: 2,
    name: 'create_resident_journey_store',
    sql: `
      CREATE TABLE resident_journeys (
        journey_id TEXT PRIMARY KEY,
        assessment_id TEXT NOT NULL,
        current_journey_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );

      CREATE TABLE journey_revisions (
        revision_id TEXT PRIMARY KEY,
        journey_id TEXT NOT NULL REFERENCES resident_journeys(journey_id),
        journey_json TEXT NOT NULL,
        actor TEXT NOT NULL,
        reason TEXT,
        changed_at TEXT NOT NULL
      );

      CREATE INDEX journey_revisions_order
        ON journey_revisions(journey_id, changed_at, revision_id);

      CREATE TABLE journey_finding_links (
        journey_id TEXT NOT NULL REFERENCES resident_journeys(journey_id),
        finding_id TEXT NOT NULL REFERENCES review_bundles(finding_id),
        PRIMARY KEY (journey_id, finding_id)
      );

      CREATE INDEX journey_finding_links_finding
        ON journey_finding_links(finding_id, journey_id);

      CREATE TABLE journey_results (
        result_id TEXT PRIMARY KEY,
        journey_id TEXT NOT NULL REFERENCES resident_journeys(journey_id),
        assessment_id TEXT NOT NULL,
        result_json TEXT NOT NULL,
        recorded_at TEXT NOT NULL
      );

      CREATE INDEX journey_results_order
        ON journey_results(journey_id, recorded_at, result_id);

      CREATE TABLE journey_result_finding_links (
        result_id TEXT NOT NULL REFERENCES journey_results(result_id),
        finding_id TEXT NOT NULL REFERENCES review_bundles(finding_id),
        PRIMARY KEY (result_id, finding_id)
      );

      CREATE INDEX journey_result_finding_links_finding
        ON journey_result_finding_links(finding_id, result_id);

      CREATE TABLE journey_result_evidence_links (
        result_id TEXT NOT NULL REFERENCES journey_results(result_id),
        record_type TEXT NOT NULL DEFAULT 'evidence' CHECK (record_type = 'evidence'),
        evidence_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        PRIMARY KEY (result_id, evidence_id),
        UNIQUE (result_id, position),
        FOREIGN KEY (record_type, evidence_id) REFERENCES source_records(record_type, record_id)
      );

      CREATE TABLE journey_audit_events (
        event_id TEXT PRIMARY KEY,
        journey_id TEXT NOT NULL REFERENCES resident_journeys(journey_id),
        event_json TEXT NOT NULL,
        occurred_at TEXT NOT NULL
      );

      CREATE INDEX journey_audit_events_order
        ON journey_audit_events(journey_id, occurred_at, event_id);

      CREATE TRIGGER journey_identity_no_update
        BEFORE UPDATE OF journey_id, assessment_id, created_at
        ON resident_journeys BEGIN SELECT RAISE(ABORT, 'journey identity is immutable'); END;
      CREATE TRIGGER journey_deletion_no_clear
        BEFORE UPDATE OF deleted_at ON resident_journeys
        WHEN OLD.deleted_at IS NOT NULL
        BEGIN SELECT RAISE(ABORT, 'journey deletion is irreversible'); END;
      CREATE TRIGGER journey_revisions_no_update
        BEFORE UPDATE ON journey_revisions BEGIN SELECT RAISE(ABORT, 'journey revisions are append-only'); END;
      CREATE TRIGGER journey_revisions_no_delete
        BEFORE DELETE ON journey_revisions BEGIN SELECT RAISE(ABORT, 'journey revisions are append-only'); END;
      CREATE TRIGGER journey_results_no_update
        BEFORE UPDATE ON journey_results BEGIN SELECT RAISE(ABORT, 'journey results are append-only'); END;
      CREATE TRIGGER journey_results_no_delete
        BEFORE DELETE ON journey_results BEGIN SELECT RAISE(ABORT, 'journey results are append-only'); END;
      CREATE TRIGGER journey_result_finding_links_no_update
        BEFORE UPDATE ON journey_result_finding_links BEGIN SELECT RAISE(ABORT, 'journey result links are append-only'); END;
      CREATE TRIGGER journey_result_finding_links_no_delete
        BEFORE DELETE ON journey_result_finding_links BEGIN SELECT RAISE(ABORT, 'journey result links are append-only'); END;
      CREATE TRIGGER journey_result_evidence_links_no_update
        BEFORE UPDATE ON journey_result_evidence_links BEGIN SELECT RAISE(ABORT, 'journey result evidence is immutable'); END;
      CREATE TRIGGER journey_result_evidence_links_no_delete
        BEFORE DELETE ON journey_result_evidence_links BEGIN SELECT RAISE(ABORT, 'journey result evidence is immutable'); END;
      CREATE TRIGGER journey_audit_events_no_update
        BEFORE UPDATE ON journey_audit_events BEGIN SELECT RAISE(ABORT, 'journey audit history is append-only'); END;
      CREATE TRIGGER journey_audit_events_no_delete
        BEFORE DELETE ON journey_audit_events BEGIN SELECT RAISE(ABORT, 'journey audit history is append-only'); END;
    `,
  },
] as const;
