import type { DB } from "../connection";
import type {
  InvestigationEvent,
  InvestigationEventDetail,
  InvestigationEventType,
} from "@/lib/domain/models";
import { newId } from "@/lib/util/id";
import { nowIso } from "@/lib/util/time";

interface EventRow {
  id: string;
  claim_id: string;
  seq: number;
  type: string;
  plain_language: string;
  detail: string | null;
  created_at: string;
}

function mapRow(row: EventRow): InvestigationEvent {
  return {
    id: row.id,
    claimId: row.claim_id,
    seq: row.seq,
    type: row.type as InvestigationEventType,
    plainLanguage: row.plain_language,
    detail: row.detail
      ? (JSON.parse(row.detail) as InvestigationEventDetail)
      : null,
    createdAt: row.created_at,
  };
}

export interface NewEvent {
  readonly claimId: string;
  readonly type: InvestigationEventType;
  readonly plainLanguage: string;
  readonly detail?: InvestigationEventDetail | null;
}

/**
 * Append a plain-language investigation step. The per-claim sequence number is
 * assigned atomically inside a transaction so concurrent SSE reads never see a
 * gap or duplicate.
 */
export function appendEvent(db: DB, input: NewEvent): InvestigationEvent {
  const insert = db.transaction((data: NewEvent): InvestigationEvent => {
    const row = db
      .prepare(
        "SELECT COALESCE(MAX(seq), -1) + 1 AS next FROM investigation_events WHERE claim_id = ?",
      )
      .get(data.claimId) as { next: number };
    const event: InvestigationEvent = {
      id: newId("evt"),
      claimId: data.claimId,
      seq: row.next,
      type: data.type,
      plainLanguage: data.plainLanguage,
      detail: data.detail ?? null,
      createdAt: nowIso(),
    };
    db.prepare(
      `INSERT INTO investigation_events (id, claim_id, seq, type, plain_language, detail, created_at)
       VALUES (@id, @claimId, @seq, @type, @plainLanguage, @detail, @createdAt)`,
    ).run({
      id: event.id,
      claimId: event.claimId,
      seq: event.seq,
      type: event.type,
      plainLanguage: event.plainLanguage,
      detail: event.detail ? JSON.stringify(event.detail) : null,
      createdAt: event.createdAt,
    });
    return event;
  });
  return insert(input);
}

export function listEventsByClaim(db: DB, claimId: string): InvestigationEvent[] {
  const rows = db
    .prepare("SELECT * FROM investigation_events WHERE claim_id = ? ORDER BY seq ASC")
    .all(claimId) as EventRow[];
  return rows.map(mapRow);
}

/** Events with seq strictly greater than `afterSeq`, for SSE resumption. */
export function listEventsAfter(
  db: DB,
  claimId: string,
  afterSeq: number,
): InvestigationEvent[] {
  const rows = db
    .prepare(
      "SELECT * FROM investigation_events WHERE claim_id = ? AND seq > ? ORDER BY seq ASC",
    )
    .all(claimId, afterSeq) as EventRow[];
  return rows.map(mapRow);
}
