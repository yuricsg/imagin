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

/** Input widget for a dialogue step. */
export type FlowInputType = "text" | "single_choice" | "multi_choice";

/** Linear sequence vs option-driven branching. */
export type FlowShape = "linear" | "branching";

/** Built-in lead fields a step answer can populate. */
export type FlowMapsTo = "name" | "phone" | "email" | "message";

/**
 * Where to store the answer: a built-in lead field, a custom category key,
 * or undefined / empty to keep it only under the step id in `answers`.
 */
export type FlowSaveAs = FlowMapsTo | (string & {});

export interface FlowStepOption {
  id: string;
  label: string;
  /**
   * Branching only: next step id, omit / empty to end the flow with the
   * WhatsApp handoff, or FLOW_END_NO_WHATSAPP to end politely without it.
   */
  nextStepId?: string;
}

export interface FlowStep {
  id: string;
  question: string;
  inputType: FlowInputType;
  /** Required when inputType is single_choice or multi_choice. */
  options?: FlowStepOption[];
  required?: boolean;
  /**
   * Built-in field or custom category key (see DialogueFlow.customSaveLabels).
   * Prefer this over the legacy `mapsTo` alias.
   */
  saveAs?: FlowSaveAs;
  /** @deprecated Use saveAs — kept for older saved bots. */
  mapsTo?: FlowMapsTo;
}

export interface DialogueFlow {
  version: 1;
  shape: FlowShape;
  greeting: string;
  steps: FlowStep[];
  /** First step after the greeting. */
  startStepId: string;
  /** Labels for custom saveAs keys (e.g. { convenio: "Convênio" }). */
  customSaveLabels?: Record<string, string>;
}

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
  /**
   * Custom dialogue for bots created with the dialogue builder.
   * Absent on legacy bots — widget keeps the cardiology state machine.
   */
  dialogue?: DialogueFlow;
}

