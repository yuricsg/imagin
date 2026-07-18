import type { Chatbot, Lead } from "./chatbots/types";
import { chatbotDisplayName } from "./chatbots/display";
import { LEAD_CHANNEL, LEAD_STATUS } from "./labels";

export type DateRange = { start: string; end: string };

export function isWithinDateRange(isoDate: string, range: DateRange): boolean {
  const value = Date.parse(isoDate);
  if (!Number.isFinite(value)) return false;
  if (range.start) {
    const start = new Date(`${range.start}T00:00:00`).getTime();
    if (value < start) return false;
  }
  if (range.end) {
    const end = new Date(`${range.end}T23:59:59.999`).getTime();
    if (value > end) return false;
  }
  return true;
}

export function buildLeadsCsv(
  leads: Lead[],
  botsById: Record<string, Chatbot>,
): string {
  const header = [
    "Data",
    "Nome",
    "Telefone",
    "Email",
    "Chatbot",
    "Cliente",
    "Status",
    "Classificação",
    "Origem",
    "Campanha",
    "Intenção",
    "Exames ou serviços",
    "Etapa final",
    "Clicou no WhatsApp",
    "Mensagem do WhatsApp",
    "Página de origem",
  ];
  const rows = leads.map((lead) => {
    const bot = botsById[lead.botId];
    const details = lead.classification.details.map((item) => item.value).join(" | ");
    return [
      lead.createdAt,
      lead.name,
      lead.phone,
      lead.email,
      bot ? chatbotDisplayName(bot) : lead.botId,
      bot?.clientName ?? lead.clientId,
      LEAD_STATUS[lead.status].label,
      lead.classification.primary,
      LEAD_CHANNEL[lead.attribution.channel].label,
      lead.attribution.utmCampaign ?? "",
      lead.intent ?? "",
      [lead.selectedExams.join(" | "), details].filter(Boolean).join(" | "),
      lead.progress.currentStep ?? "",
      lead.progress.whatsappClickedAt ? "Sim" : "Não",
      lead.whatsappMessage ?? "",
      lead.sourceUrl,
    ];
  });
  return `\uFEFF${[header, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n")}`;
}

export function reportFilename(range: DateRange): string {
  const suffix =
    range.start || range.end
      ? `${range.start || "inicio"}_a_${range.end || "hoje"}`
      : "todo-periodo";
  return `leads-imagin-${suffix}.csv`;
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
