import { chatbotCatalog, getClients } from "./chatbots/catalog";
import { getLeads } from "./leads";
import { apiListChatbots } from "./api/chatbots";
import type { ChatAccess, Chatbot, Client, DashboardMetrics, Lead } from "./chatbots/types";
import {
  computeBotActivity,
  computeMetrics,
  type BotActivity,
} from "./metrics";

export interface DashboardData {
  bots: Chatbot[];
  clients: Client[];
  leads: Lead[];
  accesses: ChatAccess[];
  dataError: string | null;
  metrics: DashboardMetrics;
  botActivity: Record<string, BotActivity>;
  /** IDs of bots fetched from the DB (editable/deletable via API). */
  dbBotIds: string[];
  /** Reference clock shared by every relative-time render to avoid drift. */
  nowMs: number;
}

/**
 * Single entry point the page awaits. It merges the in-repo chatbot catalog
 * with persisted chatbot definitions and loads only real lead/session data
 * from the Hono API.
 */
export async function getDashboardData(): Promise<DashboardData> {
  const nowMs = Date.now();
  const apiBaseUrl =
    process.env.API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://localhost:4000";

  // Merge static catalog with bots created via the dashboard (stored in DB).
  // apiListChatbots silently falls back to [] on error so the page always loads.
  const apiBots = await apiListChatbots(apiBaseUrl).catch(() => [] as Chatbot[]);
  const apiIds = new Set(apiBots.map((b) => b.id));
  const bots = [...chatbotCatalog.filter((b) => !apiIds.has(b.id)), ...apiBots];

  const clients = getClients();
  const leadData = await getLeads(apiBaseUrl);

  return {
    bots,
    clients,
    leads: leadData.leads,
    accesses: leadData.accesses,
    dataError: leadData.error,
    metrics: computeMetrics(leadData.leads, leadData.accesses),
    botActivity: Object.fromEntries(computeBotActivity(leadData.leads)),
    dbBotIds: [...apiIds],
    nowMs,
  };
}
