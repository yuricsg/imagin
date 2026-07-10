import type { ChatbotInput } from "./create";
import { FLOW_TEMPLATES, validateDialogueFlow } from "./flows";
import { isValidGaMeasurementId, isValidMetaPixelId } from "./tracking";
import { isValidWhatsAppPhone, normalizeWhatsAppPhone } from "./whatsapp";

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

  // New bots always send flowDialogue; legacy edits may omit it.
  if (input.flowDialogue) {
    const dialogueIssues = validateDialogueFlow(input.flowDialogue);
    if (dialogueIssues.length > 0) {
      errors.flowDialogue = dialogueIssues[0].message;
    }
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
    const destinations = input.whatsappDestinations ?? [];
    const filled = destinations.filter(
      (entry) => entry.label.trim() || entry.phoneNumber.trim(),
    );
    const isMulti = filled.length > 1;

    if (filled.length === 0) {
      errors.whatsappDestinations =
        "Informe o número do WhatsApp com DDI e DDD, ex.: +55 11 99999-0000.";
    }

    const seenLabels = new Set<string>();
    const seenPhones = new Set<string>();
    for (const [index, entry] of filled.entries()) {
      const position = `Número ${index + 1}`;
      const label = entry.label.trim();
      const phone = entry.phoneNumber.trim();

      if (!phone) {
        errors.whatsappDestinations ??= `${position}: informe o número com DDI e DDD.`;
      } else if (!isValidWhatsAppPhone(phone)) {
        errors.whatsappDestinations ??= `${position}: use um número válido com DDI e DDD (mínimo 10 dígitos).`;
      } else {
        const digits = normalizeWhatsAppPhone(phone);
        if (seenPhones.has(digits)) {
          errors.whatsappDestinations ??= `${position}: este número já foi adicionado.`;
        }
        seenPhones.add(digits);
      }

      // The label is what the visitor picks in the routing question, so it is
      // only required — and only has to be unique — once there is a choice.
      if (isMulti) {
        if (!label) {
          errors.whatsappDestinations ??= `${position}: dê um nome ao consultório para o visitante escolher, ex.: "Consultório de SP".`;
        } else {
          const key = label.toLocaleLowerCase("pt-BR");
          if (seenLabels.has(key)) {
            errors.whatsappDestinations ??= `${position}: já existe um consultório chamado “${label}”.`;
          }
          seenLabels.add(key);
        }
      }
    }

    if (isMulti && !input.whatsappRoutingQuestion.trim()) {
      errors.whatsappRoutingQuestion =
        "Escreva a pergunta que o bot fará para escolher o consultório.";
    }

    if (!input.whatsappMessageTemplate.trim()) {
      errors.whatsappMessageTemplate =
        "Escreva a mensagem que será enviada ao abrir o WhatsApp.";
    }
  }

  const teasers = (input.launcherTeaserTexts ?? [])
    .map((t) => t.trim())
    .filter(Boolean);
  if (teasers.length === 0) {
    errors.launcherTeaserTexts =
      "Escreva ao menos uma frase para o balão do site.";
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
