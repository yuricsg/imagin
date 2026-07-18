import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChatbotInput } from "@/lib/chatbots/create";
import { buildChatbot, DEFAULT_EMBED } from "@/lib/chatbots/create";
import {
  defaultFlowForTemplate,
  FLOW_END_NO_WHATSAPP,
  seedDialogueFromTemplate,
} from "@/lib/chatbots/flows";
import {
  DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
  DEFAULT_WHATSAPP_ROUTING_QUESTION,
} from "@/lib/chatbots/whatsapp";
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
  await user.type(screen.getByLabelText(/Especialidade/i), "Cardiologia");
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
      screen.getByRole("button", { name: /Agendamento de exames/i }),
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
    expect(screen.getByText("Agendamento de exames")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Criar chatbot" }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Dra. Ana",
          clientName: "Clínica Ana",
          specialty: "Cardiologia",
          flowTemplateId: "exam-scheduling",
          accent: "emerald",
          status: "active",
          flowDialogue: expect.objectContaining({
            version: 1,
            shape: "linear",
            steps: expect.any(Array),
          }),
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

  it("shows an inline spinner on the submit button while saving", async () => {
    const user = userEvent.setup();
    let captured: ChatbotInput | null = null;
    let resolveSave: (bot: ReturnType<typeof buildChatbot>) => void = () => {};
    const pending = new Promise<ReturnType<typeof buildChatbot>>((resolve) => {
      resolveSave = resolve;
    });
    const onCreate = vi.fn((input: ChatbotInput) => {
      captured = input;
      return pending;
    });

    render(<ChatbotForm onClose={vi.fn()} onCreate={onCreate} />);

    await fillStepOne(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await user.click(screen.getByRole("button", { name: "Criar chatbot" }));

    // While the save promise is pending: spinner label + disabled button.
    const savingButton = await screen.findByRole("button", {
      name: /Salvando…/,
    });
    expect(savingButton).toBeDisabled();
    expect(onCreate).toHaveBeenCalledOnce();

    // Resolving swaps the spinner for the success screen (the "check").
    await act(async () => {
      resolveSave(buildChatbot(captured!, new Set(), 1_700_000_000_000));
    });
    expect(await screen.findByText("Chatbot criado!")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Salvando…/ }),
    ).not.toBeInTheDocument();
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
      screen.getByRole("button", { name: /Cardiologia/i }),
    );
    await user.type(screen.getByLabelText(/Nome do chatbot/i), "Dra. Ana");
    await user.type(screen.getByLabelText(/^Cliente/i), "Clínica Ana");
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(
      screen.getByRole("button", {
        name: /Captação de pacientes/i,
        pressed: true,
      }),
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
        `Use uma URL completa, ex.: ${DEFAULT_EMBED.apiBaseUrl}`,
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

  it("calls onClose when cancel is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<ChatbotForm onClose={onClose} onCreate={createStub()} />);

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<ChatbotForm onClose={onClose} onCreate={createStub()} />);

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders as a page heading instead of a modal dialog", () => {
    render(<ChatbotForm onClose={vi.fn()} onCreate={createStub()} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Novo chatbot" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("lets the operator switch tone and updates stock questions across the flow", async () => {
    const user = userEvent.setup();

    render(<ChatbotForm onClose={vi.fn()} onCreate={createStub()} />);
    await fillStepOne(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(
      screen.getByDisplayValue(/Como posso te chamar/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Oi!/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Formal" }));
    expect(
      screen.getByDisplayValue("Por favor, informe seu nome completo."),
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Selecione o tipo de atendimento desejado."),
    ).toBeInTheDocument();
    expect(screen.getByText(/Bom dia/)).toBeInTheDocument();
    expect(
      screen.getByText(/Agradecemos o contato/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Tom: Formal")).toBeInTheDocument();
  });

  it("lets the operator switch to branching and edit a question", async () => {
    const user = userEvent.setup();

    render(<ChatbotForm onClose={vi.fn()} onCreate={createStub()} />);
    await fillStepOne(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await user.click(screen.getByRole("button", { name: /Com ramificações/i }));
    expect(
      await screen.findByRole("dialog", { name: /Fluxo com ramificações/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Benefícios/i)).toBeInTheDocument();
    expect(screen.getByText(/Fragilidades/i)).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /Entendi, continuar/i }),
    );

    expect(
      screen.getByRole("button", { name: /Com ramificações/i }),
    ).toHaveAttribute("aria-pressed", "true");

    const question = screen.getAllByDisplayValue(/./)[0];
    expect(question).toBeTruthy();
    await user.clear(question);
    await user.type(question, "Qual é o seu objetivo?");
    expect(question).toHaveValue("Qual é o seu objetivo?");
  });

  it("allows creating a custom Salvar como category", async () => {
    const user = userEvent.setup();

    render(<ChatbotForm onClose={vi.fn()} onCreate={createStub()} />);
    await fillStepOne(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    const saveSelects = screen.getAllByDisplayValue(/Não mapear|Nome do lead|Assunto/i);
    const firstSave = saveSelects[0] ?? screen.getAllByRole("combobox")[1];
    await user.selectOptions(firstSave, "__new__");
    const input = await screen.findByPlaceholderText(/Convênio/i);
    await user.type(input, "Convênio");
    await user.click(screen.getByRole("button", { name: "Criar" }));
    expect(
      screen.getAllByRole("option", { name: "Convênio" }).length,
    ).toBeGreaterThan(0);
  });

  it("selects a specialty suggestion and marks it pressed", async () => {
    const user = userEvent.setup();

    render(<ChatbotForm onClose={vi.fn()} onCreate={createStub()} />);

    await user.click(screen.getByRole("button", { name: "Cardiologia" }));
    expect(screen.getByLabelText(/Especialidade/i)).toHaveValue("Cardiologia");
    expect(screen.getByRole("button", { name: "Cardiologia" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("shows a live launcher preview that updates with teaser text", async () => {
    const user = userEvent.setup();

    render(<ChatbotForm onClose={vi.fn()} onCreate={createStub()} />);
    await fillStepOne(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByText("Prévia no site")).toBeInTheDocument();
    expect(
      screen.getAllByText(/Olá! Posso te ajudar\?/i).length,
    ).toBeGreaterThan(0);

    const teasers = screen.getByLabelText(/Texto do balão/i);
    await user.clear(teasers);
    await user.type(teasers, "Quer agendar uma consulta?");
    expect(
      screen.getAllByText("Quer agendar uma consulta?").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: "Enviar foto" }),
    ).toBeEnabled();

    await user.click(screen.getByRole("button", { name: /Robô feminino/i }));
    expect(
      screen.getByRole("button", { name: /Robô feminino/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});

/** Full input fixture used to build a realistic source bot for duplication. */
function sourceInput(): ChatbotInput {
  const flow = defaultFlowForTemplate("patient-capture");
  return {
    name: "Dra. Origem",
    flowName: "Fluxo Origem",
    clientName: "Clínica Origem",
    specialty: "Cardiologia",
    status: "active",
    accent: "indigo",
    flowTemplateId: flow.templateId,
    flowTone: flow.tone,
    flowGreeting: flow.greeting,
    flowCollectFields: flow.collectFields,
    flowServices: flow.services,
    flowInsuranceMode: flow.insuranceMode,
    flowInsurances: flow.insurances,
    gaMeasurementId: "",
    metaPixelId: "",
    whatsappEnabled: false,
    whatsappDestinations: [],
    whatsappRoutingQuestion: DEFAULT_WHATSAPP_ROUTING_QUESTION,
    whatsappMessageTemplate: DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
    whatsappClosingMessage: "",
    launcherTeaserTexts: ["Olá! Posso te ajudar?"],
    launcherAvatarUrl: null,
    ...DEFAULT_EMBED,
  };
}

describe("ChatbotForm — nome do fluxo e duplicação", () => {
  it("submits the optional flow name for a new bot", async () => {
    const user = userEvent.setup();
    const onCreate = createStub();

    render(<ChatbotForm onClose={vi.fn()} onCreate={onCreate} />);

    expect(screen.getByLabelText(/Nome do fluxo/i)).toHaveValue("");

    await fillStepOne(user);
    await user.type(
      screen.getByLabelText(/Nome do fluxo/i),
      "Fluxo de exames — LP",
    );
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    // Review step echoes the flow name next to the chatbot name.
    expect(screen.getByText("Fluxo de exames — LP")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Criar chatbot" }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Dra. Ana",
          flowName: "Fluxo de exames — LP",
        }),
      );
    });
  });

  it("prefills creation mode from the duplicated bot with (cópia) suffixes", async () => {
    const user = userEvent.setup();
    const onCreate = createStub();
    const onUpdate = vi.fn();
    const source = buildChatbot(
      {
        ...sourceInput(),
        flowDialogue: seedDialogueFromTemplate("patient-capture"),
      },
      new Set(),
      1_700_000_000_000,
    );

    render(
      <ChatbotForm
        onClose={vi.fn()}
        onCreate={onCreate}
        onUpdate={onUpdate}
        duplicateFrom={source}
      />,
    );

    // Creation mode (not edit), both names suffixed.
    expect(
      screen.getByRole("heading", { level: 1, name: "Novo chatbot" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Nome do chatbot/i)).toHaveValue(
      "Dra. Origem (cópia)",
    );
    expect(screen.getByLabelText(/Nome do fluxo/i)).toHaveValue(
      "Fluxo Origem (cópia)",
    );

    // Everything stays editable before saving, including the client.
    const clientInput = screen.getByLabelText(/^Cliente/i);
    expect(clientInput).toHaveValue("Clínica Origem");
    await user.clear(clientInput);
    await user.type(clientInput, "Clínica Nova");

    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Criar chatbot" }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Dra. Origem (cópia)",
          flowName: "Fluxo Origem (cópia)",
          clientName: "Clínica Nova",
          specialty: "Cardiologia",
          flowTemplateId: "patient-capture",
          flowDialogue: expect.objectContaining({
            version: 1,
            steps: expect.any(Array),
          }),
        }),
      );
    });
    // Duplication creates a new bot — never an update of the source.
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("falls back to the bot name for the duplicated flow name", () => {
    const source = buildChatbot(
      { ...sourceInput(), flowName: "" },
      new Set(),
      1_700_000_000_000,
    );

    render(
      <ChatbotForm
        onClose={vi.fn()}
        onCreate={createStub()}
        duplicateFrom={source}
      />,
    );

    expect(screen.getByLabelText(/Nome do fluxo/i)).toHaveValue(
      "Dra. Origem (cópia)",
    );
  });
});

describe("ChatbotForm — mensagem de encerramento do WhatsApp", () => {
  async function goToWhatsAppStep(user: ReturnType<typeof userEvent.setup>) {
    await fillStepOne(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Ativado" }));
  }

  it("submits the custom closing message typed on the WhatsApp step", async () => {
    const user = userEvent.setup();
    const onCreate = createStub();

    render(<ChatbotForm onClose={vi.fn()} onCreate={onCreate} />);

    await goToWhatsAppStep(user);
    await user.type(
      screen.getByLabelText(/Número do WhatsApp/i),
      "+55 11 98888-7777",
    );

    const closing = screen.getByLabelText(/Mensagem de encerramento do chat/i);
    // Friendly tone is the default: the placeholder shows the tone fallback.
    expect(closing).toHaveValue("");
    expect(closing).toHaveAttribute(
      "placeholder",
      "Continue no WhatsApp para falar com nossa equipe.",
    );

    await user.type(closing, "Envie a mensagem para garantir seu horário.");

    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Criar chatbot" }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          whatsappEnabled: true,
          whatsappClosingMessage: "Envie a mensagem para garantir seu horário.",
        }),
      );
    });
  });

  it("follows the tone in the placeholder but never overwrites typed text", async () => {
    const user = userEvent.setup();

    render(<ChatbotForm onClose={vi.fn()} onCreate={createStub()} />);

    await fillStepOne(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    // Switch to the formal tone on the conversation step.
    await user.click(screen.getByRole("button", { name: "Formal" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await user.click(screen.getByRole("button", { name: "Ativado" }));

    const closing = screen.getByLabelText(/Mensagem de encerramento do chat/i);
    expect(closing).toHaveAttribute(
      "placeholder",
      "Continue o atendimento pelo WhatsApp para confirmar os detalhes.",
    );

    await user.type(closing, "Texto manual do operador.");

    // Back to the conversation step, switch tone again — operator text stays.
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    await user.click(screen.getByRole("button", { name: "Amigável" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(
      screen.getByLabelText(/Mensagem de encerramento do chat/i),
    ).toHaveValue("Texto manual do operador.");
  });
});

describe("ChatbotForm — destino das opções (encerramento)", () => {
  it("offers both ending types in the option destination dropdown", async () => {
    const user = userEvent.setup();

    render(<ChatbotForm onClose={vi.fn()} onCreate={createStub()} />);
    await fillStepOne(user);
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await user.click(screen.getByRole("button", { name: /Com ramificações/i }));
    await user.click(
      await screen.findByRole("button", { name: /Entendi, continuar/i }),
    );

    const destination = screen.getAllByLabelText("Próxima etapa")[0];
    const labels = Array.from(destination.querySelectorAll("option")).map(
      (option) => option.textContent,
    );
    expect(labels).toContain("Encerrar e direcionar ao WhatsApp");
    expect(labels).toContain("Encerrar conversa (sem WhatsApp)");

    // The polite ending stores the sentinel; "" stays the WhatsApp handoff.
    await user.selectOptions(destination, FLOW_END_NO_WHATSAPP);
    expect(destination).toHaveValue(FLOW_END_NO_WHATSAPP);
    await user.selectOptions(destination, "");
    expect(destination).toHaveValue("");
  });
});
