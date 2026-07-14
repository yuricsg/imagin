import { deriveAutomaticLeadStatus } from "../conversations/session-state.js";
import type { ChatSessionRecord } from "../conversations/types.js";
import type { LeadRecord, LeadSource } from "./types.js";

export function leadToDashboardDto(
  lead: LeadRecord | undefined,
  session?: ChatSessionRecord,
  nowMs: number = Date.now(),
) {
  const source = preferSource(session?.source, lead?.source);
  const intent = lead?.intent ?? session?.intent ?? null;
  const answers = {
    ...(session?.answers ?? {}),
    ...(lead?.answers ?? {}),
  };
  const selectedExams = lead?.selectedExams ?? answerArray(answers, "examSelection");
  const status = session
    ? deriveAutomaticLeadStatus(session, nowMs)
    : (lead?.status ?? "new");
  const name = session?.visitorName ?? lead?.name ?? "";

  return {
    id: lead?.id ?? session?.id ?? "",
    leadId: lead?.id ?? null,
    sessionId: session?.id ?? lead?.sessionId ?? null,
    botId: session?.botId ?? lead?.botId ?? "",
    clientId: session?.clientId ?? lead?.clientId ?? "",
    name,
    email: lead?.email ?? null,
    phone: lead?.phone ?? null,
    status,
    intent,
    selectedExams,
    medicalRequestStatus: lead?.medicalRequestStatus ?? null,
    consultationNeed: lead?.consultationNeed ?? null,
    consultationDecision: lead?.consultationDecision ?? null,
    message: lead?.message ?? null,
    customFields: lead?.customFields ?? null,
    answers: Object.keys(answers).length > 0 ? answers : null,
    flowMode: lead?.flowMode ?? session?.flowMode ?? "legacy",
    source,
    whatsappMessage: lead?.whatsappMessage ?? null,
    whatsappUrl: lead?.whatsappUrl ?? null,
    whatsappDestinationId: lead?.whatsappDestinationId ?? null,
    classification: buildClassification({
      intent,
      selectedExams,
      consultationNeed: lead?.consultationNeed,
      medicalRequestStatus: lead?.medicalRequestStatus,
      customFields: lead?.customFields,
    }),
    progress: {
      currentStep: session?.currentStep ?? (lead ? "complete" : null),
      openedAt: session?.openedAt ?? lead?.createdAt ?? null,
      lastActivityAt: session?.lastActivityAt ?? lead?.updatedAt ?? null,
      completedAt: session?.flowCompletedAt ?? (lead ? lead.createdAt : null),
      whatsappClickedAt: session?.whatsappClickedAt ?? null,
      appointmentRequestedAt: session?.appointmentRequestedAt ?? null,
      convertedAt: session?.convertedAt ?? null,
    },
    events: session?.events ?? [],
    createdAt: session?.openedAt ?? lead?.createdAt ?? new Date(nowMs).toISOString(),
    updatedAt: session?.lastActivityAt ?? lead?.updatedAt ?? new Date(nowMs).toISOString(),
  };
}

function buildClassification(input: {
  intent: LeadRecord["intent"] | null;
  selectedExams: string[];
  consultationNeed?: string;
  medicalRequestStatus?: string;
  customFields?: Record<string, string>;
}) {
  const primary =
    input.intent === "schedule_exam"
      ? "Agendamento de exame"
      : input.intent === "schedule_consultation"
        ? "Consulta cardiológica"
        : input.intent === "severe_symptoms"
          ? "Sintomas graves"
          : "Atendimento geral";
  const details: Array<{ label: string; value: string }> = [];
  if (input.selectedExams.length > 0) {
    details.push({ label: "Exames", value: input.selectedExams.join(", ") });
  }
  if (input.consultationNeed) {
    details.push({ label: "Necessidade", value: input.consultationNeed });
  }
  if (input.medicalRequestStatus) {
    details.push({ label: "Solicitação médica", value: input.medicalRequestStatus });
  }
  for (const [label, value] of Object.entries(input.customFields ?? {})) {
    details.push({ label, value });
  }
  return { primary, details };
}

function preferSource(primary?: LeadSource, fallback?: LeadSource): LeadSource {
  return primary && Object.keys(primary).length > 0 ? primary : (fallback ?? {});
}

function answerArray(
  answers: Record<string, string | string[]>,
  key: string,
): string[] {
  const value = answers[key];
  return Array.isArray(value) ? value : [];
}
