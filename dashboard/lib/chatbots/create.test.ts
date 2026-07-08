import { describe, expect, it } from "vitest";
import { buildChatbot, chatbotToInput, DEFAULT_EMBED, normalizeStoredChatbot, updateChatbot, type ChatbotInput } from "./create";
import { defaultFlowForTemplate } from "./flows";
import { DEFAULT_WHATSAPP_MESSAGE_TEMPLATE } from "./whatsapp";

const baseFlow = defaultFlowForTemplate("patient-capture");

const baseInput: ChatbotInput = {
  name: "Dra. Renata Reis",
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
  whatsappPhoneNumber: "",
  whatsappMessageTemplate: DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
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
    expect(bot.createdAt).toBe(new Date(1_700_000_000_000).toISOString());
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

describe("normalizeStoredChatbot", () => {
  it("fills missing flow and tracking for legacy localStorage entries", () => {
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
    expect(bot).not.toBeNull();
    expect(bot!.flow.templateId).toBe("patient-capture");
    expect(bot!.tracking).toEqual({
      gaMeasurementId: "",
      metaPixelId: "",
    });
    expect(() => chatbotToInput(bot!)).not.toThrow();
  });
});
