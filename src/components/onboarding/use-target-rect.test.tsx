// @vitest-environment jsdom
import { useState } from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { useOnboardingTargetRect, type TargetRectState } from "./use-target-rect";
import type { OnboardingTargetId } from "@/lib/onboarding/targets";

// jsdom does not implement ResizeObserver.
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).ResizeObserver = MockResizeObserver;

// jsdom does not implement matchMedia.
window.matchMedia =
  window.matchMedia ??
  ((query: string) =>
    ({
      matches: false,
      media: query,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }) as unknown as MediaQueryList);

function Probe({ targetId, retryToken }: { targetId: OnboardingTargetId | null; retryToken?: number }) {
  const state = useOnboardingTargetRect(targetId, retryToken);
  return <div data-testid="probe-state">{JSON.stringify({ status: state.status })}</div>;
}

function readStatus(): TargetRectState["status"] {
  return JSON.parse(screen.getByTestId("probe-state").textContent ?? "{}").status;
}

afterEach(() => {
  vi.useRealTimers();
  // Several tests append real DOM nodes directly to document.body (outside
  // Testing Library's own render container), so they need their own cleanup.
  document.body.innerHTML = "";
});

describe("useOnboardingTargetRect", () => {
  it("is idle when targetId is null", () => {
    render(<Probe targetId={null} />);
    expect(readStatus()).toBe("idle");
  });

  it("finds an already-rendered target immediately", async () => {
    document.body.innerHTML = '<button data-onboarding-target="settings-tab">Настройки</button>';
    render(<Probe targetId="settings-tab" />);
    await waitFor(() => expect(readStatus()).toBe("found"));
  });

  it("keeps searching, then finds a target that renders after a short delay", async () => {
    render(<Probe targetId="calculator-tab" />);
    expect(readStatus()).toBe("searching");

    const el = document.createElement("button");
    el.setAttribute("data-onboarding-target", "calculator-tab");
    document.body.appendChild(el);

    await waitFor(() => expect(readStatus()).toBe("found"), { timeout: 2000 });
    el.remove();
  });

  it("gives up and reports missing after the bounded search timeout", async () => {
    vi.useFakeTimers();
    render(<Probe targetId="calendar-tab" />);
    expect(readStatus()).toBe("searching");

    await act(async () => {
      vi.advanceTimersByTime(5100);
    });
    expect(readStatus()).toBe("missing");
  });

  it("re-searches when retryToken changes after a missing result", async () => {
    vi.useFakeTimers();
    function Harness() {
      const [retryToken, setRetryToken] = useState(0);
      const state = useOnboardingTargetRect("statistics-tab", retryToken);
      return (
        <div>
          <div data-testid="probe-state">{JSON.stringify({ status: state.status })}</div>
          <button onClick={() => setRetryToken((n) => n + 1)}>retry</button>
        </div>
      );
    }
    render(<Harness />);
    await act(async () => {
      vi.advanceTimersByTime(5100);
    });
    expect(readStatus()).toBe("missing");

    const el = document.createElement("button");
    el.setAttribute("data-onboarding-target", "statistics-tab");
    document.body.appendChild(el);

    vi.useRealTimers();
    await act(async () => {
      screen.getByText("retry").click();
    });
    await waitFor(() => expect(readStatus()).toBe("found"));
    el.remove();
  });

  it("resets to idle when targetId becomes null", async () => {
    document.body.innerHTML = '<button data-onboarding-target="settings-tab">Настройки</button>';
    const { rerender } = render(<Probe targetId="settings-tab" />);
    await waitFor(() => expect(readStatus()).toBe("found"));

    rerender(<Probe targetId={null} />);
    expect(readStatus()).toBe("idle");
  });

  it("scrolls the target into view when it is not fully visible", async () => {
    const el = document.createElement("button");
    el.setAttribute("data-onboarding-target", "settings-tab");
    document.body.appendChild(el);
    const scrollIntoView = vi.fn();
    el.scrollIntoView = scrollIntoView;
    el.getBoundingClientRect = () => ({ top: -50, bottom: 0, left: 0, right: 0, width: 0, height: 50 }) as DOMRect;

    render(<Probe targetId="settings-tab" />);
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
    el.remove();
  });
});
