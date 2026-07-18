/**
 * Shared class recipes for the claim-file design language. Kept as plain
 * constants (not components) so Tailwind can see every class at build time.
 */
export const BTN_PRIMARY =
  "inline-flex min-h-touch items-center justify-center rounded-md bg-accent px-5 py-2.5 font-semibold text-accent-fg transition-colors hover:bg-accent-hover active:translate-y-px disabled:opacity-60 disabled:hover:bg-accent";

export const BTN_SECONDARY =
  "inline-flex min-h-touch items-center justify-center rounded-md border border-border bg-surface px-5 py-2.5 font-medium text-fg transition-colors hover:border-muted hover:bg-surface-2 active:translate-y-px disabled:opacity-60";

/** Mono eyebrow label used as the file's section headings. */
export const OVERLINE =
  "font-mono text-[11px] font-medium uppercase tracking-widest text-muted";

/** A sheet of the claim file. */
export const CARD = "rounded-lg border border-border bg-surface p-5";
