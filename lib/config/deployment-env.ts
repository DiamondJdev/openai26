export type Environment = Record<string, string | undefined>;

function requiredValue(env: Environment, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function resolvePublicBaseUrl(env: Environment): string {
  const explicit = env.CLAIMLENS_PUBLIC_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercelUrl = env.VERCEL_URL?.trim();
  return vercelUrl ? `https://${vercelUrl}` : "http://localhost:3000";
}

export function requireDeploymentEnv(env: Environment): void {
  requiredValue(env, "EMPLOYEE_USERNAME");
  requiredValue(env, "EMPLOYEE_PASSWORD");
  requiredValue(env, "DATABASE_URL");

  const hasBlobToken = Boolean(env.BLOB_READ_WRITE_TOKEN?.trim());
  const hasVercelBlobCredentials = Boolean(
    env.VERCEL_OIDC_TOKEN?.trim() && env.BLOB_STORE_ID?.trim(),
  );
  if (!hasBlobToken && !hasVercelBlobCredentials) {
    throw new Error(
      "Missing required Blob configuration: BLOB_READ_WRITE_TOKEN or VERCEL_OIDC_TOKEN and BLOB_STORE_ID",
    );
  }
}
