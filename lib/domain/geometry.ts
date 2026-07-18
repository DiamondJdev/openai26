/** A region box in normalized [0,1] coordinates relative to a frame. */
export interface NormalizedBBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const EPSILON = 0.0001;

/** True when the box is finite, positive, and fully inside the unit square. */
export function isValidBBox(bbox: NormalizedBBox): boolean {
  const nums = [bbox.x, bbox.y, bbox.w, bbox.h];
  if (nums.some((n) => typeof n !== "number" || !Number.isFinite(n))) {
    return false;
  }
  if (bbox.w <= 0 || bbox.h <= 0) return false;
  if (bbox.x < 0 || bbox.y < 0) return false;
  if (bbox.x + bbox.w > 1 + EPSILON) return false;
  if (bbox.y + bbox.h > 1 + EPSILON) return false;
  return true;
}
