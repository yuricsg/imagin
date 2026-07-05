import type { Chatbot, DashboardMetrics, Lead } from "./chatbots/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function computeMetrics(
  bots: Chatbot[],
  leads: Lead[],
  nowMs: number,
): DashboardMetrics {
  const todayStart = new Date(nowMs);
  todayStart.setHours(0, 0, 0, 0);
  const todayStartMs = todayStart.getTime();
  const weekAgoMs = nowMs - 7 * DAY_MS;

  let leadsToday = 0;
  let leads7d = 0;
  let converted = 0;
  let newLeads = 0;

  for (const lead of leads) {
    const ts = Date.parse(lead.createdAt);
    if (ts >= todayStartMs) leadsToday += 1;
    if (ts >= weekAgoMs) leads7d += 1;
    if (lead.status === "converted") converted += 1;
    if (lead.status === "new") newLeads += 1;
  }

  return {
    activeBots: bots.filter((b) => b.status === "active").length,
    totalBots: bots.length,
    totalLeads: leads.length,
    leadsToday,
    leads7d,
    conversionRate: leads.length === 0 ? 0 : converted / leads.length,
    newLeads,
  };
}

/** Per-bot lead counts and most-recent activity, for the chatbot list. */
export interface BotActivity {
  leadCount: number;
  newCount: number;
  lastLeadAt: string | null;
}

export function computeBotActivity(leads: Lead[]): Map<string, BotActivity> {
  const map = new Map<string, BotActivity>();
  for (const lead of leads) {
    const current = map.get(lead.botId) ?? {
      leadCount: 0,
      newCount: 0,
      lastLeadAt: null,
    };
    current.leadCount += 1;
    if (lead.status === "new") current.newCount += 1;
    if (!current.lastLeadAt || lead.createdAt > current.lastLeadAt) {
      current.lastLeadAt = lead.createdAt;
    }
    map.set(lead.botId, current);
  }
  return map;
}
