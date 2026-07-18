import type { Database } from "@/lib/db/connection";
import type { Claim } from "@/lib/domain/models";
import type {
  Confidence,
  Finding,
  Report,
  ReportOutcome,
  TimelineEntry,
} from "@/lib/domain/report";
import { CAMERA_META } from "@/lib/domain/cameras";
import {
  ManualReviewRequiredError,
  UncitedFindingError,
} from "@/lib/domain/errors";
import { listFindingsByClaim } from "@/lib/db/repositories/findings";
import { getFrameById } from "@/lib/db/repositories/evidence";
import { attachReport } from "@/lib/db/repositories/claims";
import { insertReport } from "@/lib/db/repositories/reports";

/** True when the same region has both a new-damage and a not-new finding. */
function hasRegionContradiction(findings: readonly Finding[]): boolean {
  const byRegion = new Map<string, Set<string>>();
  for (const f of findings) {
    if (f.region === null) continue;
    const set = byRegion.get(f.region) ?? new Set<string>();
    set.add(f.damageStatus);
    byRegion.set(f.region, set);
  }
  for (const set of byRegion.values()) {
    if (
      set.has("new_damage") &&
      (set.has("no_damage") || set.has("pre_existing"))
    ) {
      return true;
    }
  }
  return false;
}

function deriveOutcome(findings: readonly Finding[]): ReportOutcome {
  if (findings.some((f) => f.damageStatus === "inconclusive")) {
    return "manual_review_required";
  }
  // Contradictory evidence on one region is not a confident conclusion.
  if (hasRegionContradiction(findings)) {
    return "manual_review_required";
  }
  if (findings.some((f) => f.damageStatus === "new_damage")) {
    return "new_damage_detected";
  }
  return "no_new_damage_detected";
}

function deriveConfidence(
  findings: readonly Finding[],
  outcome: ReportOutcome,
): Confidence {
  const total = findings.length;
  const agreeing = findings.filter((f) => {
    if (outcome === "new_damage_detected")
      return f.damageStatus === "new_damage";
    return f.damageStatus === "no_damage" || f.damageStatus === "pre_existing";
  }).length;

  let level: Confidence["level"] = "low";
  if (agreeing === total && total >= 3) level = "high";
  else if (total >= 2 && agreeing / total >= 0.66) level = "medium";

  return {
    level,
    agreeingChecks: agreeing,
    totalChecks: total,
    rationale: `${agreeing}/${total} checks consistent with the conclusion`,
  };
}

function conclusionFor(outcome: ReportOutcome): {
  summary: string;
  conclusion: string;
} {
  switch (outcome) {
    case "no_new_damage_detected":
      return {
        summary:
          "No new damage was found between the pre- and post-wash footage.",
        conclusion: "No evidence the wash caused new damage.",
      };
    case "new_damage_detected":
      return {
        summary:
          "New damage was identified that was not present before the wash.",
        conclusion: "Evidence indicates the wash caused new damage.",
      };
    case "manual_review_required":
      return {
        summary:
          "The footage was insufficient to reach a confident conclusion.",
        conclusion: "This claim needs a human review.",
      };
  }
}

/** Enforce that every finding cites at least one stored, in-scope evidence frame. */
async function assertCitations(
  db: Database,
  claimId: string,
  findings: readonly Finding[],
): Promise<void> {
  for (const finding of findings) {
    if (finding.evidenceFrameIds.length === 0) {
      throw new UncitedFindingError(`Finding ${finding.id} cites no evidence.`);
    }
    for (const frameId of finding.evidenceFrameIds) {
      const frame = await getFrameById(db, frameId);
      if (!frame || frame.claimId !== claimId) {
        throw new UncitedFindingError(
          `Finding ${finding.id} cites frame ${frameId} that is missing or out of scope.`,
        );
      }
    }
  }
}

function buildTimeline(findings: readonly Finding[]): TimelineEntry[] {
  return [...findings]
    .sort(
      (a, b) =>
        a.timestampMs - b.timestampMs ||
        CAMERA_META[a.camera].order - CAMERA_META[b.camera].order,
    )
    .map((f) => ({
      timestampMs: f.timestampMs,
      camera: f.camera,
      label: f.observation,
      frameId: f.evidenceFrameIds[0] ?? null,
    }));
}

/**
 * Compile saved findings into a persisted report. Throws
 * ManualReviewRequiredError when there is nothing releasable (no findings or an
 * inconclusive outcome) and UncitedFindingError if any finding lacks stored
 * evidence — the report is generated ONLY from cited findings.
 */
export async function compileAndPersistReport(db: Database, claim: Claim): Promise<Report> {
  const findings = await listFindingsByClaim(db, claim.id);
  if (findings.length === 0) {
    throw new ManualReviewRequiredError("No findings were produced.");
  }
  await assertCitations(db, claim.id, findings);

  const outcome = deriveOutcome(findings);
  if (outcome === "manual_review_required") {
    throw new ManualReviewRequiredError(
      "Findings were inconclusive or contradictory.",
    );
  }

  const { summary, conclusion } = conclusionFor(outcome);
  const report = await insertReport(db, {
    claimId: claim.id,
    outcome,
    summary,
    conclusion,
    timeline: buildTimeline(findings),
    findingIds: findings.map((f) => f.id),
    confidence: deriveConfidence(findings, outcome),
  });
  await attachReport(db, claim.id, report.id, "review_ready");
  return report;
}
