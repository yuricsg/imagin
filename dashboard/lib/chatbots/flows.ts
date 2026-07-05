/** Conversation flow types — shared by the dashboard form and the future widget API. */

export type FlowTone = "friendly" | "formal";

export type FlowFieldKey = "name" | "phone" | "email";

export type FlowTemplateId =
  | "patient-capture"
  | "appointment"
  | "lead-capture"
  | "legal-intake";

export interface ChatbotFlowConfig {
  templateId: FlowTemplateId;
  tone: FlowTone;
  /** Empty string → template default greeting with bot/client names interpolated. */
  greeting: string;
  /** Contact fields the bot collects, in order. */
  collectFields: FlowFieldKey[];
}

export interface FlowTemplate {
  id: FlowTemplateId;
  label: string;
  description: string;
  suggestedSpecialty: string;
  defaultCollectFields: FlowFieldKey[];
  defaultGreeting: string;
  /** Bot messages after the greeting, before collecting contact data. */
  prompts: string[];
}

export const FLOW_FIELD_LABELS: Record<FlowFieldKey, string> = {
  name: "Nome",
  phone: "Telefone",
  email: "E-mail",
};

export const FLOW_TONE_LABELS: Record<FlowTone, string> = {
  friendly: "Amigável",
  formal: "Formal",
};

const COLLECT_PROMPTS: Record<FlowFieldKey, { friendly: string; formal: string }> =
  {
    name: {
      friendly: "Qual é o seu nome?",
      formal: "Por favor, informe seu nome completo.",
    },
    phone: {
      friendly: "Qual o melhor telefone para contato?",
      formal: "Informe um telefone para retorno.",
    },
    email: {
      friendly: "E o seu e-mail?",
      formal: "Informe seu endereço de e-mail.",
    },
  };

const COLLECT_PLACEHOLDERS: Record<FlowFieldKey, string> = {
  name: "Maria Silva",
  phone: "(11) 99999-0000",
  email: "maria@email.com",
};

export const FLOW_TEMPLATES: Record<FlowTemplateId, FlowTemplate> = {
  "patient-capture": {
    id: "patient-capture",
    label: "Captação de pacientes",
    description: "Interesse no serviço, convênio e contato",
    suggestedSpecialty: "Captação de pacientes — Dermatologia",
    defaultCollectFields: ["name", "phone", "email"],
    defaultGreeting:
      "Olá! Sou {botName}, assistente da {clientName}. Posso te ajudar a marcar uma consulta ou tirar dúvidas?",
    prompts: [
      "Qual procedimento ou queixa você gostaria de tratar?",
      "Você tem convênio ou prefere particular?",
    ],
  },
  appointment: {
    id: "appointment",
    label: "Agendamento",
    description: "Horário preferido e dados para confirmar",
    suggestedSpecialty: "Agendamento — Clínica odontológica",
    defaultCollectFields: ["name", "phone"],
    defaultGreeting:
      "Oi! Aqui é {botName} da {clientName}. Vamos agendar sua consulta?",
    prompts: ["Qual dia e horário funcionam melhor para você?"],
  },
  "lead-capture": {
    id: "lead-capture",
    label: "Captação de leads",
    description: "Interesse no imóvel ou serviço e contato",
    suggestedSpecialty: "Captação de leads — Imobiliária",
    defaultCollectFields: ["name", "phone", "email"],
    defaultGreeting:
      "Olá! Sou {botName}, da {clientName}. Em que posso te ajudar hoje?",
    prompts: ["O que você está procurando?"],
  },
  "legal-intake": {
    id: "legal-intake",
    label: "Atendimento jurídico",
    description: "Tipo de caso e dados para retorno",
    suggestedSpecialty: "Atendimento — Advocacia",
    defaultCollectFields: ["name", "phone", "email"],
    defaultGreeting:
      "Bom dia. Sou {botName}, assistente da {clientName}. Como posso orientá-lo(a)?",
    prompts: ["Qual assunto você gostaria de tratar?"],
  },
};

export const FLOW_TEMPLATE_ORDER: FlowTemplateId[] = [
  "patient-capture",
  "appointment",
  "lead-capture",
  "legal-intake",
];

/** Maps the specialty suggestion chips to a default flow template. */
const SPECIALTY_TO_TEMPLATE: Record<string, FlowTemplateId> = {
  "Captação de pacientes — Dermatologia": "patient-capture",
  "Agendamento — Clínica odontológica": "appointment",
  "Captação de leads — Imobiliária": "lead-capture",
  "Atendimento — Advocacia": "legal-intake",
};

export function suggestTemplateForSpecialty(
  specialty: string,
): FlowTemplateId {
  const trimmed = specialty.trim();
  if (trimmed in SPECIALTY_TO_TEMPLATE) {
    return SPECIALTY_TO_TEMPLATE[trimmed];
  }
  const lower = trimmed.toLowerCase();
  if (lower.includes("agend")) return "appointment";
  if (lower.includes("imobili") || lower.includes("lead")) return "lead-capture";
  if (lower.includes("advoc") || lower.includes("juríd")) return "legal-intake";
  return "patient-capture";
}

export function defaultFlowForTemplate(
  templateId: FlowTemplateId,
): ChatbotFlowConfig {
  const template = FLOW_TEMPLATES[templateId];
  return {
    templateId,
    tone: "friendly",
    greeting: "",
    collectFields: [...template.defaultCollectFields],
  };
}

export function resolveGreeting(
  flow: ChatbotFlowConfig,
  ctx: { botName: string; clientName: string },
): string {
  const raw = flow.greeting.trim();
  const template = FLOW_TEMPLATES[flow.templateId];
  const base = raw || template.defaultGreeting;
  return base
    .replaceAll("{botName}", ctx.botName.trim() || "assistente")
    .replaceAll("{clientName}", ctx.clientName.trim() || "nossa equipe");
}

export type FlowPreviewMessage = {
  role: "bot" | "visitor";
  text: string;
};

/** Builds a short chat preview for the form — not the full runtime flow. */
export function buildFlowPreview(
  flow: ChatbotFlowConfig,
  ctx: { botName: string; clientName: string },
): FlowPreviewMessage[] {
  const template = FLOW_TEMPLATES[flow.templateId];
  const messages: FlowPreviewMessage[] = [
    { role: "bot", text: resolveGreeting(flow, ctx) },
  ];

  for (const prompt of template.prompts.slice(0, 1)) {
    messages.push({ role: "bot", text: prompt });
    messages.push({ role: "visitor", text: "…" });
  }

  for (const field of flow.collectFields) {
    messages.push({
      role: "bot",
      text: COLLECT_PROMPTS[field][flow.tone],
    });
    messages.push({
      role: "visitor",
      text: COLLECT_PLACEHOLDERS[field],
    });
  }

  messages.push({
    role: "bot",
    text:
      flow.tone === "formal"
        ? "Obrigado. Nossa equipe entrará em contato em breve."
        : "Perfeito! Já recebemos seus dados — em breve nossa equipe fala com você.",
  });

  return messages;
}

/** Default flow for catalog bots without explicit config (backward compatible). */
export function defaultFlowForSpecialty(specialty: string): ChatbotFlowConfig {
  return defaultFlowForTemplate(suggestTemplateForSpecialty(specialty));
}
