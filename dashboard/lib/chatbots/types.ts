export type ChatbotStatus = "active" | "paused" | "draft" | "error";

export type {
  ChatbotFlowConfig,
  FlowFieldKey,
  FlowTemplateId,
  FlowTone,
  InsuranceMode,
} from "./flows";

import type { ChatbotFlowConfig } from "./flows";

export type {
  ChatbotTrackingConfig,
} from "./tracking";

import type { ChatbotTrackingConfig } from "./tracking";

export type {
  ChatbotWhatsAppConfig,
} from "./whatsapp";

import type { ChatbotWhatsAppConfig } from "./whatsapp";

export interface ChatbotEmbedConfig {
  /** Base URL of the Hono backend the widget talks to. */
  apiBaseUrl: string;
  /** Origin that serves the embeddable loader and the iframe. */
  appBaseUrl: string;
  /** Path of the embeddable loader relative to appBaseUrl. */
  scriptPath: string;
}

export interface Chatbot {
  /** Stable catalog id, also the iframe route segment (e.g. "dra-renata-reis"). */
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  status: ChatbotStatus;
  /** Short role/specialty shown in the list — keep it scannable. */
  specialty: string;
  /** Avatar accent, one of the keys in ACCENTS (see ./accents). */
  accent: AccentKey;
  createdAt: string;
  /** Conversation template and operator overrides for the widget. */
  flow: ChatbotFlowConfig;
  /** Optional GA4 / Meta Pixel IDs for attribution on the client site. */
  tracking: ChatbotTrackingConfig;
  /** Optional handoff to WhatsApp after the visitor fills the form. */
  whatsapp: ChatbotWhatsAppConfig;
  embed: ChatbotEmbedConfig;
}

export type AccentKey = "indigo" | "emerald" | "amber" | "sky" | "rose" | "violet";

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "converted"
  | "lost";

/** Where the lead came from — resolved via GA / Meta / UTM on the client site. */
export type LeadChannel =
  | "google"
  | "meta"
  | "organic"
  | "direct"
  | "referral"
  | "unknown";

export interface LeadAttribution {
  channel: LeadChannel;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
}

export interface Lead {
  id: string;
  botId: string;
  clientId: string;
  name: string;
  email: string;
  phone: string;
  status: LeadStatus;
  /** First message / intent captured by the bot. */
  message: string;
  /** Page the widget was embedded on when the lead came in. */
  sourceUrl: string;
  /** Marketing attribution captured by the widget (GA / Meta / UTM). */
  attribution: LeadAttribution;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
}

export interface DashboardMetrics {
  activeBots: number;
  totalBots: number;
  totalLeads: number;
  leadsToday: number;
  leads7d: number;
  /** Share of all leads that reached "converted" (0..1). */
  conversionRate: number;
  /** Leads still in the "new" status — the operator's inbox. */
  newLeads: number;
}
