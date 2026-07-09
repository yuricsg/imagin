/** WhatsApp handoff — optional redirect after the bot collects lead data. */

export interface ChatbotWhatsAppConfig {
  /** When true, the widget shows a button to continue on WhatsApp. */
  enabled: boolean;
  /** Destination number — stored with digits only (incl. country code, e.g. 5511…). */
  phoneNumber: string;
  /** Pre-filled message; placeholders: {bot}, {nome}, {telefone}, {email}, {mensagem}, + custom saveAs keys. */
  messageTemplate: string;
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

export const EMPTY_WHATSAPP: ChatbotWhatsAppConfig = {
  enabled: false,
  phoneNumber: "",
  messageTemplate: DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
};

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
];

/** @deprecated Prefer WHATSAPP_BUILTIN_VARIABLES or listWhatsAppVariables(). */
export const WHATSAPP_VARIABLES = WHATSAPP_BUILTIN_VARIABLES;

const SAMPLE_VALUES: Record<string, string> = {
  nome: "Maria Silva",
  telefone: "(11) 98765-4321",
  email: "maria@email.com",
  mensagem: "Gostaria de agendar uma consulta.",
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

export function buildWhatsAppFromInput(input: {
  whatsappEnabled: boolean;
  whatsappPhoneNumber: string;
  whatsappMessageTemplate: string;
}): ChatbotWhatsAppConfig {
  if (!input.whatsappEnabled) {
    return {
      enabled: false,
      phoneNumber: "",
      messageTemplate:
        input.whatsappMessageTemplate.trim() || DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
    };
  }
  return {
    enabled: true,
    phoneNumber: normalizeWhatsAppPhone(input.whatsappPhoneNumber),
    messageTemplate:
      input.whatsappMessageTemplate.trim() || DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
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
  return config.enabled && config.phoneNumber.length >= 10;
}
