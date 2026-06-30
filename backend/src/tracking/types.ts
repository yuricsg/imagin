import type { ChatbotDefinition } from "../chatbots/types.js";
import type { LeadRecord } from "../leads/types.js";

export type TrackingRequestContext = {
  ipAddress?: string;
  userAgent?: string;
};

export type TrackingDispatchResult = {
  provider: "meta" | "google_analytics";
  status: "sent" | "skipped" | "failed";
  reason?: string;
};

export type TrackingService = {
  trackLeadCreated(
    lead: LeadRecord,
    chatbot: ChatbotDefinition,
    context: TrackingRequestContext,
  ): Promise<TrackingDispatchResult[]>;
};
