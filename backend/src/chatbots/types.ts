import type { LeadSubmission } from "../leads/types.js";

export type ChatbotDefinition = {
  botId: string;
  name: string;
  clientId: string;
  clientName: string;
  status: "active" | "draft" | "archived";
  description: string;
  whatsappPhone: string;
  tracking: {
    meta?: {
      pixelId?: string;
      accessToken?: string;
      testEventCode?: string;
    };
    googleAnalytics?: {
      measurementId?: string;
      apiSecret?: string;
    };
  };
  buttonTexts: string[];
  examOptions: string[];
  medicalRequestOptions: string[];
  consultationNeeds: string[];
  consultationDecisions: string[];
  formatWhatsAppMessage(lead: LeadSubmission): string;
};

export type ChatbotIntegrationStatus = {
  metaConfigured: boolean;
  googleAnalyticsConfigured: boolean;
};

export type PublicChatbotConfig = Omit<
  ChatbotDefinition,
  "whatsappPhone" | "tracking" | "formatWhatsAppMessage"
> & {
  integrationStatus: ChatbotIntegrationStatus;
};

export type CreateChatbotInput = {
  botId: string;
  name: string;
  clientId: string;
  clientName: string;
  status: ChatbotDefinition["status"];
  description: string;
  whatsappPhone: string;
  tracking: ChatbotDefinition["tracking"];
  buttonTexts: string[];
  examOptions: string[];
  medicalRequestOptions: string[];
  consultationNeeds: string[];
  consultationDecisions: string[];
};
