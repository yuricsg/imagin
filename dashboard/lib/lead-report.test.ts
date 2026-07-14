import { describe, expect, it } from "vitest";
import { buildLeadsCsv, isWithinDateRange, reportFilename } from "./lead-report";
import type { Chatbot, Lead } from "./chatbots/types";

describe("lead report", () => {
  it("includes both calendar boundaries", () => {
    const range = { start: "2026-07-01", end: "2026-07-14" };
    expect(isWithinDateRange("2026-07-01T00:00:00-03:00", range)).toBe(true);
    expect(isWithinDateRange("2026-07-14T23:59:59-03:00", range)).toBe(true);
    expect(isWithinDateRange("2026-06-30T23:59:59-03:00", range)).toBe(false);
  });

  it("escapes CSV data and uses the selected period in the filename", () => {
    const lead = {
      id: "lead-1",
      botId: "bot-1",
      clientId: "client-1",
      name: "Maria, Silva",
      phone: "",
      email: "",
      status: "new",
      message: "",
      sourceUrl: "https://example.test",
      attribution: { channel: "direct", utmSource: null, utmMedium: null, utmCampaign: null },
      classification: { primary: "Consulta", details: [] },
      selectedExams: [],
      intent: null,
      progress: { currentStep: "name", whatsappClickedAt: null },
      createdAt: "2026-07-14T12:00:00.000Z",
      whatsappMessage: null,
    } as Lead;
    const bot = { id: "bot-1", name: "Bot", clientName: "Cliente" } as Chatbot;
    const csv = buildLeadsCsv([lead], { "bot-1": bot });
    expect(csv).toContain('"Maria, Silva"');
    expect(csv).toContain('"Novo"');
    expect(reportFilename({ start: "2026-07-01", end: "2026-07-14" })).toBe(
      "leads-imagin-2026-07-01_a_2026-07-14.csv",
    );
  });
});
