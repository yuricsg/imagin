import { describe, expect, it } from "vitest";
import { buildChatbot, chatbotToInput, DEFAULT_EMBED, duplicateChatbotInput, normalizeStoredChatbot, updateChatbot, type ChatbotInput } from "./create";
import { defaultFlowForTemplate } from "./flows";
import {
  DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
  DEFAULT_WHATSAPP_ROUTING_QUESTION,
} from "./whatsapp";

const baseFlow = defaultFlowForTemplate("patient-capture");

const baseInput: ChatbotInput = {
  name: "Dra. Renata Reis",
  flowName: "",
  clientName: "Clínica Renata Reis",
  specialty: "Captação — Dermatologia",
  status: "active",
  accent: "indigo",
  flowTemplateId: baseFlow.templateId,
  flowTone: baseFlow.tone,
  flowGreeting: baseFlow.greeting,
  flowCollectFields: baseFlow.collectFields,
  flowServices: baseFlow.services,
  flowInsuranceMode: baseFlow.insuranceMode,
  flowInsurances: baseFlow.insurances,
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

describe("buildChatbot", () => {
  it("derives slug id and clientId from names", () => {
    const bot = buildChatbot(baseInput, new Set(), 1_700_000_000_000);

    expect(bot.id).toBe("dra-renata-reis");
    expect(bot.clientId).toBe("clinica-renata-reis");
    expect(bot.name).toBe("Dra. Renata Reis");
    expect(bot.clientName).toBe("Clínica Renata Reis");
    expect(bot.specialty).toBe("Captação — Dermatologia");
  });

  it("appends numeric suffix when id already exists", () => {
    const existing = new Set(["dra-renata-reis"]);
    const bot = buildChatbot(baseInput, existing, 1_700_000_000_000);

    expect(bot.id).toBe("dra-renata-reis-2");
  });

  it("increments suffix until a free id is found", () => {
    const existing = new Set(["dra-renata-reis", "dra-renata-reis-2"]);
    const bot = buildChatbot(baseInput, existing, 1_700_000_000_000);

    expect(bot.id).toBe("dra-renata-reis-3");
  });

  it("falls back to chatbot id when name slugifies to empty", () => {
    const bot = buildChatbot(
      { ...baseInput, name: "!!!" },
      new Set(),
      1_700_000_000_000,
    );

    expect(bot.id).toBe("chatbot");
  });

  it("stores trimmed embed config, flow and createdAt", () => {
    const bot = buildChatbot(
      {
        ...baseInput,
        flowGreeting: " Olá ",
        apiBaseUrl: " https://api.example.com ",
        appBaseUrl: " https://app.example.com ",
        scriptPath: " /widget.js ",
      },
      new Set(),
      1_700_000_000_000,
    );

    expect(bot.flow.templateId).toBe("patient-capture");
    expect(bot.flow.greeting).toBe("Olá");
    expect(bot.tracking).toEqual({
      gaMeasurementId: "",
      metaPixelId: "",
    });
    expect(bot.embed).toEqual({
      apiBaseUrl: "https://api.example.com",
      appBaseUrl: "https://app.example.com",
      scriptPath: "/widget.js",
    });
    expect(bot.launcher).toEqual({
      teaserTexts: ["Olá! Posso te ajudar?"],
      avatarUrl: null,
    });
    expect(bot.createdAt).toBe(new Date(1_700_000_000_000).toISOString());
  });

  it("stores custom launcher teaser texts", () => {
    const bot = buildChatbot(
      {
        ...baseInput,
        launcherTeaserTexts: ["  Agende agora  ", "", "Fale conosco"],
        launcherAvatarUrl: null,
      },
      new Set(),
      1_700_000_000_000,
    );

    expect(bot.launcher.teaserTexts).toEqual(["Agende agora", "Fale conosco"]);
    expect(bot.launcher.avatarUrl).toBeNull();
  });
});

describe("chatbotToInput / updateChatbot", () => {
  it("round-trips bot fields through the form input shape", () => {
    const bot = buildChatbot(baseInput, new Set(), 1_700_000_000_000);
    const input = chatbotToInput(bot);

    expect(input.name).toBe(bot.name);
    expect(input.flowTemplateId).toBe(bot.flow.templateId);
    expect(input.gaMeasurementId).toBe("");
  });

  it("updates fields without changing id or createdAt", () => {
    const bot = buildChatbot(baseInput, new Set(), 1_700_000_000_000);
    const updated = updateChatbot(bot, {
      ...chatbotToInput(bot),
      name: "Dr. Ana Silva",
      specialty: "Ortopedia",
      status: "paused",
    });

    expect(updated.id).toBe(bot.id);
    expect(updated.createdAt).toBe(bot.createdAt);
    expect(updated.name).toBe("Dr. Ana Silva");
    expect(updated.specialty).toBe("Ortopedia");
    expect(updated.status).toBe("paused");
  });
});

describe("flowName (nome operacional da lista)", () => {
  it("round-trips flowName through build → toInput → update → normalize", () => {
    const bot = buildChatbot(
      { ...baseInput, flowName: " Fluxo de exames — LP " },
      new Set(),
      1_700_000_000_000,
    );
    expect(bot.flowName).toBe("Fluxo de exames — LP");

    const input = chatbotToInput(bot);
    expect(input.flowName).toBe("Fluxo de exames — LP");

    const updated = updateChatbot(bot, { ...input, flowName: "Fluxo B" });
    expect(updated.flowName).toBe("Fluxo B");
    expect(updated.id).toBe(bot.id);

    const restored = normalizeStoredChatbot(
      JSON.parse(JSON.stringify(updated)),
    );
    expect(restored?.flowName).toBe("Fluxo B");
  });

  it("falls back to undefined when flowName is blank", () => {
    const bot = buildChatbot(
      { ...baseInput, flowName: "   " },
      new Set(),
      1_700_000_000_000,
    );
    expect(bot.flowName).toBeUndefined();
    expect(chatbotToInput(bot).flowName).toBe("");

    const cleared = updateChatbot(bot, { ...chatbotToInput(bot), flowName: "" });
    expect(cleared.flowName).toBeUndefined();

    const normalized = normalizeStoredChatbot({
      id: "bot-x",
      name: "Bot X",
      flowName: "  ",
    });
    expect(normalized?.flowName).toBeUndefined();
  });

  it("preserves flowName from older stored payloads", () => {
    const normalized = normalizeStoredChatbot({
      id: "bot-x",
      name: "Bot X",
      flowName: " Fluxo legado ",
    });
    expect(normalized?.flowName).toBe("Fluxo legado");
  });
});

describe("whatsappClosingMessage (encerramento editável)", () => {
  it("round-trips closingMessage through build → toInput → update → normalize", () => {
    const bot = buildChatbot(
      {
        ...baseInput,
        whatsappEnabled: true,
        whatsappDestinations: [
          { id: "a", label: "", phoneNumber: "+55 11 98888-7777" },
        ],
        whatsappClosingMessage: " Envie a mensagem para ser atendido(a). ",
      },
      new Set(),
      1_700_000_000_000,
    );
    expect(bot.whatsapp.closingMessage).toBe(
      "Envie a mensagem para ser atendido(a).",
    );

    const input = chatbotToInput(bot);
    expect(input.whatsappClosingMessage).toBe(
      "Envie a mensagem para ser atendido(a).",
    );

    const updated = updateChatbot(bot, {
      ...input,
      whatsappClosingMessage: "Fechamos por aqui — continue no WhatsApp.",
    });
    expect(updated.whatsapp.closingMessage).toBe(
      "Fechamos por aqui — continue no WhatsApp.",
    );

    const restored = normalizeStoredChatbot(
      JSON.parse(JSON.stringify(updated)),
    );
    expect(restored?.whatsapp.closingMessage).toBe(
      "Fechamos por aqui — continue no WhatsApp.",
    );
  });

  it("falls back to undefined when the closing message is blank", () => {
    const bot = buildChatbot(
      { ...baseInput, whatsappClosingMessage: "   " },
      new Set(),
      1_700_000_000_000,
    );
    expect(bot.whatsapp.closingMessage).toBeUndefined();
    expect(chatbotToInput(bot).whatsappClosingMessage).toBe("");

    const normalized = normalizeStoredChatbot({
      id: "bot-x",
      name: "Bot X",
      whatsapp: { enabled: false, closingMessage: "  " },
    });
    expect(normalized?.whatsapp.closingMessage).toBeUndefined();
  });

  it("preserves closingMessage from older stored payloads", () => {
    const normalized = normalizeStoredChatbot({
      id: "bot-x",
      name: "Bot X",
      whatsapp: { enabled: true, closingMessage: " Encerramento legado " },
    });
    expect(normalized?.whatsapp.closingMessage).toBe("Encerramento legado");
  });
});

describe("embed defaults e cura do domínio legado", () => {
  it("falls back to the real deploys when no env is set", () => {
    // vitest runs without NEXT_PUBLIC_* set — fallbacks must be the live deploys.
    expect(DEFAULT_EMBED.apiBaseUrl).toBe("https://imagin-v587.onrender.com");
    expect(DEFAULT_EMBED.appBaseUrl).toBe("https://imagin-virid.vercel.app");
    expect(DEFAULT_EMBED.scriptPath).toBe("/embed/widget.js");
  });

  it("heals exactly the legacy aspirational domains on read", () => {
    const normalized = normalizeStoredChatbot({
      id: "bot-x",
      name: "Bot X",
      embed: {
        apiBaseUrl: "https://api.imagin.app",
        appBaseUrl: "https://app.imagin.app/", // trailing-slash variant
        scriptPath: "/embed/widget.js",
      },
    });
    expect(normalized?.embed.apiBaseUrl).toBe(DEFAULT_EMBED.apiBaseUrl);
    expect(normalized?.embed.appBaseUrl).toBe(DEFAULT_EMBED.appBaseUrl);
    expect(normalized?.embed.scriptPath).toBe("/embed/widget.js");
  });

  it("does not touch custom embed URLs", () => {
    const normalized = normalizeStoredChatbot({
      id: "bot-x",
      name: "Bot X",
      embed: {
        apiBaseUrl: "https://api.exemplo.com",
        appBaseUrl: "https://painel.exemplo.com",
        scriptPath: "/widget.js",
      },
    });
    expect(normalized?.embed).toEqual({
      apiBaseUrl: "https://api.exemplo.com",
      appBaseUrl: "https://painel.exemplo.com",
      scriptPath: "/widget.js",
    });
  });
});

describe("duplicateChatbotInput", () => {
  it("copies the full input with (cópia) suffixes on both names", () => {
    const bot = buildChatbot(
      { ...baseInput, flowName: "Fluxo original" },
      new Set(),
      1_700_000_000_000,
    );
    const input = duplicateChatbotInput(bot);

    expect(input.name).toBe("Dra. Renata Reis (cópia)");
    expect(input.flowName).toBe("Fluxo original (cópia)");
    expect(input.clientName).toBe(bot.clientName);
    expect(input.flowTemplateId).toBe(bot.flow.templateId);
    expect(input.launcherTeaserTexts).toEqual(bot.launcher.teaserTexts);
  });

  it("uses the bot name as flowName base when the source has none", () => {
    const bot = buildChatbot(baseInput, new Set(), 1_700_000_000_000);
    const input = duplicateChatbotInput(bot);

    expect(input.flowName).toBe("Dra. Renata Reis (cópia)");
  });

  it("produces a new bot (new id) when the duplicate input is built", () => {
    const bot = buildChatbot(baseInput, new Set(), 1_700_000_000_000);
    const copy = buildChatbot(
      duplicateChatbotInput(bot),
      new Set([bot.id]),
      1_700_000_100_000,
    );

    expect(copy.id).not.toBe(bot.id);
    expect(copy.createdAt).not.toBe(bot.createdAt);
    expect(copy.flowName).toBe("Dra. Renata Reis (cópia)");
  });
});

describe("normalizeStoredChatbot", () => {
  it("stores dialogue when provided on create", () => {
    const dialogue = {
      version: 1 as const,
      shape: "linear" as const,
      greeting: "",
      startStepId: "s1",
      steps: [
        {
          id: "s1",
          question: "Como te chamo?",
          inputType: "text" as const,
          required: true,
          mapsTo: "name" as const,
        },
        {
          id: "s2",
          question: "Escolha",
          inputType: "single_choice" as const,
          options: [
            { id: "a", label: "A" },
            { id: "b", label: "B" },
          ],
        },
      ],
    };
    const bot = buildChatbot(
      { ...baseInput, flowDialogue: dialogue },
      new Set(),
      1_700_000_000_000,
    );
    expect(bot.flow.dialogue?.steps).toHaveLength(2);
    expect(chatbotToInput(bot).flowDialogue?.steps[0].question).toBe(
      "Como te chamo?",
    );
  });

  it("keeps legacy bots without dialogue after normalize", () => {
    const legacy = {
      id: "legacy-bot",
      name: "Bot Legado",
      clientId: "cliente-legado",
      clientName: "Cliente Legado",
      status: "active",
      specialty: "Suporte",
      accent: "indigo",
      createdAt: "2026-01-01T00:00:00.000Z",
      embed: DEFAULT_EMBED,
    };
    const bot = normalizeStoredChatbot(legacy);
    expect(bot!.flow.dialogue).toBeUndefined();
    expect(bot!.launcher).toEqual({
      teaserTexts: ["Olá! Posso te ajudar?"],
      avatarUrl: null,
    });
  });

  it("round-trips launcher fields through chatbotToInput", () => {
    const bot = buildChatbot(
      {
        ...baseInput,
        launcherTeaserTexts: ["Linha A", "Linha B"],
      },
      new Set(),
      1_700_000_000_000,
    );
    const input = chatbotToInput(bot);
    expect(input.launcherTeaserTexts).toEqual(["Linha A", "Linha B"]);
    expect(input.launcherAvatarUrl).toBeNull();
  });
});
