const MIN_PLATE_LENGTH = 2;
const MAX_PLATE_LENGTH = 10;

/**
 * Normalize a license plate for indexing and lookup: uppercase and strip every
 * non-alphanumeric character (spaces, dashes, dots, punctuation). Deterministic
 * and idempotent. Returns an empty string when nothing alphanumeric remains.
 *
 * Ambiguous characters (O/0, I/1) are intentionally NOT collapsed — doing so
 * could merge two genuinely different plates and misattribute a visit.
 */
export function normalizePlate(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export type PlateValidation =
  | { readonly ok: true; readonly normalized: string }
  | { readonly ok: false; readonly error: string };

/**
 * Validate manager-entered plate input at the system boundary and return the
 * normalized form. A single user-facing message is used for every rejection so
 * the error does not reveal which rule tripped.
 */
export function validatePlate(raw: string): PlateValidation {
  const normalized = normalizePlate(raw);
  if (
    normalized.length < MIN_PLATE_LENGTH ||
    normalized.length > MAX_PLATE_LENGTH
  ) {
    return { ok: false, error: "Enter a valid license plate." };
  }
  return { ok: true, normalized };
}
