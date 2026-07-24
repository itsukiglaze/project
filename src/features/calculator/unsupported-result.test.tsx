// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { UnsupportedResult } from "./unsupported-result";

describe("UnsupportedResult", () => {
  it("13. renders as an informational status, not an alert/error", () => {
    render(<UnsupportedResult reason="Stable Channel не гарантирует конкретную цель." stale={false} />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText(/не гарантирует конкретную цель/i)).toBeInTheDocument();
  });
});
