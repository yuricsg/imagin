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

export function buildWhatsAppUrl(chatbot: ChatbotDefinition, message: string) {
  const phone = chatbot.whatsappPhone.replace(/\D/g, "");
  const target = phone ? `https://wa.me/${phone}` : "https://wa.me/";

  return `${target}?text=${encodeURIComponent(message)}`;
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

  return {
    ...publicConfig,
    conversationFlow: getConversationFlow(chatbot.flowKey),
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
