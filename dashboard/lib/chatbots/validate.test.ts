import { describe, expect, it } from "vitest";
import { DEFAULT_EMBED, type ChatbotInput } from "./create";
import { defaultFlowForTemplate } from "./flows";
import { DEFAULT_WHATSAPP_MESSAGE_TEMPLATE } from "./whatsapp";
import {
  hasRequiredChatbotFields,
  validateChatbotInput,
} from "./validate";

const baseFlow = defaultFlowForTemplate("patient-capture");

const validInput: ChatbotInput = {
  name: "Dra. Renata Reis",
  clientName: "Clínica Renata Reis",
  specialty: "Dermatologia",
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

describe("validateChatbotInput", () => {
  it("returns null for a complete input", () => {
    expect(validateChatbotInput(validInput)).toBeNull();
  });

  it("returns per-field errors for empty required fields", () => {
    const errors = validateChatbotInput({
      ...validInput,
      name: "  ",
      clientName: "",
      specialty: " ",
    });

    expect(errors).toEqual({
      name: "Informe o nome do chatbot.",
      clientName: "Informe o nome do cliente.",
      specialty: "Informe a especialidade ou função.",
    });
  });

  it("validates embed fields when cleared", () => {
    const errors = validateChatbotInput({
      ...validInput,
      apiBaseUrl: "",
      appBaseUrl: " ",
      scriptPath: "",
    });

    expect(errors).toMatchObject({
      apiBaseUrl: "Informe a URL base da API.",
      appBaseUrl: "Informe a URL base do app.",
      scriptPath: "Informe o caminho do script.",
    });
  });

  it("rejects malformed URLs and non-http protocols", () => {
    const errors = validateChatbotInput({
      ...validInput,
      apiBaseUrl: "api.imagin.app",
      appBaseUrl: "ftp://app.imagin.app",
    });

    expect(errors).toEqual({
      apiBaseUrl: "Use uma URL completa, ex.: https://api.imagin.app",
      appBaseUrl: "Use uma URL completa, ex.: https://app.imagin.app",
    });
  });

  it("rejects script paths that do not start with a slash", () => {
    const errors = validateChatbotInput({
      ...validInput,
      scriptPath: "embed/widget.js",
    });

    expect(errors).toEqual({
      scriptPath: "O caminho deve começar com /, ex.: /embed/widget.js",
    });
  });

  it("accepts trimmed valid values with surrounding whitespace", () => {
    expect(
      validateChatbotInput({
        ...validInput,
        apiBaseUrl: " https://api.example.com ",
        scriptPath: " /widget.js ",
      }),
    ).toBeNull();
  });

  it("requires at least one collect field", () => {
    const errors = validateChatbotInput({
      ...validInput,
      flowCollectFields: [],
    });

    expect(errors?.flowCollectFields).toBe(
      "Selecione ao menos um dado para o bot coletar.",
    );
  });

  it("validates optional tracking IDs when provided", () => {
    expect(
      validateChatbotInput({
        ...validInput,
        gaMeasurementId: "invalid",
        metaPixelId: "abc",
      }),
    ).toMatchObject({
      gaMeasurementId: "Use um ID GA4 válido, ex.: G-XXXXXXXXXX, ou UA-XXXXXXX-X.",
      metaPixelId:
        "Use apenas números (10–20 dígitos), como no Gerenciador de Eventos da Meta.",
    });
  });

  it("requires phone and message when WhatsApp is enabled", () => {
    expect(
      validateChatbotInput({
        ...validInput,
        whatsappEnabled: true,
        whatsappPhoneNumber: "",
        whatsappMessageTemplate: "",
      }),
    ).toMatchObject({
      whatsappPhoneNumber:
        "Informe o número do WhatsApp com DDI e DDD, ex.: +55 11 99999-0000.",
      whatsappMessageTemplate:
        "Escreva a mensagem que será enviada ao abrir o WhatsApp.",
    });
  });
});

describe("hasRequiredChatbotFields", () => {
  it("is false until name, client and specialty are filled", () => {
    expect(
      hasRequiredChatbotFields({
        name: "Bot",
        clientName: "",
        specialty: "Função",
      }),
    ).toBe(false);

    expect(
      hasRequiredChatbotFields({
        name: "Bot",
        clientName: "Cliente",
        specialty: "Função",
      }),
    ).toBe(true);
  });
});
