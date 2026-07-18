/** Current time as an ISO-8601 string. Wrapped so it can be stubbed in tests. */
export function nowIso(): string {
  return new Date().toISOString();
}
