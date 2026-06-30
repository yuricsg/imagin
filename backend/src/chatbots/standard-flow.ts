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

export function formatStandardWhatsAppMessage(lead: LeadSubmission) {
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
