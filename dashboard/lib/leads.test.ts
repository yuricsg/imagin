import { afterEach, describe, expect, it, vi } from "vitest";
import { getLeads } from "./leads";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getLeads", () => {
  it("returns an honest empty state when the API has no leads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ leads: [], accesses: [] }), { status: 200 }),
      ),
    );
    await expect(getLeads("https://api.example")).resolves.toEqual({
      leads: [],
      accesses: [],
      error: null,
    });
  });

  it("never substitutes mock leads when the API is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    const result = await getLeads("https://api.example");
    expect(result.leads).toEqual([]);
    expect(result.accesses).toEqual([]);
    expect(result.error).toContain("status 503");
  });

  it("maps attribution, status, progress and conversation events", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            accesses: [
              {
                id: "session-1",
                botId: "bot-1",
                clientId: "client-1",
                openedAt: "2026-07-14T12:00:00.000Z",
              },
            ],
            leads: [
              {
                id: "lead-1",
                sessionId: "session-1",
                botId: "bot-1",
                clientId: "client-1",
                name: "Maria",
                status: "appointment_requested",
                intent: "schedule_exam",
                selectedExams: ["Ecocardiograma"],
                source: {
                  pageUrl: "https://client.example",
                  utm: { source: "google", campaign: "cardio" },
                  clickIds: { gclid: "click-1" },
                },
                classification: {
                  primary: "Agendamento de exame",
                  details: [{ label: "Exames", value: "Ecocardiograma" }],
                },
                progress: {
                  currentStep: "medicalRequest",
                  openedAt: "2026-07-14T12:00:00.000Z",
                },
                events: [
                  {
                    id: "event-1",
                    type: "chat_opened",
                    createdAt: "2026-07-14T12:00:00.000Z",
                  },
                ],
                createdAt: "2026-07-14T12:00:00.000Z",
                updatedAt: "2026-07-14T12:05:00.000Z",
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    const result = await getLeads("https://api.example");
    expect(result.accesses).toHaveLength(1);
    expect(result.leads[0]).toMatchObject({
      name: "Maria",
      status: "appointment_requested",
      sourceUrl: "https://client.example",
      attribution: { channel: "google", utmCampaign: "cardio" },
      progress: { currentStep: "medicalRequest" },
    });
    expect(result.leads[0].events[0].type).toBe("chat_opened");
  });
});
