import { renataReisChatbot } from "./renata-reis.js";
import type { ChatbotDefinition, PublicChatbotConfig } from "./types.js";

const chatbotDefinitions = [renataReisChatbot] satisfies ChatbotDefinition[];

export function listChatbots(): PublicChatbotConfig[] {
  return chatbotDefinitions.map(toPublicChatbotConfig);
}

export function getChatbotDefinition(botId: string): ChatbotDefinition | null {
  return chatbotDefinitions.find((chatbot) => chatbot.botId === botId) ?? null;
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
    formatWhatsAppMessage: _formatWhatsAppMessage,
    ...publicConfig
  } = chatbot;

  return publicConfig;
}
