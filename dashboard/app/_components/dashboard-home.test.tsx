import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardData } from "@/lib/dashboard";
import { computeMetrics } from "@/lib/metrics";
import { computeBotActivity } from "@/lib/metrics";
import { chatbotCatalog } from "@/lib/chatbots/catalog";
import type { Chatbot, Lead } from "@/lib/chatbots/types";
import { DashboardHome } from "./dashboard-home";

const NOW_MS = Date.parse("2026-07-05T12:00:00.000Z");
const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
}));

function makeData(overrides: Partial<DashboardData> = {}): DashboardData {
  const base: DashboardData = {
    bots: [],
    clients: [],
    leads: [],
    accesses: [],
    dataError: null,
    metrics: computeMetrics([], []),
    botActivity: {},
    dbBotIds: [],
    nowMs: NOW_MS,
  };
  return { ...base, ...overrides };
}

function makeLead(overrides: Partial<Lead> = {}): Lead {
  const createdAt = overrides.createdAt ?? "2026-07-05T10:00:00.000Z";
  return {
    id: "lead-1",
    leadId: "lead-1",
    sessionId: "session-1",
    botId: "dra-renata-reis",
    clientId: "clinica-renata",
    name: "Maria Real",
    email: "maria@example.com",
    phone: "87999990000",
    status: "new",
    intent: "schedule_exam",
    selectedExams: ["Ecocardiograma"],
    medicalRequestStatus: "Sim",
    consultationNeed: null,
    consultationDecision: null,
    customFields: null,
    answers: { examSelection: ["Ecocardiograma"] },
    whatsappMessage: "Mensagem real",
    whatsappUrl: "https://wa.me/5587999990000",
    message: "Agendamento de exame",
    sourceUrl: "https://cliente.example/cardio",
    source: { pageUrl: "https://cliente.example/cardio" },
    attribution: {
      channel: "google",
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "cardio",
    },
    classification: {
      primary: "Agendamento de exame",
      details: [{ label: "Exames", value: "Ecocardiograma" }],
    },
    progress: {
      currentStep: "medicalRequest",
      openedAt: createdAt,
      lastActivityAt: createdAt,
      completedAt: null,
      whatsappClickedAt: null,
      appointmentRequestedAt: null,
      convertedAt: null,
    },
    events: [
      {
        id: "event-1",
        type: "chat_opened",
        createdAt,
      },
    ],
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
  pushMock.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("DashboardHome — navegação do wizard", () => {
  it("links Novo chatbot to the dedicated create page", () => {
    render(<DashboardHome data={makeData()} />);

    const link = screen.getByRole("link", { name: /Novo chatbot/i });
    expect(link).toHaveAttribute("href", "/chatbots/new");
  });

  it("shows empty-state CTA linking to create page", () => {
    render(<DashboardHome data={makeData()} />);

    const link = screen.getByRole("link", { name: /Criar primeiro chatbot/i });
    expect(link).toHaveAttribute("href", "/chatbots/new");
  });

  it("navigates to edit page for a local bot", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      "imagin:chatbots",
      JSON.stringify([
        {
          id: "dr-caio-costa",
          name: "Dr. Caio Costa",
          clientId: "clinica-costa",
          clientName: "Clínica Costa",
          status: "active",
          specialty: "Ortopedia",
          accent: "indigo",
          createdAt: "2026-01-01T00:00:00.000Z",
          embed: {
            apiBaseUrl: "https://api.imagin.app",
            appBaseUrl: "https://app.imagin.app",
            scriptPath: "/embed/widget.js",
          },
          flow: {
            templateId: "patient-capture",
            tone: "friendly",
            greeting: "",
            collectFields: ["name", "phone"],
            services: [],
            insuranceMode: "both",
            insurances: [],
          },
          tracking: { gaMeasurementId: "", metaPixelId: "" },
          whatsapp: {
            enabled: false,
            phoneNumber: "",
            messageTemplate: "",
          },
        },
      ]),
    );

    render(<DashboardHome data={makeData()} />);

    await user.click(
      screen.getByRole("button", { name: /Editar Dr\. Caio Costa/i }),
    );

    expect(pushMock).toHaveBeenCalledWith("/chatbots/dr-caio-costa/edit");
  });

  it("opens edit navigation for a legacy bot saved without flow or tracking", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      "imagin:chatbots",
      JSON.stringify([
        {
          id: "legacy-bot",
          name: "Bot Legado",
          clientId: "cliente-legado",
          clientName: "Cliente Legado",
          status: "active",
          specialty: "Suporte",
          accent: "indigo",
          createdAt: "2026-01-01T00:00:00.000Z",
          embed: {
            apiBaseUrl: "https://api.imagin.app",
            appBaseUrl: "https://app.imagin.app",
            scriptPath: "/embed/widget.js",
          },
        },
      ]),
    );

    render(<DashboardHome data={makeData()} />);

    await user.click(
      screen.getByRole("button", { name: "Editar Bot Legado" }),
    );

    expect(pushMock).toHaveBeenCalledWith("/chatbots/legacy-bot/edit");
  });

  it("deletes a created bot after confirmation", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      "imagin:chatbots",
      JSON.stringify([
        {
          id: "bot-temp",
          name: "Bot Temp",
          clientId: "cliente-temp",
          clientName: "Cliente Temp",
          status: "active",
          specialty: "Suporte",
          accent: "indigo",
          createdAt: "2026-01-01T00:00:00.000Z",
          embed: {
            apiBaseUrl: "https://api.imagin.app",
            appBaseUrl: "https://app.imagin.app",
            scriptPath: "/embed/widget.js",
          },
          flow: {
            templateId: "patient-capture",
            tone: "friendly",
            greeting: "",
            collectFields: ["name", "phone"],
            services: [],
            insuranceMode: "both",
            insurances: [],
          },
          tracking: { gaMeasurementId: "", metaPixelId: "" },
          whatsapp: {
            enabled: false,
            phoneNumber: "",
            messageTemplate: "",
          },
        },
      ]),
    );

    render(<DashboardHome data={makeData()} />);

    await user.click(screen.getByRole("button", { name: "Excluir Bot Temp" }));
    const confirm = screen.getByRole("alertdialog", { name: /Excluir chatbot/i });
    await user.click(within(confirm).getByRole("button", { name: "Excluir" }));

    expect(
      screen.queryByRole("button", { name: "Excluir Bot Temp" }),
    ).not.toBeInTheDocument();
    expect(
      JSON.parse(window.localStorage.getItem("imagin:chatbots") ?? "[]"),
    ).toEqual([]);
  });
});

