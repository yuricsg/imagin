/** Conversation flow types — shared by the dashboard form and the widget API. */

export type FlowTone = "friendly" | "formal";

export type FlowFieldKey = "name" | "phone" | "email";

export type FlowTemplateId =
  | "patient-capture"
  | "appointment"
  | "exam-scheduling"
  | "triage";

/** How the clinic bills — drives the convênio question in the conversation. */
export type InsuranceMode = "particular" | "convenio" | "both";

export interface ChatbotFlowConfig {
  templateId: FlowTemplateId;
  tone: FlowTone;
  /** Empty string → template default greeting with bot/client names interpolated. */
  greeting: string;
  /** Contact fields the bot collects, in order. */
  collectFields: FlowFieldKey[];
  /** Services / procedures / exams the clinic offers — shown as options in the chat. */
  services: string[];
  /** Whether the clinic serves particular, convênio, or both. */
  insuranceMode: InsuranceMode;
  /** Accepted health-insurance plans (when insuranceMode allows convênio). */
  insurances: string[];
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
  /** Starter list of services for this kind of clinic — the operator can edit. */
  defaultServices: string[];
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

export const INSURANCE_MODE_LABELS: Record<InsuranceMode, string> = {
  particular: "Somente particular",
  convenio: "Somente convênio",
  both: "Particular e convênio",
};

export const INSURANCE_MODE_ORDER: InsuranceMode[] = [
  "particular",
  "convenio",
  "both",
];

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
    description: "Primeiro contato: interesse, convênio e dados de contato",
    suggestedSpecialty: "Captação de pacientes",
    defaultCollectFields: ["name", "phone", "email"],
    defaultGreeting:
      "Olá! Sou {botName}, assistente da {clientName}. Posso te ajudar a marcar uma consulta ou tirar dúvidas?",
    prompts: [
      "Qual atendimento ou queixa você gostaria de tratar?",
      "Você tem convênio ou prefere particular?",
    ],
    defaultServices: ["Primeira consulta", "Avaliação", "Retorno"],
  },
  appointment: {
    id: "appointment",
    label: "Agendamento de consulta",
    description: "Horário preferido e dados para confirmar a consulta",
    suggestedSpecialty: "Agendamento de consultas",
    defaultCollectFields: ["name", "phone"],
    defaultGreeting:
      "Oi! Aqui é {botName} da {clientName}. Vamos agendar sua consulta?",
    prompts: ["Qual dia e horário funcionam melhor para você?"],
    defaultServices: ["Consulta", "Retorno", "Teleconsulta"],
  },
  "exam-scheduling": {
    id: "exam-scheduling",
    label: "Agendamento de exames",
    description: "Escolha do exame, solicitação médica e contato",
    suggestedSpecialty: "Agendamento de exames",
    defaultCollectFields: ["name", "phone"],
    defaultGreeting:
      "Olá! Sou {botName}, da {clientName}. Vou te ajudar a agendar seu exame.",
    prompts: [
      "Qual exame você precisa realizar?",
      "Você já tem a solicitação médica?",
    ],
    defaultServices: [
      "Eletrocardiograma",
      "Ultrassonografia",
      "Exames laboratoriais",
      "Raio-X",
    ],
  },
  triage: {
    id: "triage",
    label: "Triagem / pré-atendimento",
    description: "Entende a queixa e prioriza urgências antes do contato",
    suggestedSpecialty: "Triagem de pacientes",
    defaultCollectFields: ["name", "phone"],
    defaultGreeting:
      "Olá! Sou {botName}, da {clientName}. Vou fazer algumas perguntas rápidas para entender seu caso.",
    prompts: [
      "Qual sintoma ou queixa você está sentindo?",
      "Há quanto tempo isso começou?",
    ],
    defaultServices: ["Avaliação de sintomas", "Atendimento de urgência"],
  },
};

export const FLOW_TEMPLATE_ORDER: FlowTemplateId[] = [
  "patient-capture",
  "appointment",
  "exam-scheduling",
  "triage",
];

/** Common medical specialties — used as quick-fill suggestions in the form. */
export const MEDICAL_SPECIALTIES: string[] = [
  "Cardiologia",
  "Dermatologia",
  "Ginecologia e Obstetrícia",
  "Ortopedia",
  "Pediatria",
  "Oftalmologia",
  "Endocrinologia",
  "Psiquiatria",
  "Otorrinolaringologia",
  "Nutrição",
  "Fisioterapia",
  "Odontologia",
  "Clínica Geral",
];

/** Maps common intent keywords in the specialty/role text to a default template. */
export function suggestTemplateForSpecialty(
  specialty: string,
): FlowTemplateId {
  const lower = specialty.trim().toLowerCase();
  if (lower.includes("exame")) return "exam-scheduling";
  if (
    lower.includes("triagem") ||
    lower.includes("urg") ||
    lower.includes("sintoma")
  ) {
    return "triage";
  }
  if (lower.includes("agend") || lower.includes("consulta")) {
    return "appointment";
  }
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
    services: [...template.defaultServices],
    insuranceMode: "both",
    insurances: [],
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
    const service = flow.services[0];
    messages.push({ role: "visitor", text: service ?? "…" });
  }

  if (flow.insuranceMode !== "particular") {
    messages.push({
      role: "bot",
      text: "Você vai usar convênio ou prefere particular?",
    });
    const insurance = flow.insurances[0];
    messages.push({
      role: "visitor",
      text: insurance ? `Convênio ${insurance}` : "Particular",
    });
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
