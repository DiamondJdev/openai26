"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { apiGet, apiPost, apiPostForm } from "@/lib/client/api";
import { BrandMark } from "@/components/BrandMark";
import { BTN_PRIMARY, OVERLINE } from "@/components/ui";

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function CameraIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

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
      <header className="flex items-center gap-2.5 border-b border-border pb-4">
        <BrandMark />
        <div>
          <p className="font-display text-lg font-semibold leading-none tracking-tight">
            ClaimLens
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted">
            Private claim · secure link
          </p>
        </div>
      </header>

      {phase === "checking" && (
        <div className="space-y-3" aria-label="Loading">
          <div className="h-7 w-40 animate-pulse rounded bg-surface-2" />
          <div className="h-28 animate-pulse rounded-lg bg-surface-2" />
        </div>
      )}

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
        <IntakeForm
          onSubmitted={(v) => setView(v)}
          setError={setError}
          error={error}
        />
      )}

      {phase === "view" && view?.state === "under_review" && <UnderReview />}

      {phase === "view" && view?.state === "released" && (
        <ReleasedView view={view} />
      )}
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
      const data = await apiPost<{ view: CustomerView }>(
        "/api/customer/session",
        {
          token,
          pin,
        },
      );
      onVerified(data.view);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That PIN is not valid.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Enter your PIN
        </h1>
        <p className="mt-1 text-sm text-muted">
          Use the 6-digit PIN the wash shared alongside this private link.
        </p>
      </div>
      <div>
        <label htmlFor="pin" className={OVERLINE}>
          PIN
        </label>
        <input
          id="pin"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          className="mt-1 min-h-touch w-full rounded-lg border border-border bg-surface px-4 py-3 text-center font-mono text-2xl font-semibold tracking-[0.35em]"
          placeholder="000000"
          required
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
        disabled={busy || pin.length < 6}
        className={`${BTN_PRIMARY} w-full py-3 text-base`}
      >
        {busy ? "Checking…" : "Continue"}
      </button>
    </form>
  );
}

