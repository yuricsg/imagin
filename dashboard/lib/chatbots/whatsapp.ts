/** WhatsApp handoff — optional redirect after the bot collects lead data. */

/**
 * One WhatsApp number the visitor can be routed to — e.g. a doctor's office in
 * a given state. With two or more, the bot asks `routingQuestion` at the end of
 * the dialogue and opens the number the visitor picked.
 */
export interface WhatsAppDestination {
  /** Stable id — referenced by the lead payload so the backend picks the number. */
  id: string;
  /** What the visitor sees in the routing question, e.g. "Consultório de SP". */
  label: string;
  /** Digits only, incl. country code (e.g. 5511…). */
  phoneNumber: string;
}

export interface ChatbotWhatsAppConfig {
  /** When true, the widget shows a button to continue on WhatsApp. */
  enabled: boolean;
  /**
   * Primary number — mirrors `destinations[0]`. Kept so consumers that don't
   * route (legacy widget flow, backend `whatsappPhone` column) keep working.
   */
  phoneNumber: string;
  /** One entry per office/number. Single entry means no routing question. */
  destinations: WhatsAppDestination[];
  /** Asked before the handoff when there is more than one destination. */
  routingQuestion: string;
  /** Pre-filled message; placeholders: {bot}, {nome}, {telefone}, {email}, {mensagem}, {unidade}, + custom saveAs keys. */
  messageTemplate: string;
  /**
   * Last chat bubble before the WhatsApp button (e.g. "Clique no botão para
   * enviar a mensagem para a secretária."). Optional — empty falls back to
   * the tone default. Operator text is never rewritten by tone changes.
   */
  closingMessage?: string;
}

export type WhatsAppVariable = {
  key: string;
  token: string;
  label: string;
  description: string;
};

export const DEFAULT_WHATSAPP_MESSAGE_TEMPLATE = `Olá! Vim pelo {bot} e gostaria de continuar o atendimento.

Meu nome: {nome}
Telefone: {telefone}
E-mail: {email}
Assunto: {mensagem}`;

export const DEFAULT_WHATSAPP_ROUTING_QUESTION =
  "Para qual unidade você prefere ser atendido?";

/**
 * Default closing bubble per tone, shown when the bot has no custom
 * `closingMessage` (single-number bots; routed bots mention the office).
 */
export const DEFAULT_WHATSAPP_CLOSING_MESSAGES: Record<
  "friendly" | "formal",
  string
> = {
  friendly: "Continue no WhatsApp para falar com nossa equipe.",
  formal: "Continue o atendimento pelo WhatsApp para confirmar os detalhes.",
};

export const EMPTY_WHATSAPP: ChatbotWhatsAppConfig = {
  enabled: false,
  phoneNumber: "",
  destinations: [],
  routingQuestion: DEFAULT_WHATSAPP_ROUTING_QUESTION,
  messageTemplate: DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
};

let destinationCounter = 0;

/** Ids only need to be unique within one bot's destination list. */
export function createDestinationId(): string {
  destinationCounter += 1;
  return `wa-${Date.now().toString(36)}-${destinationCounter}`;
}

export function emptyDestination(): WhatsAppDestination {
  return { id: createDestinationId(), label: "", phoneNumber: "" };
}

/** Built-in placeholders always available in the WhatsApp message editor. */
export const WHATSAPP_BUILTIN_VARIABLES: WhatsAppVariable[] = [
  {
    key: "{bot}",
    token: "bot",
    label: "Nome do chatbot",
    description:
      "Preenchido automaticamente com o nome deste bot — o visitante não precisa informar",
  },
  {
    key: "{nome}",
    token: "nome",
    label: "Nome",
    description: "Nome que o visitante informou no chat",
  },
  {
    key: "{telefone}",
    token: "telefone",
    label: "Telefone",
    description: "Telefone informado no chat",
  },
  {
    key: "{email}",
    token: "email",
    label: "E-mail",
    description: "E-mail informado no chat",
  },
  {
    key: "{mensagem}",
    token: "mensagem",
    label: "Assunto / mensagem",
    description: "Primeira intenção ou mensagem capturada pelo bot",
  },
  {
    key: "{unidade}",
    token: "unidade",
    label: "Unidade escolhida",
    description:
      "Consultório que o visitante escolheu — fica vazio quando há um único número",
  },
];

