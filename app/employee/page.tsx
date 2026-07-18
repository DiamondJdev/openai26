"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toString as toQrCodeSvg } from "qrcode";
import { apiGet, apiPost } from "@/lib/client/api";
import { StatusBadge } from "@/components/StatusBadge";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, OVERLINE } from "@/components/ui";
import type { ClaimStatus } from "@/lib/domain/claim-status";

interface QueueClaim {
  id: string;
  status: ClaimStatus;
  plateDisplay: string;
  vehicleType: string;
  customerName: string | null;
  createdAt: string;
}

interface CreatedClaim {
  claim: QueueClaim;
  url: string;
  pin: string;
}

interface DemoResetResult {
  seededVisits: number;
  deletedArtifacts: number;
}

/** Relative age for queue triage: "just now", "4m", "2h", "3d". */
function relativeAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

/** Group a numeric PIN into readable triads: "029154" → "029 154". */
function groupPin(pin: string): string {
  if (!/^\d{6}$/.test(pin)) return pin;
  return `${pin.slice(0, 3)} ${pin.slice(3)}`;
}

function CopyField({
  label,
  value,
  display,
  big = false,
}: {
  label: string;
  value: string;
  display?: string;
  big?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <span className={OVERLINE}>{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <code
          className={`flex-1 truncate rounded border border-border bg-bg px-3 py-2 font-mono ${
            big ? "text-2xl font-semibold tracking-[0.2em]" : "text-sm"
          }`}
        >
          {display ?? value}
        </code>
        <button
          type="button"
          className="min-h-touch shrink-0 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium transition-colors hover:border-muted hover:bg-surface-2 active:translate-y-px"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? `${label} copied to clipboard` : ""}
      </span>
    </div>
  );
}

function NewClaimForm({ onCreated }: { onCreated: (c: CreatedClaim) => void }) {
  const [plate, setPlate] = useState("");
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const data = await apiPost<CreatedClaim>("/api/employee/claims", {
        plate,
        managerNote: note,
      });
      onCreated(data);
      setPlate("");
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create claim.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <section aria-labelledby="new-claim" className={CARD}>
      <h2 id="new-claim" className={OVERLINE}>
        New claim
      </h2>
      <p className="mt-1.5 text-sm text-muted">
        Start by plate. You&apos;ll get a private link and PIN to hand the
        customer.
      </p>
      <form onSubmit={handleCreate} className="mt-4 space-y-4">
        <div>
          <label htmlFor="plate" className="block text-sm font-medium">
            License plate
          </label>
          <input
            id="plate"
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            required
            autoComplete="off"
            autoCapitalize="characters"
            className="mt-1 min-h-touch w-full rounded-md border border-border bg-bg px-3 py-2 font-mono tracking-widest placeholder:font-sans placeholder:tracking-normal placeholder:text-muted"
            placeholder="7GAB-991"
          />
        </div>
        <div>
          <label htmlFor="note" className="block text-sm font-medium">
            Complaint note{" "}
            <span className="font-normal text-muted">(optional)</span>
          </label>
          <textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
            className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2"
            placeholder="Customer says the rear bumper was scratched."
          />
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-md border border-danger/30 bg-danger-weak px-3 py-2 text-sm text-danger"
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={creating}
          className={`${BTN_PRIMARY} w-full`}
        >
          {creating ? "Creating…" : "Create claim & get link"}
        </button>
      </form>
    </section>
  );
}

function HandoffCard({
  created,
  onReset,
}: {
  created: CreatedClaim;
  onReset: () => void;
}) {
  const [qrCode, setQrCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setQrCode(null);
    toQrCodeSvg(created.url, {
      type: "svg",
      width: 176,
      margin: 1,
      errorCorrectionLevel: "M",
    })
      .then((svg) => {
        if (!cancelled) {
          setQrCode(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
        }
      })
      .catch(() => {
        if (!cancelled) setQrCode(null);
      });
    return () => {
      cancelled = true;
    };
  }, [created.url]);

  return (
    <section
      aria-labelledby="handoff"
      className="rounded-lg border border-signal/40 bg-signal-weak p-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="handoff"
          className="font-mono text-[11px] font-medium uppercase tracking-widest text-signal-strong"
        >
          Hand off to the customer
        </h2>
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
          Shown once
        </span>
      </div>

      <div className="mt-4 flex flex-col items-center gap-4">
        <figure className="flex flex-col items-center">
          <div className="rounded-lg border border-border bg-white p-3">
            {qrCode ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrCode}
                alt="QR code linking to the customer's private claim page"
                width={176}
                height={176}
                className="block"
              />
            ) : (
              <div className="h-[176px] w-[176px] animate-pulse rounded bg-surface-2" />
            )}
          </div>
          <figcaption className="mt-2 text-xs text-muted">
            Have the customer scan this to open their page.
          </figcaption>
        </figure>

        <div className="w-full space-y-3">
          <CopyField
            label="PIN"
            value={created.pin}
            display={groupPin(created.pin)}
            big
          />
          <CopyField label="Private link" value={created.url} />
          <p className="text-xs text-muted">
            Read the PIN aloud or send it separately — never in the same message
            as the link.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3 border-t border-signal/20 pt-4">
        <Link
          href={`/employee/claims/${created.claim.id}`}
          className={BTN_PRIMARY}
        >
          Open claim
        </Link>
        {/* Intentionally inert — reserved for a future native share hook. */}
        <button type="button" className={BTN_SECONDARY}>
          Share link
        </button>
        <button
          type="button"
          onClick={onReset}
          className="ml-auto min-h-touch px-2 text-sm font-medium text-muted transition-colors hover:text-fg"
        >
          Start another claim
        </button>
      </div>
    </section>
  );
}