export interface FlowTemplate {
  id: FlowTemplateId;
  label: string;
  description: string;
  suggestedSpecialty: string;
  defaultCollectFields: FlowFieldKey[];
  /** @deprecated Prefer greetingsByTone — kept for callers that only need one string. */
  defaultGreeting: string;
  greetingsByTone: Record<FlowTone, string>;
  /** Bot messages after the greeting, before collecting contact data. */
  prompts: string[];
  promptsByTone: Record<FlowTone, string[]>;
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

export const FLOW_SHAPE_LABELS: Record<FlowShape, string> = {
  linear: "Linear",
  branching: "Com ramificações",
};

export const FLOW_INPUT_TYPE_LABELS: Record<FlowInputType, string> = {
  text: "Campo de texto",
  single_choice: "Uma opção",
  multi_choice: "Várias opções",
};

export const FLOW_MAPS_TO_LABELS: Record<FlowMapsTo, string> = {
  name: "Nome do lead",
  phone: "Telefone",
  email: "E-mail",
  message: "Assunto / mensagem",
};

export const BUILTIN_SAVE_AS: FlowMapsTo[] = [
  "name",
  "phone",
  "email",
  "message",
];

export function isBuiltinSaveAs(value: string | undefined | null): value is FlowMapsTo {
  return (
    value === "name" ||
    value === "phone" ||
    value === "email" ||
    value === "message"
  );
}

/** Resolves the effective save key for a step (saveAs wins over legacy mapsTo). */
export function resolveStepSaveAs(step: FlowStep): string | undefined {
  const raw = (step.saveAs ?? step.mapsTo)?.trim();
  return raw || undefined;
}

/** Human label for a saveAs key. */
export function labelForSaveAs(
  key: string,
  customLabels?: Record<string, string>,
): string {
  if (isBuiltinSaveAs(key)) return FLOW_MAPS_TO_LABELS[key];
  return customLabels?.[key]?.trim() || key;
}

/**
 * Resolves a stored answer to what the visitor actually saw: choice steps
 * persist option ids (needed for branching), so they are mapped back to their
 * labels here. Free-text answers and unknown ids are returned unchanged —
 * never an empty string.
 */
export function resolveAnswerLabels(
  step: FlowStep | undefined,
  answer: string | string[],
): string | string[] {
  const options = step?.options;
  if (!options || options.length === 0) return answer;
  const toLabel = (value: string) => {
    const label = options
      .find((option) => option.id === value)
      ?.label.trim();
    return label || value;
  };
  return Array.isArray(answer) ? answer.map(toLabel) : toLabel(answer);
}

/** Slug for a new custom save category. */
export function slugifySaveAsKey(label: string): string {
  const base = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || `campo-${Date.now().toString(36)}`;
}

export const FLOW_SHAPE_GUIDE: Record<
  FlowShape,
  {
    title: string;
    summary: string;
    benefits: string[];
    drawbacks: string[];
    bestFor: string;
  }
> = {
  linear: {
    title: "Fluxo linear",
    summary:
      "Todas as pessoas passam pelas mesmas perguntas, na mesma ordem — do início ao fim.",
    benefits: [
      "Mais simples de montar e revisar",
      "Previsível: todo lead responde o mesmo roteiro",
      "Ideal para captação rápida (nome, telefone, interesse)",
      "Menos chance de o visitante se perder no meio do caminho",
    ],
    drawbacks: [
      "Não adapta a conversa ao que a pessoa escolheu",
      "Pode fazer perguntas irrelevantes (ex.: convênio para quem já disse particular)",
      "Fica longo se você precisar cobrir muitos cenários diferentes",
    ],
    bestFor:
      "Clínicas que querem um formulário conversacional curto e uniforme.",
  },
  branching: {
    title: "Fluxo com ramificações",
    summary:
      "Cada opção de resposta pode levar a uma pergunta diferente — ou encerrar o atendimento.",
    benefits: [
      "Conversa sob medida: exame vs consulta vs urgência",
      "Evita perguntas desnecessárias",
      "Permite caminhos curtos (ex.: urgência → WhatsApp direto)",
      "Melhor para especialidades com vários tipos de atendimento",
    ],
    drawbacks: [
      "Mais complexo de configurar e testar",
      "Fácil esquecer um caminho sem saída ou sem contato",
      "A prévia mostra só um caminho — revise cada ramificação",
      "Leads ficam mais heterogêneos (campos diferentes por rota)",
    ],
    bestFor:
      "Clínicas com fluxos distintos (exames, consultas, triagem) no mesmo bot.",
  },
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
      friendly: "Como posso te chamar? 🙂",
      formal: "Por favor, informe seu nome completo.",
    },
    phone: {
      friendly: "Qual o melhor WhatsApp ou telefone pra gente te retornar?",
      formal: "Informe um telefone com DDD para retorno.",
    },
    email: {
      friendly: "E o seu e-mail? (se preferir, pode pular depois)",
      formal: "Informe seu endereço de e-mail para contato.",
    },
  };

/** Stock collect-field question for the selected tone. */
export function collectPromptFor(field: FlowFieldKey, tone: FlowTone): string {
  return COLLECT_PROMPTS[field][tone];
}

/** Closing line shown after the visitor finishes the flow. */
export function closingMessageForTone(tone: FlowTone): string {
  return tone === "formal"
    ? "Agradecemos o contato. Nossa equipe analisará as informações e retornará em breve."
    : "Prontinho! 🎉 Já recebemos tudo — em breve alguém da equipe fala com você.";
}

/**
 * Serialized `FlowStepOption.nextStepId` meaning "end the conversation politely,
 * without the WhatsApp handoff". An empty nextStepId keeps the original
 * behavior (end and hand off to WhatsApp), so bots saved before this value
 * existed are unaffected. The value can never collide with generated step ids
 * (`step-*`).
 */
export const FLOW_END_NO_WHATSAPP = "end:no-whatsapp";

/** True when a nextStepId is the polite no-WhatsApp ending. */
export function isFarewellEnding(nextStepId: string | undefined): boolean {
  return nextStepId?.trim() === FLOW_END_NO_WHATSAPP;
}

/** Goodbye bubble when the flow ends without the WhatsApp handoff. */
export function farewellMessageForTone(tone: FlowTone): string {
  return tone === "formal"
    ? "Agradecemos o contato. Se precisar, estamos à disposição por aqui."
    : "Tudo bem! Se precisar, é só chamar por aqui. 😊";
}

