import type { Database } from "../connection";
import type { InvestigationEvent, InvestigationEventDetail, InvestigationEventType } from "@/lib/domain/models";
import { newId } from "@/lib/util/id";
import { nowIso } from "@/lib/util/time";

interface EventRow { id: string; claim_id: string; seq: number; type: string; plain_language: string; detail: string | null; created_at: string; }

function mapRow(row: EventRow): InvestigationEvent {
  return { id: row.id, claimId: row.claim_id, seq: row.seq, type: row.type as InvestigationEventType, plainLanguage: row.plain_language, detail: row.detail ? JSON.parse(row.detail) as InvestigationEventDetail : null, createdAt: row.created_at };
}

export interface NewEvent { readonly claimId: string; readonly type: InvestigationEventType; readonly plainLanguage: string; readonly detail?: InvestigationEventDetail | null; }

/** Atomically append an event with a gap-free sequence per claim. */
export async function appendEvent(db: Database, input: NewEvent): Promise<InvestigationEvent> {
  const rows = await db.query<EventRow>(
    `WITH locked AS (
       SELECT pg_advisory_xact_lock(hashtext($1))
     ), next_event AS (
       SELECT COALESCE(MAX(seq), -1) + 1 AS seq
       FROM investigation_events, locked
       WHERE claim_id = $1
     )
     INSERT INTO investigation_events (id, claim_id, seq, type, plain_language, detail, created_at)
     SELECT $2, $1, next_event.seq, $3, $4, $5, $6 FROM next_event
     RETURNING *`,
    [input.claimId, newId("evt"), input.type, input.plainLanguage, input.detail ? JSON.stringify(input.detail) : null, nowIso()],
  );
  if (!rows[0]) throw new Error("Event was not created");
  return mapRow(rows[0]);
}

export async function listEventsByClaim(db: Database, claimId: string): Promise<InvestigationEvent[]> {
  return (await db.query<EventRow>(
    "SELECT * FROM investigation_events WHERE claim_id = $1 ORDER BY seq ASC", [claimId],
  )).map(mapRow);
}

/** Events with seq strictly greater than `afterSeq`, for SSE resumption. */
export async function listEventsAfter(db: Database, claimId: string, afterSeq: number): Promise<InvestigationEvent[]> {
  return (await db.query<EventRow>(
    "SELECT * FROM investigation_events WHERE claim_id = $1 AND seq > $2 ORDER BY seq ASC", [claimId, afterSeq],
  )).map(mapRow);
}
