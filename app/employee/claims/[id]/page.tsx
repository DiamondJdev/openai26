"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiGet, apiPost } from "@/lib/client/api";
import { StatusBadge } from "@/components/StatusBadge";
import { DamageSelector } from "@/components/DamageSelector";
import {
  InvestigationTimeline,
  type TraceEvent,
} from "@/components/InvestigationTimeline";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, OVERLINE } from "@/components/ui";
import { CAMERA_META, type CameraId } from "@/lib/domain/cameras";
import { REGION_META, type DamageRegion } from "@/lib/domain/regions";
import type { ClaimStatus } from "@/lib/domain/claim-status";
import type { VehicleType } from "@/lib/domain/vehicle";
import type { DamageStatus, Report, ReportOutcome } from "@/lib/domain/report";

interface ClaimFinding {
  id: string;
  camera: CameraId;
  timestampMs: number;
  observation: string;
  region: DamageRegion | null;
  damageStatus: DamageStatus;
}

interface ClaimDetail {
  id: string;
  status: ClaimStatus;
  vehicleType: VehicleType;
  selectedRegions: DamageRegion[];
  managerNote: string;
  shareEvidenceCrops: boolean;
  manualReviewReason: string | null;
  createdAt: string;
  visit: { plateDisplay: string; occurredAt: string; cameras: string[] } | null;
  submission: {
    name: string;
    email: string;
    phone: string;
    submittedAt: string;
  } | null;
  uploads: { id: string; kind: string }[];
  report: Report | null;
  crops: { id: string; region: string; camera: string }[];
  findings: ClaimFinding[];
  events: TraceEvent[];
}

function shortId(id: string): string {
  return id
    .replace(/^claim_/, "")
    .slice(0, 4)
    .toUpperCase();
}

