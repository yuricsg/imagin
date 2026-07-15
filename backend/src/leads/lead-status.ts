import {
  isAppointmentRequestText,
  isNotInterestedText,
} from "../conversations/session-state.js";
import type { AutomaticLeadStatus } from "../conversations/types.js";
import type { CreateLeadRecordInput } from "./types.js";

export function deriveSubmittedLeadStatus(
  input: CreateLeadRecordInput,
): AutomaticLeadStatus {
  const combinedAnswers = [
    input.consultationDecision,
    input.message,
    ...Object.values(input.customFields ?? {}),
    ...Object.values(input.answers ?? {}).flatMap((value) => value),
  ]
    .filter(Boolean)
    .join(" ");

  if (isNotInterestedText(combinedAnswers)) return "not_interested";
  if (input.intent === "schedule_exam") return "appointment_requested";
  if (isAppointmentRequestText(combinedAnswers)) return "appointment_requested";
  return "new";
}

export function normalizePersistedLeadStatus(value: string): AutomaticLeadStatus {
  switch (value) {
    case "whatsapp_handoff":
    case "appointment_requested":
    case "not_interested":
    case "abandoned":
    case "converted":
    case "new":
      return value;
    case "contacted":
      return "whatsapp_handoff";
    case "qualified":
      return "appointment_requested";
    case "archived":
    case "lost":
      return "abandoned";
    default:
      return "new";
  }
}
