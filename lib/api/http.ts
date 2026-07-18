import { NextResponse } from "next/server";
import {
  InvalidTransitionError,
  NotFoundError,
  ToolSecurityError,
  ValidationError,
} from "@/lib/domain/errors";

export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
}

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(error: string, status = 400): NextResponse {
  return NextResponse.json({ success: false, error }, { status });
}

/**
 * Map an error to a safe HTTP response. Expected domain errors surface their
 * user-friendly message; anything else becomes a generic 500 that never leaks
 * internal details.
 */
export function handleError(error: unknown): NextResponse {
  if (error instanceof ValidationError) return fail(error.message, 400);
  if (error instanceof NotFoundError) return fail(error.message, 404);
  if (error instanceof InvalidTransitionError) {
    return fail("That action is not available right now.", 409);
  }
  if (error instanceof ToolSecurityError) return fail("Request rejected.", 400);
  return fail("Something went wrong. Please try again.", 500);
}
