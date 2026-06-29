import type { LeadSubmission } from "../leads/types.js";

export type ChatbotDefinition = {
  botId: string;
  name: string;
  clientId: string;
  clientName: string;
  status: "active" | "draft" | "archived";
  description: string;
  whatsappPhone: string;
  buttonTexts: string[];
  examOptions: string[];
  medicalRequestOptions: string[];
  consultationNeeds: string[];
  consultationDecisions: string[];
  formatWhatsAppMessage(lead: LeadSubmission): string;
};

export type PublicChatbotConfig = Omit<
  ChatbotDefinition,
  "whatsappPhone" | "formatWhatsAppMessage"
>;
