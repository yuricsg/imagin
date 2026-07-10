import type { AccentKey, Chatbot, ChatbotStatus } from "./types";
import type {
  ChatbotFlowConfig,
  DialogueFlow,
  FlowFieldKey,
  FlowTemplateId,
  FlowTone,
  InsuranceMode,
} from "./flows";
import {
  defaultFlowForTemplate,
  FLOW_TEMPLATES,
  normalizeDialogue,
} from "./flows";
import { buildTrackingFromInput } from "./tracking";
import {
  buildWhatsAppFromInput,
  DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
  DEFAULT_WHATSAPP_ROUTING_QUESTION,
  EMPTY_WHATSAPP,
  normalizeWhatsAppDestinations,
  type WhatsAppDestination,
} from "./whatsapp";
import {
  buildLauncherFromInput,
  DEFAULT_LAUNCHER,
  normalizeLauncher,
} from "./launcher";
import { slugify } from "../format";

/** localStorage key holding the bots created through the dashboard UI. */
const STORAGE_KEY = "imagin:chatbots";

const ACCENT_KEYS = new Set<AccentKey>([
  "indigo",
  "violet",
  "sky",
  "emerald",
  "amber",
  "rose",
]);

const STATUS_VALUES = new Set<ChatbotStatus>([
  "active",
  "paused",
  "draft",
  "error",
]);

function isFlowTemplateId(value: unknown): value is FlowTemplateId {
  return typeof value === "string" && value in FLOW_TEMPLATES;
}

function isFlowTone(value: unknown): value is FlowTone {
  return value === "friendly" || value === "formal";
}

function isFlowFieldKey(value: unknown): value is FlowFieldKey {
  return value === "name" || value === "phone" || value === "email";
}

function isInsuranceMode(value: unknown): value is InsuranceMode {
  return value === "particular" || value === "convenio" || value === "both";
}

/** Trims, dedupes and drops empty entries from a free-text list field. */
function cleanStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/**
 * Fills in flow / tracking / embed defaults for bots saved before those fields
 * existed — prevents crashes when opening the edit wizard.
 */
export function normalizeStoredChatbot(raw: unknown): Chatbot | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.name !== "string") {
    return null;
  }

  const flowDefaults = defaultFlowForTemplate("patient-capture");
  const flowRaw =
    record.flow && typeof record.flow === "object"
      ? (record.flow as Record<string, unknown>)
      : null;
  const templateId = isFlowTemplateId(flowRaw?.templateId)
    ? flowRaw.templateId
    : flowDefaults.templateId;
  const templateDefaults = defaultFlowForTemplate(templateId);
  const collectRaw = flowRaw?.collectFields;
  const collectFields = Array.isArray(collectRaw)
    ? collectRaw.filter(isFlowFieldKey)
    : [...templateDefaults.collectFields];
  const storedServices = cleanStringList(flowRaw?.services);
  const dialogue = normalizeDialogue(flowRaw?.dialogue);
  const flow: ChatbotFlowConfig = {
    templateId,
    tone: isFlowTone(flowRaw?.tone) ? flowRaw.tone : templateDefaults.tone,
    greeting: typeof flowRaw?.greeting === "string" ? flowRaw.greeting : "",
    collectFields:
      collectFields.length > 0 ? collectFields : [...templateDefaults.collectFields],
    services:
      storedServices.length > 0 ? storedServices : [...templateDefaults.services],
    insuranceMode: isInsuranceMode(flowRaw?.insuranceMode)
      ? flowRaw.insuranceMode
      : templateDefaults.insuranceMode,
    insurances: cleanStringList(flowRaw?.insurances),
    ...(dialogue ? { dialogue } : {}),
  };

  const trackingRaw =
    record.tracking && typeof record.tracking === "object"
      ? (record.tracking as Record<string, unknown>)
      : null;
  const embedRaw =
    record.embed && typeof record.embed === "object"
      ? (record.embed as Record<string, unknown>)
      : null;

  const accent =
    typeof record.accent === "string" && ACCENT_KEYS.has(record.accent as AccentKey)
      ? (record.accent as AccentKey)
      : "indigo";
  const status =
    typeof record.status === "string" &&
    STATUS_VALUES.has(record.status as ChatbotStatus)
      ? (record.status as ChatbotStatus)
      : "active";

  return {
    id: record.id,
    name: record.name,
    clientId:
      typeof record.clientId === "string"
        ? record.clientId
        : slugify(String(record.clientName ?? record.name)) || `${record.id}-cliente`,
    clientName: typeof record.clientName === "string" ? record.clientName : record.name,
    status,
    specialty: typeof record.specialty === "string" ? record.specialty : "",
    accent,
    createdAt:
      typeof record.createdAt === "string"
        ? record.createdAt
        : new Date().toISOString(),
    flow,
    tracking: {
      gaMeasurementId:
        typeof trackingRaw?.gaMeasurementId === "string"
          ? trackingRaw.gaMeasurementId
          : "",
      metaPixelId:
        typeof trackingRaw?.metaPixelId === "string"
          ? trackingRaw.metaPixelId
          : "",
    },
    whatsapp: (() => {
      const whatsappRaw =
        record.whatsapp && typeof record.whatsapp === "object"
          ? (record.whatsapp as Record<string, unknown>)
          : null;
      const enabled = whatsappRaw?.enabled === true;
      const messageTemplate =
        typeof whatsappRaw?.messageTemplate === "string" &&
        whatsappRaw.messageTemplate.trim()
          ? whatsappRaw.messageTemplate
          : DEFAULT_WHATSAPP_MESSAGE_TEMPLATE;
      const routingQuestion =
        typeof whatsappRaw?.routingQuestion === "string" &&
        whatsappRaw.routingQuestion.trim()
          ? whatsappRaw.routingQuestion.trim()
          : DEFAULT_WHATSAPP_ROUTING_QUESTION;
      if (!enabled) {
        return { ...EMPTY_WHATSAPP, routingQuestion, messageTemplate };
      }
      // Bots saved before multi-number support only carry `phoneNumber`.
      const destinations = normalizeWhatsAppDestinations(
        whatsappRaw?.destinations,
        typeof whatsappRaw?.phoneNumber === "string"
          ? whatsappRaw.phoneNumber
          : "",
      );
      return {
        enabled: true,
        phoneNumber: destinations[0]?.phoneNumber ?? "",
        destinations,
        routingQuestion,
        messageTemplate,
      };
    })(),
    embed: {
      apiBaseUrl:
        typeof embedRaw?.apiBaseUrl === "string"
          ? embedRaw.apiBaseUrl
          : DEFAULT_EMBED.apiBaseUrl,
      appBaseUrl:
        typeof embedRaw?.appBaseUrl === "string"
          ? embedRaw.appBaseUrl
          : DEFAULT_EMBED.appBaseUrl,
      scriptPath:
        typeof embedRaw?.scriptPath === "string"
          ? embedRaw.scriptPath
          : DEFAULT_EMBED.scriptPath,
    },
    launcher: normalizeLauncher(record.launcher),
  };
}

