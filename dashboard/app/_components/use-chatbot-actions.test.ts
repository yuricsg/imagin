import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Chatbot } from "@/lib/chatbots/types";
import {
  buildChatbot,
  getCreatedBots,
  saveCreatedBots,
  type ChatbotInput,
} from "@/lib/chatbots/create";
import { migrateLocalBots } from "./use-chatbot-actions";

const apiCreateChatbot = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/chatbots", () => ({ apiCreateChatbot }));

function makeBot(id: string): Chatbot {
  const input: ChatbotInput = {
    name: id,
    flowName: "",
    clientName: "Clínica",
    specialty: "Cardiologia",
    status: "active",
    accent: "indigo",
    flowTemplateId: "patient-capture",
    flowTone: "friendly",
    flowGreeting: "",
    flowCollectFields: ["name"],
    flowServices: ["Consulta"],
    flowInsuranceMode: "particular",
    flowInsurances: [],
    gaMeasurementId: "",
    metaPixelId: "",
    whatsappEnabled: false,
    whatsappDestinations: [],
    whatsappRoutingQuestion: "",
    whatsappMessageTemplate: "",
    whatsappClosingMessage: "",
    launcherTeaserTexts: ["Olá!"],
    launcherAvatarUrl: null,
    apiBaseUrl: "https://api.imagin.app",
    appBaseUrl: "https://app.imagin.app",
    scriptPath: "/embed/widget.js",
  };
  return { ...buildChatbot(input, new Set()), id };
}

beforeEach(() => {
  apiCreateChatbot.mockReset();
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("migrateLocalBots", () => {
  it("pushes localStorage-only bots to the DB and clears them", async () => {
    saveCreatedBots([makeBot("orfao-1")]);
    apiCreateChatbot.mockResolvedValue(makeBot("orfao-1"));

    const migrated = await migrateLocalBots(new Set());

    expect(migrated).toBe(1);
    expect(apiCreateChatbot).toHaveBeenCalledTimes(1);
    expect(getCreatedBots()).toHaveLength(0);
  });

  it("skips bots already present on the server", async () => {
    saveCreatedBots([makeBot("ja-no-banco")]);

    const migrated = await migrateLocalBots(new Set(["ja-no-banco"]));

    expect(migrated).toBe(0);
    expect(apiCreateChatbot).not.toHaveBeenCalled();
    // Left untouched — the server copy is authoritative, no double write.
    expect(getCreatedBots()).toHaveLength(1);
  });

  it("keeps a bot in localStorage when its migration fails", async () => {
    saveCreatedBots([makeBot("falha")]);
    apiCreateChatbot.mockRejectedValue(new Error("backend dormindo"));

    const migrated = await migrateLocalBots(new Set());

    expect(migrated).toBe(0);
    expect(getCreatedBots().map((b) => b.id)).toEqual(["falha"]);
  });

  it("migrates only the orphans, leaving the failed ones behind", async () => {
    saveCreatedBots([makeBot("ok"), makeBot("ruim")]);
    apiCreateChatbot.mockImplementation(async (bot: Chatbot) => {
      if (bot.id === "ruim") throw new Error("falhou");
      return bot;
    });

    const migrated = await migrateLocalBots(new Set());

    expect(migrated).toBe(1);
    expect(getCreatedBots().map((b) => b.id)).toEqual(["ruim"]);
  });
});
