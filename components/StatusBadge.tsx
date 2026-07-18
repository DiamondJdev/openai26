import type { ClaimStatus } from "@/lib/domain/claim-status";

interface BadgeMeta {
  readonly text: string;
  readonly className: string;
  /** Leading dot encodes the workflow state at a glance. */
  readonly dot?: "signal" | "pulse" | "success";
}

/**
 * Semantic status scale: neutral = waiting on others, signal orange = waiting
 * on you, pulsing = machine at work, green = resolved, amber = held.
 */
const LABELS: Record<ClaimStatus, BadgeMeta> = {
  draft: { text: "Awaiting customer", className: "bg-surface-2 text-muted" },
  customer_submitted: {
    text: "Ready to investigate",
    className: "bg-signal-weak text-signal-strong",
    dot: "signal",
  },
  investigating: {
    text: "Investigating",
    className: "bg-accent-weak text-fg",
    dot: "pulse",
  },
  review_ready: {
    text: "Decision needed",
    className: "border border-signal/40 bg-signal-weak text-signal-strong",
    dot: "signal",
  },
  released: {
    text: "Released",
    className: "bg-success-weak text-success",
    dot: "success",
  },
  manual_review_required: {
    text: "Manual review",
    className: "bg-warning-weak text-warning",
  },
};

const DOT_CLASSES: Record<NonNullable<BadgeMeta["dot"]>, string> = {
  signal: "bg-signal",
  pulse: "animate-pulse bg-fg",
  success: "bg-success",
};

export function StatusBadge({ status }: { status: ClaimStatus }) {
  const meta = LABELS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2 py-1 font-mono text-[11px] font-medium uppercase tracking-wider ${meta.className}`}
    >
      {meta.dot && (
        <span
          aria-hidden
          className={`h-1.5 w-1.5 rounded-full ${DOT_CLASSES[meta.dot]}`}
        />
      )}
      {meta.text}
    </span>
  );
}
