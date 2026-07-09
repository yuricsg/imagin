import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardData } from "@/lib/dashboard";
import { computeMetrics } from "@/lib/metrics";
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

function makeData(): DashboardData {
  return {
    bots: [],
    clients: [],
    leads: [],
    metrics: computeMetrics([], [], NOW_MS),
    botActivity: {},
    dbBotIds: [],
    nowMs: NOW_MS,
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
