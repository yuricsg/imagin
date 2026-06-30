import type { LeadSubmission } from "../leads/types.js";
import type { ChatbotDefinition } from "./types.js";
import { formatStandardWhatsAppMessage } from "./standard-flow.js";

export const renataReisBotId = "dra-renata-reis";

export const renataReisChatbot: ChatbotDefinition = {
  botId: renataReisBotId,
  name: "Dra. Renata Reis",
  clientId: "clinica-renata",
  clientName: "Clínica Renata Reis",
  status: "active",
  description: "Captação de leads para consultas e exames cardiológicos.",
  whatsappPhone: process.env.RENATA_REIS_WHATSAPP ?? "",
  tracking: {
    meta: {
      pixelId:
        process.env.RENATA_REIS_META_PIXEL_ID ?? process.env.META_PIXEL_ID,
      accessToken:
        process.env.RENATA_REIS_META_ACCESS_TOKEN ??
        process.env.META_ACCESS_TOKEN,
      testEventCode:
        process.env.RENATA_REIS_META_TEST_EVENT_CODE ??
        process.env.META_TEST_EVENT_CODE,
    },
    googleAnalytics: {
      measurementId:
        process.env.RENATA_REIS_GA4_MEASUREMENT_ID ??
        process.env.GA4_MEASUREMENT_ID,
      apiSecret:
        process.env.RENATA_REIS_GA4_API_SECRET ??
        process.env.GA4_API_SECRET,
    },
  },
  buttonTexts: [
    "Consultas e exames em um só lugar! Agende agora!",
    "Quer agendar uma consulta com a Dra. Renata Reis?",
    "Precisa realizar exames cardiológicos?",
    "Agende seu ecocardiograma!",
    "Precisa de um parecer cardiológico?",
    "Faça seus Exames Laboratoriais. Agende agora!",
  ],
  examOptions: [
    "Ecocardiograma transtorácico (adulto ou criança)",
    "Ecocardiograma fetal",
    "Exames laboratoriais",
    "Parecer cardiológico - pré operatório",
    "Teste ergométrico",
    "Mapa 24h",
    "Holter 24h",
    "Polissonografia tipo 3",
  ],
  medicalRequestOptions: ["Sim", "Não", "Tenho dúvidas"],
  consultationNeeds: [
    "Avaliação pré-operatória",
    "Acompanhamento cardiológico",
    "Check-up",
    "Sintomas: dor no peito, falta de ar, palpitações",
    "Outro",
  ],
  consultationDecisions: [
    "Quero agendar uma consulta",
    "Tenho dúvidas",
    "Não tenho interesse no momento",
  ],
  formatWhatsAppMessage,
};

export function formatWhatsAppMessage(lead: LeadSubmission) {
  if (lead.intent === "severe_symptoms") {
    return `Oi, meu nome é ${lead.name}. Preciso de avaliação de sintomas graves (pico de pressão alta ou dor no peito). Vim através do assistente de leads do site.`;
  }

  return formatStandardWhatsAppMessage(lead);
}
