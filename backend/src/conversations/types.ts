import type { LeadIntent, LeadSource } from "../leads/types.js";

export const ABANDONED_AFTER_MS = 30 * 60 * 1000;

export type AutomaticLeadStatus =
  | "new"
  | "whatsapp_handoff"
  | "appointment_requested"
  | "not_interested"
  | "abandoned"
  | "converted";

export type ChatEventType =
  | "chat_opened"
  | "name_captured"
  | "intent_selected"
  | "answer_submitted"
  | "flow_completed"
  | "lead_created"
  | "whatsapp_clicked"
  | "conversion_confirmed";

export const CHAT_EVENT_TYPES = new Set<ChatEventType>([
  "chat_opened",
  "name_captured",
  "intent_selected",
  "answer_submitted",
  "flow_completed",
  "lead_created",
  "whatsapp_clicked",
  "conversion_confirmed",
]);

export type ChatEventInput = {
  type: ChatEventType;
  stepId?: string;
  label?: string;
  value?: string | string[] | Record<string, unknown>;
  name?: string;
  intent?: LeadIntent;
  flowMode?: "legacy" | "custom_dialogue";
  leadId?: string;
};

export type ChatEventRecord = ChatEventInput & {
  id: string;
  sessionId: string;
  botId: string;
  clientId: string;
  createdAt: string;
};

export type ChatSessionRecord = {
  id: string;
  botId: string;
  clientId: string;
  leadId?: string;
  visitorName?: string;
  intent?: LeadIntent;
  flowMode: "legacy" | "custom_dialogue";
  currentStep?: string;
  answers: Record<string, string | string[]>;
  source: LeadSource;
  openedAt: string;
  lastActivityAt: string;
  flowCompletedAt?: string;
  whatsappClickedAt?: string;
  appointmentRequestedAt?: string;
  notInterestedAt?: string;
  convertedAt?: string;
  createdAt: string;
  updatedAt: string;
  events: ChatEventRecord[];
};

export type CreateChatSessionInput = {
  botId: string;
  clientId: string;
  source: LeadSource;
};

export interface ConversationRepository {
  createSession(input: CreateChatSessionInput): Promise<ChatSessionRecord>;
  getSession(id: string): Promise<ChatSessionRecord | null>;
  listSessions(): Promise<ChatSessionRecord[]>;
  appendEvent(
    sessionId: string,
    input: ChatEventInput,
  ): Promise<ChatSessionRecord | null>;
  findByLeadId(leadId: string): Promise<ChatSessionRecord | null>;
}