/** Compact ops-style timestamp: "Jul 18 · 10:32". */
function compact(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${date} · ${time}`;
}

function washClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export default function ClaimWorkspace() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [detail, setDetail] = useState<ClaimDetail | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [vehicleType, setVehicleType] = useState<VehicleType>("car");
  const [selected, setSelected] = useState<DamageRegion[]>([]);
  const [shareCrops, setShareCrops] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  const [holdReason, setHoldReason] = useState("");
  const [seeded, setSeeded] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<{
        claim: ClaimDetail;
        investigationRunning: boolean;
      }>(`/api/employee/claims/${id}`);
      setDetail(data.claim);
      setLoadFailed(false);
      setRunning(data.investigationRunning);
      if (!seeded) {
        setVehicleType(data.claim.vehicleType);
        setSelected(data.claim.selectedRegions);
        setShareCrops(data.claim.shareEvidenceCrops);
        setSeeded(true);
      }
    } catch {
      setLoadFailed(true);
    }
  }, [id, seeded]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!detail) return;
    const live = running || detail.status === "investigating";
    if (!live) return;
    const t = setInterval(load, 1500);
    return () => clearInterval(t);
  }, [detail, running, load]);

  async function action<T>(fn: () => Promise<T>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  function toggleRegion(region: DamageRegion) {
    setSelected((prev) =>
      prev.includes(region)
        ? prev.filter((r) => r !== region)
        : [...prev, region],
    );
  }

  if (!detail) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-6">
        <Link
          href="/employee"
          className="font-mono text-xs uppercase tracking-wider text-muted transition-colors hover:text-fg"
        >
          ← Queue
        </Link>
        {loadFailed ? (
          <div
            role="alert"
            className="mt-6 max-w-xl rounded-lg border border-danger/30 bg-danger-weak p-5"
          >
            <p className="font-medium text-danger">
              Could not load this claim.
            </p>
            <p className="mt-1 text-sm text-muted">
              Check that the app is running, then{" "}
              <button
                type="button"
                onClick={load}
                className="font-medium text-fg underline"
              >
                try again
              </button>
              .
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4" aria-label="Loading claim">
            <div className="h-9 w-72 animate-pulse rounded bg-surface-2" />
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="h-48 animate-pulse rounded-lg bg-surface-2" />
              <div className="h-48 animate-pulse rounded-lg bg-surface-2" />
            </div>
          </div>
        )}
      </main>
    );
  }

  const live = running || detail.status === "investigating";
  const canInvestigate = detail.status === "customer_submitted";
  const showLedger = live || detail.events.length > 0;

  return (
    <main className="mx-auto max-w-6xl px-6 py-6">
      {/* ── File header ─────────────────────────────────────────────── */}
      <header className="border-b border-border pb-4">
        <Link
          href="/employee"
          className="font-mono text-xs uppercase tracking-wider text-muted transition-colors hover:text-fg"
        >
          ← Queue
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Claim{" "}
            <span className="font-mono tracking-normal">
              #{shortId(detail.id)}
            </span>
          </h1>
          {detail.visit && (
            <span className="rounded border border-border bg-surface px-2.5 py-0.5 font-mono text-lg font-medium tracking-[0.15em]">
              {detail.visit.plateDisplay}
            </span>
          )}
          <span className="text-sm text-muted">
            {detail.visit
              ? `washed ${compact(detail.visit.occurredAt)}`
              : "no wash visit on file"}
            {" · "}opened {compact(detail.createdAt)}
          </span>
          <span className="ml-auto">
            <StatusBadge status={detail.status} />
          </span>
        </div>
        {detail.managerNote && (
          <p className="mt-2 max-w-3xl text-sm">
            <span className={`${OVERLINE} mr-2`}>Complaint</span>
            <span className="text-fg/90">“{detail.managerNote}”</span>
          </p>
        )}
      </header>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-danger/30 bg-danger-weak px-4 py-2.5 text-sm text-danger"
        >
          {error}
        </p>
      )}

      {/* ── File + ledger ───────────────────────────────────────────── */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[5fr,7fr]">
        {/* Left: the claim file. */}
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="customer-h" className={CARD}>
            <h2 id="customer-h" className={OVERLINE}>
              Customer
            </h2>
            {detail.submission ? (
              <>
                <dl className="mt-3 grid grid-cols-[auto,1fr] gap-x-6 gap-y-1.5 text-sm">
                  <dt className="text-muted">Name</dt>
                  <dd className="font-medium">{detail.submission.name}</dd>
                  <dt className="text-muted">Email</dt>
                  <dd className="break-all">{detail.submission.email}</dd>
                  <dt className="text-muted">Phone</dt>
                  <dd className="font-mono text-[13px]">
                    {detail.submission.phone}
                  </dd>
                  <dt className="text-muted">Submitted</dt>
                  <dd>{compact(detail.submission.submittedAt)}</dd>
                </dl>
                {detail.uploads.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {detail.uploads.map((u) => (
                      <figure key={u.id} className="w-28">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/employee/uploads/${u.id}`}
                          alt={`${u.kind} photo`}
                          className="h-20 w-28 rounded-md bg-well object-cover"
                        />
                        <figcaption className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted">
                          {u.kind}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="mt-3 text-sm text-muted">
                Waiting on the customer&apos;s intake — share the private link
                and PIN from the queue if you haven&apos;t yet.
              </p>
            )}
          </section>

          {canInvestigate ? (
            <section aria-labelledby="damage-h" className={CARD}>
              <h2 id="damage-h" className={OVERLINE}>
                Reported damage
              </h2>
              <p className="mt-2 text-sm text-muted">
                Confirm the vehicle type and the areas the customer reported,
                then start the investigation.
              </p>
              <div className="mt-4">
                <DamageSelector
                  vehicleType={vehicleType}
                  selected={selected}
                  onVehicleTypeChange={setVehicleType}
                  onToggle={toggleRegion}
                  disabled={busy}
                />
              </div>
              <button
                type="button"
                disabled={busy || selected.length === 0}
                onClick={() =>
                  action(async () => {
                    await apiPost(`/api/employee/claims/${id}/intake`, {
                      vehicleType,
                      selectedRegions: selected,
                    });
                    await apiPost(`/api/employee/claims/${id}/investigate`);
                    setRunning(true);
                  })
                }
                className={`${BTN_PRIMARY} mt-5 w-full text-base`}
              >
                {busy ? "Starting…" : "▸ Start investigation"}
              </button>
              {selected.length === 0 && (
                <p className="mt-2 text-center text-xs text-muted">
                  Select at least one damage area to start.
                </p>
              )}
            </section>
          ) : detail.selectedRegions.length > 0 ? (
            <section aria-labelledby="damage-h" className={CARD}>
              <h2 id="damage-h" className={OVERLINE}>
                Reported damage
              </h2>
              <ul
                aria-label="Reported areas"
                className="mt-3 flex flex-wrap gap-1.5"
              >
                {detail.selectedRegions.map((r) => (
                  <li
                    key={r}
                    className="rounded border border-border bg-accent-weak px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wide"
                  >
                    {REGION_META[r].label}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {/* Right: the investigation ledger + verdict. */}
        <div className="min-w-0">
          <div className="space-y-6 lg:sticky lg:top-6">
            {showLedger ? (
              <InvestigationTimeline events={detail.events} live={live} />
            ) : (
              <section
                aria-label="Investigation log"
                className="rounded-lg border border-dashed border-border p-8 text-center"
              >
                <p className={OVERLINE}>Investigation log</p>
                <p className="mx-auto mt-3 max-w-xs text-sm text-muted">
                  {canInvestigate
                    ? "Mark the reported damage, then start the investigation to watch the evidence log fill in live."
                    : "The three-camera investigation will be logged here, step by step."}
                </p>
                <p className="mt-4 flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted">
                  {(["entrance", "mid_tunnel", "exit"] as const).map((c, i) => (
                    <span key={c} className="flex items-center gap-2">
                      {i > 0 && <span aria-hidden>→</span>}
                      <span className="rounded border border-border px-1.5 py-0.5">
                        {CAMERA_META[c].label}
                      </span>
                    </span>
                  ))}
                </p>
              </section>
            )}

            {detail.report && (
              <ReportCard
                detail={detail}
                busy={busy}
                shareCrops={shareCrops}
                setShareCrops={setShareCrops}
                holdOpen={holdOpen}
                setHoldOpen={setHoldOpen}
                holdReason={holdReason}
                setHoldReason={setHoldReason}
                onRelease={() =>
                  action(() =>
                    apiPost(`/api/employee/claims/${id}/release`, {
                      shareEvidenceCrops: shareCrops,
                    }),
                  )
                }
                onHold={() =>
                  action(() =>
                    apiPost(`/api/employee/claims/${id}/hold`, {
                      reason:
                        holdReason.trim() || "Manager requested a closer look.",
                    }),
                  )
                }
              />
            )}

            {detail.status === "manual_review_required" && (
              <section
                aria-labelledby="manual-h"
                className="rounded-lg border border-warning/40 bg-warning-weak p-5"
              >
                <h2
                  id="manual-h"
                  className="font-display text-lg font-semibold"
                >
                  Held for manual review
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {detail.manualReviewReason ??
                    "This claim needs a human review."}
                </p>
                <div className="mt-4 border-t border-warning/30 pt-4">
                  <h3 className={OVERLINE}>Release human-reviewed result</h3>
                  <p className="mt-2 text-sm text-muted">
                    Review the log and the customer&apos;s photos, then choose
                    the final determination. The customer is told a human
                    reviewed the case.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        action(() =>
                          apiPost(`/api/employee/claims/${id}/manual-release`, {
                            outcome: "no_new_damage_detected",
                          }),
                        )
                      }
                      className={BTN_SECONDARY}
                    >
                      Release: no new damage found
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        action(() =>
                          apiPost(`/api/employee/claims/${id}/manual-release`, {
                            outcome: "new_damage_detected",
                          }),
                        )
                      }
                      className={BTN_PRIMARY}
                    >
                      Release: new damage found
                    </button>
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

/* ── Verdict + report ─────────────────────────────────────────────── */

const VERDICT_STYLES: Record<ReportOutcome, { banner: string; label: string }> =
  {
    no_new_damage_detected: {
      banner: "border-success/40 bg-success-weak",
      label: "text-success",
    },
    new_damage_detected: {
      banner: "border-signal/50 bg-signal-weak",
      label: "text-signal-strong",
    },
    manual_review_required: {
      banner: "border-warning/40 bg-warning-weak",
      label: "text-warning",
    },
  };

const FINDING_STATUS: Record<
  DamageStatus,
  { text: string; className: string }
> = {
  new_damage: {
    text: "New damage",
    className: "bg-signal-weak text-signal-strong",
  },
  pre_existing: { text: "Pre-existing", className: "bg-surface-2 text-muted" },
  no_damage: { text: "No damage", className: "bg-success-weak text-success" },
  inconclusive: {
    text: "Inconclusive",
    className: "bg-warning-weak text-warning",
  },
};

function ReportCard({
  detail,
  busy,
  shareCrops,
  setShareCrops,
  holdOpen,
  setHoldOpen,
  holdReason,
  setHoldReason,
  onRelease,
  onHold,
}: {
  detail: ClaimDetail;
  busy: boolean;
  shareCrops: boolean;
  setShareCrops: (v: boolean) => void;
  holdOpen: boolean;
  setHoldOpen: (v: boolean) => void;
  holdReason: string;
  setHoldReason: (v: string) => void;
  onRelease: () => void;
  onHold: () => void;
}) {
  const report = detail.report;
  if (!report) return null;
  const styles = VERDICT_STYLES[report.outcome];

  return (
    <section
      aria-labelledby="report-h"
      className="overflow-hidden rounded-lg border border-border bg-surface"
    >
      {/* Verdict banner keyed to the outcome. */}
      <div className={`border-b px-5 py-4 ${styles.banner}`}>
        <h2 id="report-h" className={OVERLINE}>
          Verdict
        </h2>
        <p
          className={`mt-1 font-display text-2xl font-semibold tracking-tight ${styles.label}`}
        >
          {report.conclusion}
        </p>
        <p className="mt-1 text-sm text-fg/80">{report.summary}</p>
        <p className="mt-2.5 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded bg-surface px-2 py-0.5 font-mono text-xs font-medium uppercase tracking-wider">
            Confidence: {report.confidence.level} ·{" "}
            {report.confidence.agreeingChecks}/{report.confidence.totalChecks}{" "}
            checks agree
          </span>
          <span className="text-xs text-muted">
            {report.confidence.rationale}
          </span>
        </p>
      </div>

      <div className="space-y-5 p-5">
        {/* Wash timeline from the compiled report. */}
        {report.timeline.length > 0 && (
          <div>
            <h3 className={OVERLINE}>Wash timeline</h3>
            <ol className="mt-2 space-y-1">
              {report.timeline.map((t, i) => (
                <li key={i} className="flex items-baseline gap-3 text-sm">
                  <span className="w-12 shrink-0 text-right font-mono text-xs text-muted">
                    {washClock(t.timestampMs)}
                  </span>
                  <span className="shrink-0 rounded-sm border border-border px-1 font-mono text-[10px] uppercase tracking-wider text-muted">
                    {CAMERA_META[t.camera].label}
                  </span>
                  <span className="min-w-0">{t.label}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Findings with their evidence citations. */}
        {detail.findings.length > 0 && (
          <div>
            <h3 className={OVERLINE}>Findings</h3>
            <ul className="mt-2 space-y-2">
              {detail.findings.map((f) => {
                const status = FINDING_STATUS[f.damageStatus];
                return (
                  <li
                    key={f.id}
                    className="rounded-md border border-border p-3 text-sm"
                  >
                    <p className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-sm px-1.5 py-px font-mono text-[10px] font-medium uppercase tracking-wider ${status.className}`}
                      >
                        {status.text}
                      </span>
                      {f.region && (
                        <span className="font-medium">
                          {REGION_META[f.region].label}
                        </span>
                      )}
                      <span className="ml-auto font-mono text-[11px] text-muted">
                        {CAMERA_META[f.camera].label} ·{" "}
                        {washClock(f.timestampMs)}
                      </span>
                    </p>
                    <p className="mt-1.5 text-fg/90">{f.observation}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Evidence crops the employee may share. */}
        {detail.crops.length > 0 && (
          <div>
            <h3 className={OVERLINE}>Evidence crops</h3>
            <div className="mt-2 flex flex-wrap gap-3">
              {detail.crops.map((c) => (
                <figure key={c.id} className="w-32">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/employee/crops/${c.id}`}
                    alt={`${c.region.replace(/_/g, " ")} crop from ${c.camera.replace(/_/g, " ")}`}
                    className="h-24 w-32 rounded-md bg-well object-cover"
                  />
                  <figcaption className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted">
                    {c.region.replace(/_/g, " ")} ·{" "}
                    {c.camera.replace(/_/g, " ")}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}

        {/* Decision controls. */}
        {detail.status === "review_ready" && (
          <div className="space-y-4 border-t border-border pt-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={shareCrops}
                onChange={(e) => setShareCrops(e.target.checked)}
                className="mt-0.5 h-5 w-5"
              />
              <span className="text-sm">
                <span className="font-medium">
                  Share evidence photos with the customer
                </span>
                <span className="block text-muted">
                  Off by default. Shares only focused entrance/exit crops of the
                  reported areas.
                </span>
              </span>
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={onRelease}
                className={BTN_PRIMARY}
              >
                {busy ? "Working…" : "Release report to customer"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setHoldOpen(!holdOpen)}
                aria-expanded={holdOpen}
                className={BTN_SECONDARY}
              >
                Hold for manual review
              </button>
            </div>

            {holdOpen && (
              <div className="rounded-md border border-border bg-bg p-3">
                <label
                  htmlFor="hold-reason"
                  className="block text-sm font-medium"
                >
                  Why are you holding this claim?
                </label>
                <textarea
                  id="hold-reason"
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  rows={2}
                  maxLength={300}
                  placeholder="e.g. Exit-camera frame is too dark to rule out the scratch."
                  className="mt-1.5 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={onHold}
                  className={`${BTN_SECONDARY} mt-2 text-sm`}
                >
                  {busy ? "Working…" : "Confirm hold"}
                </button>
              </div>
            )}
          </div>
        )}

        {detail.status === "released" && (
          <p className="border-t border-border pt-4 text-sm">
            <span className="font-medium text-success">
              ✓ Released to customer
            </span>{" "}
            <span className="text-muted">
              {detail.shareEvidenceCrops
                ? `with ${detail.crops.length} evidence photo${detail.crops.length === 1 ? "" : "s"}.`
                : "— no evidence photos shared."}
            </span>
          </p>
        )}
      </div>
    </section>
  );
}
