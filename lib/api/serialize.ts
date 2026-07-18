import "server-only";
import type { AppContext } from "@/lib/runtime/context";
import type { Claim } from "@/lib/domain/models";
import { getVisitById } from "@/lib/db/repositories/visits";
import { getSubmissionByClaimId } from "@/lib/db/repositories/submissions";
import { listUploadsByClaim } from "@/lib/db/repositories/uploads";
import { getReportByClaimId } from "@/lib/db/repositories/reports";
import { listEventsByClaim } from "@/lib/db/repositories/events";
import { listCropsByClaim } from "@/lib/db/repositories/evidence";

/** Compact queue row for the employee live queue. */
export function claimSummary(ctx: AppContext, claim: Claim) {
  const visit = getVisitById(ctx.db, claim.visitId);
  const submission = getSubmissionByClaimId(ctx.db, claim.id);
  return {
    id: claim.id,
    status: claim.status,
    plateDisplay: visit?.plateDisplay ?? "—",
    vehicleType: claim.vehicleType,
    customerName: submission?.name ?? null,
    createdAt: claim.createdAt,
    updatedAt: claim.updatedAt,
  };
}

/**
 * Full employee-side detail. Employees have trusted local access, so this
 * includes the submission, upload references, findings-backed report, and the
 * plain-language investigation trace.
 */
export function claimDetail(ctx: AppContext, claim: Claim) {
  const visit = getVisitById(ctx.db, claim.visitId);
  const submission = getSubmissionByClaimId(ctx.db, claim.id);
  const uploads = listUploadsByClaim(ctx.db, claim.id).map((u) => ({
    id: u.id,
    kind: u.kind,
  }));
  const report = getReportByClaimId(ctx.db, claim.id);
  const events = listEventsByClaim(ctx.db, claim.id).map((e) => ({
    seq: e.seq,
    type: e.type,
    plainLanguage: e.plainLanguage,
    detail: e.detail,
    createdAt: e.createdAt,
  }));
  const crops = listCropsByClaim(ctx.db, claim.id).map((c) => ({
    id: c.id,
    region: c.region,
    camera: c.camera,
  }));

  return {
    id: claim.id,
    status: claim.status,
    vehicleType: claim.vehicleType,
    selectedRegions: claim.selectedRegions,
    managerNote: claim.managerNote,
    shareEvidenceCrops: claim.shareEvidenceCrops,
    manualReviewReason: claim.manualReviewReason,
    createdAt: claim.createdAt,
    updatedAt: claim.updatedAt,
    visit: visit
      ? {
          plateDisplay: visit.plateDisplay,
          occurredAt: visit.occurredAt,
          cameras: Object.keys(visit.sources),
        }
      : null,
    submission: submission
      ? {
          name: submission.name,
          email: submission.email,
          phone: submission.phone,
          submittedAt: submission.submittedAt,
        }
      : null,
    uploads,
    report,
    crops,
    events,
  };
}