/** All stock strings for a template (greeting + prompts + collect + legacy). */
export function stockStringsForTemplate(
  templateId: FlowTemplateId,
): Set<string> {
  const template = FLOW_TEMPLATES[templateId];
  const strings = new Set<string>();
  for (const t of ["friendly", "formal"] as const) {
    strings.add(template.greetingsByTone[t].trim());
    for (const prompt of template.promptsByTone[t]) {
      strings.add(prompt.trim());
    }
  }
  for (const field of Object.keys(COLLECT_PROMPTS) as FlowFieldKey[]) {
    strings.add(COLLECT_PROMPTS[field].friendly);
    strings.add(COLLECT_PROMPTS[field].formal);
  }
  strings.add(closingMessageForTone("friendly"));
  strings.add(closingMessageForTone("formal"));
  // Legacy stock strings from before the tone rewrite.
  strings.add(
    "Olá! Sou {botName}, assistente da {clientName}. Posso te ajudar a marcar uma consulta ou tirar dúvidas?",
  );
  strings.add("Qual atendimento ou queixa você gostaria de tratar?");
  strings.add("Você tem convênio ou prefere particular?");
  strings.add("Qual é o seu nome?");
  strings.add("Qual o melhor telefone para contato?");
  strings.add("E o seu e-mail?");
  strings.add("Por favor, informe seu nome completo.");
  strings.add("Informe um telefone para retorno.");
  strings.add("Informe seu endereço de e-mail.");
  strings.add(
    "Perfeito! Já recebemos seus dados — em breve nossa equipe fala com você.",
  );
  strings.add("Obrigado. Nossa equipe entrará em contato em breve.");
  return strings;
}

function isStockCopy(value: string, templateId: FlowTemplateId): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return stockStringsForTemplate(templateId).has(trimmed);
}

/**
 * Rewrites greeting + stock dialogue questions to match the selected tone.
 * Operator-edited copy is left alone.
 */
export function applyToneToDialogue(
  dialogue: DialogueFlow,
  tone: FlowTone,
  templateId: FlowTemplateId,
): DialogueFlow {
  const template = FLOW_TEMPLATES[templateId];
  const prompts = template.promptsByTone[tone];
  const stock = stockStringsForTemplate(templateId);

  const nextGreeting = isStockCopy(dialogue.greeting, templateId)
    ? template.greetingsByTone[tone]
    : dialogue.greeting;

  let promptIndex = 0;
  const steps = dialogue.steps.map((step) => {
    const saveAs = resolveStepSaveAs(step);
    if (saveAs === "name" || saveAs === "phone" || saveAs === "email") {
      const variants = COLLECT_PROMPTS[saveAs];
      const current = step.question.trim();
      const isStock =
        !current ||
        current === variants.friendly ||
        current === variants.formal ||
        stock.has(current);
      if (!isStock) return step;
      return { ...step, question: variants[tone] };
    }

    // Non-contact steps: rewrite if still a stock template prompt.
    const current = step.question.trim();
    if (!current || stock.has(current)) {
      const replacement =
        prompts[promptIndex] ??
        prompts[prompts.length - 1] ??
        step.question;
      promptIndex += 1;
      return { ...step, question: replacement };
    }
    promptIndex += 1;
    return step;
  });

  return {
    ...dialogue,
    greeting: nextGreeting,
    steps,
  };
}

/** Greeting string for a template + tone (with placeholders intact). */
export function greetingForTone(
  templateId: FlowTemplateId,
  tone: FlowTone,
): string {
  return FLOW_TEMPLATES[templateId].greetingsByTone[tone];
}

const COLLECT_PLACEHOLDERS: Record<FlowFieldKey, string> = {
  name: "Maria Silva",
  phone: "(11) 99999-0000",
  email: "maria@email.com",
};

const PATIENT_CAPTURE_GREETINGS = {
  friendly:
    "Oi! 👋 Eu sou {botName}, da {clientName}. Posso te ajudar a marcar uma consulta ou tirar uma dúvida rapidinho?",
  formal:
    "Bom dia. Sou {botName}, assistente virtual da {clientName}. Em que posso ser útil: agendamento ou informações?",
} as const satisfies Record<FlowTone, string>;

