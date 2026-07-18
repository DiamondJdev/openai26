import { INVESTIGATION_LIMITS } from "./constants";
import { resolvePublicBaseUrl } from "./deployment-env";

export { requireDeploymentEnv, resolvePublicBaseUrl } from "./deployment-env";

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
    publicBaseUrl: resolvePublicBaseUrl(process.env),
    databaseUrl: process.env.DATABASE_URL ?? "",
    dataDir: process.env.CLAIMLENS_DATA_DIR ?? ".data",
    dbPath: process.env.CLAIMLENS_DB_PATH ?? "",
    manifestPath: process.env.CLAIMLENS_MANIFEST_PATH ?? "fixtures/manifest.json",
    // Env may only tighten the guardrails, never exceed the hard caps.
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
