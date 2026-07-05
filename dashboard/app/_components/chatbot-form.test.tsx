import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChatbotInput } from "@/lib/chatbots/create";
import { buildChatbot } from "@/lib/chatbots/create";
import { ChatbotForm } from "./chatbot-form";

afterEach(() => {
  cleanup();
});

/** onCreate stub matching the real contract: builds and returns the bot. */
function createStub() {
  return vi.fn((input: ChatbotInput) =>
    buildChatbot(input, new Set(), 1_700_000_000_000),
  );
}

async function fillStepOne(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Nome do chatbot/i), "Dra. Ana");
  await user.type(screen.getByLabelText(/^Cliente/i), "Clínica Ana");
  await user.type(screen.getByLabelText(/O que o bot faz/i), "Captação");
}

describe("ChatbotForm (wizard)", () => {
  it("walks through the five steps and creates the bot", async () => {
    const user = userEvent.setup();
    const onCreate = createStub();

    render(<ChatbotForm onClose={vi.fn()} onCreate={onCreate} />);

    // Step 1 — about
    await fillStepOne(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    // Step 2 — conversation
    expect(screen.getByText("Prévia da conversa no site")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /Captação de leads/i }),
    );
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    // Step 3 — WhatsApp (disabled by default)
    expect(screen.getByText("Continuar no WhatsApp")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    // Step 4 — appearance
    expect(screen.getByText("Como vai aparecer no painel")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Verde" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    // Step 5 — review
    expect(screen.getByText("Configuração avançada")).toBeInTheDocument();
    expect(screen.getByText("Captação de leads")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Criar chatbot" }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Dra. Ana",
          clientName: "Clínica Ana",
          specialty: "Captação",
          flowTemplateId: "lead-capture",
          accent: "emerald",
          status: "active",
        }),
      );
    });

    // Success screen with install instructions
    expect(await screen.findByText("Chatbot criado!")).toBeInTheDocument();
    expect(screen.getByText("Código de instalação")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Concluir" }),
    ).toBeInTheDocument();
  });

  it("blocks step 1 until required fields are filled, with per-field errors", async () => {
    const user = userEvent.setup();
    const onCreate = createStub();

    render(<ChatbotForm onClose={vi.fn()} onCreate={onCreate} />);

    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(
      await screen.findByText("Informe o nome do chatbot."),
    ).toBeInTheDocument();
    expect(screen.getByText("Informe o nome do cliente.")).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
    // Still on step 1.
    expect(screen.getByLabelText(/Nome do chatbot/i)).toBeInTheDocument();
  });

  it("syncs flow template when a specialty chip is selected", async () => {
    const user = userEvent.setup();

    render(<ChatbotForm onClose={vi.fn()} onCreate={createStub()} />);

    await user.click(
      screen.getByRole("button", { name: /Imobiliária/i }),
    );
    await user.type(screen.getByLabelText(/Nome do chatbot/i), "Corretor");
    await user.type(screen.getByLabelText(/^Cliente/i), "Imob");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(
      screen.getByRole("button", { name: /Captação de leads/i, pressed: true }),
    ).toBeInTheDocument();
  });

  it("validates advanced embed fields on the review step", async () => {
    const user = userEvent.setup();
    const onCreate = createStub();

    render(<ChatbotForm onClose={vi.fn()} onCreate={onCreate} />);

    await fillStepOne(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await user.click(
      screen.getByRole("button", { name: /Configuração avançada/i }),
    );
    const apiInput = screen.getByLabelText(/API base URL/i);
    await user.clear(apiInput);
    await user.type(apiInput, "sem-protocolo");

    await user.click(screen.getByRole("button", { name: "Criar chatbot" }));

    expect(
      await screen.findByText(
        "Use uma URL completa, ex.: https://api.imagin.app",
      ),
    ).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(apiInput).toHaveFocus();
    });
  });

  it("validates tracking IDs on the review step", async () => {
    const user = userEvent.setup();
    const onCreate = createStub();

    render(<ChatbotForm onClose={vi.fn()} onCreate={onCreate} />);

    await fillStepOne(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await user.click(
      screen.getByRole("button", { name: /Google Analytics e Meta Ads/i }),
    );
    await user.type(
      screen.getByLabelText(/Google Analytics/i),
      "id-invalido",
    );

    await user.click(screen.getByRole("button", { name: "Criar chatbot" }));

    expect(
      await screen.findByText(/ID GA4 válido/i),
    ).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("goes back to the previous step keeping values", async () => {
    const user = userEvent.setup();

    render(<ChatbotForm onClose={vi.fn()} onCreate={createStub()} />);

    await fillStepOne(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Voltar" }));

    expect(screen.getByLabelText(/Nome do chatbot/i)).toHaveValue("Dra. Ana");
  });

  it("traps Tab focus inside the dialog", async () => {
    const user = userEvent.setup();

    render(<ChatbotForm onClose={vi.fn()} onCreate={createStub()} />);

    const dialog = screen.getByRole("dialog", { name: "Novo chatbot" });
    const [closeButton] = within(dialog).getAllByRole("button", {
      name: "Fechar",
    });
    closeButton.focus();
    await user.tab({ shift: true });

    expect(screen.getByRole("button", { name: "Continuar" })).toHaveFocus();
  });

  it("calls onClose when cancel is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<ChatbotForm onClose={onClose} onCreate={createStub()} />);

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
