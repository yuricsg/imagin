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

/** Dialogue step read from `dashboardConfig.flow.dialogue` (untyped JSON). */
type DialogueStep = {
  id: string;
  saveAs?: string;
  options: { id: string; label: string }[];
};

const BUILTIN_SAVE_AS = new Set(["name", "phone", "email", "message"]);

/**
 * Reads the dialogue steps from the dashboard config, tolerating legacy or
 * partial payloads. Choice answers are stored as option ids (branching needs
 * them); the options here are how we map them back to visitor-facing labels.
 */
function readDialogueSteps(dashboardConfig: unknown): DialogueStep[] {
  if (!dashboardConfig || typeof dashboardConfig !== "object") return [];
  const flow = (dashboardConfig as { flow?: unknown }).flow;
  if (!flow || typeof flow !== "object") return [];
  const dialogue = (flow as { dialogue?: unknown }).dialogue;
  if (!dialogue || typeof dialogue !== "object") return [];
  const steps = (dialogue as { steps?: unknown }).steps;
  if (!Array.isArray(steps)) return [];

  const out: DialogueStep[] = [];
  for (const entry of steps) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    if (typeof record.id !== "string" || !record.id.trim()) continue;
    const options = Array.isArray(record.options)
      ? record.options.flatMap((option) => {
          if (!option || typeof option !== "object") return [];
          const opt = option as Record<string, unknown>;
          if (typeof opt.id !== "string" || typeof opt.label !== "string") {
            return [];
          }
          return [{ id: opt.id, label: opt.label }];
        })
      : [];
    const saveAsRaw =
      typeof record.saveAs === "string"
        ? record.saveAs
        : typeof record.mapsTo === "string"
          ? record.mapsTo
          : "";
    out.push({
      id: record.id,
      ...(saveAsRaw.trim() ? { saveAs: saveAsRaw.trim() } : {}),
      options,
    });
  }
  return out;
}

/** Maps an option id back to its label; unknown ids are kept as-is. */
function optionLabel(step: DialogueStep | undefined, value: string): string {
  if (!step) return value;
  const label = step.options.find((option) => option.id === value)?.label.trim();
  return label || value;
}

/** Human-readable version of one stored answer (multi values join with ", "). */
function answerDisplay(
  step: DialogueStep | undefined,
  answer: string | string[],
): string {
  const values = Array.isArray(answer) ? answer : [answer];
  return values
    .map((value) => optionLabel(step, value))
    .filter(Boolean)
    .join(", ");
}

type ResolvedDialogueAnswers = {
  name: string;
  phone: string;
  email: string;
  message: string;
  custom: Record<string, string>;
};

/**
 * Rebuilds the lead fields from the raw step answers with option labels
 * resolved. Returns null when the bot has no readable dialogue, so callers
 * fall back to the values sent by the widget.
 */
function resolveDialogueAnswers(
  steps: DialogueStep[],
  answers: Record<string, string | string[]> | undefined,
): ResolvedDialogueAnswers | null {
  if (steps.length === 0 || !answers) return null;
  const result: ResolvedDialogueAnswers = {
    name: "",
    phone: "",
    email: "",
    message: "",
    custom: {},
  };
  for (const step of steps) {
    if (!step.saveAs) continue;
    const raw = answers[step.id];
    if (raw == null) continue;
    const value = answerDisplay(step, raw).trim();
    if (!value) continue;
    if (BUILTIN_SAVE_AS.has(step.saveAs)) {
      result[step.saveAs as "name" | "phone" | "email" | "message"] = value;
    } else {
      result.custom[step.saveAs] = value;
    }
  }
  return result;
}

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
  dialogueSteps: DialogueStep[],
): Record<string, string> {
  const resolved = resolveDialogueAnswers(dialogueSteps, lead.answers);
  return {
    bot: botName,
    nome: resolved?.name || lead.name || "",
    telefone: resolved?.phone || lead.phone || "",
    email: resolved?.email || lead.email || "",
    mensagem: resolved?.message || lead.message || "",
    // Set by the widget when the visitor picks one of several offices.
    unidade: "",
    ...(lead.customFields ?? {}),
    // Labels resolved from the dialogue win over raw option ids sent by
    // older widgets.
    ...(resolved?.custom ?? {}),
  };
}

function formatFromDashboardTemplate(
  lead: LeadSubmission,
  dashboardConfig: unknown,
  dialogueSteps: DialogueStep[],
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
    valuesFromCustomDialogueLead(lead, botName, dialogueSteps),
  );
}

export function formatStandardWhatsAppMessage(
  lead: LeadSubmission,
  dashboardConfig?: unknown,
) {
  if (lead.flowMode === "custom_dialogue") {
    const dialogueSteps = readDialogueSteps(dashboardConfig);
    const fromTemplate = formatFromDashboardTemplate(
      lead,
      dashboardConfig,
      dialogueSteps,
    );
    if (fromTemplate) return fromTemplate;

    const resolved = resolveDialogueAnswers(dialogueSteps, lead.answers);
    const name = resolved?.name || lead.name;
    const message = resolved?.message || lead.message;
    const phone = resolved?.phone || lead.phone;
    const email = resolved?.email || lead.email;
    const customFields = resolved
      ? { ...lead.customFields, ...resolved.custom }
      : lead.customFields;

    const lines = [`Oi, meu nome é ${name}.`];
    if (message) lines.push(`Assunto: ${message}.`);
    if (phone) lines.push(`Telefone: ${phone}.`);
    if (email) lines.push(`E-mail: ${email}.`);
    if (customFields) {
      const extras = Object.entries(customFields)
        .map(([key, value]) => `${key}: ${value}`)
        .filter(Boolean);
      if (extras.length > 0) {
        lines.push(extras.join(" · "));
      }
    }
    if (lead.answers) {
      const extras = Object.entries(lead.answers)
        .map(([stepId, value]) =>
          answerDisplay(
            dialogueSteps.find((step) => step.id === stepId),
            value,
          ),
        )
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
