import { INVESTIGATION_LIMITS } from "./constants";

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Centralized, defaulted environment access. Reading is lazy at call sites so the
 * app and tests boot without a live OpenAI key; the key is required only when an
 * investigation actually runs (validated in the driver, not here).
 */
export function getEnv() {
  return {
    openAiApiKey: process.env.OPENAI_API_KEY ?? "",
    model: process.env.CLAIMLENS_MODEL ?? "gpt-5.6",
    publicBaseUrl:
      process.env.CLAIMLENS_PUBLIC_BASE_URL ?? "http://localhost:3000",
    dataDir: process.env.CLAIMLENS_DATA_DIR ?? ".data",
    dbPath: process.env.CLAIMLENS_DB_PATH ?? "",
    manifestPath: process.env.CLAIMLENS_MANIFEST_PATH ?? "fixtures/manifest.json",
    // Env may only tighten the guardrails, never exceed the hard caps.
    maxToolCalls: Math.min(
      readInt("CLAIMLENS_MAX_TOOL_CALLS", INVESTIGATION_LIMITS.maxToolCalls),
      INVESTIGATION_LIMITS.maxToolCalls,
    ),
    maxInvestigationMs: Math.min(
      readInt(
        "CLAIMLENS_MAX_INVESTIGATION_MS",
        INVESTIGATION_LIMITS.maxInvestigationMs,
      ),
      INVESTIGATION_LIMITS.maxInvestigationMs,
    ),
  };
}

export type AppEnv = ReturnType<typeof getEnv>;
