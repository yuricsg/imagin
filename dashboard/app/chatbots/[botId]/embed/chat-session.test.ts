import { describe, expect, it, vi } from "vitest";
import { createChatSessionTracker } from "./chat-session";

describe("createChatSessionTracker", () => {
  it("creates one session and serializes subsequent events", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({
        url: String(input),
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      return new Response(
        calls.length === 1 ? JSON.stringify({ session: { id: "session-1" } }) : "{}",
        { status: calls.length === 1 ? 201 : 200 },
      );
    }) as unknown as typeof fetch;
    const tracker = createChatSessionTracker({
      apiBaseUrl: "https://api.example",
      botId: "bot-1",
      clientId: "client-1",
      source: { pageUrl: "https://client.example" },
      fetcher,
    });

    await Promise.all([
      tracker.ensureSession(),
      tracker.ensureSession(),
      tracker.trackEvent({ type: "name_captured", name: "Guilherme" }),
      tracker.trackEvent({
        type: "intent_selected",
        intent: "schedule_exam",
      }),
    ]);
    await tracker.flush();

    expect(calls).toHaveLength(3);
    expect(calls[0].body).toEqual({
      clientId: "client-1",
      source: { pageUrl: "https://client.example" },
    });
    expect(calls[1].body).toMatchObject({ type: "name_captured" });
    expect(calls[2].body).toMatchObject({ type: "intent_selected" });
  });

  it("does not block the conversation when session tracking is unavailable", async () => {
    const fetcher = vi.fn(async () => new Response("", { status: 503 })) as unknown as typeof fetch;
    const tracker = createChatSessionTracker({
      apiBaseUrl: "https://api.example",
      botId: "bot-1",
      clientId: "client-1",
      source: {},
      fetcher,
    });

    await expect(tracker.trackEvent({ type: "flow_completed" })).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
