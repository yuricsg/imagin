"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type { Chatbot } from "@/lib/chatbots/types";
import {
  buildChatbot,
  getCreatedBots,
  getServerCreatedBots,
  saveCreatedBots,
  subscribeCreatedBots,
  updateChatbot,
  normalizeStoredChatbot,
  type ChatbotInput,
} from "@/lib/chatbots/create";
import { apiCreateChatbot, apiUpdateChatbot } from "@/lib/api/chatbots";

/**
 * Shared create/update helpers for the chatbot wizard (home + dedicated pages).
 * Keeps localStorage optimistic updates and API persistence in one place.
 */
export function useChatbotActions(serverBots: Chatbot[] = []) {
  const createdBots = useSyncExternalStore(
    subscribeCreatedBots,
    getCreatedBots,
    getServerCreatedBots,
  );

  const [clientUpdates, setClientUpdates] = useState<Map<string, Chatbot>>(
    () => new Map(),
  );

  const serverBotIds = useMemo(
    () => new Set(serverBots.map((b) => b.id)),
    [serverBots],
  );

  const bots = useMemo(() => {
    const visibleServer = serverBots.map((b) => clientUpdates.get(b.id) ?? b);
    const visibleLocal = createdBots
      .filter((b) => !serverBotIds.has(b.id))
      .map((b) => clientUpdates.get(b.id) ?? b);
    return [...visibleServer, ...visibleLocal];
  }, [serverBots, createdBots, serverBotIds, clientUpdates]);

  const create = useCallback(
    (input: ChatbotInput): Chatbot => {
      const existingIds = new Set(bots.map((bot) => bot.id));
      const bot = buildChatbot(input, existingIds, Date.now());
      saveCreatedBots([...createdBots, bot]);
      apiCreateChatbot(bot).catch((err) =>
        console.warn("Failed to save bot to API:", err),
      );
      return bot;
    },
    [bots, createdBots],
  );

  const update = useCallback(
    (base: Chatbot, input: ChatbotInput): Chatbot => {
      const normalized = normalizeStoredChatbot(base) ?? base;
      const updated = updateChatbot(normalized, input);
      const existsLocally = createdBots.some((bot) => bot.id === updated.id);
      saveCreatedBots(
        existsLocally
          ? createdBots.map((bot) => (bot.id === updated.id ? updated : bot))
          : [...createdBots, updated],
      );
      setClientUpdates((prev) => new Map(prev).set(updated.id, updated));
      apiUpdateChatbot(updated).catch((err) =>
        console.warn("Failed to update bot in API:", err),
      );
      return updated;
    },
    [createdBots],
  );

  const findBot = useCallback(
    (id: string): Chatbot | null => {
      const fromList = bots.find((b) => b.id === id);
      if (fromList) return normalizeStoredChatbot(fromList) ?? fromList;
      const fromLocal = createdBots.find((b) => b.id === id);
      if (fromLocal) return normalizeStoredChatbot(fromLocal) ?? fromLocal;
      return null;
    },
    [bots, createdBots],
  );

  return { bots, createdBots, create, update, findBot, clientUpdates };
}
