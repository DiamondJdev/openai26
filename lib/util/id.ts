import { randomUUID } from "node:crypto";

/** Generate a globally-unique id for a DB row or evidence artifact. */
export function newId(prefix?: string): string {
  const id = randomUUID();
  return prefix ? `${prefix}_${id}` : id;
}
