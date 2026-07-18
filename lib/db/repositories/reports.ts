import type { DB } from "../connection";
import type {
  Confidence,
  Report,
  ReportOutcome,
  TimelineEntry,
} from "@/lib/domain/report";
import { newId } from "@/lib/util/id";
import { nowIso } from "@/lib/util/time";

interface ReportRow {
  id: string;
  claim_id: string;
  outcome: string;
  summary: string;
  conclusion: string;
  timeline: string;
  finding_ids: string;
  confidence: string;
  generated_at: string;
}

function mapRow(row: ReportRow): Report {
  return {
    id: row.id,
    claimId: row.claim_id,
    outcome: row.outcome as ReportOutcome,
    summary: row.summary,
    conclusion: row.conclusion,
    timeline: JSON.parse(row.timeline) as TimelineEntry[],
    findingIds: JSON.parse(row.finding_ids) as string[],
    confidence: JSON.parse(row.confidence) as Confidence,
    generatedAt: row.generated_at,
  };
}

export interface NewReport {
  readonly claimId: string;
  readonly outcome: ReportOutcome;
  readonly summary: string;
  readonly conclusion: string;
  readonly timeline: readonly TimelineEntry[];
  readonly findingIds: readonly string[];
  readonly confidence: Confidence;
}

export function insertReport(db: DB, input: NewReport): Report {
  const report: Report = {
    id: newId("report"),
    generatedAt: nowIso(),
    ...input,
    timeline: [...input.timeline],
    findingIds: [...input.findingIds],
  };
  db.prepare(
    `INSERT INTO reports (id, claim_id, outcome, summary, conclusion, timeline, finding_ids, confidence, generated_at)
     VALUES (@id, @claimId, @outcome, @summary, @conclusion, @timeline, @findingIds, @confidence, @generatedAt)`,
  ).run({
    id: report.id,
    claimId: report.claimId,
    outcome: report.outcome,
    summary: report.summary,
    conclusion: report.conclusion,
    timeline: JSON.stringify(report.timeline),
    findingIds: JSON.stringify(report.findingIds),
    confidence: JSON.stringify(report.confidence),
    generatedAt: report.generatedAt,
  });
  return report;
}

export function getReportById(db: DB, id: string): Report | null {
  const row = db.prepare("SELECT * FROM reports WHERE id = ?").get(id) as
    | ReportRow
    | undefined;
  return row ? mapRow(row) : null;
}

export function getReportByClaimId(db: DB, claimId: string): Report | null {
  const row = db
    .prepare("SELECT * FROM reports WHERE claim_id = ?")
    .get(claimId) as ReportRow | undefined;
  return row ? mapRow(row) : null;
}
