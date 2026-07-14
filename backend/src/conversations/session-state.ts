import type {
  AutomaticLeadStatus,
  ChatEventInput,
  ChatSessionRecord,
} from "./types.js";
import { ABANDONED_AFTER_MS } from "./types.js";

export function deriveAutomaticLeadStatus(
  session: ChatSessionRecord,
  nowMs: number = Date.now(),
): AutomaticLeadStatus {
  if (session.convertedAt) return "converted";
  if (session.notInterestedAt) return "not_interested";
  if (session.appointmentRequestedAt) return "appointment_requested";
  if (session.whatsappClickedAt) return "whatsapp_handoff";

  const lastActivity = Date.parse(session.lastActivityAt);
  if (Number.isFinite(lastActivity) && nowMs - lastActivity >= ABANDONED_AFTER_MS) {
    return "abandoned";
  }

  return "new";
}

export function applySessionEvent(
  session: ChatSessionRecord,
  event: ChatEventInput,
  occurredAt: string,
): ChatSessionRecord {
  const next: ChatSessionRecord = {
    ...session,
    answers: { ...session.answers },
    lastActivityAt: occurredAt,
    updatedAt: occurredAt,
  };

  if (event.flowMode) next.flowMode = event.flowMode;
  if (event.stepId) next.currentStep = event.stepId;
  if (event.type === "name_captured" && event.name?.trim()) {
    next.visitorName = event.name.trim();
  }
  if (event.type === "intent_selected" && event.intent) {
    next.intent = event.intent;
    if (event.intent === "schedule_exam") {
      next.appointmentRequestedAt = occurredAt;
    }
  }
  if (event.type === "answer_submitted" && event.stepId && event.value !== undefined) {
    if (typeof event.value === "string" || Array.isArray(event.value)) {
      next.answers[event.stepId] = event.value;
    }
  }

  const answerText = [event.label, valueToText(event.value)]
    .filter(Boolean)
    .join(" ");
  if (isNotInterestedText(answerText)) {
    next.notInterestedAt = occurredAt;
  } else if (isAppointmentRequestText(answerText)) {
    next.appointmentRequestedAt = occurredAt;
  }

  if (event.type === "flow_completed") next.flowCompletedAt = occurredAt;
  if (event.type === "whatsapp_clicked") next.whatsappClickedAt = occurredAt;
  if (event.type === "conversion_confirmed") next.convertedAt = occurredAt;
  if (event.type === "lead_created" && event.leadId) next.leadId = event.leadId;

  return next;
}

export function isNotInterestedText(value: string): boolean {
  const normalized = normalize(value);
  return [
    "nao tenho interesse",
    "sem interesse",
    "nao quero",
    "agora nao",
  ].some((term) => normalized.includes(term));
}

export function isAppointmentRequestText(value: string): boolean {
  const normalized = normalize(value);
  if (isNotInterestedText(normalized)) return false;
  return [
    "quero agendar",
    "agendar uma consulta",
    "agendar consulta",
    "agendar exame",
    "marcar consulta",
    "marcar exame",
    "confirmar agendamento",
  ].some((term) => normalized.includes(term));
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function valueToText(value: ChatEventInput["value"]): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.join(" ");
  return "";
}