const PATIENT_CAPTURE_PROMPTS = {
  friendly: [
    "O que você precisa hoje? Pode escolher uma opção abaixo 🙂",
    "Você usa convênio ou prefere particular?",
  ],
  formal: [
    "Selecione o tipo de atendimento desejado.",
    "Informe se o atendimento será por convênio ou particular.",
  ],
} as const satisfies Record<FlowTone, readonly string[]>;

const APPOINTMENT_GREETINGS = {
  friendly:
    "Oi! Aqui é {botName} da {clientName} 😊 Vamos achar um horário pra sua consulta?",
  formal:
    "Olá. Sou {botName}, da {clientName}. Vamos proceder com o agendamento da sua consulta.",
} as const satisfies Record<FlowTone, string>;

const APPOINTMENT_PROMPTS = {
  friendly: ["Qual dia e horário ficam melhores pra você?"],
  formal: ["Informe a data e o horário de preferência para a consulta."],
} as const satisfies Record<FlowTone, readonly string[]>;

const EXAM_GREETINGS = {
  friendly:
    "Oi! Sou {botName}, da {clientName}. Vou te ajudar a agendar seu exame 💙",
  formal:
    "Olá. Sou {botName}, da {clientName}. Posso auxiliar no agendamento do seu exame.",
} as const satisfies Record<FlowTone, string>;

const EXAM_PROMPTS = {
  friendly: [
    "Qual exame você precisa fazer?",
    "Você já tem a solicitação médica?",
  ],
  formal: [
    "Selecione o exame a ser agendado.",
    "Possui solicitação médica?",
  ],
} as const satisfies Record<FlowTone, readonly string[]>;

const TRIAGE_GREETINGS = {
  friendly:
    "Oi! Sou {botName}, da {clientName}. Vou fazer umas perguntinhas rápidas pra entender seu caso 🙂",
  formal:
    "Olá. Sou {botName}, da {clientName}. Farei algumas perguntas para triagem do seu caso.",
} as const satisfies Record<FlowTone, string>;

const TRIAGE_PROMPTS = {
  friendly: [
    "O que você está sentindo?",
    "Isso começou há quanto tempo?",
  ],
  formal: [
    "Descreva o sintoma ou queixa principal.",
    "Há quanto tempo o quadro se iniciou?",
  ],
} as const satisfies Record<FlowTone, readonly string[]>;