describe("DashboardHome — funil real", () => {
  const firstBot = chatbotCatalog[0];
  const secondBot: Chatbot = {
    ...firstBot,
    id: "bot-2",
    name: "Bot Dois",
    clientId: "cliente-2",
    clientName: "Cliente Dois",
  };

  function funnelData(): DashboardData {
    const leads = [
      makeLead(),
      makeLead({
        id: "lead-2",
        leadId: "lead-2",
        sessionId: "session-2",
        botId: secondBot.id,
        clientId: secondBot.clientId,
        name: "João Real",
        createdAt: "2026-06-20T10:00:00.000Z",
        updatedAt: "2026-06-20T10:00:00.000Z",
      }),
    ];
    const accesses = [
      { id: "a1", botId: firstBot.id, clientId: firstBot.clientId, openedAt: "2026-07-05T09:00:00.000Z" },
      { id: "a2", botId: firstBot.id, clientId: firstBot.clientId, openedAt: "2026-07-05T10:00:00.000Z" },
      { id: "a3", botId: secondBot.id, clientId: secondBot.clientId, openedAt: "2026-06-20T10:00:00.000Z" },
    ];
    return makeData({
      bots: [firstBot, secondBot],
      leads,
      accesses,
      metrics: computeMetrics(leads, accesses),
      botActivity: Object.fromEntries(computeBotActivity(leads)),
    });
  }

  it("updates top metrics for the selected chatbot", async () => {
    const user = userEvent.setup();
    render(<DashboardHome data={funnelData()} />);
    const accessesCard = screen.getByText("Acessos").closest("div.rounded-2xl");
    expect(accessesCard).not.toBeNull();
    expect(within(accessesCard as HTMLElement).getByText("3")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: `${firstBot.name}, ${firstBot.clientName}`,
      }),
    );
    expect(within(accessesCard as HTMLElement).getByText("2")).toBeInTheDocument();
  });

  it("filters metrics and leads with calendar start and end dates", () => {
    render(<DashboardHome data={funnelData()} />);
    fireEvent.change(screen.getByLabelText("Data inicial"), {
      target: { value: "2026-07-01" },
    });
    fireEvent.change(screen.getByLabelText("Data final"), {
      target: { value: "2026-07-05" },
    });
    expect(screen.getByText("1 no período")).toBeInTheDocument();
    expect(screen.queryByText("João Real")).not.toBeInTheDocument();
  });

  it("opens a modal with source, answers and flow progress", async () => {
    const user = userEvent.setup();
    render(<DashboardHome data={funnelData()} />);
    await user.click(screen.getAllByRole("button", { name: "Maria Real" })[0]);
    const modal = screen.getByRole("dialog", { name: "Maria Real" });
    expect(within(modal).getByText("https://cliente.example/cardio")).toBeInTheDocument();
    expect(within(modal).getAllByText("Ecocardiograma").length).toBeGreaterThan(0);
    expect(within(modal).getByText("medicalRequest")).toBeInTheDocument();
  });

  it("shows API failure without substituting fictitious leads", () => {
    render(<DashboardHome data={makeData({ dataError: "API indisponível." })} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Nenhum dado fictício");
    expect(screen.queryByText("Camila Andrade")).not.toBeInTheDocument();
  });
});
