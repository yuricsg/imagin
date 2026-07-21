import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPinnedCommands, savePinnedCommands } from "@/lib/api/pins";
import { usePinnedCommands } from "./use-pinned-commands";

vi.mock("@/lib/api/pins", () => ({
  fetchPinnedCommands: vi.fn(),
  savePinnedCommands: vi.fn(),
}));

const fetchPinsMock = vi.mocked(fetchPinnedCommands);
const savePinsMock = vi.mocked(savePinnedCommands);

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe("usePinnedCommands", () => {
  it("hydrates the local cache from the operator API", async () => {
    fetchPinsMock.mockResolvedValue(["open-leads", "new-chatbot"]);

    const { result } = renderHook(() =>
      usePinnedCommands("operador@imagin.test"),
    );

    await waitFor(() => {
      expect(result.current.pinnedIds).toEqual([
        "open-leads",
        "new-chatbot",
      ]);
    });
    expect(fetchPinsMock).toHaveBeenCalledWith("operador@imagin.test");
  });

  it("updates immediately and persists a toggled command", async () => {
    fetchPinsMock.mockResolvedValue([]);
    savePinsMock.mockResolvedValue(["new-chatbot"]);

    const { result } = renderHook(() =>
      usePinnedCommands("atalhos@imagin.test"),
    );
    await waitFor(() => expect(fetchPinsMock).toHaveBeenCalledOnce());

    act(() => result.current.togglePin("new-chatbot"));

    expect(result.current.pinnedIds).toEqual(["new-chatbot"]);
    expect(savePinsMock).toHaveBeenCalledWith("atalhos@imagin.test", [
      "new-chatbot",
    ]);
  });
});
