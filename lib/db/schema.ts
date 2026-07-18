/**
 * Postgres DDL applied through versioned migrations. Serialized domain values
 * remain TEXT so existing mappers can preserve their JSON representation.
 */
export const POSTGRES_SCHEMA_STATEMENTS = [
  `CREATE TABLE visits (
    id TEXT PRIMARY KEY,
    plate_normalized TEXT NOT NULL,
    plate_display TEXT NOT NULL,
    vehicle_type TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    sources TEXT NOT NULL DEFAULT '{}'
  )`,
  "CREATE INDEX idx_visits_plate ON visits(plate_normalized, occurred_at DESC)",
  `CREATE TABLE claims (
    id TEXT PRIMARY KEY,
    visit_id TEXT NOT NULL REFERENCES visits(id),
    status TEXT NOT NULL,
    vehicle_type TEXT NOT NULL,
    selected_regions TEXT NOT NULL DEFAULT '[]',
    manager_note TEXT NOT NULL DEFAULT '',
    report_id TEXT,
    share_evidence_crops BOOLEAN NOT NULL DEFAULT FALSE,
    released_at TEXT,
    manual_review_reason TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  "CREATE INDEX idx_claims_status ON claims(status, created_at DESC)",
  `CREATE TABLE customer_access (
    id TEXT PRIMARY KEY,
    claim_id TEXT NOT NULL UNIQUE REFERENCES claims(id),
    token_hash TEXT NOT NULL UNIQUE,
    pin_hash TEXT NOT NULL,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE customer_submissions (
    id TEXT PRIMARY KEY,
    claim_id TEXT NOT NULL UNIQUE REFERENCES claims(id),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    consent_at TEXT NOT NULL,
    submitted_at TEXT NOT NULL
  )`,
  `CREATE TABLE uploads (
    id TEXT PRIMARY KEY,
    claim_id TEXT NOT NULL REFERENCES claims(id),
    kind TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    mime TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    bytes INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  "CREATE INDEX idx_uploads_claim ON uploads(claim_id, kind)",
  `CREATE TABLE evidence_frames (
    id TEXT PRIMARY KEY,
    claim_id TEXT NOT NULL REFERENCES claims(id),
    camera TEXT NOT NULL,
    timestamp_ms INTEGER NOT NULL,
    stored_path TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  "CREATE INDEX idx_frames_claim ON evidence_frames(claim_id)",
  `CREATE TABLE evidence_crops (
    id TEXT PRIMARY KEY,
    claim_id TEXT NOT NULL REFERENCES claims(id),
    frame_id TEXT NOT NULL REFERENCES evidence_frames(id),
    camera TEXT NOT NULL,
    region TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  "CREATE INDEX idx_crops_claim ON evidence_crops(claim_id, region)",
  `CREATE TABLE findings (
    id TEXT PRIMARY KEY,
    claim_id TEXT NOT NULL REFERENCES claims(id),
    camera TEXT NOT NULL,
    timestamp_ms INTEGER NOT NULL,
    observation TEXT NOT NULL,
    region TEXT,
    damage_status TEXT NOT NULL DEFAULT 'inconclusive',
    bbox TEXT,
    evidence_frame_ids TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
  )`,
  "CREATE INDEX idx_findings_claim ON findings(claim_id)",
  `CREATE TABLE investigation_events (
    id TEXT PRIMARY KEY,
    claim_id TEXT NOT NULL REFERENCES claims(id),
    seq INTEGER NOT NULL,
    type TEXT NOT NULL,
    plain_language TEXT NOT NULL,
    detail TEXT,
    created_at TEXT NOT NULL
  )`,
  "CREATE UNIQUE INDEX idx_events_claim_seq ON investigation_events(claim_id, seq)",
  `CREATE TABLE reports (
    id TEXT PRIMARY KEY,
    claim_id TEXT NOT NULL UNIQUE REFERENCES claims(id),
    outcome TEXT NOT NULL,
    summary TEXT NOT NULL,
    conclusion TEXT NOT NULL,
    timeline TEXT NOT NULL DEFAULT '[]',
    finding_ids TEXT NOT NULL DEFAULT '[]',
    confidence TEXT NOT NULL,
    generated_at TEXT NOT NULL
  )`,
] as const;
