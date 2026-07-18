"use client";

import { useState } from "react";
import type { Chatbot, Lead } from "@/lib/chatbots/types";
import { ACCENTS } from "@/lib/chatbots/accents";
import { chatbotDisplayName } from "@/lib/chatbots/display";
import { LEAD_CHANNEL, LEAD_STATUS } from "@/lib/labels";
import { absoluteTime, relativeTime } from "@/lib/format";
import { Avatar, Badge, Skeleton } from "./ui";
import { IconCheck, IconCopy, IconExternal } from "./icons";

const TH = "px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500";

/** Stagger step between row entrances; capped at ~10 rows (globals.css tokens). */
const STAGGER_MS = 35;

function staggerDelay(index: number): string {
  return `${Math.min(index, 9) * STAGGER_MS}ms`;
}

export function LeadsTable({
  leads,
  botsById,
  showBotColumn,
  nowMs,
  onOpenLead,
}: {
  leads: Lead[];
  botsById: Record<string, Chatbot>;
  showBotColumn: boolean;
  nowMs: number;
  onOpenLead: (lead: Lead) => void;
}) {
  return (
    <>
      <div className="divide-y divide-zinc-100 md:hidden dark:divide-zinc-800/70">
        {leads.map((lead, index) => {
          const bot = botsById[lead.botId];
          const status = LEAD_STATUS[lead.status];
          return (
            <button
              key={lead.id}
              type="button"
              onClick={() => onOpenLead(lead)}
              style={{ animationDelay: staggerDelay(index) }}
              className="motion-enter motion-lift motion-press block w-full px-4 py-4 text-left transition-colors hover:bg-zinc-50 focus:bg-zinc-50 focus:outline-none dark:hover:bg-zinc-800/30 dark:focus:bg-zinc-800/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{lead.name}</p>
                  <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{bot?.name ?? lead.botId}</p>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-zinc-400">{relativeTime(lead.createdAt, nowMs)}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge label={status.label} className={status.badge} dot={status.dot} />
                <Badge label={LEAD_CHANNEL[lead.attribution.channel].label} className={LEAD_CHANNEL[lead.attribution.channel].badge} />
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-300">{lead.classification.primary}</p>
            </button>
          );
        })}
      </div>
      <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[680px] border-collapse">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className={TH}>Lead</th>
            <th className={TH}>Telefone</th>
            {showBotColumn ? <th className={TH}>Chatbot</th> : null}
            <th className={TH}>Status</th>
            <th className={TH}>Origem</th>
            <th className={`${TH} text-right`}>Recebido</th>
            <th className={TH}>
              <span className="sr-only">Ações rápidas</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead, index) => {
            const bot = botsById[lead.botId];
            const status = LEAD_STATUS[lead.status];
            return (
              <tr
                key={lead.id}
                style={{ animationDelay: staggerDelay(index) }}
                className="motion-enter group border-b border-zinc-100 transition-colors last:border-0 hover:bg-zinc-50 dark:border-zinc-800/70 dark:hover:bg-zinc-800/30"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={lead.name}
                      size="sm"
                      className="bg-linear-to-br from-zinc-100 to-zinc-200 text-zinc-600 dark:from-zinc-700 dark:to-zinc-800 dark:text-zinc-200"
                    />
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onOpenLead(lead)}
                        className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100"
                        title={lead.message}
                      >
                        {lead.name}
                      </button>
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
                            {chatbotDisplayName(bot)}
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
                <td className="whitespace-nowrap px-2 py-3">
                  <LeadQuickActions lead={lead} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </>
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
          className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400"
          title={utmParts.join(" · ")}
        >
          {utmParts.join(" · ")}
        </p>
      ) : null}
      <p
        className="mt-0.5 truncate text-xs text-zinc-400 dark:text-zinc-500"
        title={lead.sourceUrl}
      >
        {lead.sourceUrl}
      </p>
    </div>
  );
}

/** Skeleton mirroring the desktop rows; used by the route-level loading shell. */
export function LeadsTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="px-4 py-3">
      <div className="space-y-3.5">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-7 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-44 max-w-full" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="hidden h-5 w-20 rounded-full sm:block" />
            <Skeleton className="hidden h-5 w-16 rounded-full sm:block" />
            <Skeleton className="h-3.5 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}

const QUICK_ACTION_CLASS =
  "flex size-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 dark:hover:bg-zinc-800 dark:hover:text-teal-300";

/**
 * Hover/focus-revealed per-row actions (desktop): copy the prepared WhatsApp
 * message and open the WhatsApp conversation. The mobile card stays a single
 * tap target — its details modal offers the same actions.
 */
function LeadQuickActions({ lead }: { lead: Lead }) {
  const [copied, setCopied] = useState(false);

  async function copyMessage() {
    const text = lead.whatsappMessage || lead.message;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked (insecure context); fail quietly.
    }
  }

  if (copied) {
    return (
      <span className="inline-flex items-center gap-1 px-1 text-xs font-medium text-teal-700 dark:text-teal-300">
        <IconCheck className="size-4" />
        Copiado
      </span>
    );
  }

  return (
    <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
      <button
        type="button"
        onClick={copyMessage}
        aria-label={`Copiar mensagem de ${lead.name}`}
        title="Copiar mensagem do WhatsApp"
        className={QUICK_ACTION_CLASS}
      >
        <IconCopy className="size-4" />
      </button>
      {lead.whatsappUrl ? (
        <a
          href={lead.whatsappUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Abrir WhatsApp de ${lead.name}`}
          title="Abrir conversa no WhatsApp"
          className={QUICK_ACTION_CLASS}
        >
          <IconExternal className="size-4" />
        </a>
      ) : null}
    </div>
  );
}
