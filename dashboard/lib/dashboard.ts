import { chatbotCatalog, getClients } from "./chatbots/catalog";
import { getLeads } from "./leads";
import { apiListChatbots } from "./api/chatbots";
import type { Chatbot, Client, DashboardMetrics, Lead } from "./chatbots/types";
import {
  computeBotActivity,
  computeMetrics,
  type BotActivity,
} from "./metrics";

export interface DashboardData {
  bots: Chatbot[];
  clients: Client[];
  leads: Lead[];
  metrics: DashboardMetrics;
  botActivity: Record<string, BotActivity>;
  /** Reference clock shared by every relative-time render to avoid drift. */
  nowMs: number;
}

/**
 * Single entry point the page awaits. Today it reads the in-repo catalog and
 * sample leads; swapping these getters for calls to the Hono backend later
 * keeps this signature — and every consumer — unchanged.
 */
export async function getDashboardData(): Promise<DashboardData> {
  const nowMs = Date.now();

  // Merge static catalog with bots created via the dashboard (stored in DB).
  // apiListChatbots silently falls back to [] on error so the page always loads.
  const apiBots = await apiListChatbots().catch(() => [] as Chatbot[]);
  const apiIds = new Set(apiBots.map((b) => b.id));
  const bots = [...chatbotCatalog.filter((b) => !apiIds.has(b.id)), ...apiBots];

  const clients = getClients();
  const leads = await getLeads(nowMs);

  return {
    bots,
    clients,
    leads,
    metrics: computeMetrics(bots, leads, nowMs),
    botActivity: Object.fromEntries(computeBotActivity(leads)),
    nowMs,
  };
}
