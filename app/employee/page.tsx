"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiPost } from "@/lib/client/api";
import { StatusBadge } from "@/components/StatusBadge";
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

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded bg-bg px-3 py-2 text-sm">{value}</code>
        <button
          type="button"
          className="min-h-touch shrink-0 rounded-lg border border-border px-3 py-2 text-sm"
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
    </div>
  );
}

export default function EmployeeDashboard() {
  const [plate, setPlate] = useState("");
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedClaim | null>(null);
  const [claims, setClaims] = useState<QueueClaim[]>([]);

  const loadQueue = useCallback(async () => {
    try {
      const data = await apiGet<{ claims: QueueClaim[] }>("/api/employee/claims");
      setClaims(data.claims);
    } catch {
      // transient; keep last known queue
    }
  }, []);

  useEffect(() => {
    loadQueue();
    const t = setInterval(loadQueue, 4000);
    return () => clearInterval(t);
  }, [loadQueue]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const data = await apiPost<CreatedClaim>("/api/employee/claims", {
        plate,
        managerNote: note,
      });
      setCreated(data);
      setPlate("");
      setNote("");
      loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create claim.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Employee console</h1>
      <p className="mt-1 text-muted">
        Start a claim by plate, share the private link, then investigate when the
        customer submits.
      </p>

      <section aria-labelledby="new-claim" className="mt-8 rounded-xl border border-border bg-surface p-5">
        <h2 id="new-claim" className="text-lg font-medium">
          New claim
        </h2>
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
              className="mt-1 min-h-touch w-full rounded-lg border border-border bg-bg px-3 py-2"
              placeholder="7GAB-991"
            />
          </div>
          <div>
            <label htmlFor="note" className="block text-sm font-medium">
              Complaint note <span className="text-muted">(optional)</span>
            </label>
            <textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2"
              placeholder="Customer says the rear bumper was scratched."
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={creating}
            className="min-h-touch rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-fg disabled:opacity-60"
          >
            {creating ? "Creating…" : "Create claim & get link"}
          </button>
        </form>

        {created && (
          <div className="mt-5 space-y-3 rounded-lg border border-accent/40 bg-accent-weak p-4">
            <p className="text-sm font-medium">
              Share these with the customer (shown once):
            </p>
            <CopyRow label="Private link" value={created.url} />
            <CopyRow label="PIN" value={created.pin} />
          </div>
        )}
      </section>

      <section aria-labelledby="queue" className="mt-8">
        <h2 id="queue" className="text-lg font-medium">
          Live queue
        </h2>
        <ul className="mt-3 space-y-2">
          {claims.length === 0 && (
            <li className="text-muted">No claims yet.</li>
          )}
          {claims.map((c) => (
            <li key={c.id}>
              <Link
                href={`/employee/claims/${c.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 hover:border-accent"
              >
                <span className="flex flex-col">
                  <span className="font-medium">{c.plateDisplay}</span>
                  <span className="text-sm text-muted">
                    {c.customerName ?? "Awaiting submission"} · {c.vehicleType}
                  </span>
                </span>
                <StatusBadge status={c.status} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
