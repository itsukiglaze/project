import type { SnapshotApiResult } from "./api";

export type MutationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success" }
  | { status: "stale_state"; current: unknown }
  | { status: "idempotency_key_reused" }
  | { status: "validation_error"; message: string; fieldErrors?: Record<string, string[]> }
  | { status: "auth_error"; message: string }
  | { status: "not_found" }
  | { status: "network_error" }
  | { status: "unknown_error"; message: string };

/** A visible reason the last save/delete didn't go through — `null` while idle/loading/success, never a silent no-op. */
export function snapshotMutationErrorMessage(state: MutationState): string | null {
  switch (state.status) {
    case "stale_state":
      return "Не удалось сохранить — баланс за эту дату уже изменился в другом месте. Откройте «История баланса» и попробуйте ещё раз.";
    case "idempotency_key_reused":
      return "Повторная отправка не удалась. Попробуйте ещё раз.";
    case "validation_error":
      return state.message;
    case "auth_error":
      return "Требуется вход через Telegram.";
    case "not_found":
      return "Этот баланс уже был удалён в другом месте.";
    case "network_error":
      return "Не удалось связаться с сервером. Проверьте соединение и попробуйте снова.";
    case "unknown_error":
      return state.message;
    default:
      return null;
  }
}

export function mapMutationError<T>(
  result: Exclude<SnapshotApiResult<T>, { status: "success" }>,
): MutationState {
  switch (result.status) {
    case "stale_state":
      return { status: "stale_state", current: result.current };
    case "idempotency_key_reused":
      return { status: "idempotency_key_reused" };
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
