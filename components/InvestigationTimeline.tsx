"use client";

import { useEffect, useRef, useState } from "react";
import { CAMERA_META, type CameraId } from "@/lib/domain/cameras";

export interface TraceEvent {
  seq: number;
  type: string;
  plainLanguage: string;
  detail: { camera?: CameraId; timestampMs?: number; frameId?: string } | null;
  createdAt: string;
}

interface InvestigationTimelineProps {
  events: TraceEvent[];
  /** True while the agent is still working — shows the live footer and ticker. */
  live?: boolean;
  /** Tool-call budget, rendered as "step N of ≤max". */
  maxSteps?: number;
}

function clock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/** Elapsed investigation time as "+m:ss" from the first event. */
function elapsed(deltaMs: number): string {
  const total = Math.max(0, Math.floor(deltaMs / 1000));
  return `+${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

interface RowStyle {
  readonly shape: "circle" | "diamond" | "square" | "dot";
  readonly marker: string;
  /** De-emphasized row (raw tool results, not insights). */
  readonly dim?: boolean;
  readonly chip?: { text: string; className: string };
}

/**
 * Each event type gets a distinct marker so the log reads at a glance:
 * lifecycle = filled circle, tool call = hollow circle, raw result = dim dot,
 * observation = hollow diamond, finding = filled signal diamond.
 * Amber/red marker colors are well-surface variants of warning/danger.
 */
function rowStyle(type: string): RowStyle {
  switch (type) {
    case "finding_saved":
      return {
        shape: "diamond",
        marker: "bg-signal-bright",
        chip: { text: "Finding", className: "bg-signal-bright/15 text-signal-bright" },
      };
    case "observation":
      return { shape: "diamond", marker: "border border-well-fg" };
    case "tool_call":
      return { shape: "circle", marker: "border border-well-muted" };
    case "tool_result":
      return { shape: "dot", marker: "bg-well-muted/70", dim: true };
    case "manual_review":
      return {
        shape: "diamond",
        marker: "bg-[#fbbf24]",
        chip: { text: "Held", className: "bg-[#fbbf24]/15 text-[#fbbf24]" },
      };
    case "error":
      return {
        shape: "square",
        marker: "bg-[#f87171]",
        chip: { text: "Error", className: "bg-[#f87171]/15 text-[#f87171]" },
      };
    // started / completed / report_generated
    default:
      return { shape: "circle", marker: "bg-well-fg" };
  }
}

const SHAPE_CLASSES: Record<RowStyle["shape"], string> = {
  circle: "h-2.5 w-2.5 rounded-full",
  diamond: "h-2 w-2 rotate-45 rounded-[1px]",
  square: "h-2 w-2 rounded-[1px]",
  dot: "h-1.5 w-1.5 rounded-full",
};

function MetaChips({ detail }: { detail: NonNullable<TraceEvent["detail"]> }) {
  const chip =
    "rounded-sm border border-well-line px-1 py-px font-mono text-[10px] uppercase tracking-wider text-well-muted";
  return (
    <span className="mt-1 flex flex-wrap gap-1.5">
      {detail.camera && (
        <span className={chip}>{CAMERA_META[detail.camera].label}</span>
      )}
      {detail.timestampMs !== undefined && (
        <span className={chip}>{clock(detail.timestampMs)}</span>
      )}
      {detail.frameId && (
        <span className={chip}>frame ·{detail.frameId.slice(-6)}</span>
      )}
    </span>
  );
}

/**
 * The investigation ledger: a timecoded, typed evidence log rendered in a dark
 * well. Exposes only camera / timestamp / evidence-frame details — never
 * prompts or raw tool arguments.
 */
export function InvestigationTimeline({
  events,
  live = false,
  maxSteps,
}: InvestigationTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Tick the elapsed clock once a second while live.
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [live]);

  // Keep the newest step in view while the agent is working.
  useEffect(() => {
    if (live && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [live, events.length]);

  const t0 = events.length > 0 ? Date.parse(events[0].createdAt) : null;
  const tLast =
    events.length > 0 ? Date.parse(events[events.length - 1].createdAt) : null;
  const steps = events.filter((e) => e.type === "tool_call").length;

  return (
    <section
      aria-label="Investigation log"
      className="well overflow-hidden rounded-lg bg-well text-well-fg"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-well-line px-4 py-3">
        <h2 className="font-mono text-xs font-medium uppercase tracking-widest text-well-muted">
          Investigation log
        </h2>
        <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider">
          {live ? (
            <>
              <span
                aria-hidden
                className="h-2 w-2 animate-pulse rounded-full bg-signal-bright"
              />
              <span className="text-signal-bright">Live</span>
              <span className="text-well-muted">
                · step {steps}
                {maxSteps !== undefined && ` of ≤${maxSteps}`}
                {t0 !== null && ` · ${elapsed(nowMs - t0)}`}
              </span>
            </>
          ) : (
            events.length > 0 && (
              <span className="text-well-muted">
                {steps} steps
                {t0 !== null && tLast !== null && ` · ${elapsed(tLast - t0)}`}
              </span>
            )
          )}
        </p>
      </div>

      {events.length === 0 ? (
        <p className="flex items-center gap-2.5 px-4 py-6 text-sm text-well-muted">
          <span
            aria-hidden
            className="h-2 w-2 animate-pulse rounded-full bg-signal-bright"
          />
          Starting the investigation — the first step lands here.
        </p>
      ) : (
        <div
          ref={scrollRef}
          role="log"
          aria-label="Investigation steps"
          className="max-h-[55vh] overflow-y-auto"
        >
          <ol className="relative px-4 py-3">
            {/* Rail connecting the step markers. */}
            <span
              aria-hidden
              className="absolute bottom-3 left-[5.0625rem] top-3 w-px bg-well-line"
            />
            {events.map((e) => {
              const s = rowStyle(e.type);
              const hasDetail =
                e.detail &&
                (e.detail.camera ||
                  e.detail.timestampMs !== undefined ||
                  e.detail.frameId);
              return (
                <li key={e.seq} className="flex gap-3 py-1.5">
                  <span className="w-12 shrink-0 pt-0.5 text-right font-mono text-[11px] text-well-muted">
                    {t0 !== null && elapsed(Date.parse(e.createdAt) - t0)}
                  </span>
                  <span
                    aria-hidden
                    className="relative z-10 mt-1 flex h-2.5 w-2.5 shrink-0 items-center justify-center"
                  >
                    <span
                      className={`${SHAPE_CLASSES[s.shape]} ${s.marker} ring-4 ring-well`}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm leading-snug ${
                        s.dim ? "text-well-muted" : "text-well-fg"
                      }`}
                    >
                      {s.chip && (
                        <span
                          className={`mr-2 inline-block rounded-sm px-1.5 py-px align-middle font-mono text-[10px] font-medium uppercase tracking-wider ${s.chip.className}`}
                        >
                          {s.chip.text}
                        </span>
                      )}
                      {e.plainLanguage}
                    </p>
                    {hasDetail && e.detail && <MetaChips detail={e.detail} />}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
