// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockFetchResourceSnapshot = vi.fn();
const mockSaveResourceSnapshot = vi.fn();

vi.mock("./api", () => ({
  fetchResourceSnapshot: (...args: unknown[]) => mockFetchResourceSnapshot(...args),
  saveResourceSnapshot: (...args: unknown[]) => mockSaveResourceSnapshot(...args),
}));

import { useResourceForm } from "./use-resource-form";

const INITIAL = { polychrome: 160, monochrome: 0, encryptedMasterTape: 1, masterTape: 0, boopon: 0 };
const VERSIONED_INITIAL = { ...INITIAL, version: 3 };

describe("useResourceForm", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads the current snapshot and version on mount", async () => {
    mockFetchResourceSnapshot.mockResolvedValue({ status: "success", data: VERSIONED_INITIAL });
    const { result } = renderHook(() => useResourceForm());

    await waitFor(() => expect(result.current.phase).toBe("editing"));
    expect(result.current.draft.polychrome).toBe("160");
  });

  it("shows a load error when the initial fetch fails", async () => {
    mockFetchResourceSnapshot.mockResolvedValue({ status: "network_error" });
    const { result } = renderHook(() => useResourceForm());

    await waitFor(() => expect(result.current.phase).toBe("load_error"));
  });

  it("computes a diff preview only for changed fields", async () => {
    mockFetchResourceSnapshot.mockResolvedValue({ status: "success", data: VERSIONED_INITIAL });
    const { result } = renderHook(() => useResourceForm());
    await waitFor(() => expect(result.current.phase).toBe("editing"));

    act(() => result.current.updateField("polychrome", "320"));
    act(() => result.current.openPreview());

    expect(result.current.phase).toBe("previewing");
    expect(result.current.previewChanges).toEqual([
      { field: "polychrome", previous: 160, next: 320 },
    ]);
  });

  it("sends the loaded version as expectedVersion when saving", async () => {
    mockFetchResourceSnapshot.mockResolvedValue({ status: "success", data: VERSIONED_INITIAL });
    mockSaveResourceSnapshot.mockResolvedValue({
      status: "success",
      data: { previous: INITIAL, updated: { ...INITIAL, polychrome: 320 }, changed: [], version: 4, replay: false },
    });

    const { result } = renderHook(() => useResourceForm());
    await waitFor(() => expect(result.current.phase).toBe("editing"));

    act(() => result.current.updateField("polychrome", "320"));
    act(() => result.current.openPreview());
    await act(async () => {
      await result.current.confirmSave();
    });

    expect(mockSaveResourceSnapshot.mock.calls[0][1]).toBe(3); // expectedVersion from load
  });

  it("reuses the same idempotency key when retrying after a failed save with the SAME payload", async () => {
    mockFetchResourceSnapshot.mockResolvedValue({ status: "success", data: VERSIONED_INITIAL });
    mockSaveResourceSnapshot
      .mockResolvedValueOnce({ status: "network_error" })
      .mockResolvedValueOnce({
        status: "success",
        data: { previous: INITIAL, updated: { ...INITIAL, polychrome: 320 }, changed: [], version: 4, replay: false },
      });

    const { result } = renderHook(() => useResourceForm());
    await waitFor(() => expect(result.current.phase).toBe("editing"));

    act(() => result.current.updateField("polychrome", "320"));
    act(() => result.current.openPreview());

    await act(async () => {
      await result.current.confirmSave();
    });
    expect(result.current.phase).toBe("save_error");

    await act(async () => {
      await result.current.confirmSave(); // retry, same payload
    });
    expect(result.current.phase).toBe("saved");

    const firstKey = mockSaveResourceSnapshot.mock.calls[0][2];
    const secondKey = mockSaveResourceSnapshot.mock.calls[1][2];
    expect(firstKey).toBe(secondKey);
  });

  it("generates a NEW idempotency key if the payload changes before retrying", async () => {
    mockFetchResourceSnapshot.mockResolvedValue({ status: "success", data: VERSIONED_INITIAL });
    mockSaveResourceSnapshot.mockResolvedValue({ status: "network_error" });

    const { result } = renderHook(() => useResourceForm());
    await waitFor(() => expect(result.current.phase).toBe("editing"));

    act(() => result.current.updateField("polychrome", "320"));
    act(() => result.current.openPreview());
    await act(async () => {
      await result.current.confirmSave();
    });
    expect(result.current.phase).toBe("save_error");
    const firstKey = mockSaveResourceSnapshot.mock.calls[0][2];

    // Edit the payload, then re-preview and save again.
    act(() => result.current.updateField("polychrome", "640"));
    expect(result.current.phase).toBe("editing"); // editing invalidated the stale preview
    act(() => result.current.openPreview());
    await act(async () => {
      await result.current.confirmSave();
    });

    const secondKey = mockSaveResourceSnapshot.mock.calls[1][2];
    expect(secondKey).not.toBe(firstKey);
  });

  it("handles a STALE_STATE conflict by prompting a reload rather than silently retrying", async () => {
    mockFetchResourceSnapshot.mockResolvedValue({ status: "success", data: VERSIONED_INITIAL });
    mockSaveResourceSnapshot.mockResolvedValue({ status: "conflict", currentVersion: 9, current: {} });

    const { result } = renderHook(() => useResourceForm());
    await waitFor(() => expect(result.current.phase).toBe("editing"));

    act(() => result.current.updateField("polychrome", "320"));
    act(() => result.current.openPreview());
    await act(async () => {
      await result.current.confirmSave();
    });

    expect(result.current.phase).toBe("conflict");
  });

  it("reloadAfterConflict refetches and returns to editing with the new baseline/version", async () => {
    mockFetchResourceSnapshot
      .mockResolvedValueOnce({ status: "success", data: VERSIONED_INITIAL })
      .mockResolvedValueOnce({ status: "success", data: { ...INITIAL, polychrome: 999, version: 9 } });
    mockSaveResourceSnapshot.mockResolvedValue({ status: "conflict", currentVersion: 9, current: {} });

    const { result } = renderHook(() => useResourceForm());
    await waitFor(() => expect(result.current.phase).toBe("editing"));

    act(() => result.current.updateField("polychrome", "320"));
    act(() => result.current.openPreview());
    await act(async () => {
      await result.current.confirmSave();
    });
    expect(result.current.phase).toBe("conflict");

    await act(async () => {
      await result.current.reloadAfterConflict();
    });

    expect(result.current.phase).toBe("editing");
    expect(result.current.draft.polychrome).toBe("999");
  });

  it("editing a field after a preview marks the preview stale (back to editing)", async () => {
    mockFetchResourceSnapshot.mockResolvedValue({ status: "success", data: VERSIONED_INITIAL });
    const { result } = renderHook(() => useResourceForm());
    await waitFor(() => expect(result.current.phase).toBe("editing"));

    act(() => result.current.openPreview());
    expect(result.current.phase).toBe("previewing");

    act(() => result.current.updateField("boopon", "5"));
    expect(result.current.phase).toBe("editing");
  });
});
