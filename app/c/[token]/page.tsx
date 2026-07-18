"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { apiGet, apiPost, apiPostForm } from "@/lib/client/api";

interface ContactCard {
  title: string;
  body: string;
  actionLabel: string;
  actionHref: string;
}
type CustomerView =
  | { state: "intake" }
  | { state: "under_review" }
  | {
      state: "released";
      outcome: string;
      conclusion: string;
      summary: string;
      crops: { id: string; region: string; camera: string }[];
      contactCards: ContactCard[];
    };

const UPLOAD_FIELDS = [
  { kind: "plate", label: "License plate photo" },
  { kind: "odometer", label: "Odometer photo" },
  { kind: "insurance", label: "Insurance card photo" },
] as const;

export default function CustomerClaimPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [phase, setPhase] = useState<"checking" | "pin" | "view">("checking");
  const [view, setView] = useState<CustomerView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshView = useCallback(async () => {
    const data = await apiGet<{ view: CustomerView }>("/api/customer/claim");
    setView(data.view);
    setPhase("view");
  }, []);

  useEffect(() => {
    refreshView().catch(() => setPhase("pin"));
  }, [refreshView]);

  // Poll while under review so the customer sees the result as soon as it's released.
  useEffect(() => {
    if (view?.state !== "under_review") return;
    const t = setInterval(() => {
      refreshView().catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [view, refreshView]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-5 py-8">
      <header>
        <p className="text-sm font-medium uppercase tracking-widest text-accent">
          ClaimLens
        </p>
        <h1 className="text-2xl font-semibold">Your wash claim</h1>
      </header>

      {phase === "checking" && <p className="text-muted">Loading…</p>}

      {phase === "pin" && (
        <PinGate
          token={token}
          onVerified={(v) => {
            setView(v);
            setPhase("view");
          }}
        />
      )}

      {phase === "view" && view?.state === "intake" && (
        <IntakeForm onSubmitted={(v) => setView(v)} setError={setError} error={error} />
      )}

      {phase === "view" && view?.state === "under_review" && <UnderReview />}

      {phase === "view" && view?.state === "released" && <ReleasedView view={view} />}
    </main>
  );
}

function PinGate({
  token,
  onVerified,
}: {
  token: string;
  onVerified: (v: CustomerView) => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await apiPost<{ view: CustomerView }>("/api/customer/session", {
        token,
        pin,
      });
      onVerified(data.view);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That PIN is not valid.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-muted">
        Enter the PIN shared with your private link to continue.
      </p>
      <div>
        <label htmlFor="pin" className="block text-base font-medium">
          PIN
        </label>
        <input
          id="pin"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          className="mt-1 min-h-touch w-full rounded-lg border border-border bg-surface px-4 py-3 text-lg tracking-widest"
          placeholder="123456"
          required
        />
      </div>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="min-h-touch w-full rounded-lg bg-accent px-5 py-3 text-lg font-semibold text-accent-fg disabled:opacity-60"
      >
        {busy ? "Checking…" : "Continue"}
      </button>
    </form>
  );
}

function IntakeForm({
  onSubmitted,
  setError,
  error,
}: {
  onSubmitted: (v: CustomerView) => void;
  setError: (e: string | null) => void;
  error: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!formRef.current) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData(formRef.current);
      form.set("consent", form.get("consent") === "on" ? "true" : "false");
      const data = await apiPostForm<{ view: CustomerView }>(
        "/api/customer/claim/intake",
        form,
      );
      onSubmitted(data.view);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-5" noValidate>
      <p className="text-muted">
        Share a few details and photos so we can look into your claim.
      </p>

      <Field id="name" label="Full name" type="text" autoComplete="name" />
      <Field id="email" label="Email" type="email" autoComplete="email" />
      <Field id="phone" label="Phone" type="tel" autoComplete="tel" />

      {UPLOAD_FIELDS.map((f) => (
        <div key={f.kind}>
          <label htmlFor={f.kind} className="block text-base font-medium">
            {f.label}
          </label>
          <input
            id={f.kind}
            name={f.kind}
            type="file"
            accept="image/*"
            capture="environment"
            required
            className="mt-1 block w-full text-base file:mr-3 file:min-h-touch file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:font-semibold file:text-accent-fg"
          />
        </div>
      ))}

      <label className="flex items-start gap-3">
        <input type="checkbox" name="consent" required className="mt-1 h-5 w-5" />
        <span className="text-base">
          I consent to ClaimLens reviewing wash footage of my vehicle for this claim.
        </span>
      </label>

      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="min-h-touch w-full rounded-lg bg-accent px-5 py-3 text-lg font-semibold text-accent-fg disabled:opacity-60"
      >
        {busy ? "Submitting…" : "Submit claim"}
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  type,
  autoComplete,
}: {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-base font-medium">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        required
        className="mt-1 min-h-touch w-full rounded-lg border border-border bg-surface px-4 py-3 text-base"
      />
    </div>
  );
}

function UnderReview() {
  return (
    <section aria-live="polite" className="rounded-xl border border-border bg-surface p-6 text-center">
      <h2 className="text-xl font-semibold">We&apos;re reviewing your claim</h2>
      <p className="mt-2 text-muted">
        Thanks for your submission. We&apos;re looking into the wash footage now and
        will update this page with the result. You can keep this page open.
      </p>
    </section>
  );
}

function ReleasedView({
  view,
}: {
  view: Extract<CustomerView, { state: "released" }>;
}) {
  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-xl font-semibold">{view.conclusion}</h2>
        <p className="mt-2 text-muted">{view.summary}</p>
      </div>

      {view.crops.length > 0 && (
        <div>
          <h3 className="text-lg font-medium">Evidence photos</h3>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {view.crops.map((c) => (
              <figure key={c.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/customer/crops/${c.id}`}
                  alt={`${c.region.replace(/_/g, " ")} at ${c.camera.replace(/_/g, " ")}`}
                  className="w-full rounded-lg border border-border object-cover"
                />
                <figcaption className="mt-1 text-sm capitalize text-muted">
                  {c.region.replace(/_/g, " ")} · {c.camera.replace(/_/g, " ")}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {view.contactCards.map((card) => (
          <a
            key={card.title}
            href={card.actionHref}
            className="block rounded-xl border border-border bg-surface p-4"
          >
            <p className="font-medium">{card.title}</p>
            <p className="mt-1 text-sm text-muted">{card.body}</p>
            <span className="mt-2 inline-block font-semibold text-accent">
              {card.actionLabel} →
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
