export type ChatbotStatus = "active" | "paused" | "draft" | "error";

export type {
  ChatbotFlowConfig,
  DialogueFlow,
  FlowFieldKey,
  FlowInputType,
  FlowMapsTo,
  FlowSaveAs,
  FlowShape,
  FlowStep,
  FlowStepOption,
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

/** Floating site launcher (speech bubble + avatar) shown by the embed script. */
export interface ChatbotLauncherConfig {
  /** Rotating teaser lines inside the speech bubble (at least one). */
  teaserTexts: string[];
  /**
   * Custom avatar image URL. `null` uses the built-in default at
   * `/embed/default-avatar.png`. Upload is not wired yet.
   */
  avatarUrl: string | null;
}

export interface Chatbot {
  /** Stable catalog id, also the iframe route segment (e.g. "dra-renata-reis"). */
  id: string;
  /** Visitor-facing name shown inside the chat (embed `data-bot-name`, chat header). */
  name: string;
  /**
   * Operational name shown in the dashboard bot list and other operator
   * surfaces, so several bots can share the same visitor-facing `name`.
   * Optional — when empty, operator surfaces fall back to `name`.
   */
  flowName?: string;
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
  /** Site launcher bubble + avatar (widget.js). */
  launcher: ChatbotLauncherConfig;
}

export type AccentKey = "indigo" | "emerald" | "amber" | "sky" | "rose" | "violet";

export type LeadStatus =
  | "new"
  | "whatsapp_handoff"
  | "appointment_requested"
  | "not_interested"
  | "abandoned"
  | "converted";

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

export interface LeadSourceDetails {
  pageUrl?: string;
  landingPageUrl?: string;
  referrer?: string;
  parentOrigin?: string;
  utm?: Record<string, string>;
  clickIds?: Record<string, string>;
  cookies?: Record<string, string>;
}

export interface LeadEvent {
  id: string;
  type: string;
  stepId?: string;
  label?: string;
  value?: string | string[] | Record<string, unknown>;
  createdAt: string;
}

export interface LeadProgress {
  currentStep: string | null;
  openedAt: string | null;
  lastActivityAt: string | null;
  completedAt: string | null;
  whatsappClickedAt: string | null;
  appointmentRequestedAt: string | null;
  convertedAt: string | null;
}

export interface Lead {
  id: string;
  botId: string;
  clientId: string;
  name: string;
  email: string;
  phone: string;
  status: LeadStatus;
  leadId: string | null;
  sessionId: string | null;
  intent: string | null;
  selectedExams: string[];
  medicalRequestStatus: string | null;
  consultationNeed: string | null;
  consultationDecision: string | null;
  customFields: Record<string, string> | null;
  answers: Record<string, string | string[]> | null;
  whatsappMessage: string | null;
  whatsappUrl: string | null;
  /** First message / intent captured by the bot. */
  message: string;
  /** Page the widget was embedded on when the lead came in. */
  sourceUrl: string;
  /** Marketing attribution captured by the widget (GA / Meta / UTM). */
  attribution: LeadAttribution;
  source: LeadSourceDetails;
  classification: {
    primary: string;
    details: Array<{ label: string; value: string }>;
  };
  progress: LeadProgress;
  events: LeadEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatAccess {
  id: string;
  botId: string;
  clientId: string;
  openedAt: string;
}

export interface Client {
  id: string;
  name: string;
}

export interface DashboardMetrics {
  totalAccesses: number;
  totalLeads: number;
  appointmentRequests: number;
  convertedLeads: number;
  /** Share of all leads that reached "converted" (0..1). */
  conversionRate: number;
}
