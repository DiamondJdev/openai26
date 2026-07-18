import type { Visit } from "./models";

/**
 * Select the most recent visit from a list. Pure and non-mutating. Ties on
 * `occurredAt` are broken deterministically by descending id, matching the
 * repository query so in-memory and SQL selection never disagree.
 */
export function selectLatestVisit(visits: readonly Visit[]): Visit | null {
  if (visits.length === 0) return null;
  return visits.reduce((best, candidate) => {
    if (candidate.occurredAt > best.occurredAt) return candidate;
    if (candidate.occurredAt === best.occurredAt && candidate.id > best.id) {
      return candidate;
    }
    return best;
  });
}