/** @deprecated Prefer WHATSAPP_BUILTIN_VARIABLES or listWhatsAppVariables(). */
export const WHATSAPP_VARIABLES = WHATSAPP_BUILTIN_VARIABLES;

const SAMPLE_VALUES: Record<string, string> = {
  nome: "Maria Silva",
  telefone: "(11) 98765-4321",
  email: "maria@email.com",
  mensagem: "Gostaria de agendar uma consulta.",
  unidade: "Consultório São Paulo",
};

/** Builds WhatsApp chips from custom "Salvar como" categories on the dialogue. */
export function whatsappVariablesFromCustomLabels(
  customSaveLabels?: Record<string, string> | null,
): WhatsAppVariable[] {
  if (!customSaveLabels) return [];
  const out: WhatsAppVariable[] = [];
  for (const [token, label] of Object.entries(customSaveLabels)) {
    const key = token.trim();
    const display = label.trim();
    if (!key || !display) continue;
    if (WHATSAPP_BUILTIN_VARIABLES.some((v) => v.token === key)) continue;
    out.push({
      key: `{${key}}`,
      token: key,
      label: display,
      description: `Resposta salva como “${display}” no diálogo`,
    });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

/** Built-in + custom saveAs categories for the WhatsApp step UI. */
export function listWhatsAppVariables(
  customSaveLabels?: Record<string, string> | null,
): WhatsAppVariable[] {
  return [
    ...WHATSAPP_BUILTIN_VARIABLES,
    ...whatsappVariablesFromCustomLabels(customSaveLabels),
  ];
}

/** Strips everything except digits — used for wa.me links and storage. */
export function normalizeWhatsAppPhone(value: string): string {
  return value.replace(/\D/g, "");
}

/** Brazilian/international mobile: 10–15 digits after normalization. */
export function isValidWhatsAppPhone(value: string): boolean {
  const digits = normalizeWhatsAppPhone(value);
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * Drops blank rows, normalizes phones and guarantees unique ids. Accepts the
 * legacy single `phoneNumber` shape so bots saved before routing existed keep
 * their number.
 */
export function normalizeWhatsAppDestinations(
  raw: unknown,
  legacyPhoneNumber = "",
): WhatsAppDestination[] {
  const entries = Array.isArray(raw) ? raw : [];
  const seenIds = new Set<string>();
  const out: WhatsAppDestination[] = [];

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const phoneNumber = normalizeWhatsAppPhone(
      typeof record.phoneNumber === "string" ? record.phoneNumber : "",
    );
    if (!phoneNumber) continue;
    const label =
      typeof record.label === "string" ? record.label.trim() : "";
    let id =
      typeof record.id === "string" && record.id.trim()
        ? record.id.trim()
        : createDestinationId();
    while (seenIds.has(id)) id = createDestinationId();
    seenIds.add(id);
    out.push({ id, label, phoneNumber });
  }

  if (out.length > 0) return out;

  const legacy = normalizeWhatsAppPhone(legacyPhoneNumber);
  return legacy
    ? [{ id: createDestinationId(), label: "", phoneNumber: legacy }]
    : [];
}

/** The number the visitor is sent to; falls back to the first destination. */
export function resolveWhatsAppDestination(
  config: Pick<ChatbotWhatsAppConfig, "destinations" | "phoneNumber">,
  destinationId?: string | null,
): WhatsAppDestination | null {
  const destinations =
    config.destinations?.length > 0
      ? config.destinations
      : config.phoneNumber
        ? [{ id: "primary", label: "", phoneNumber: config.phoneNumber }]
        : [];
  if (destinations.length === 0) return null;
  if (destinationId) {
    const match = destinations.find((entry) => entry.id === destinationId);
    if (match) return match;
  }
  return destinations[0];
}

/** True when the bot must ask which office before opening WhatsApp. */
export function needsWhatsAppRouting(
  config: Pick<ChatbotWhatsAppConfig, "enabled" | "destinations">,
): boolean {
  return config.enabled && (config.destinations?.length ?? 0) > 1;
}

export function buildWhatsAppFromInput(input: {
  whatsappEnabled: boolean;
  whatsappDestinations: WhatsAppDestination[];
  whatsappRoutingQuestion: string;
  whatsappMessageTemplate: string;
  whatsappClosingMessage: string;
}): ChatbotWhatsAppConfig {
  const messageTemplate =
    input.whatsappMessageTemplate.trim() || DEFAULT_WHATSAPP_MESSAGE_TEMPLATE;
  const routingQuestion =
    input.whatsappRoutingQuestion.trim() || DEFAULT_WHATSAPP_ROUTING_QUESTION;
  const closingMessage = input.whatsappClosingMessage.trim() || undefined;

  if (!input.whatsappEnabled) {
    return { ...EMPTY_WHATSAPP, routingQuestion, messageTemplate, closingMessage };
  }

  const destinations = normalizeWhatsAppDestinations(input.whatsappDestinations);
  return {
    enabled: true,
    phoneNumber: destinations[0]?.phoneNumber ?? "",
    destinations,
    routingQuestion,
    messageTemplate,
    closingMessage,
  };
}

/**
 * Replaces `{token}` placeholders. Tokens listed in `knownTokens` (or present in
 * `values`) are substituted; unknown tokens are left untouched.
 */
export function fillWhatsAppTemplate(
  template: string,
  values: Partial<Record<string, string>>,
  knownTokens?: Iterable<string>,
): string {
  const known = new Set<string>([
    ...WHATSAPP_BUILTIN_VARIABLES.map((v) => v.token),
    ...(knownTokens ?? []),
    ...Object.keys(values),
  ]);
  return template.replace(/\{([a-zA-Z0-9_-]+)\}/g, (match, token: string) => {
    if (!known.has(token)) return match;
    return values[token]?.trim() ?? "";
  });
}

/** Example message for the form preview (does not affect production). */
export function previewWhatsAppMessage(
  template: string,
  botName = "assistente",
  customSaveLabels?: Record<string, string> | null,
): string {
  const customSamples: Record<string, string> = {};
  for (const [token, label] of Object.entries(customSaveLabels ?? {})) {
    if (!token.trim()) continue;
    customSamples[token] = `Ex.: ${label.trim() || token}`;
  }
  return fillWhatsAppTemplate(
    template,
    {
      ...SAMPLE_VALUES,
      ...customSamples,
      bot: botName.trim() || "assistente",
    },
    Object.keys(customSamples),
  );
}

/** Resolves all placeholders before opening WhatsApp (widget + test button). */
export function resolveWhatsAppMessage(
  template: string,
  botName: string,
  lead: Partial<Record<string, string>> = {},
  customSaveLabels?: Record<string, string> | null,
): string {
  return fillWhatsAppTemplate(
    template,
    {
      bot: botName.trim() || "assistente",
      nome: lead.nome ?? "",
      telefone: lead.telefone ?? "",
      email: lead.email ?? "",
      mensagem: lead.mensagem ?? "",
      unidade: lead.unidade ?? "",
      ...lead,
    },
    Object.keys(customSaveLabels ?? {}),
  );
}

export function whatsAppUrl(phoneDigits: string, message: string): string {
  const phone = normalizeWhatsAppPhone(phoneDigits);
  const text = encodeURIComponent(message);
  return `https://wa.me/${phone}?text=${text}`;
}

export function hasWhatsAppConfigured(config: ChatbotWhatsAppConfig): boolean {
  if (!config.enabled) return false;
  const destinations = config.destinations ?? [];
  if (destinations.length > 0) {
    return destinations.every((entry) => isValidWhatsAppPhone(entry.phoneNumber));
  }
  return config.phoneNumber.length >= 10;
}
