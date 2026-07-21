import { chatbotCatalog, getClients } from "./chatbots/catalog";
import { getLeads, type LeadsQuery } from "./leads";
import { apiListChatbots } from "./api/chatbots";

/** Signed-in operator's email, or null when there's no session/request scope. */
async function resolveUserEmail(): Promise<string | null> {
  try {
    // Lazy import so modules that don't render (tests) never load NextAuth.
    const { auth } = await import("./auth");
    const session = await auth();
    return session?.user?.email ?? null;
  } catch {
    return null;
  }
}
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
  /** Signed-in operator's email — scopes per-user preferences (⌘K pins). */
  userEmail: string | null;
  /** Reference clock shared by every relative-time render to avoid drift. */
  nowMs: number;
}

type DashboardDataQuery = LeadsQuery & {
  recentDays?: number;
};

/**
 * Single entry point the page awaits. It merges the in-repo chatbot catalog
 * with persisted chatbot definitions and loads only real lead/session data
 * from the Hono API.
 */
export async function getDashboardData(
  query: DashboardDataQuery = {},
): Promise<DashboardData> {
  const nowMs = Date.now();
  const { recentDays, ...leadQuery } = query;

  if (recentDays && !leadQuery.from) {
    leadQuery.from = new Date(
      nowMs - recentDays * 24 * 60 * 60 * 1000,
    ).toISOString();
  }

  const apiBaseUrl =
    process.env.API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://localhost:4000";

  const [apiBots, leadData, userEmail] = await Promise.all([
    // API failure must not hide the in-repo catalog.
    apiListChatbots(apiBaseUrl).catch(() => [] as Chatbot[]),
    getLeads(apiBaseUrl, leadQuery),
    resolveUserEmail(),
  ]);
  const apiIds = new Set(apiBots.map((b) => b.id));
  const bots = [...chatbotCatalog.filter((b) => !apiIds.has(b.id)), ...apiBots];

  const clients = getClients();

  return {
    bots,
    clients,
    leads: leadData.leads,
    accesses: leadData.accesses,
    dataError: leadData.error,
    metrics: computeMetrics(leadData.leads, leadData.accesses),
    botActivity: Object.fromEntries(computeBotActivity(leadData.leads)),
    dbBotIds: [...apiIds],
    userEmail,
    nowMs,
  };
}