export const FLOW_TEMPLATES: Record<FlowTemplateId, FlowTemplate> = {
  "patient-capture": {
    id: "patient-capture",
    label: "Captação de pacientes",
    description: "Primeiro contato: interesse, convênio e dados de contato",
    suggestedSpecialty: "Captação de pacientes",
    defaultCollectFields: ["name", "phone", "email"],
    greetingsByTone: { ...PATIENT_CAPTURE_GREETINGS },
    defaultGreeting: PATIENT_CAPTURE_GREETINGS.friendly,
    promptsByTone: {
      friendly: [...PATIENT_CAPTURE_PROMPTS.friendly],
      formal: [...PATIENT_CAPTURE_PROMPTS.formal],
    },
    prompts: [...PATIENT_CAPTURE_PROMPTS.friendly],
    defaultServices: ["Primeira consulta", "Avaliação", "Retorno"],
  },
  appointment: {
    id: "appointment",
    label: "Agendamento de consulta",
    description: "Horário preferido e dados para confirmar a consulta",
    suggestedSpecialty: "Agendamento de consultas",
    defaultCollectFields: ["name", "phone"],
    greetingsByTone: { ...APPOINTMENT_GREETINGS },
    defaultGreeting: APPOINTMENT_GREETINGS.friendly,
    promptsByTone: {
      friendly: [...APPOINTMENT_PROMPTS.friendly],
      formal: [...APPOINTMENT_PROMPTS.formal],
    },
    prompts: [...APPOINTMENT_PROMPTS.friendly],
    defaultServices: ["Consulta", "Retorno", "Teleconsulta"],
  },
  "exam-scheduling": {
    id: "exam-scheduling",
    label: "Agendamento de exames",
    description: "Escolha do exame, solicitação médica e contato",
    suggestedSpecialty: "Agendamento de exames",
    defaultCollectFields: ["name", "phone"],
    greetingsByTone: { ...EXAM_GREETINGS },
    defaultGreeting: EXAM_GREETINGS.friendly,
    promptsByTone: {
      friendly: [...EXAM_PROMPTS.friendly],
      formal: [...EXAM_PROMPTS.formal],
    },
    prompts: [...EXAM_PROMPTS.friendly],
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
    greetingsByTone: { ...TRIAGE_GREETINGS },
    defaultGreeting: TRIAGE_GREETINGS.friendly,
    promptsByTone: {
      friendly: [...TRIAGE_PROMPTS.friendly],
      formal: [...TRIAGE_PROMPTS.formal],
    },
    prompts: [...TRIAGE_PROMPTS.friendly],
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

let stepIdCounter = 0;

/** Stable-enough unique id for new steps/options in the form. */
export function createFlowId(prefix: string): string {
  stepIdCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${stepIdCounter}`;
}

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

/** Builds an editable DialogueFlow seed from a template + clinic metadata. */
export function seedDialogueFromTemplate(
  templateId: FlowTemplateId,
  options: {
    shape?: FlowShape;
    services?: string[];
    insuranceMode?: InsuranceMode;
    insurances?: string[];
    collectFields?: FlowFieldKey[];
    greeting?: string;
    tone?: FlowTone;
  } = {},
): DialogueFlow {
  const template = FLOW_TEMPLATES[templateId];
  const shape = options.shape ?? "linear";
  const services =
    options.services && options.services.length > 0
      ? options.services
      : [...template.defaultServices];
  const collectFields =
    options.collectFields && options.collectFields.length > 0
      ? options.collectFields
      : [...template.defaultCollectFields];
  const insuranceMode = options.insuranceMode ?? "both";
  const tone = options.tone ?? "friendly";
  const steps: FlowStep[] = [];

  const tonePrompts = template.promptsByTone[tone];
  const serviceStepId = createFlowId("step");
  const serviceOptions: FlowStepOption[] = services.map((label) => ({
    id: createFlowId("opt"),
    label,
  }));
  steps.push({
    id: serviceStepId,
    question: tonePrompts[0] ?? "Como podemos te ajudar?",
    inputType: "single_choice",
    options: serviceOptions,
    required: true,
    saveAs: "message",
    mapsTo: "message",
  });

  if (insuranceMode !== "particular") {
    const insuranceStepId = createFlowId("step");
    const insuranceOptions: FlowStepOption[] = [
      { id: createFlowId("opt"), label: "Particular" },
      ...(options.insurances ?? []).map((label) => ({
        id: createFlowId("opt"),
        label: `Convênio ${label}`,
      })),
      ...(options.insurances && options.insurances.length > 0
        ? []
        : [{ id: createFlowId("opt"), label: "Convênio" }]),
    ];
    steps.push({
      id: insuranceStepId,
      question:
        tonePrompts[1] ??
        "Você vai usar convênio ou prefere particular?",
      inputType: "single_choice",
      options: insuranceOptions,
      required: true,
    });
  }

  for (const field of collectFields) {
    steps.push({
      id: createFlowId("step"),
      question: COLLECT_PROMPTS[field][tone],
      inputType: "text",
      required: true,
      saveAs: field,
      mapsTo: field,
    });
  }

  const greeting =
    (options.greeting ?? "").trim() || template.greetingsByTone[tone];

  return {
    version: 1,
    shape,
    greeting,
    steps,
    startStepId: steps[0]?.id ?? "",
  };
}

export function defaultFlowForTemplate(
  templateId: FlowTemplateId,
): ChatbotFlowConfig {
  const template = FLOW_TEMPLATES[templateId];
  const base: ChatbotFlowConfig = {
    templateId,
    tone: "friendly",
    greeting: "",
    collectFields: [...template.defaultCollectFields],
    services: [...template.defaultServices],
    insuranceMode: "both",
    insurances: [],
  };
  return base;
}

/** New bots always get a dialogue seed so the widget uses the custom interpreter. */
export function defaultFlowWithDialogue(
  templateId: FlowTemplateId,
): ChatbotFlowConfig {
  const base = defaultFlowForTemplate(templateId);
  return {
    ...base,
    dialogue: seedDialogueFromTemplate(templateId, {
      services: base.services,
      collectFields: base.collectFields,
      insuranceMode: base.insuranceMode,
      tone: base.tone,
    }),
  };
}

export function resolveGreeting(
  flow: ChatbotFlowConfig,
  ctx: { botName: string; clientName: string },
): string {
  const dialogueGreeting = flow.dialogue?.greeting?.trim();
  const raw = dialogueGreeting || flow.greeting.trim();
  const template = FLOW_TEMPLATES[flow.templateId];
  const base = raw || template.greetingsByTone[flow.tone];
  return base
    .replaceAll("{botName}", ctx.botName.trim() || "assistente")
    .replaceAll("{clientName}", ctx.clientName.trim() || "nossa equipe");
}

export type FlowPreviewMessage = {
  role: "bot" | "visitor";
  text: string;
};

function isChoiceType(type: FlowInputType): boolean {
  return type === "single_choice" || type === "multi_choice";
}

/** Preview driven by DialogueFlow when present; falls back to template preview. */
export function buildFlowPreview(
  flow: ChatbotFlowConfig,
  ctx: { botName: string; clientName: string; closingMessage?: string },
): FlowPreviewMessage[] {
  if (flow.dialogue && flow.dialogue.steps.length > 0) {
    return buildDialoguePreview(flow.dialogue, flow, ctx);
  }

  const template = FLOW_TEMPLATES[flow.templateId];
  const messages: FlowPreviewMessage[] = [
    { role: "bot", text: resolveGreeting(flow, ctx) },
  ];

  const tonePrompts = template.promptsByTone[flow.tone];
  for (const prompt of tonePrompts.slice(0, 1)) {
    messages.push({ role: "bot", text: prompt });
    const service = flow.services[0];
    messages.push({ role: "visitor", text: service ?? "…" });
  }

  if (flow.insuranceMode !== "particular") {
    messages.push({
      role: "bot",
      text:
        tonePrompts[1] ??
        "Você vai usar convênio ou prefere particular?",
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
    text: ctx.closingMessage?.trim() || closingMessageForTone(flow.tone),
  });

  return messages;
}

function buildDialoguePreview(
  dialogue: DialogueFlow,
  flow: ChatbotFlowConfig,
  ctx: { botName: string; clientName: string; closingMessage?: string },
): FlowPreviewMessage[] {
  const messages: FlowPreviewMessage[] = [
    {
      role: "bot",
      text: resolveGreeting({ ...flow, dialogue }, ctx),
    },
  ];

  const byId = new Map<string, FlowStep>(
    dialogue.steps.map((s) => [s.id, s]),
  );
  let currentId: string | undefined =
    dialogue.startStepId || dialogue.steps[0]?.id;
  const visited = new Set<string>();
  let endedFarewell = false;

  while (currentId && byId.has(currentId) && !visited.has(currentId)) {
    visited.add(currentId);
    const step: FlowStep = byId.get(currentId)!;
    messages.push({ role: "bot", text: step.question });

    if (isChoiceType(step.inputType) && step.options && step.options.length > 0) {
      const option = step.options[0];
      messages.push({ role: "visitor", text: option.label });
      if (dialogue.shape === "branching") {
        const next = option.nextStepId?.trim();
        if (isFarewellEnding(next)) {
          endedFarewell = true;
          currentId = undefined;
        } else {
          currentId = next || undefined;
        }
        continue;
      }
    } else {
      const saveAs = resolveStepSaveAs(step);
      if (saveAs && isBuiltinSaveAs(saveAs) && saveAs in COLLECT_PLACEHOLDERS) {
        messages.push({
          role: "visitor",
          text: COLLECT_PLACEHOLDERS[saveAs as FlowFieldKey],
        });
      } else {
        messages.push({ role: "visitor", text: "…" });
      }
    }

    const index = dialogue.steps.findIndex((s) => s.id === currentId);
    currentId =
      index >= 0 && index < dialogue.steps.length - 1
        ? dialogue.steps[index + 1].id
        : undefined;
  }

  messages.push({
    role: "bot",
    text: endedFarewell
      ? farewellMessageForTone(flow.tone)
      : ctx.closingMessage?.trim() || closingMessageForTone(flow.tone),
  });

  return messages;
}

/** True when the bot should use the custom dialogue interpreter. */
export function hasCustomDialogue(
  flow: ChatbotFlowConfig | undefined | null,
): flow is ChatbotFlowConfig & { dialogue: DialogueFlow } {
  return Boolean(flow?.dialogue?.version === 1 && flow.dialogue.steps.length > 0);
}

/** Finds a step by id. */
export function getDialogueStep(
  dialogue: DialogueFlow,
  stepId: string,
): FlowStep | undefined {
  return dialogue.steps.find((s) => s.id === stepId);
}

/**
 * Resolves the next step after an answer.
 * - linear: next in array order
 * - branching + single_choice: option.nextStepId (empty = end)
 * - branching + multi/text: next in array order
 */
export function resolveNextStepId(
  dialogue: DialogueFlow,
  currentStepId: string,
  answer?: string | string[],
): string | null {
  const index = dialogue.steps.findIndex((s) => s.id === currentStepId);
  if (index < 0) return null;
  const step = dialogue.steps[index];

  if (
    dialogue.shape === "branching" &&
    step.inputType === "single_choice" &&
    typeof answer === "string"
  ) {
    const option = step.options?.find(
      (o) => o.id === answer || o.label === answer,
    );
    if (option) {
      const next = option.nextStepId?.trim();
      return next || null;
    }
  }

  const next = dialogue.steps[index + 1];
  return next?.id ?? null;
}

/** Maps accumulated answers into known lead fields + custom categories. */
export function extractLeadFieldsFromAnswers(
  dialogue: DialogueFlow,
  answers: Record<string, string | string[]>,
): {
  name: string;
  phone: string;
  email: string;
  message: string;
  custom: Record<string, string>;
} {
  const result = {
    name: "",
    phone: "",
    email: "",
    message: "",
    custom: {} as Record<string, string>,
  };
  for (const step of dialogue.steps) {
    const saveAs = resolveStepSaveAs(step);
    if (!saveAs) continue;
    const raw = answers[step.id];
    if (raw == null) continue;
    // Choice answers are stored as option ids — surface the labels instead.
    const resolved = resolveAnswerLabels(step, raw);
    const value = Array.isArray(resolved) ? resolved.join(", ") : resolved;
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (isBuiltinSaveAs(saveAs)) {
      result[saveAs] = trimmed;
    } else {
      result.custom[saveAs] = trimmed;
    }
  }
  return result;
}

export type DialogueValidationIssue = {
  stepId?: string;
  message: string;
};

/** Validates a DialogueFlow for the wizard / runtime. */
export function validateDialogueFlow(
  dialogue: DialogueFlow | undefined | null,
): DialogueValidationIssue[] {
  const issues: DialogueValidationIssue[] = [];
  if (!dialogue) {
    issues.push({ message: "Monte ao menos uma etapa no diálogo." });
    return issues;
  }
  if (dialogue.version !== 1) {
    issues.push({ message: "Versão de diálogo inválida." });
  }
  if (dialogue.shape !== "linear" && dialogue.shape !== "branching") {
    issues.push({ message: "Escolha o formato do fluxo (linear ou com ramificações)." });
  }
  if (!dialogue.steps || dialogue.steps.length === 0) {
    issues.push({ message: "Adicione ao menos uma pergunta." });
    return issues;
  }

  const ids = new Set<string>();
  for (const step of dialogue.steps) {
    if (!step.id.trim()) {
      issues.push({ message: "Etapa sem identificador." });
      continue;
    }
    if (ids.has(step.id)) {
      issues.push({ stepId: step.id, message: "Id de etapa duplicado." });
    }
    ids.add(step.id);

    if (!step.question.trim()) {
      issues.push({
        stepId: step.id,
        message: "Informe o texto da pergunta.",
      });
    }

    if (isChoiceType(step.inputType)) {
      const options = step.options ?? [];
      const validOptions = options.filter((o) => o.label.trim());
      if (validOptions.length < 2) {
        issues.push({
          stepId: step.id,
          message: "Opções precisam de pelo menos 2 respostas.",
        });
      }
      if (dialogue.shape === "branching") {
        for (const option of validOptions) {
          const next = option.nextStepId?.trim();
          if (next && !ids.has(next) && !dialogue.steps.some((s) => s.id === next)) {
            // checked after full pass below
          }
        }
      }
    }
  }

  const start = dialogue.startStepId || dialogue.steps[0]?.id;
  if (!start || !ids.has(start)) {
    issues.push({ message: "Defina a primeira etapa do diálogo." });
  }

  if (!dialogue.steps.some((step) => resolveStepSaveAs(step) === "name")) {
    issues.push({
      message: "Adicione uma pergunta salva como Nome do lead.",
    });
  }

  if (dialogue.shape === "branching") {
    for (const step of dialogue.steps) {
      if (!isChoiceType(step.inputType)) continue;
      for (const option of step.options ?? []) {
        const next = option.nextStepId?.trim();
        if (next && !isFarewellEnding(next) && !ids.has(next)) {
          issues.push({
            stepId: step.id,
            message: `Opção "${option.label}" aponta para uma etapa inexistente.`,
          });
        }
      }
    }
  }

  return issues;
}

/** Parses unknown JSON into a DialogueFlow or returns undefined. */
export function normalizeDialogue(raw: unknown): DialogueFlow | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as Record<string, unknown>;
  if (record.version !== 1) return undefined;
  if (record.shape !== "linear" && record.shape !== "branching") return undefined;
  if (!Array.isArray(record.steps)) return undefined;

  const steps: FlowStep[] = [];
  for (const entry of record.steps) {
    if (!entry || typeof entry !== "object") continue;
    const step = entry as Record<string, unknown>;
    if (typeof step.id !== "string" || typeof step.question !== "string") {
      continue;
    }
    const inputType =
      step.inputType === "text" ||
      step.inputType === "single_choice" ||
      step.inputType === "multi_choice"
        ? step.inputType
        : "text";
    const optionsRaw = Array.isArray(step.options) ? step.options : [];
    const options: FlowStepOption[] = [];
    for (const opt of optionsRaw) {
      if (!opt || typeof opt !== "object") continue;
      const o = opt as Record<string, unknown>;
      if (typeof o.id !== "string" || typeof o.label !== "string") continue;
      options.push({
        id: o.id,
        label: o.label,
        nextStepId:
          typeof o.nextStepId === "string" ? o.nextStepId : undefined,
      });
    }
    const saveAsRaw =
      typeof step.saveAs === "string"
        ? step.saveAs.trim()
        : typeof step.mapsTo === "string"
          ? step.mapsTo.trim()
          : "";
    const saveAs = saveAsRaw || undefined;
    const mapsTo = isBuiltinSaveAs(saveAs) ? saveAs : undefined;
    steps.push({
      id: step.id,
      question: step.question,
      inputType,
      options: isChoiceType(inputType) ? options : undefined,
      required: step.required !== false,
      ...(saveAs ? { saveAs } : {}),
      ...(mapsTo ? { mapsTo } : {}),
    });
  }

  if (steps.length === 0) return undefined;

  const startStepId =
    typeof record.startStepId === "string" &&
    steps.some((s) => s.id === record.startStepId)
      ? record.startStepId
      : steps[0].id;

  const customSaveLabels: Record<string, string> = {};
  if (record.customSaveLabels && typeof record.customSaveLabels === "object") {
    for (const [key, label] of Object.entries(
      record.customSaveLabels as Record<string, unknown>,
    )) {
      if (typeof label === "string" && label.trim() && key.trim()) {
        customSaveLabels[key.trim()] = label.trim();
      }
    }
  }

  return {
    version: 1,
    shape: record.shape,
    greeting: typeof record.greeting === "string" ? record.greeting : "",
    steps,
    startStepId,
    ...(Object.keys(customSaveLabels).length > 0
      ? { customSaveLabels }
      : {}),
  };
}

/** Default flow for catalog bots without explicit config (backward compatible). */
export function defaultFlowForSpecialty(specialty: string): ChatbotFlowConfig {
  return defaultFlowForTemplate(suggestTemplateForSpecialty(specialty));
}