function PhotoField({
  kind,
  label,
  index,
  onCapturedChange,
}: {
  kind: string;
  label: string;
  index: number;
  onCapturedChange: (kind: string, captured: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setFileName(null);
      onCapturedChange(kind, false);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    setFileName(file.name);
    onCapturedChange(kind, true);
  }

  return (
    <div>
      <input
        ref={inputRef}
        id={kind}
        name={kind}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="sr-only"
      />
      {preview ? (
        <div className="flex items-center gap-3 rounded-lg border border-success/40 bg-success-weak p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={`${label} preview`}
            className="h-14 w-14 shrink-0 rounded-md bg-well object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-medium text-success">
              <span aria-hidden>✓</span> {label}
            </p>
            <p className="truncate text-xs text-muted">{fileName}</p>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="shrink-0 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium transition-colors hover:bg-surface-2"
          >
            Retake
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center gap-3 rounded-lg border border-dashed border-border p-3 text-left transition-colors hover:border-muted hover:bg-surface-2"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-surface-2 font-mono text-sm text-muted">
            {index}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{label}</span>
            <span className="block text-xs text-muted">
              Tap to take a photo
            </span>
          </span>
          <span className="shrink-0 text-muted">
            <CameraIcon />
          </span>
        </button>
      )}
    </div>
  );
}

function Field({
  id,
  label,
  type,
  autoComplete,
  value,
  onChange,
  onBlur,
  error,
  inputMode,
}: {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  error?: string;
  inputMode?: "text" | "email" | "tel";
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={error ? true : undefined}
        className={`mt-1 min-h-touch w-full rounded-lg border bg-surface px-4 py-3 text-base ${
          error ? "border-danger" : "border-border"
        }`}
      />
      {error && (
        <p className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [captured, setCaptured] = useState<Record<string, boolean>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const capturedCount = UPLOAD_FIELDS.filter((f) => captured[f.kind]).length;
  const errors = {
    name: name.trim() ? "" : "Enter your full name.",
    email: EMAIL_RE.test(email) ? "" : "Enter a valid email.",
    phone: phone.trim().length >= 7 ? "" : "Enter a phone number.",
  };
  const allValid =
    !errors.name &&
    !errors.email &&
    !errors.phone &&
    capturedCount === UPLOAD_FIELDS.length &&
    consent;

  function markCaptured(kind: string, isCaptured: boolean) {
    setCaptured((prev) => ({ ...prev, [kind]: isCaptured }));
  }

  function showError(field: keyof typeof errors): string | undefined {
    if (!touched[field] && !submitAttempted) return undefined;
    return errors[field] || undefined;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    if (!allValid || !formRef.current) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData(formRef.current);
      form.set("consent", "true");
      const data = await apiPostForm<{ view: CustomerView }>(
        "/api/customer/claim/intake",
        form,
      );
      onSubmitted(data.view);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not submit. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-6" noValidate>
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Tell us about your claim
        </h1>
        <p className="mt-1 text-sm text-muted">
          A few details and three quick photos. This takes about a minute.
        </p>
      </div>

      <fieldset className="space-y-4">
        <legend className={`mb-1 ${OVERLINE}`}>Your details</legend>
        <Field
          id="name"
          label="Full name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={setName}
          onBlur={() => setTouched((t) => ({ ...t, name: true }))}
          error={showError("name")}
        />
        <Field
          id="email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          error={showError("email")}
        />
        <Field
          id="phone"
          label="Phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={setPhone}
          onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
          error={showError("phone")}
        />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-1 flex w-full items-center justify-between">
          <span className={OVERLINE}>Photos</span>
          <span
            className="font-mono text-[11px] uppercase tracking-wider text-muted"
            aria-live="polite"
          >
            {capturedCount} of {UPLOAD_FIELDS.length} added
          </span>
        </legend>
        {UPLOAD_FIELDS.map((f, i) => (
          <PhotoField
            key={f.kind}
            kind={f.kind}
            label={f.label}
            index={i + 1}
            onCapturedChange={markCaptured}
          />
        ))}
      </fieldset>

      <label className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3">
        <input
          type="checkbox"
          name="consent"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0"
        />
        <span className="text-sm">
          I consent to ClaimLens reviewing wash footage of my vehicle for this
          claim.
        </span>
      </label>

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
        disabled={busy || (submitAttempted && !allValid)}
        className={`${BTN_PRIMARY} w-full py-3 text-base`}
      >
        {busy ? "Submitting…" : "Submit claim"}
      </button>
    </form>
  );
}

function UnderReview() {
  return (
    <section
      aria-live="polite"
      className="rounded-lg border border-border bg-surface p-6 text-center"
    >
      <span
        aria-hidden
        className="mx-auto flex h-2.5 w-24 items-center justify-center gap-1.5"
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 animate-pulse rounded-full bg-signal"
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </span>
      <h1 className="mt-4 font-display text-xl font-semibold tracking-tight">
        We&apos;re reviewing your claim
      </h1>
      <p className="mt-2 text-sm text-muted">
        Thanks for your submission. We&apos;re looking into the wash footage now
        and will update this page with the result — you can keep it open.
      </p>
    </section>
  );
}

const CUSTOMER_VERDICT: Record<string, { banner: string; label: string }> = {
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

/** Entrance = before the wash, exit = after — the whole point of the crops. */
function phaseLabel(camera: string): string {
  if (camera === "entrance") return "Before wash";
  if (camera === "exit") return "After wash";
  return camera.replace(/_/g, " ");
}

function ReleasedView({
  view,
}: {
  view: Extract<CustomerView, { state: "released" }>;
}) {
  const verdict = CUSTOMER_VERDICT[view.outcome] ?? {
    banner: "border-border bg-surface",
    label: "text-fg",
  };
  const [primary, ...secondary] = view.contactCards;

  return (
    <section className="space-y-6">
      {/* Outcome-keyed verdict — the customer's payoff, in the system's language. */}
      <div className={`rounded-lg border p-5 ${verdict.banner}`}>
        <h1 className={OVERLINE}>Result</h1>
        <p
          className={`mt-1 font-display text-2xl font-semibold tracking-tight ${verdict.label}`}
        >
          {view.conclusion}
        </p>
        <p className="mt-1.5 text-sm text-fg/80">{view.summary}</p>
      </div>

      {view.crops.length > 0 && (
        <div>
          <h2 className={OVERLINE}>Evidence</h2>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {view.crops.map((c) => (
              <figure
                key={c.id}
                className="overflow-hidden rounded-lg border border-well-line bg-well"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/customer/crops/${c.id}`}
                  alt={`${c.region.replace(/_/g, " ")} — ${phaseLabel(c.camera)}`}
                  className="aspect-[4/3] w-full object-cover"
                />
                <figcaption className="flex items-center justify-between gap-2 px-2 py-1.5 font-mono text-[10px] uppercase tracking-wider text-well-muted">
                  <span className="truncate">
                    {c.region.replace(/_/g, " ")}
                  </span>
                  <span className="shrink-0 text-well-fg">
                    {phaseLabel(c.camera)}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}

      {view.contactCards.length > 0 && (
        <div className="space-y-3">
          {primary && (
            <a
              href={primary.actionHref}
              className="block rounded-lg bg-accent p-4 text-accent-fg transition-colors hover:bg-accent-hover"
            >
              <p className="font-medium">{primary.title}</p>
              <p className="mt-1 text-sm text-accent-fg/80">{primary.body}</p>
              <span className="mt-2 inline-block text-sm font-semibold">
                {primary.actionLabel} →
              </span>
            </a>
          )}
          {secondary.map((card) => (
            <a
              key={card.title}
              href={card.actionHref}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 transition-colors hover:bg-surface-2"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium">{card.title}</span>
                <span className="block text-xs text-muted">{card.body}</span>
              </span>
              <span className="shrink-0 text-sm font-medium text-fg">
                {card.actionLabel} →
              </span>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
