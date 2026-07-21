import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { Chatbot } from "@/lib/chatbots/types";
import { buildChatbot } from "@/lib/chatbots/create";
import { BotReportClient } from "./bot-report";

function makeBot(id: string, name: string): Chatbot {
  const bot = buildChatbot(
    {
      name,
      flowName: "",
      clientName: "Clínica Teste",
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
    },
    new Set(),
  );
  return { ...bot, id };
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("BotReportClient", () => {
  it("renders the report for a bot present in the server list", () => {
    const bot = makeBot("dra-renata-reis", "Dra. Renata Reis");
    render(
      <BotReportClient
        botId={bot.id}
        serverBots={[bot]}
        leads={[]}
        accesses={[]}
        nowMs={Date.now()}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Dra. Renata Reis" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Chatbot não encontrado")).not.toBeInTheDocument();
  });

  it("falls back to a localStorage-only bot missing from the server list", () => {
    const bot = makeBot("dra-maria-souza", "Dra. Maria Souza");
    window.localStorage.setItem("imagin:chatbots", JSON.stringify([bot]));

    render(
      <BotReportClient
        botId="dra-maria-souza"
        serverBots={[]}
        leads={[]}
        accesses={[]}
        nowMs={Date.now()}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Dra. Maria Souza" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Chatbot não encontrado")).not.toBeInTheDocument();
  });

  it("shows the not-found state when the bot is in neither source", () => {
    render(
      <BotReportClient
        botId="fantasma"
        serverBots={[]}
        leads={[]}
        accesses={[]}
        nowMs={Date.now()}
      />,
    );
    expect(screen.getByText("Chatbot não encontrado")).toBeInTheDocument();
  });
});
