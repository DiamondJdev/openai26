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
import type { ClaimStatus } from "@/lib/domain/claim-status";
import type { DamageRegion } from "@/lib/domain/regions";
import type { VehicleType } from "@/lib/domain/vehicle";
import type { Report } from "@/lib/domain/report";

interface ClaimDetail {
  id: string;
  status: ClaimStatus;
  vehicleType: VehicleType;
  selectedRegions: DamageRegion[];
  managerNote: string;
  shareEvidenceCrops: boolean;
  manualReviewReason: string | null;
  visit: { plateDisplay: string; occurredAt: string; cameras: string[] } | null;
  submission: { name: string; email: string; phone: string; submittedAt: string } | null;
  uploads: { id: string; kind: string }[];
  report: Report | null;
  crops: { id: string; region: string; camera: string }[];
  events: TraceEvent[];
}

export default function ClaimWorkspace() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [detail, setDetail] = useState<ClaimDetail | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [vehicleType, setVehicleType] = useState<VehicleType>("car");
  const [selected, setSelected] = useState<DamageRegion[]>([]);
  const [shareCrops, setShareCrops] = useState(false);
  const [seeded, setSeeded] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<{ claim: ClaimDetail; investigationRunning: boolean }>(
        `/api/employee/claims/${id}`,
      );
      setDetail(data.claim);
      setRunning(data.investigationRunning);
      if (!seeded) {
        setVehicleType(data.claim.vehicleType);
        setSelected(data.claim.selectedRegions);
        setShareCrops(data.claim.shareEvidenceCrops);
        setSeeded(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load claim.");
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
      prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region],
    );
  }

  if (!detail) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-muted">{error ?? "Loading…"}</p>
      </main>
    );
  }

  const canInvestigate = detail.status === "customer_submitted";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/employee" className="text-sm text-accent">
        ← Back to queue
      </Link>

      <header className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{detail.visit?.plateDisplay ?? "Claim"}</h1>
          {detail.visit && (
            <p className="text-sm text-muted">Wash at {new Date(detail.visit.occurredAt).toLocaleString()}</p>
          )}
        </div>
        <StatusBadge status={detail.status} />
      </header>

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}

      {detail.submission && (
        <section className="mt-6 rounded-xl border border-border bg-surface p-5">
          <h2 className="text-lg font-medium">Customer submission</h2>
          <dl className="mt-2 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">Name</dt>
            <dd>{detail.submission.name}</dd>
            <dt className="text-muted">Email</dt>
            <dd>{detail.submission.email}</dd>
            <dt className="text-muted">Phone</dt>
            <dd>{detail.submission.phone}</dd>
          </dl>
          {detail.uploads.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3">
              {detail.uploads.map((u) => (
                <figure key={u.id} className="w-28">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/employee/uploads/${u.id}`}
                    alt={`${u.kind} photo`}
                    className="h-20 w-28 rounded border border-border object-cover"
                  />
                  <figcaption className="mt-1 text-xs capitalize text-muted">{u.kind}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </section>
      )}

      {canInvestigate && (
        <section className="mt-6 rounded-xl border border-border bg-surface p-5">
          <h2 className="text-lg font-medium">Mark reported damage</h2>
          <p className="mt-1 text-sm text-muted">
            Confirm the vehicle type and the areas the customer reported, then start the investigation.
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
            className="mt-4 min-h-touch rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-fg disabled:opacity-60"
          >
            {busy ? "Starting…" : "Start investigation"}
          </button>
        </section>
      )}

      {(detail.status === "investigating" || detail.events.length > 0) && (
        <section className="mt-6" aria-live="polite">
          <h2 className="text-lg font-medium">
            Investigation trace{" "}
            {(running || detail.status === "investigating") && (
              <span className="text-sm font-normal text-accent">· live</span>
            )}
          </h2>
          <div className="mt-3">
            <InvestigationTimeline events={detail.events} />
          </div>
        </section>
      )}

      {detail.report && (
        <section className="mt-6 rounded-xl border border-border bg-surface p-5">
          <h2 className="text-lg font-medium">Report</h2>
          <p className="mt-2 text-xl font-semibold">{detail.report.conclusion}</p>
          <p className="mt-1 text-sm text-muted">{detail.report.summary}</p>
          <p className="mt-2 text-sm">
            Confidence: <span className="font-medium capitalize">{detail.report.confidence.level}</span>{" "}
            <span className="text-muted">({detail.report.confidence.rationale})</span>
          </p>

          {detail.status === "review_ready" && (
            <div className="mt-5 space-y-4 border-t border-border pt-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={shareCrops}
                  onChange={(e) => setShareCrops(e.target.checked)}
                  className="h-5 w-5"
                />
                <span>
                  Share evidence photos with the customer
                  <span className="block text-sm text-muted">
                    Off by default. Releases only focused entrance/exit crops for the selected areas.
                  </span>
                </span>
              </label>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    action(() =>
                      apiPost(`/api/employee/claims/${id}/release`, {
                        shareEvidenceCrops: shareCrops,
                      }),
                    )
                  }
                  className="min-h-touch rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-fg disabled:opacity-60"
                >
                  Release report (unchanged)
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    action(() =>
                      apiPost(`/api/employee/claims/${id}/hold`, {
                        reason: "Manager requested a closer look.",
                      }),
                    )
                  }
                  className="min-h-touch rounded-lg border border-border px-5 py-2.5 disabled:opacity-60"
                >
                  Require manual review
                </button>
              </div>
            </div>
          )}

          {detail.status === "released" && (
            <p className="mt-4 border-t border-border pt-4 text-sm text-success">
              Released to customer
              {detail.shareEvidenceCrops
                ? ` with ${detail.crops.length} evidence photo(s).`
                : " (no evidence photos shared)."}
            </p>
          )}
        </section>
      )}

      {detail.status === "manual_review_required" && (
        <section className="mt-6 rounded-xl border border-warning/40 bg-[rgba(251,191,36,0.10)] p-5">
          <h2 className="text-lg font-medium">Held for manual review</h2>
          <p className="mt-1 text-sm text-muted">
            {detail.manualReviewReason ?? "This claim needs a human review."}
          </p>
          <div className="mt-5 border-t border-warning/30 pt-4">
            <h3 className="font-medium">Release human-reviewed result</h3>
            <p className="mt-1 text-sm text-muted">
              Choose the final determination to send to the customer. The message
              will state that a human employee manually reviewed the case.
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
                className="min-h-touch rounded-lg border border-border bg-surface px-5 py-2.5 font-semibold disabled:opacity-60"
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
                className="min-h-touch rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-fg disabled:opacity-60"
              >
                Release: new damage found
              </button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
