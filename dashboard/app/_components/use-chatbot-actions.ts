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
 * The database is the source of truth: create/update await the API and throw on
 * failure so the wizard can surface it — nothing is persisted to localStorage.
 * localStorage is read only to recover legacy bots that never reached the DB
 * (see `migrateLocalBots`).
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
    // Legacy localStorage bots still awaiting migration to the DB.
    const visibleLocal = createdBots
      .filter((b) => !serverBotIds.has(b.id))
      .map((b) => clientUpdates.get(b.id) ?? b);
    return [...visibleServer, ...visibleLocal];
  }, [serverBots, createdBots, serverBotIds, clientUpdates]);

  const create = useCallback(
    async (input: ChatbotInput): Promise<Chatbot> => {
      const existingIds = new Set(bots.map((bot) => bot.id));
      const bot = buildChatbot(input, existingIds, Date.now());
      // Persist to the DB and surface failures — the bot only exists if saved.
      // apiCreateChatbot retries to ride out a cold backend before giving up.
      const saved = await apiCreateChatbot(bot);
      return saved;
    },
    [bots],
  );

  const update = useCallback(
    async (base: Chatbot, input: ChatbotInput): Promise<Chatbot> => {
      const normalized = normalizeStoredChatbot(base) ?? base;
      const updated = updateChatbot(normalized, input);
      const saved = await apiUpdateChatbot(updated);
      // Optimistic in-memory override until the next server fetch.
      setClientUpdates((prev) => new Map(prev).set(saved.id, saved));
      return saved;
    },
    [],
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

/**
 * One-time recovery of bots that live only in localStorage because their
 * original DB write failed (e.g. the backend was cold). Pushes each orphan not
 * already on the server to the DB and, on success, drops it from localStorage.
 * Returns the number of bots migrated so the caller can refresh the server data.
 */
export async function migrateLocalBots(
  serverBotIds: ReadonlySet<string>,
): Promise<number> {
  const local = getCreatedBots();
  const orphans = local.filter((bot) => !serverBotIds.has(bot.id));
  if (orphans.length === 0) return 0;

  const migratedIds = new Set<string>();
  for (const bot of orphans) {
    try {
      await apiCreateChatbot(bot);
      migratedIds.add(bot.id);
    } catch (err) {
      // Leave it in localStorage to retry on the next load.
      console.warn(`Falha ao migrar bot ${bot.id} para o banco:`, err);
    }
  }

  if (migratedIds.size > 0) {
    saveCreatedBots(getCreatedBots().filter((bot) => !migratedIds.has(bot.id)));
  }
  return migratedIds.size;
}
