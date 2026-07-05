import type { ChatbotInput } from "./create";
import { FLOW_TEMPLATES } from "./flows";
import { isValidGaMeasurementId, isValidMetaPixelId } from "./tracking";
import { isValidWhatsAppPhone } from "./whatsapp";

export type ChatbotField = keyof ChatbotInput;

export type ChatbotFieldErrors = Partial<Record<ChatbotField, string>>;

/** True when the value parses as an absolute http(s) URL. */
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Validates chatbot form input; returns per-field errors or null when valid. */
export function validateChatbotInput(input: ChatbotInput): ChatbotFieldErrors | null {
  const errors: ChatbotFieldErrors = {};

  if (!input.name.trim()) {
    errors.name = "Informe o nome do chatbot.";
  }
  if (!input.clientName.trim()) {
    errors.clientName = "Informe o nome do cliente.";
  }
  if (!input.specialty.trim()) {
    errors.specialty = "Informe a especialidade ou função.";
  }

  if (!(input.flowTemplateId in FLOW_TEMPLATES)) {
    errors.flowTemplateId = "Escolha um modelo de conversa.";
  }
  if (!input.flowCollectFields || input.flowCollectFields.length === 0) {
    errors.flowCollectFields = "Selecione ao menos um dado para o bot coletar.";
  }

  const gaId = input.gaMeasurementId.trim();
  if (gaId && !isValidGaMeasurementId(gaId)) {
    errors.gaMeasurementId =
      "Use um ID GA4 válido, ex.: G-XXXXXXXXXX, ou UA-XXXXXXX-X.";
  }

  const metaId = input.metaPixelId.trim();
  if (metaId && !isValidMetaPixelId(metaId)) {
    errors.metaPixelId =
      "Use apenas números (10–20 dígitos), como no Gerenciador de Eventos da Meta.";
  }

  if (input.whatsappEnabled) {
    const phone = input.whatsappPhoneNumber.trim();
    if (!phone) {
      errors.whatsappPhoneNumber =
        "Informe o número do WhatsApp com DDI e DDD, ex.: +55 11 99999-0000.";
    } else if (!isValidWhatsAppPhone(phone)) {
      errors.whatsappPhoneNumber =
        "Use um número válido com DDI e DDD (mínimo 10 dígitos).";
    }
    if (!input.whatsappMessageTemplate.trim()) {
      errors.whatsappMessageTemplate =
        "Escreva a mensagem que será enviada ao abrir o WhatsApp.";
    }
  }

  const apiBaseUrl = input.apiBaseUrl.trim();
  if (!apiBaseUrl) {
    errors.apiBaseUrl = "Informe a URL base da API.";
  } else if (!isHttpUrl(apiBaseUrl)) {
    errors.apiBaseUrl = "Use uma URL completa, ex.: https://api.imagin.app";
  }

  const appBaseUrl = input.appBaseUrl.trim();
  if (!appBaseUrl) {
    errors.appBaseUrl = "Informe a URL base do app.";
  } else if (!isHttpUrl(appBaseUrl)) {
    errors.appBaseUrl = "Use uma URL completa, ex.: https://app.imagin.app";
  }

  const scriptPath = input.scriptPath.trim();
  if (!scriptPath) {
    errors.scriptPath = "Informe o caminho do script.";
  } else if (!scriptPath.startsWith("/")) {
    errors.scriptPath = "O caminho deve começar com /, ex.: /embed/widget.js";
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

/** True when the three main fields are filled — used to enable submit early. */
export function hasRequiredChatbotFields(
  input: Pick<ChatbotInput, "name" | "clientName" | "specialty">,
): boolean {
  return Boolean(
    input.name.trim() && input.clientName.trim() && input.specialty.trim(),
  );
}
