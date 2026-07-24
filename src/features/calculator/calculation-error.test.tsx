// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalculationError } from "./calculation-error";

describe("CalculationError", () => {
  it("14. renders a server validation error as part of the form, with its message", () => {
    render(
      <CalculationError
        state={{ status: "validation_error", message: "Проверьте введённые данные." }}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Проверьте введённые данные.")).toBeInTheDocument();
  });

  it("15. a network error offers a retry action that re-triggers submission", async () => {
    const onRetry = vi.fn();
    render(<CalculationError state={{ status: "network_error" }} onRetry={onRetry} />);

    await userEvent.click(screen.getByRole("button", { name: /повторить/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
