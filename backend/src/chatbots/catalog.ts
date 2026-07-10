import { renataReisChatbot } from "./renata-reis.js";
import { getConversationFlow } from "./conversation-flows.js";
import type { ChatbotDefinition, PublicChatbotConfig } from "./types.js";

export const staticChatbotDefinitions = [
  renataReisChatbot,
] satisfies ChatbotDefinition[];

export function listChatbots(): PublicChatbotConfig[] {
  return staticChatbotDefinitions.map(toPublicChatbotConfig);
}

export function getChatbotDefinition(botId: string): ChatbotDefinition | null {
  return (
    staticChatbotDefinitions.find((chatbot) => chatbot.botId === botId) ?? null
  );
}

export function getPublicChatbotConfig(botId: string): PublicChatbotConfig | null {
  const chatbot = getChatbotDefinition(botId);

  return chatbot ? toPublicChatbotConfig(chatbot) : null;
}

/**
 * Resolves the number a lead should be handed off to. Bots created with several
 * offices carry them in `dashboardConfig.whatsapp.destinations`; the visitor's
 * pick arrives as `destinationId`. Anything unresolved falls back to the bot's
 * primary `whatsappPhone`, so single-number bots are unaffected.
 */
export function resolveWhatsAppPhone(
  chatbot: ChatbotDefinition,
  destinationId?: string,
): string {
  const fallback = chatbot.whatsappPhone.replace(/\D/g, "");
  if (!destinationId) return fallback;

  const config = chatbot.dashboardConfig;
  if (!config || typeof config !== "object") return fallback;
  const whatsapp = (config as { whatsapp?: unknown }).whatsapp;
  if (!whatsapp || typeof whatsapp !== "object") return fallback;
  const destinations = (whatsapp as { destinations?: unknown }).destinations;
  if (!Array.isArray(destinations)) return fallback;

  for (const entry of destinations) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    if (record.id !== destinationId) continue;
    const phone =
      typeof record.phoneNumber === "string"
        ? record.phoneNumber.replace(/\D/g, "")
        : "";
    if (phone) return phone;
  }

  return fallback;
}

export function buildWhatsAppUrl(
  chatbot: ChatbotDefinition,
  message: string,
  destinationId?: string,
) {
  const phone = resolveWhatsAppPhone(chatbot, destinationId);
  const target = phone ? `https://wa.me/${phone}` : "https://wa.me/";

  return `${target}?text=${encodeURIComponent(message)}`;
}

function readLauncherFromDashboardConfig(
  dashboardConfig: unknown,
  buttonTexts: string[],
): { teaserTexts: string[]; avatarUrl: string | null } {
  const fallbackTexts =
    buttonTexts.length > 0 ? buttonTexts : ["Olá! Posso te ajudar?"];

  if (!dashboardConfig || typeof dashboardConfig !== "object") {
    return { teaserTexts: fallbackTexts, avatarUrl: null };
  }

  const record = dashboardConfig as Record<string, unknown>;
  const launcherRaw = record.launcher;
  if (!launcherRaw || typeof launcherRaw !== "object") {
    return { teaserTexts: fallbackTexts, avatarUrl: null };
  }

  const launcher = launcherRaw as Record<string, unknown>;
  const teasers = Array.isArray(launcher.teaserTexts)
    ? launcher.teaserTexts
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
  const avatarUrl =
    typeof launcher.avatarUrl === "string" && launcher.avatarUrl.trim()
      ? launcher.avatarUrl.trim()
      : null;

  return {
    teaserTexts: teasers.length > 0 ? teasers : fallbackTexts,
    avatarUrl,
  };
}

function toPublicChatbotConfig(
  chatbot: ChatbotDefinition,
): PublicChatbotConfig {
  const {
    whatsappPhone: _whatsappPhone,
    tracking: _tracking,
    formatWhatsAppMessage: _formatWhatsAppMessage,
    ...publicConfig
  } = chatbot;

  const baseLauncher =
    chatbot.launcher ??
    readLauncherFromDashboardConfig(
      chatbot.dashboardConfig,
      chatbot.buttonTexts,
    );
  // The dedicated avatarUrl column is the durable source; fall back to it when
  // the dashboardConfig launcher has no photo.
  const launcher = {
    ...baseLauncher,
    avatarUrl: baseLauncher.avatarUrl ?? chatbot.avatarUrl ?? null,
  };

  return {
    ...publicConfig,
    launcher,
    buttonTexts: launcher.teaserTexts,
    conversationFlow: getConversationFlow(chatbot.flowKey),
    dashboardConfig: chatbot.dashboardConfig,
    integrationStatus: {
      metaConfigured: Boolean(
        chatbot.tracking.meta?.pixelId && chatbot.tracking.meta.accessToken,
      ),
      googleAnalyticsConfigured: Boolean(
        chatbot.tracking.googleAnalytics?.measurementId &&
          chatbot.tracking.googleAnalytics.apiSecret,
      ),
    },
  };
}

export { toPublicChatbotConfig };