function QueueRow({ claim }: { claim: QueueClaim }) {
  return (
    <li>
      <Link
        href={`/employee/claims/${claim.id}`}
        className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-muted hover:bg-surface-2"
      >
        <span className="rounded border border-border bg-bg px-2 py-0.5 font-mono text-sm font-medium tracking-widest">
          {claim.plateDisplay}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">
            {claim.customerName ?? (
              <span className="text-muted">Awaiting submission</span>
            )}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
            {relativeAge(claim.createdAt)}
          </span>
        </span>
        <StatusBadge status={claim.status} />
      </Link>
    </li>
  );
}

export default function EmployeeDashboard() {
  const [created, setCreated] = useState<CreatedClaim | null>(null);
  const [claims, setClaims] = useState<QueueClaim[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    try {
      const data = await apiGet<{ claims: QueueClaim[] }>(
        "/api/employee/claims",
      );
      setClaims(data.claims);
      setLoaded(true);
    } catch {
      // transient; keep last known queue
    }
  }, []);

  useEffect(() => {
    loadQueue();
    const t = setInterval(loadQueue, 4000);
    return () => clearInterval(t);
  }, [loadQueue]);

  async function signOut() {
    try {
      await apiPost("/api/employee/logout");
    } catch {
      // Non-fatal — clearing the cookie server-side is best-effort here.
    }
    window.location.assign("/employee/login");
  }

  async function resetDemoData() {
    if (
      !window.confirm(
        "Reset all ClaimLens demo claims, uploads, evidence, and reports? This cannot be undone.",
      )
    ) {
      return;
    }

    setResetting(true);
    setResetFeedback(null);
    setResetError(null);
    try {
      const result = await apiPost<DemoResetResult>("/api/employee/reset", {});
      setCreated(null);
      setResetFeedback(
        `Demo reset: ${result.seededVisits} visits restored and ${result.deletedArtifacts} ClaimLens artifacts removed.`,
      );
      await loadQueue();
    } catch (error) {
      setResetError(
        error instanceof Error ? error.message : "Could not reset demo data.",
      );
    } finally {
      setResetting(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="flex items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className={OVERLINE}>Employee console</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
            Claims
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={resetDemoData}
            disabled={resetting}
            className="min-h-touch rounded-md border border-danger/40 bg-danger-weak px-3 py-2 text-sm font-medium text-danger transition-colors hover:border-danger disabled:opacity-60"
          >
            {resetting ? "Resetting…" : "Reset demo data"}
          </button>
          <button
            type="button"
            onClick={signOut}
            className="min-h-touch rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-muted transition-colors hover:border-muted hover:text-fg"
          >
            Sign out
          </button>
        </div>
      </header>

      {resetFeedback && (
        <p
          role="status"
          className="mt-4 rounded-md border border-success/40 bg-success-weak px-3 py-2 text-sm text-success"
        >
          {resetFeedback}
        </p>
      )}
      {resetError && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-danger/30 bg-danger-weak px-3 py-2 text-sm text-danger"
        >
          {resetError}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[7fr,5fr]">
        {/* Queue — the console's steady state. */}
        <section aria-labelledby="queue" className="lg:order-1">
          <div className="flex items-baseline gap-2">
            <h2 id="queue" className={OVERLINE}>
              Queue
            </h2>
            {claims.length > 0 && (
              <span className="font-mono text-[11px] text-muted">
                {claims.length}
              </span>
            )}
          </div>

          {claims.length === 0 ? (
            <div className="mt-3 rounded-lg border border-dashed border-border px-6 py-12 text-center">
              <p className="font-medium">
                {loaded ? "No claims yet" : "Loading queue…"}
              </p>
              {loaded && (
                <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
                  Start a claim by plate to generate the customer&apos;s private
                  link and PIN. New submissions land here automatically.
                </p>
              )}
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {claims.map((c) => (
                <QueueRow key={c.id} claim={c} />
              ))}
            </ul>
          )}
        </section>

        {/* New claim / handoff — occasional, but the highest-stakes action. */}
        <aside className="lg:order-2">
          <div className="lg:sticky lg:top-8">
            {created ? (
              <HandoffCard created={created} onReset={() => setCreated(null)} />
            ) : (
              <NewClaimForm onCreated={setCreated} />
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