/** Sensible embed defaults pre-filled in the creation form. */
export const DEFAULT_EMBED = {
  apiBaseUrl: "https://api.imagin.app",
  appBaseUrl: "https://app.imagin.app",
  scriptPath: "/embed/widget.js",
};

/** Everything the operator types when registering a new chatbot. */
export type ChatbotInput = {
  name: string;
  clientName: string;
  specialty: string;
  status: ChatbotStatus;
  accent: AccentKey;
  flowTemplateId: FlowTemplateId;
  flowTone: FlowTone;
  flowGreeting: string;
  flowCollectFields: FlowFieldKey[];
  flowServices: string[];
  flowInsuranceMode: InsuranceMode;
  flowInsurances: string[];
  /** Custom dialogue builder — always set for new bots; optional when editing legacy. */
  flowDialogue?: DialogueFlow;
  gaMeasurementId: string;
  metaPixelId: string;
  whatsappEnabled: boolean;
  /** One number per office; two or more make the bot ask which one to use. */
  whatsappDestinations: WhatsAppDestination[];
  /** Question asked before the handoff when there is more than one number. */
  whatsappRoutingQuestion: string;
  whatsappMessageTemplate: string;
  /** One teaser line per entry; empty entries are dropped on save. */
  launcherTeaserTexts: string[];
  /** Custom avatar URL; null uses the built-in default (upload not wired yet). */
  launcherAvatarUrl: string | null;
  apiBaseUrl: string;
  appBaseUrl: string;
  scriptPath: string;
};

function buildFlowFromInput(input: ChatbotInput): ChatbotFlowConfig {
  const defaults = defaultFlowForTemplate(input.flowTemplateId);
  const collectFields =
    input.flowCollectFields.length > 0
      ? input.flowCollectFields
      : defaults.collectFields;
  const services = cleanStringList(input.flowServices);
  const greeting = input.flowGreeting.trim();
  const dialogue = normalizeDialogue(input.flowDialogue);

  if (dialogue) {
    dialogue.greeting = greeting || dialogue.greeting;
  }

  return {
    templateId: input.flowTemplateId,
    tone: input.flowTone,
    greeting,
    collectFields,
    services: services.length > 0 ? services : [...defaults.services],
    insuranceMode: input.flowInsuranceMode,
    insurances:
      input.flowInsuranceMode === "particular"
        ? []
        : cleanStringList(input.flowInsurances),
    ...(dialogue ? { dialogue } : {}),
  };
}

