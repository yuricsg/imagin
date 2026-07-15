import type { ChatAccess, DashboardMetrics, Lead } from "./chatbots/types";

export function computeMetrics(
  leads: Lead[],
  accesses: ChatAccess[],
): DashboardMetrics {
  let converted = 0;
  let appointmentRequests = 0;

  for (const lead of leads) {
    if (lead.status === "converted") converted += 1;
    if (lead.status === "appointment_requested") appointmentRequests += 1;
  }

  return {
    totalAccesses: accesses.length,
    totalLeads: leads.length,
    appointmentRequests,
    convertedLeads: converted,
    conversionRate: leads.length === 0 ? 0 : converted / leads.length,
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
