import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
      screen.getByRole("button", { name: "Ações de Dr. Caio Costa" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Editar" }));

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
      screen.getByRole("button", { name: "Ações de Bot Legado" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Editar" }));

    expect(pushMock).toHaveBeenCalledWith("/chatbots/legacy-bot/edit");
  });

  it("navigates to the duplication page for a local bot", async () => {
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
      screen.getByRole("button", { name: "Ações de Dr. Caio Costa" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Duplicar" }));

    expect(pushMock).toHaveBeenCalledWith("/chatbots/new?from=dr-caio-costa");
  });

  it("shows the flow name as the list title, falling back to the bot name", async () => {
    const user = userEvent.setup();
    const baseBot = {
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
    };
    window.localStorage.setItem(
      "imagin:chatbots",
      JSON.stringify([
        { ...baseBot, id: "bot-com-fluxo", name: "Assistente", flowName: "Fluxo LP Cardio" },
        { ...baseBot, id: "bot-sem-fluxo", name: "Dr. Sem Fluxo" },
      ]),
    );

    render(<DashboardHome data={makeData()} />);

    // The flow name drives the list title and every aria-label.
    expect(
      screen.getByRole("button", { name: "Fluxo LP Cardio, Clínica Costa" }),
    ).toBeInTheDocument();
    // Actions live behind the always-visible kebab menu.
    await user.click(
      screen.getByRole("button", { name: "Ações de Fluxo LP Cardio" }),
    );
    expect(
      screen.getByRole("menuitem", { name: "Editar" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Duplicar" }),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    // Bots without flowName fall back to the visitor-facing name.
    expect(
      screen.getByRole("button", { name: "Dr. Sem Fluxo, Clínica Costa" }),
    ).toBeInTheDocument();

    // Selecting the bot also shows the flow name in the leads context.
    await user.click(
      screen.getByRole("button", { name: "Fluxo LP Cardio, Clínica Costa" }),
    );
    expect(screen.getByText(/filtrando por Fluxo LP Cardio/)).toBeInTheDocument();
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

    await user.click(
      screen.getByRole("button", { name: "Ações de Bot Temp" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Excluir" }));
    const confirm = screen.getByRole("alertdialog", { name: /Excluir chatbot/i });
    await user.click(within(confirm).getByRole("button", { name: "Excluir" }));

    expect(
      screen.queryByRole("button", { name: "Ações de Bot Temp" }),
    ).not.toBeInTheDocument();
    expect(
      JSON.parse(window.localStorage.getItem("imagin:chatbots") ?? "[]"),
    ).toEqual([]);
  });
});

describe("DashboardHome — menu de ações do chatbot", () => {
  function localBot(overrides: Record<string, unknown> = {}) {
    return {
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
      whatsapp: { enabled: false, phoneNumber: "", messageTemplate: "" },
      ...overrides,
    };
  }

  function seedLocal(bots: object[]) {
    window.localStorage.setItem("imagin:chatbots", JSON.stringify(bots));
  }

  it("keeps the kebab trigger always visible and toggles the menu by click", async () => {
    const user = userEvent.setup();
    seedLocal([localBot()]);
    render(<DashboardHome data={makeData()} />);

    const trigger = screen.getByRole("button", {
      name: "Ações de Dr. Caio Costa",
    });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByRole("menu", { name: "Ações de Dr. Caio Costa" });
    expect(
      within(menu).getByRole("menuitem", { name: "Editar" }),
    ).toHaveFocus();

    await user.click(trigger);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes with Esc returning focus to the trigger, and on outside click", async () => {
    const user = userEvent.setup();
    seedLocal([localBot()]);
    render(<DashboardHome data={makeData()} />);
    const trigger = screen.getByRole("button", {
      name: "Ações de Dr. Caio Costa",
    });

    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("navigates menu items with arrow keys", async () => {
    const user = userEvent.setup();
    seedLocal([localBot()]);
    render(<DashboardHome data={makeData()} />);
    await user.click(
      screen.getByRole("button", { name: "Ações de Dr. Caio Costa" }),
    );

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Duplicar" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Excluir" })).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("menuitem", { name: "Duplicar" })).toHaveFocus();
  });

  it("keeps only one menu open at a time", async () => {
    const user = userEvent.setup();
    seedLocal([localBot(), localBot({ id: "bot-dois", name: "Bot Dois" })]);
    render(<DashboardHome data={makeData()} />);

    await user.click(
      screen.getByRole("button", { name: "Ações de Dr. Caio Costa" }),
    );
    expect(
      screen.getByRole("menu", { name: "Ações de Dr. Caio Costa" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ações de Bot Dois" }));
    expect(
      screen.queryByRole("menu", { name: "Ações de Dr. Caio Costa" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("menu", { name: "Ações de Bot Dois" }),
    ).toBeInTheDocument();
  });

  it("renders no actions menu for non-editable (server) bots", () => {
    render(<DashboardHome data={makeData({ bots: [chatbotCatalog[0]] })} />);
    expect(
      screen.queryByRole("button", { name: /^Ações de / }),
    ).not.toBeInTheDocument();
  });

  it("lists Editar/Duplicar per editable bot in the ⌘K palette", async () => {
    const user = userEvent.setup();
    seedLocal([localBot()]);
    render(<DashboardHome data={makeData()} />);

    await user.keyboard("{Meta>}k{/Meta}");
    const dialog = await screen.findByRole("dialog", {
      name: "Paleta de comandos",
    });
    expect(
      within(dialog).getByRole("option", { name: /Editar Dr\. Caio Costa/ }),
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("option", { name: /Duplicar Dr\. Caio Costa/ }),
    );
    expect(pushMock).toHaveBeenCalledWith("/chatbots/new?from=dr-caio-costa");
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

describe("DashboardHome — respostas do diálogo no modal do lead", () => {
  const dialogueBot: Chatbot = {
    ...chatbotCatalog[0],
    id: "ana-assistente-virtual",
    name: "Ana - Assistente virtual",
    flow: {
      ...chatbotCatalog[0].flow,
      dialogue: {
        version: 1,
        shape: "linear",
        greeting: "",
        startStepId: "step-exames",
        steps: [
          {
            id: "step-exames",
            question: "Quais exames você deseja agendar?",
            inputType: "multi_choice",
            saveAs: "exame",
            options: [
              { id: "opt-mrnnzskh-62", label: "Parecer cardiológico - pré operatório" },
              { id: "opt-mrnnzpxc-61", label: "Teste ergométrico" },
            ],
          },
          {
            id: "step-solicitacao",
            question: "Possui solicitação médica?",
            inputType: "single_choice",
            saveAs: "solicitacao",
            options: [
              { id: "opt-mrno0ong-67", label: "Sim" },
              { id: "opt-nao", label: "Não" },
            ],
          },
        ],
        customSaveLabels: { exame: "Exame", solicitacao: "Solicitação" },
      },
    },
  };

  it("shows option labels instead of internal ids", async () => {
    const user = userEvent.setup();
    const lead = makeLead({
      botId: dialogueBot.id,
      medicalRequestStatus: null,
      answers: {
        "step-exames": ["opt-mrnnzskh-62", "opt-mrnnzpxc-61"],
        "step-solicitacao": "opt-mrno0ong-67",
      },
    });
    render(
      <DashboardHome
        data={makeData({
          bots: [dialogueBot],
          leads: [lead],
          botActivity: Object.fromEntries(computeBotActivity([lead])),
        })}
      />,
    );

    await user.click(screen.getAllByRole("button", { name: "Maria Real" })[0]);
    const modal = screen.getByRole("dialog", { name: "Maria Real" });

    // Values show what the visitor picked — never internal option ids.
    expect(
      within(modal).getByText(
        "Parecer cardiológico - pré operatório, Teste ergométrico",
      ),
    ).toBeInTheDocument();
    expect(within(modal).getByText("Sim")).toBeInTheDocument();
    expect(
      within(modal).queryByText(/opt-mrnnzskh-62|opt-mrnnzpxc-61|opt-mrno0ong-67/),
    ).not.toBeInTheDocument();
    // Entries are named after their save categories, not raw step ids.
    expect(within(modal).getByText("Exame")).toBeInTheDocument();
    expect(within(modal).getByText("Solicitação")).toBeInTheDocument();
    expect(within(modal).queryByText("step-exames")).not.toBeInTheDocument();
  });
});

describe("DashboardHome — command palette, atalhos e quick actions", () => {
  function twoStatusData() {
    const fresh = makeLead({
      id: "lead-new",
      leadId: "lead-new",
      name: "Maria Real",
      status: "new",
    });
    const old = makeLead({
      id: "lead-old",
      leadId: "lead-old",
      name: "João Antigo",
      email: "joao@example.com",
      status: "converted",
    });
    return makeData({ leads: [fresh, old] });
  }

  it("opens with ⌘K, navigates with the keyboard and runs the highlighted action", async () => {
    const user = userEvent.setup();
    render(<DashboardHome data={twoStatusData()} />);

    await user.keyboard("{Meta>}k{/Meta}");
    const dialog = await screen.findByRole("dialog", {
      name: "Paleta de comandos",
    });
    const input = within(dialog).getByRole("combobox", {
      name: "Buscar comandos",
    });
    // Opening focuses the input (rAF) — wait for it before typing arrows.
    await waitFor(() => expect(input).toHaveFocus());

    // First action is "Criar chatbot"; ArrowDown highlights "Somente novos".
    await user.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute(
      "aria-activedescendant",
      "command-option-only-new",
    );
    await user.keyboard("{Enter}");

    // Palette closed and the only-new filter applied: converted lead hides.
    expect(
      screen.queryByRole("dialog", { name: "Paleta de comandos" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("João Antigo")).not.toBeInTheDocument();
    expect(screen.getAllByText("Maria Real").length).toBeGreaterThan(0);
  });

  it("filters commands as you type and closes with Esc", async () => {
    const user = userEvent.setup();
    render(<DashboardHome data={makeData()} />);

    await user.keyboard("{Control>}k{/Control}");
    await screen.findByRole("dialog", { name: "Paleta de comandos" });
    await user.type(
      screen.getByRole("combobox", { name: "Buscar comandos" }),
      "csv",
    );
    expect(
      screen.getByRole("option", { name: /Exportar CSV/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Criar chatbot/ }),
    ).not.toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: "Paleta de comandos" }),
    ).not.toBeInTheDocument();
  });

  it("focuses the lead search with / and navigates to the new-bot page with n", async () => {
    const user = userEvent.setup();
    render(<DashboardHome data={makeData()} />);

    await user.keyboard("/");
    const searchInput = screen.getByPlaceholderText(/Buscar por nome/);
    expect(searchInput).toHaveFocus();

    // Typing "n" inside the search field must not trigger the shortcut.
    await user.keyboard("n");
    expect(pushMock).not.toHaveBeenCalled();

    // With focus outside fields, "n" navigates to the create page.
    (document.activeElement as HTMLElement).blur();
    await user.keyboard("n");
    expect(pushMock).toHaveBeenCalledWith("/chatbots/new");
  });

  it("toggles the Somente novos chip showing the live counter", async () => {
    const user = userEvent.setup();
    render(<DashboardHome data={twoStatusData()} />);

    const chip = screen.getByRole("button", { name: /Somente novos/ });
    expect(chip).toHaveTextContent("1");

    await user.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("João Antigo")).not.toBeInTheDocument();

    await user.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "false");
    expect(screen.getAllByText("João Antigo").length).toBeGreaterThan(0);
  });

  it("copies the lead WhatsApp message from the row quick action", async () => {
    const user = userEvent.setup();
    // userEvent installs its own clipboard stub — override after setup.
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<DashboardHome data={twoStatusData()} />);

    await user.click(
      screen.getByRole("button", { name: "Copiar mensagem de Maria Real" }),
    );
    expect(writeText).toHaveBeenCalledWith("Mensagem real");
    expect(await screen.findByText("Copiado")).toBeInTheDocument();
  });
});