/** Builds a Chatbot from form input, deriving ids and guaranteeing uniqueness. */
export function buildChatbot(
  input: ChatbotInput,
  existingIds: Set<string>,
  nowMs: number = Date.now(),
): Chatbot {
  const base = slugify(input.name) || "chatbot";
  let id = base;
  let suffix = 2;
  while (existingIds.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return {
    id,
    name: input.name.trim(),
    clientId: slugify(input.clientName) || `${id}-cliente`,
    clientName: input.clientName.trim(),
    status: input.status,
    specialty: input.specialty.trim(),
    accent: input.accent,
    createdAt: new Date(nowMs).toISOString(),
    flow: buildFlowFromInput(input),
    tracking: buildTrackingFromInput(input),
    whatsapp: buildWhatsAppFromInput(input),
    embed: {
      apiBaseUrl: input.apiBaseUrl.trim(),
      appBaseUrl: input.appBaseUrl.trim(),
      scriptPath: input.scriptPath.trim(),
    },
    launcher: buildLauncherFromInput(input),
  };
}

/** Maps a persisted bot back to form fields for editing. */
export function chatbotToInput(bot: Chatbot): ChatbotInput {
  const safe = normalizeStoredChatbot(bot) ?? bot;
  return {
    name: safe.name,
    clientName: safe.clientName,
    specialty: safe.specialty,
    status: safe.status,
    accent: safe.accent,
    flowTemplateId: safe.flow.templateId,
    flowTone: safe.flow.tone,
    flowGreeting: safe.flow.greeting,
    flowCollectFields: [...safe.flow.collectFields],
    flowServices: [...safe.flow.services],
    flowInsuranceMode: safe.flow.insuranceMode,
    flowInsurances: [...safe.flow.insurances],
    flowDialogue: safe.flow.dialogue
      ? structuredClone(safe.flow.dialogue)
      : undefined,
    gaMeasurementId: safe.tracking.gaMeasurementId ?? "",
    metaPixelId: safe.tracking.metaPixelId ?? "",
    whatsappEnabled: safe.whatsapp.enabled,
    whatsappDestinations: safe.whatsapp.destinations.map((entry) => ({
      ...entry,
    })),
    whatsappRoutingQuestion: safe.whatsapp.routingQuestion,
    whatsappMessageTemplate: safe.whatsapp.messageTemplate,
    launcherTeaserTexts: [...(safe.launcher ?? DEFAULT_LAUNCHER).teaserTexts],
    launcherAvatarUrl: (safe.launcher ?? DEFAULT_LAUNCHER).avatarUrl,
    apiBaseUrl: safe.embed.apiBaseUrl,
    appBaseUrl: safe.embed.appBaseUrl,
    scriptPath: safe.embed.scriptPath,
  };
}

/** Applies form changes while keeping id and createdAt stable (embed URL stays the same). */
export function updateChatbot(existing: Chatbot, input: ChatbotInput): Chatbot {
  return {
    ...existing,
    name: input.name.trim(),
    clientId: slugify(input.clientName) || existing.clientId,
    clientName: input.clientName.trim(),
    status: input.status,
    specialty: input.specialty.trim(),
    accent: input.accent,
    flow: buildFlowFromInput(input),
    tracking: buildTrackingFromInput(input),
    whatsapp: buildWhatsAppFromInput(input),
    embed: {
      apiBaseUrl: input.apiBaseUrl.trim(),
      appBaseUrl: input.appBaseUrl.trim(),
      scriptPath: input.scriptPath.trim(),
    },
    launcher: buildLauncherFromInput(input),
  };
}

// Created bots are an external store (localStorage) read through
// useSyncExternalStore. That keeps SSR and the first client render in agreement
// (both see EMPTY) without a setState-in-effect, then swaps to the real value.

const EMPTY: Chatbot[] = [];
let cache: { raw: string | null; bots: Chatbot[] } = { raw: null, bots: EMPTY };
const listeners = new Set<() => void>();

/** Subscribe to created-bot changes (same tab via save, other tabs via storage). */
export function subscribeCreatedBots(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

/** Client snapshot: parsed bots, cached by raw string so the reference is stable. */
export function getCreatedBots(): Chatbot[] {
  if (typeof window === "undefined") return EMPTY;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cache.raw) return cache.bots;
  let bots: Chatbot[] = EMPTY;
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      bots = parsed
        .map((entry) => normalizeStoredChatbot(entry))
        .filter((bot): bot is Chatbot => bot !== null);
    }
  } catch {
    bots = EMPTY;
  }
  cache = { raw, bots };
  return bots;
}

/** Server snapshot: always empty (localStorage is browser-only). */
export function getServerCreatedBots(): Chatbot[] {
  return EMPTY;
}

export function saveCreatedBots(bots: Chatbot[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bots));
  } catch {
    // Storage may be unavailable (private mode / quota) — degrade quietly.
  }
  for (const callback of listeners) callback();
}
