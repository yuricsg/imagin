import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DashboardData } from "@/lib/dashboard";
import { computeMetrics } from "@/lib/metrics";
import { DashboardHome } from "./dashboard-home";

const NOW_MS = Date.parse("2026-07-05T12:00:00.000Z");

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
});

afterEach(() => {
  cleanup();
});

describe("DashboardHome — fluxo de criação de chatbot", () => {
  it("creates a bot through the wizard, shows success and lists it selected", async () => {
    const user = userEvent.setup();
    render(<DashboardHome data={makeData()} />);

    await user.click(screen.getByRole("button", { name: /Novo chatbot/i }));

    const dialog = screen.getByRole("dialog", { name: "Novo chatbot" });

    await user.type(
      within(dialog).getByLabelText(/Nome do chatbot/i),
      "Dr. Caio Costa",
    );
    await user.type(within(dialog).getByLabelText(/^Cliente/i), "Clínica Costa");
    await user.type(
      within(dialog).getByLabelText(/Especialidade/i),
      "Ortopedia",
    );
    await user.click(within(dialog).getByRole("button", { name: "Continuar" }));
    await user.click(within(dialog).getByRole("button", { name: "Continuar" }));
    await user.click(within(dialog).getByRole("button", { name: "Continuar" }));
    await user.click(within(dialog).getByRole("button", { name: "Continuar" }));
    await user.click(
      within(dialog).getByRole("button", { name: "Criar chatbot" }),
    );

    expect(await screen.findByText("Chatbot criado!")).toBeInTheDocument();
    expect(screen.getAllByText(/dr-caio-costa/).length).toBeGreaterThan(0);

    const botButton = screen.getByRole("button", {
      name: "Dr. Caio Costa, Clínica Costa",
      pressed: true,
    });
    expect(botButton).toBeInTheDocument();

    const stored = JSON.parse(
      window.localStorage.getItem("imagin:chatbots") ?? "[]",
    ) as Array<{ id: string }>;
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe("dr-caio-costa");

    await user.click(screen.getByRole("button", { name: "Concluir" }));
    expect(screen.queryByText("Chatbot criado!")).not.toBeInTheDocument();
  });

  it("keeps the wizard open and shows errors when embed config is invalid", async () => {
    const user = userEvent.setup();
    render(<DashboardHome data={makeData()} />);

    await user.click(screen.getByRole("button", { name: /Novo chatbot/i }));
    const dialog = screen.getByRole("dialog", { name: "Novo chatbot" });

    await user.type(within(dialog).getByLabelText(/Nome do chatbot/i), "Bot X");
    await user.type(within(dialog).getByLabelText(/^Cliente/i), "Cliente X");
    await user.type(within(dialog).getByLabelText(/Especialidade/i), "Suporte");
    await user.click(within(dialog).getByRole("button", { name: "Continuar" }));
    await user.click(within(dialog).getByRole("button", { name: "Continuar" }));
    await user.click(within(dialog).getByRole("button", { name: "Continuar" }));
    await user.click(within(dialog).getByRole("button", { name: "Continuar" }));

    await user.click(
      within(dialog).getByRole("button", { name: /Configuração avançada/i }),
    );
    const apiInput = within(dialog).getByLabelText(/API base URL/i);
    await user.clear(apiInput);
    await user.type(apiInput, "api-sem-protocolo");

    await user.click(
      within(dialog).getByRole("button", { name: "Criar chatbot" }),
    );

    expect(
      await within(dialog).findByText(
        "Use uma URL completa, ex.: https://api.imagin.app",
      ),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem("imagin:chatbots")).toBeNull();
  });

  it("edits a created bot and keeps the same id", async () => {
    const user = userEvent.setup();
    render(<DashboardHome data={makeData()} />);

    await user.click(screen.getByRole("button", { name: /Novo chatbot/i }));
    let dialog = screen.getByRole("dialog", { name: "Novo chatbot" });
    await user.type(
      within(dialog).getByLabelText(/Nome do chatbot/i),
      "Dr. Caio Costa",
    );
    await user.type(within(dialog).getByLabelText(/^Cliente/i), "Clínica Costa");
    await user.type(
      within(dialog).getByLabelText(/Especialidade/i),
      "Ortopedia",
    );
    await user.click(within(dialog).getByRole("button", { name: "Continuar" }));
    await user.click(within(dialog).getByRole("button", { name: "Continuar" }));
    await user.click(within(dialog).getByRole("button", { name: "Continuar" }));
    await user.click(within(dialog).getByRole("button", { name: "Continuar" }));
    await user.click(
      within(dialog).getByRole("button", { name: "Criar chatbot" }),
    );
    await user.click(screen.getByRole("button", { name: "Concluir" }));

    await user.click(
      screen.getByRole("button", { name: /Editar Dr\. Caio Costa/i }),
    );
    dialog = screen.getByRole("dialog", { name: "Editar chatbot" });
    const nameInput = within(dialog).getByLabelText(/Nome do chatbot/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Dr. Caio Costa Jr.");
    await user.click(within(dialog).getByRole("button", { name: "Continuar" }));
    await user.click(within(dialog).getByRole("button", { name: "Continuar" }));
    await user.click(within(dialog).getByRole("button", { name: "Continuar" }));
    await user.click(within(dialog).getByRole("button", { name: "Continuar" }));
    await user.click(
      within(dialog).getByRole("button", { name: "Salvar alterações" }),
    );

    expect(await screen.findByText("Alterações salvas!")).toBeInTheDocument();
    const stored = JSON.parse(
      window.localStorage.getItem("imagin:chatbots") ?? "[]",
    ) as Array<{ id: string; name: string }>;
    expect(stored[0].id).toBe("dr-caio-costa");
    expect(stored[0].name).toBe("Dr. Caio Costa Jr.");
    await user.click(screen.getByRole("button", { name: "Concluir" }));
  });

  it("opens edit wizard for a legacy bot saved without flow or tracking", async () => {
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

    expect(
      screen.getByRole("dialog", { name: "Editar chatbot" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("dialog")).getByLabelText(/Nome do chatbot/i),
    ).toHaveValue("Bot Legado");
  });

  it("deletes a created bot after confirmation", async () => {
    const user = userEvent.setup();
    render(<DashboardHome data={makeData()} />);

    await user.click(screen.getByRole("button", { name: /Novo chatbot/i }));
    const dialog = screen.getByRole("dialog", { name: "Novo chatbot" });
    await user.type(within(dialog).getByLabelText(/Nome do chatbot/i), "Bot Temp");
    await user.type(within(dialog).getByLabelText(/^Cliente/i), "Cliente Temp");
    await user.type(
      within(dialog).getByLabelText(/Especialidade/i),
      "Suporte",
    );
    await user.click(within(dialog).getByRole("button", { name: "Continuar" }));
    await user.click(within(dialog).getByRole("button", { name: "Continuar" }));
    await user.click(within(dialog).getByRole("button", { name: "Continuar" }));
    await user.click(within(dialog).getByRole("button", { name: "Continuar" }));
    await user.click(
      within(dialog).getByRole("button", { name: "Criar chatbot" }),
    );
    await user.click(screen.getByRole("button", { name: "Concluir" }));

    await user.click(
      screen.getByRole("button", { name: "Excluir Bot Temp" }),
    );
    const confirm = screen.getByRole("alertdialog", { name: /Excluir chatbot/i });
    await user.click(
      within(confirm).getByRole("button", { name: "Excluir" }),
    );

    expect(
      screen.queryByRole("button", { name: "Excluir Bot Temp" }),
    ).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("imagin:chatbots") ?? "[]")).toEqual(
      [],
    );
  });
});
