"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import type { Chatbot, Client, Lead, LeadStatus } from "@/lib/chatbots/types";
import type { DashboardData } from "@/lib/dashboard";
import { ACCENTS } from "@/lib/chatbots/accents";
import { computeMetrics } from "@/lib/metrics";
import {
  buildLeadsCsv,
  isWithinDateRange,
  reportFilename,
  type DateRange,
} from "@/lib/lead-report";
import {
  getCreatedBots,
  getServerCreatedBots,
  saveCreatedBots,
  subscribeCreatedBots,
  normalizeStoredChatbot,
} from "@/lib/chatbots/create";
import { apiDeleteChatbot } from "@/lib/api/chatbots";
import { chatbotDisplayName } from "@/lib/chatbots/display";
import { MetricsRow } from "./metrics-row";
import { ChatbotList } from "./chatbot-list";
import { EmbedBlock } from "./embed-block";
import { LeadsToolbar } from "./leads-toolbar";
import { LeadsTable } from "./leads-table";
import { LeadDetailsModal } from "./lead-details-modal";
import { EmptyState } from "./ui";
import { IconAlert, IconBot, IconInboxStack, IconPlus } from "./icons";

export function DashboardHome({ data }: { data: DashboardData }) {
  const router = useRouter();
  const {
    bots: serverBots,
    leads,
    accesses = [],
    dataError = null,
    botActivity,
    dbBotIds,
    nowMs,
  } = data;

  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState<string>("all");
  const [status, setStatus] = useState<LeadStatus | "all">("all");
  const [dateRange, setDateRange] = useState<DateRange>({ start: "", end: "" });
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  // IDs of bots deleted this session — filtered out immediately without page reload.
  const [deletedBotIds, setDeletedBotIds] = useState<Set<string>>(new Set());

  // Bots registered through the UI live only in the browser (localStorage), read
  // as an external store so SSR and the first client render agree (both empty).
  const createdBots = useSyncExternalStore(
    subscribeCreatedBots,
    getCreatedBots,
    getServerCreatedBots,
  );

  const serverBotIds = useMemo(
    () => new Set(serverBots.map((b) => b.id)),
    [serverBots],
  );

  const bots = useMemo(() => {
    const visibleServer = serverBots
      .filter((b) => !deletedBotIds.has(b.id))
      .map((b) => {
        const local = createdBots.find((c) => c.id === b.id);
        return local ?? b;
      });
    const visibleLocal = createdBots
      .filter((b) => !serverBotIds.has(b.id) && !deletedBotIds.has(b.id));
    return [...visibleServer, ...visibleLocal];
  }, [serverBots, createdBots, serverBotIds, deletedBotIds]);

  // A bot is editable if it is in localStorage (just created, pre-sync)
  // OR if it was fetched from the DB (dbBotIds) — which happens after page reload.
  const editableBotIds = useMemo(
    () => new Set([...createdBots.map((b) => b.id), ...dbBotIds]),
    [createdBots, dbBotIds],
  );

  const botsById = useMemo(() => {
    const record: Record<string, Chatbot> = {};
    for (const bot of bots) record[bot.id] = bot;
    return record;
  }, [bots]);

  // Clients and metrics are derived from the full bot list so newly created
  // bots show up in the client filter and the metric counters immediately.
  const clients = useMemo<Client[]>(() => {
    const byId = new Map<string, Client>();
    for (const bot of bots) {
      if (!byId.has(bot.clientId)) {
        byId.set(bot.clientId, { id: bot.clientId, name: bot.clientName });
      }
    }
    return [...byId.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR"),
    );
  }, [bots]);

  const selectedBot = selectedBotId ? botsById[selectedBotId] ?? null : null;

  function handleDelete(id: string) {
    // Remove from localStorage, mark as deleted client-side, and delete from DB.
    saveCreatedBots(createdBots.filter((bot) => bot.id !== id));
    setDeletedBotIds((prev) => new Set([...prev, id]));
    if (selectedBotId === id) setSelectedBotId(null);
    apiDeleteChatbot(id).catch((err) =>
      console.warn("Failed to delete bot from API:", err),
    );
  }

  const contextLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (selectedBotId && lead.botId !== selectedBotId) return false;
      if (clientId !== "all" && lead.clientId !== clientId) return false;
      if (!isWithinDateRange(lead.createdAt, dateRange)) return false;
      return true;
    });
  }, [leads, selectedBotId, clientId, dateRange]);

  const contextAccesses = useMemo(() => {
    return accesses.filter((access) => {
      if (selectedBotId && access.botId !== selectedBotId) return false;
      if (clientId !== "all" && access.clientId !== clientId) return false;
      return isWithinDateRange(access.openedAt, dateRange);
    });
  }, [accesses, selectedBotId, clientId, dateRange]);

  const metrics = useMemo(
    () => computeMetrics(contextLeads, contextAccesses),
    [contextAccesses, contextLeads],
  );

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();
    return contextLeads.filter((lead) => {
      if (status !== "all" && lead.status !== status) return false;
      if (query) {
        const haystack =
          `${lead.name} ${lead.email} ${lead.phone} ${lead.message} ${lead.sourceUrl} ${lead.classification.primary}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [contextLeads, status, search]);

  const hasActiveFilters =
    selectedBotId !== null ||
    clientId !== "all" ||
    status !== "all" ||
    dateRange.start !== "" ||
    dateRange.end !== "" ||
    search.trim() !== "";

  function clearFilters() {
    setSelectedBotId(null);
    setSearch("");
    setClientId("all");
    setStatus("all");
    setDateRange({ start: "", end: "" });
  }

  function exportCsv() {
    const csv = buildLeadsCsv(filteredLeads, botsById);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = reportFilename(dateRange);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Visão geral
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Monitore seus chatbots e os leads recebidos por cada um.
          </p>
        </div>
        <div className="flex items-center gap-3 sm:justify-end">
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            {bots.length} {bots.length === 1 ? "chatbot" : "chatbots"} ·{" "}
            {clients.length} {clients.length === 1 ? "cliente" : "clientes"}
          </p>
          <Link href="/chatbots/new" className="btn-brand px-4 py-2.5">
            <IconPlus className="size-4" />
            Novo chatbot
          </Link>
        </div>
      </div>

      <MetricsRow metrics={metrics} />

      {dataError ? (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
          <IconAlert className="mt-0.5 size-4 shrink-0" />
          <p>{dataError} Nenhum dado fictício foi exibido.</p>
        </div>
      ) : null}

      {bots.length === 0 ? (
        <section className="rounded-xl border border-dashed border-zinc-300/90 bg-white/70 px-5 py-8 text-center dark:border-zinc-700/80 dark:bg-zinc-900/40 sm:px-8 sm:py-10">
          <div className="mx-auto max-w-md space-y-3">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-cyan-500 text-teal-950 shadow-sm shadow-cyan-500/25">
              <IconBot className="size-6" />
            </div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Comece pelo seu primeiro chatbot
            </h2>
            <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              Cadastre um bot em poucos passos, copie o código de instalação e
              acompanhe os leads aqui no painel — com origem do Google, Meta e
              campanhas quando configurado.
            </p>
            <Link href="/chatbots/new" className="btn-brand inline-flex px-4 py-2">
              <IconPlus className="size-4" />
              Criar primeiro chatbot
            </Link>
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-zinc-200/70 bg-white/80 backdrop-blur-xl dark:border-zinc-800/70 dark:bg-zinc-900/55 lg:col-span-2">
          <header className="flex items-center justify-between gap-2 border-b border-zinc-200/70 px-5 py-4 dark:border-zinc-800/70">
            <div className="flex items-baseline gap-2">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Leads
              </h2>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {filteredLeads.length === contextLeads.length
                  ? `${contextLeads.length} no período`
                  : `${filteredLeads.length} de ${contextLeads.length}`}
              </span>
            </div>
            {selectedBot ? (
              <span className="flex min-w-0 items-center gap-1.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                <span
                  className={`size-1.5 shrink-0 rounded-full ${ACCENTS[selectedBot.accent].dot}`}
                />
                <span className="truncate">filtrando por {chatbotDisplayName(selectedBot)}</span>
              </span>
            ) : null}
          </header>

          <LeadsToolbar
            search={search}
            onSearch={setSearch}
            botId={selectedBotId ?? "all"}
            onBot={(value) => setSelectedBotId(value === "all" ? null : value)}
            clientId={clientId}
            onClient={setClientId}
            status={status}
            onStatus={setStatus}
            dateRange={dateRange}
            onDateRange={setDateRange}
            bots={bots}
            clients={clients}
            hasActiveFilters={hasActiveFilters}
            onClear={clearFilters}
            onExport={exportCsv}
            exportDisabled={filteredLeads.length === 0}
          />

          {filteredLeads.length > 0 ? (
            <LeadsTable
              leads={filteredLeads}
              botsById={botsById}
              showBotColumn={selectedBotId === null}
              nowMs={nowMs}
              onOpenLead={setSelectedLead}
            />
          ) : hasActiveFilters ? (
            <EmptyState
              icon={<IconInboxStack className="size-5" />}
              title="Nenhum lead corresponde aos filtros"
              description="Ajuste a busca ou os filtros para ver mais resultados."
              action={
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Limpar filtros
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={<IconInboxStack className="size-5" />}
              title="Nenhum lead ainda"
              description="Assim que um chatbot capturar um lead, ele aparece aqui."
            />
          )}
        </section>

        <div className="space-y-6">
          <ChatbotList
            bots={bots}
            activity={botActivity}
            selectedBotId={selectedBotId}
            editableBotIds={editableBotIds}
            onSelect={setSelectedBotId}
            onCreate={() => router.push("/chatbots/new")}
            onEdit={(bot) => {
              const normalized = normalizeStoredChatbot(bot);
              if (normalized) router.push(`/chatbots/${normalized.id}/edit`);
            }}
            onDuplicate={(bot) => router.push(`/chatbots/new?from=${bot.id}`)}
            onDelete={handleDelete}
            nowMs={nowMs}
          />

          {selectedBot ? (
            <EmbedBlock bot={selectedBot} />
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-300/80 bg-white/60 p-5 backdrop-blur-xl dark:border-zinc-700/80 dark:bg-zinc-900/40">
              <EmptyState
                icon={<IconBot className="size-5" />}
                title="Selecione um chatbot"
                description="Escolha um bot na lista para filtrar seus leads e copiar o código de incorporação."
              />
            </div>
          )}
        </div>
      </div>

      {selectedLead ? (
        <LeadDetailsModal
          lead={selectedLead}
          bot={botsById[selectedLead.botId]}
          onClose={() => setSelectedLead(null)}
        />
      ) : null}
    </main>
  );
}
