import type { Chatbot, Lead } from "@/lib/chatbots/types";
import { ACCENTS } from "@/lib/chatbots/accents";
import { LEAD_CHANNEL, LEAD_STATUS } from "@/lib/labels";
import { absoluteTime, relativeTime } from "@/lib/format";
import { Avatar, Badge } from "./ui";

const TH = "px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500";

export function LeadsTable({
  leads,
  botsById,
  showBotColumn,
  nowMs,
}: {
  leads: Lead[];
  botsById: Record<string, Chatbot>;
  showBotColumn: boolean;
  nowMs: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] border-collapse">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className={TH}>Lead</th>
            <th className={TH}>Telefone</th>
            {showBotColumn ? <th className={TH}>Chatbot</th> : null}
            <th className={TH}>Status</th>
            <th className={TH}>Origem</th>
            <th className={`${TH} text-right`}>Recebido</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const bot = botsById[lead.botId];
            const status = LEAD_STATUS[lead.status];
            return (
              <tr
                key={lead.id}
                className="border-b border-zinc-100 transition-colors last:border-0 hover:bg-zinc-50 dark:border-zinc-800/70 dark:hover:bg-zinc-800/30"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={lead.name}
                      size="sm"
                      className="bg-linear-to-br from-zinc-100 to-zinc-200 text-zinc-600 dark:from-zinc-700 dark:to-zinc-800 dark:text-zinc-200"
                    />
                    <div className="min-w-0">
                      <p
                        className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100"
                        title={lead.message}
                      >
                        {lead.name}
                      </p>
                      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {lead.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm tabular-nums text-zinc-600 dark:text-zinc-300">
                  {lead.phone}
                </td>
                {showBotColumn ? (
                  <td className="px-4 py-3">
                    {bot ? (
                      <div className="flex items-center gap-2">
                        <span className={`size-2.5 shrink-0 rounded-full ring-2 ring-white dark:ring-zinc-900 ${ACCENTS[bot.accent].dot}`} />
                        <div className="min-w-0">
                          <p className="truncate text-sm text-zinc-700 dark:text-zinc-200">
                            {bot.name}
                          </p>
                          <p className="truncate text-xs text-zinc-400 dark:text-zinc-500">
                            {bot.clientName}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-zinc-400">—</span>
                    )}
                  </td>
                ) : null}
                <td className="px-4 py-3">
                  <Badge label={status.label} className={status.badge} dot={status.dot} />
                </td>
                <td className="px-4 py-3">
                  <LeadOriginCell lead={lead} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <span
                    className="text-sm tabular-nums text-zinc-500 dark:text-zinc-400"
                    title={absoluteTime(lead.createdAt)}
                  >
                    {relativeTime(lead.createdAt, nowMs)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LeadOriginCell({ lead }: { lead: Lead }) {
  const channel = LEAD_CHANNEL[lead.attribution.channel];
  const utmParts = [
    lead.attribution.utmSource,
    lead.attribution.utmMedium,
    lead.attribution.utmCampaign,
  ].filter(Boolean);

  return (
    <div className="min-w-0 max-w-[200px]">
      <Badge label={channel.label} className={channel.badge} />
      {utmParts.length > 0 ? (
        <p
          className="mt-1 truncate text-[11px] text-zinc-500 dark:text-zinc-400"
          title={utmParts.join(" · ")}
        >
          {utmParts.join(" · ")}
        </p>
      ) : null}
      <p
        className="mt-0.5 truncate text-[11px] text-zinc-400 dark:text-zinc-500"
        title={lead.sourceUrl}
      >
        {lead.sourceUrl}
      </p>
    </div>
  );
}
