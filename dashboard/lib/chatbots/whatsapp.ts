/** WhatsApp handoff — optional redirect after the bot collects lead data. */

export interface ChatbotWhatsAppConfig {
  /** When true, the widget shows a button to continue on WhatsApp. */
  enabled: boolean;
  /** Destination number — stored with digits only (incl. country code, e.g. 5511…). */
  phoneNumber: string;
  /** Pre-filled message; placeholders: {bot}, {nome}, {telefone}, {email}, {mensagem}. */
  messageTemplate: string;
}

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

export const WHATSAPP_VARIABLES = [
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
] as const;

const SAMPLE_VALUES: Record<string, string> = {
  nome: "Maria Silva",
  telefone: "(11) 98765-4321",
  email: "maria@email.com",
  mensagem: "Gostaria de agendar uma consulta.",
};

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

/** Replaces {nome}, {telefone}, etc. with captured lead values. */
export function fillWhatsAppTemplate(
  template: string,
  values: Partial<Record<string, string>>,
): string {
  let result = template;
  for (const variable of WHATSAPP_VARIABLES) {
    const replacement = values[variable.token]?.trim() ?? "";
    result = result.replaceAll(variable.key, replacement);
  }
  return result;
}

/** Example message for the form preview (does not affect production). */
export function previewWhatsAppMessage(
  template: string,
  botName = "assistente",
): string {
  return fillWhatsAppTemplate(template, {
    ...SAMPLE_VALUES,
    bot: botName.trim() || "assistente",
  });
}

/** Resolves all placeholders before opening WhatsApp (widget + test button). */
export function resolveWhatsAppMessage(
  template: string,
  botName: string,
  lead: Partial<Record<string, string>> = {},
): string {
  return fillWhatsAppTemplate(template, {
    bot: botName.trim() || "assistente",
    nome: lead.nome ?? "",
    telefone: lead.telefone ?? "",
    email: lead.email ?? "",
    mensagem: lead.mensagem ?? "",
  });
}

export function whatsAppUrl(phoneDigits: string, message: string): string {
  const phone = normalizeWhatsAppPhone(phoneDigits);
  const text = encodeURIComponent(message);
  return `https://wa.me/${phone}?text=${text}`;
}

export function hasWhatsAppConfigured(config: ChatbotWhatsAppConfig): boolean {
  return config.enabled && config.phoneNumber.length >= 10;
}
