import type { Database } from "../connection";
import type { Confidence, Report, ReportOutcome, TimelineEntry } from "@/lib/domain/report";
import { newId } from "@/lib/util/id";
import { nowIso } from "@/lib/util/time";

interface ReportRow { id: string; claim_id: string; outcome: string; summary: string; conclusion: string; timeline: string; finding_ids: string; confidence: string; generated_at: string; }
function mapRow(row: ReportRow): Report { return { id: row.id, claimId: row.claim_id, outcome: row.outcome as ReportOutcome, summary: row.summary, conclusion: row.conclusion, timeline: JSON.parse(row.timeline) as TimelineEntry[], findingIds: JSON.parse(row.finding_ids) as string[], confidence: JSON.parse(row.confidence) as Confidence, generatedAt: row.generated_at }; }
export interface NewReport { readonly claimId: string; readonly outcome: ReportOutcome; readonly summary: string; readonly conclusion: string; readonly timeline: readonly TimelineEntry[]; readonly findingIds: readonly string[]; readonly confidence: Confidence; }
export async function insertReport(db: Database, input: NewReport): Promise<Report> {
  const rows = await db.query<ReportRow>(
    `INSERT INTO reports (id, claim_id, outcome, summary, conclusion, timeline, finding_ids, confidence, generated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [newId("report"), input.claimId, input.outcome, input.summary, input.conclusion, JSON.stringify(input.timeline), JSON.stringify(input.findingIds), JSON.stringify(input.confidence), nowIso()],
  );
  if (!rows[0]) throw new Error("Report was not created");
  return mapRow(rows[0]);
}
export async function getReportById(db: Database, id: string): Promise<Report | null> { const rows = await db.query<ReportRow>("SELECT * FROM reports WHERE id = $1", [id]); return rows[0] ? mapRow(rows[0]) : null; }
export async function getReportByClaimId(db: Database, claimId: string): Promise<Report | null> { const rows = await db.query<ReportRow>("SELECT * FROM reports WHERE claim_id = $1", [claimId]); return rows[0] ? mapRow(rows[0]) : null; }
