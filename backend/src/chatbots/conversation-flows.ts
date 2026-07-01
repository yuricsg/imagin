import type { LeadIntent } from "../leads/types.js";

export const defaultConversationFlowKey = "cardiology_exam_consultation";

export type ConversationFlowKey =
  | "cardiology_exam_consultation"
  | "exam_scheduling"
  | "consultation_scheduling"
  | "urgent_triage";

export type ConversationFlowDefinition = {
  key: ConversationFlowKey;
  label: string;
  description: string;
  intents: LeadIntent[];
};

export const conversationFlows = [
  {
    key: "cardiology_exam_consultation",
    label: "Consulta + exames cardiologicos",
    description:
      "Fluxo completo com triagem de exames, consulta cardiologica e sintomas graves.",
    intents: ["schedule_exam", "schedule_consultation", "severe_symptoms"],
  },
  {
    key: "exam_scheduling",
    label: "Agendamento de exames",
    description:
      "Fluxo focado em selecionar exames e confirmar se existe solicitacao medica.",
    intents: ["schedule_exam"],
  },
  {
    key: "consultation_scheduling",
    label: "Agendamento de consulta",
    description:
      "Fluxo focado em necessidade da consulta, investimento, endereco e decisao de agendamento.",
    intents: ["schedule_consultation"],
  },
  {
    key: "urgent_triage",
    label: "Triagem urgente",
    description:
      "Fluxo curto para casos graves que devem ser enviados direto para atendimento humano.",
    intents: ["severe_symptoms"],
  },
] satisfies ConversationFlowDefinition[];

export function getConversationFlow(value: unknown): ConversationFlowDefinition {
  const flow = conversationFlows.find((entry) => entry.key === value);

  return flow ?? conversationFlows[0];
}

export function isConversationIntentAllowed(
  flowKey: ConversationFlowKey,
  intent: LeadIntent,
) {
  return getConversationFlow(flowKey).intents.includes(intent);
}
