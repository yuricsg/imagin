import type { Chatbot, Client } from "./types";
import { renataReis } from "./renata-reis";

/**
 * Server-side catalog. The Dra. Renata Reis entry is the project seed;
 * additional bots created in the UI merge client-side from localStorage.
 */
export const chatbotCatalog: Chatbot[] = [renataReis];

export function getChatbotById(id: string): Chatbot | undefined {
  return chatbotCatalog.find((bot) => bot.id === id);
}

/** Distinct clients across the catalog, alphabetically ordered for filters. */
export function getClients(): Client[] {
  const byId = new Map<string, Client>();
  for (const bot of chatbotCatalog) {
    if (!byId.has(bot.clientId)) {
      byId.set(bot.clientId, { id: bot.clientId, name: bot.clientName });
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
