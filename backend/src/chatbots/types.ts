import type { LeadSubmission } from "../leads/types.js";
import type {
  ConversationFlowDefinition,
  ConversationFlowKey,
} from "./conversation-flows.js";

export type ChatbotDefinition = {
  botId: string;
  /** Full dashboard Chatbot JSON — stored as-is for the dashboard UI. */
  dashboardConfig?: unknown;
  name: string;
  clientId: string;
  clientName: string;
  status: "active" | "draft" | "archived";
  flowKey: ConversationFlowKey;
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
  /**
   * Site launcher (speech bubble + avatar). Prefer dashboardConfig.launcher;
   * when absent, teaserTexts fall back to buttonTexts.
   */
  launcher?: {
    teaserTexts: string[];
    avatarUrl: string | null;
  };
  /** Dedicated column mirroring the launcher photo (data URL or preset path). */
  avatarUrl?: string | null;
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
  conversationFlow: ConversationFlowDefinition;
  /** Full dashboard Chatbot JSON, present only for bots created via the dashboard. */
  dashboardConfig?: unknown;
};

export type CreateChatbotInput = {
  botId: string;
  name: string;
  clientId: string;
  clientName: string;
  status: ChatbotDefinition["status"];
  flowKey: ConversationFlowKey;
  description: string;
  whatsappPhone: string;
  tracking: ChatbotDefinition["tracking"];
  buttonTexts: string[];
  examOptions: string[];
  medicalRequestOptions: string[];
  consultationNeeds: string[];
  consultationDecisions: string[];
  /** Launcher photo (data URL or preset path) persisted in its own column. */
  avatarUrl?: string | null;
  /** Full dashboard Chatbot JSON — stored as-is and returned for the dashboard UI. */
  dashboardConfig?: unknown;
};
