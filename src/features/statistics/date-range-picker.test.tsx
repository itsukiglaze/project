// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/features/calendar/local-date-client", () => ({
  getTodayLocalDate: () => ({ year: 2026, month: 1, day: 15 }),
}));

import { DateRangePicker } from "./date-range-picker";

const FROM = { year: 2026, month: 1, day: 1 };
const TO = { year: 2026, month: 1, day: 31 };

describe("DateRangePicker", () => {
  it("±7 дней applies a symmetric range around today", async () => {
    const onChange = vi.fn();
    render(<DateRangePicker from={FROM} to={TO} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "±7 дней" }));
    expect(onChange).toHaveBeenCalledWith(
      { year: 2026, month: 1, day: 8 },
      { year: 2026, month: 1, day: 22 },
    );
  });

  it("±30 дней applies a symmetric 60-day range around today", async () => {
    const onChange = vi.fn();
    render(<DateRangePicker from={FROM} to={TO} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "±30 дней" }));
    expect(onChange).toHaveBeenCalledWith(
      { year: 2025, month: 12, day: 16 },
      { year: 2026, month: 2, day: 14 },
    );
  });

  it("Этот месяц applies the first-to-last day of today's month", async () => {
    const onChange = vi.fn();
    render(<DateRangePicker from={FROM} to={TO} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Этот месяц" }));
    expect(onChange).toHaveBeenCalledWith(
      { year: 2026, month: 1, day: 1 },
      { year: 2026, month: 1, day: 31 },
    );
  });

  it("applies a valid custom range", async () => {
    const onChange = vi.fn();
    render(<DateRangePicker from={FROM} to={TO} onChange={onChange} />);

    const fromInput = screen.getByLabelText("С");
    const toInput = screen.getByLabelText("По");
    await userEvent.clear(fromInput);
    await userEvent.type(fromInput, "2026-03-01");
    await userEvent.clear(toInput);
    await userEvent.type(toInput, "2026-03-10");
    await userEvent.click(screen.getByRole("button", { name: /применить период/i }));

    expect(onChange).toHaveBeenCalledWith(
      { year: 2026, month: 3, day: 1 },
      { year: 2026, month: 3, day: 10 },
    );
  });

  it("rejects a custom range where from > to, without calling onChange", async () => {
    const onChange = vi.fn();
    render(<DateRangePicker from={FROM} to={TO} onChange={onChange} />);

    const fromInput = screen.getByLabelText("С");
    const toInput = screen.getByLabelText("По");
    await userEvent.clear(fromInput);
    await userEvent.type(fromInput, "2026-03-10");
    await userEvent.clear(toInput);
    await userEvent.type(toInput, "2026-03-01");
    await userEvent.click(screen.getByRole("button", { name: /применить период/i }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/начальная дата должна быть раньше/i);
  });

  it("rejects a custom range exceeding the maximum span, without calling onChange", async () => {
    const onChange = vi.fn();
    render(<DateRangePicker from={FROM} to={TO} onChange={onChange} />);

    const fromInput = screen.getByLabelText("С");
    const toInput = screen.getByLabelText("По");
    await userEvent.clear(fromInput);
    await userEvent.type(fromInput, "2020-01-01");
    await userEvent.clear(toInput);
    await userEvent.type(toInput, "2026-01-01");
    await userEvent.click(screen.getByRole("button", { name: /применить период/i }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/не может превышать/i);
  });

  it("all preset and apply buttons meet the 44px touch-target minimum", () => {
    render(<DateRangePicker from={FROM} to={TO} onChange={vi.fn()} />);
    for (const button of screen.getAllByRole("button")) {
      expect(button.className).toMatch(/\bmin-h-11\b/);
    }
  });
});
