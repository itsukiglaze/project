import type { CalendarApiResult } from "./api";

export type MutationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success" }
  | { status: "stale_state"; current: unknown }
  | { status: "idempotency_key_reused" }
  | { status: "invalid_occurrence"; errors: string[] }
  | { status: "validation_error"; message: string; fieldErrors?: Record<string, string[]> }
  | { status: "auth_error"; message: string }
  | { status: "not_found" }
  | { status: "network_error" }
  | { status: "unknown_error"; message: string };

export function mapMutationError<T>(
  result: Exclude<CalendarApiResult<T>, { status: "success" }>,
): MutationState {
  switch (result.status) {
    case "stale_state":
      return { status: "stale_state", current: result.current };
    case "idempotency_key_reused":
      return { status: "idempotency_key_reused" };
    case "invalid_occurrence":
      return { status: "invalid_occurrence", errors: result.errors };
    case "validation_error":
      return { status: "validation_error", message: result.message, fieldErrors: result.fieldErrors };
    case "auth_error":
      return { status: "auth_error", message: result.message };
    case "not_found":
      return { status: "not_found" };
    case "network_error":
      return { status: "network_error" };
    case "unknown_error":
      return { status: "unknown_error", message: result.message };
  }
}
