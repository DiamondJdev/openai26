import { PIN_POLICY } from "@/lib/config/constants";

export interface ThrottleState {
  readonly failedAttempts: number;
  readonly lockedUntil: string | null;
}

export interface LockStatus {
  readonly locked: boolean;
  readonly retryAfterMs: number;
}

/** Whether PIN attempts are currently locked out, and for how long. */
export function lockStatus(state: ThrottleState, nowMs: number): LockStatus {
  if (state.lockedUntil !== null) {
    const until = Date.parse(state.lockedUntil);
    if (Number.isFinite(until) && nowMs < until) {
      return { locked: true, retryAfterMs: until - nowMs };
    }
  }
  return { locked: false, retryAfterMs: 0 };
}

/**
 * Next throttle state after a failed PIN attempt. On reaching the max, a lockout
 * window opens and the counter resets so the customer gets a fresh set of
 * attempts once the window elapses.
 */
export function afterFailure(state: ThrottleState, nowMs: number): ThrottleState {
  const attempts = state.failedAttempts + 1;
  if (attempts >= PIN_POLICY.maxFailedAttempts) {
    return {
      failedAttempts: 0,
      lockedUntil: new Date(nowMs + PIN_POLICY.lockoutMs).toISOString(),
    };
  }
  return { failedAttempts: attempts, lockedUntil: null };
}

/** Reset throttle state after a successful PIN verification. */
export function afterSuccess(): ThrottleState {
  return { failedAttempts: 0, lockedUntil: null };
}
