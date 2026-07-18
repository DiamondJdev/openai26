import type { Config } from "tailwindcss";

/**
 * Design tokens are declared as CSS variables in app/globals.css and referenced
 * here so both Tailwind utilities and raw CSS share one accessible source of truth.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        "surface-2": "var(--color-surface-2)",
        border: "var(--color-border)",
        fg: "var(--color-fg)",
        muted: "var(--color-muted)",
        accent: "var(--color-accent)",
        "accent-hover": "var(--color-accent-hover)",
        "accent-fg": "var(--color-accent-fg)",
        "accent-weak": "var(--color-accent-weak)",
        signal: "var(--color-signal)",
        "signal-strong": "var(--color-signal-strong)",
        "signal-weak": "var(--color-signal-weak)",
        "signal-bright": "var(--color-signal-bright)",
        danger: "var(--color-danger)",
        "danger-weak": "var(--color-danger-weak)",
        success: "var(--color-success)",
        "success-weak": "var(--color-success-weak)",
        warning: "var(--color-warning)",
        "warning-weak": "var(--color-warning-weak)",
        well: "var(--color-well)",
        "well-fg": "var(--color-well-fg)",
        "well-muted": "var(--color-well-muted)",
        "well-line": "var(--color-well-line)",
        "well-surface": "var(--color-well-surface)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      minHeight: {
        touch: "44px",
      },
      minWidth: {
        touch: "44px",
      },
    },
  },
  plugins: [],
};

export default config;
