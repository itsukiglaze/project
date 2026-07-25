// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AuthFailureCategory } from "@/components/providers/auth-provider";

const mockUseAuth = vi.fn();

vi.mock("@/components/providers/auth-provider", async () => {
  const actual =
    await vi.importActual<typeof import("@/components/providers/auth-provider")>(
      "@/components/providers/auth-provider",
    );
  return { ...actual, useAuth: () => mockUseAuth() };
});
vi.mock("@/components/auth/telegram-login-widget", () => ({
  TelegramLoginWidget: () => <div data-testid="login-widget" />,
}));
vi.mock("@/features/resource-snapshots/api", () => ({
  fetchLatestSnapshot: () => Promise.resolve({ status: "success", data: { snapshot: null } }),
  fetchSnapshotHistory: () => Promise.resolve({ status: "success", data: { snapshots: [] } }),
  saveSnapshot: vi.fn(),
  deleteSnapshot: vi.fn(),
}));

import HomePage from "./page";

function authValue(overrides: Record<string, unknown> = {}) {
  return {
    status: "error",
    user: null,
    errorCode: null,
    authFailureCategory: null,
    launchPath: null,
    retry: vi.fn(),
    completeLoginWidgetAuth: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("HomePage — error states", () => {
  it("shows the exact required message for EMPTY_INIT_DATA", () => {
    mockUseAuth.mockReturnValue(
      authValue({ errorCode: "EMPTY_INIT_DATA", authFailureCategory: "EMPTY_INIT_DATA" as AuthFailureCategory }),
    );
    render(<HomePage />);
    expect(
      screen.getByText(
        "Этот клиент Telegram не передал безопасные данные авторизации. Откройте приложение в официальном клиенте Telegram или используйте безопасный вход через браузер.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the login widget fallback for EMPTY_INIT_DATA", () => {
    mockUseAuth.mockReturnValue(
      authValue({ errorCode: "EMPTY_INIT_DATA", authFailureCategory: "EMPTY_INIT_DATA" as AuthFailureCategory }),
    );
    render(<HomePage />);
    expect(screen.getByTestId("login-widget")).toBeInTheDocument();
  });

  it("shows the login widget fallback for NO_TELEGRAM (ordinary browser)", () => {
    mockUseAuth.mockReturnValue(
      authValue({ errorCode: "MISSING_INIT_DATA", authFailureCategory: "NO_TELEGRAM" as AuthFailureCategory }),
    );
    render(<HomePage />);
    expect(screen.getByTestId("login-widget")).toBeInTheDocument();
  });

  it("does NOT show the login widget fallback for a rejected signature (fallback wouldn't help)", () => {
    mockUseAuth.mockReturnValue(
      authValue({
        errorCode: "SIGNATURE_MISMATCH",
        authFailureCategory: "INIT_DATA_REJECTED" as AuthFailureCategory,
      }),
    );
    render(<HomePage />);
    expect(screen.queryByTestId("login-widget")).not.toBeInTheDocument();
  });

  it("does NOT show the login widget fallback for a backend failure", () => {
    mockUseAuth.mockReturnValue(
      authValue({ errorCode: "INTERNAL_ERROR", authFailureCategory: "BACKEND_ERROR" as AuthFailureCategory }),
    );
    render(<HomePage />);
    expect(screen.queryByTestId("login-widget")).not.toBeInTheDocument();
  });

  it("shows the loading skeleton while status is loading", () => {
    mockUseAuth.mockReturnValue(authValue({ status: "loading" }));
    const { container } = render(<HomePage />);
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("shows authenticated content when status is authenticated", () => {
    mockUseAuth.mockReturnValue(
      authValue({
        status: "authenticated",
        user: { id: "u1", firstName: "Anya", username: null, timezone: "Europe/Berlin" },
      }),
    );
    render(<HomePage />);
    expect(screen.getByText("Anya")).toBeInTheDocument();
  });

  it("renders the resource-balance card for an authenticated user", async () => {
    mockUseAuth.mockReturnValue(
      authValue({
        status: "authenticated",
        user: { id: "u1", firstName: "Anya", username: null, timezone: "Europe/Berlin" },
      }),
    );
    render(<HomePage />);
    expect(await screen.findByRole("heading", { name: "Баланс ресурсов сегодня" })).toBeInTheDocument();
  });
});
