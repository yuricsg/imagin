import type { LeadSubmission } from "../leads/types.js";

export const defaultButtonTexts = ["Iniciar atendimento"];

export const defaultExamOptions = ["Exame"];

export const defaultMedicalRequestOptions = ["Sim", "Não", "Tenho dúvidas"];

export const defaultConsultationNeeds = [
  "Avaliação",
  "Acompanhamento",
  "Check-up",
  "Sintomas",
  "Outro",
];

export const defaultConsultationDecisions = [
  "Quero agendar uma consulta",
  "Tenho dúvidas",
  "Não tenho interesse no momento",
];

type DashboardWhatsAppConfig = {
  enabled?: boolean;
  phoneNumber?: string;
  messageTemplate?: string;
};

type DashboardBotConfig = {
  name?: string;
  whatsapp?: DashboardWhatsAppConfig;
};

/** Fills `{token}` placeholders from lead + custom fields. */
export function fillDashboardWhatsAppTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{([a-zA-Z0-9_-]+)\}/g, (match, token: string) => {
    if (!(token in values)) return match;
    return values[token]?.trim() ?? "";
  });
}

function valuesFromCustomDialogueLead(
  lead: LeadSubmission,
  botName: string,
): Record<string, string> {
  return {
    bot: botName,
    nome: lead.name ?? "",
    telefone: lead.phone ?? "",
    email: lead.email ?? "",
    mensagem: lead.message ?? "",
    ...(lead.customFields ?? {}),
  };
}

function formatFromDashboardTemplate(
  lead: LeadSubmission,
  dashboardConfig: unknown,
): string | null {
  if (!dashboardConfig || typeof dashboardConfig !== "object") return null;
  const config = dashboardConfig as DashboardBotConfig;
  const template = config.whatsapp?.messageTemplate?.trim();
  if (!template) return null;
  const botName =
    typeof config.name === "string" && config.name.trim()
      ? config.name.trim()
      : "assistente";
  return fillDashboardWhatsAppTemplate(
    template,
    valuesFromCustomDialogueLead(lead, botName),
  );
}

export function formatStandardWhatsAppMessage(
  lead: LeadSubmission,
  dashboardConfig?: unknown,
) {
  if (lead.flowMode === "custom_dialogue") {
    const fromTemplate = formatFromDashboardTemplate(lead, dashboardConfig);
    if (fromTemplate) return fromTemplate;

    const lines = [`Oi, meu nome é ${lead.name}.`];
    if (lead.message) lines.push(`Assunto: ${lead.message}.`);
    if (lead.phone) lines.push(`Telefone: ${lead.phone}.`);
    if (lead.email) lines.push(`E-mail: ${lead.email}.`);
    if (lead.customFields) {
      const extras = Object.entries(lead.customFields)
        .map(([key, value]) => `${key}: ${value}`)
        .filter(Boolean);
      if (extras.length > 0) {
        lines.push(extras.join(" · "));
      }
    }
    if (lead.answers) {
      const extras = Object.values(lead.answers)
        .map((value) => (Array.isArray(value) ? value.join(", ") : value))
        .filter(Boolean);
      if (extras.length > 0) {
        lines.push(`Respostas: ${extras.join(" | ")}.`);
      }
    }
    lines.push("Vim através do assistente de leads do site.");
    return lines.join(" ");
  }

  if (lead.intent === "schedule_exam") {
    const selectedExams = lead.selectedExams?.join(", ") ?? "";
    const examAction =
      lead.medicalRequestStatus === "Tenho dúvidas"
        ? "Ainda tenho dúvidas"
        : "Quero agendar exame";

    return `Oi, meu nome é ${lead.name}. ${examAction}: ${selectedExams}. Possuo solicitação médica: ${lead.medicalRequestStatus}. Vim através do assistente de leads do site.`;
  }

  if (lead.intent === "schedule_consultation") {
    return `Oi, meu nome é ${lead.name}. ${lead.consultationDecision}. Minha principal necessidade é: ${lead.consultationNeed}. Vim através do assistente de leads do site.`;
  }

  return `Oi, meu nome é ${lead.name}. Preciso de avaliação de sintomas graves. Vim através do assistente de leads do site.`;
}
