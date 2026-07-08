"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { Chatbot, Client, LeadStatus } from "@/lib/chatbots/types";
import type { DashboardData } from "@/lib/dashboard";
import { ACCENTS } from "@/lib/chatbots/accents";
import { computeMetrics } from "@/lib/metrics";
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
import { apiCreateChatbot, apiUpdateChatbot, apiDeleteChatbot } from "@/lib/api/chatbots";
import { MetricsRow } from "./metrics-row";
import { ChatbotList } from "./chatbot-list";
import { EmbedBlock } from "./embed-block";
import { ChatbotForm } from "./chatbot-form";
import { LeadsToolbar, type PeriodFilter } from "./leads-toolbar";
import { LeadsTable } from "./leads-table";
import { EmptyState } from "./ui";
import { IconBot, IconInboxStack, IconPlus } from "./icons";

const DAY_MS = 24 * 60 * 60 * 1000;

function periodThreshold(period: PeriodFilter, nowMs: number): number | null {
  if (period === "all") return null;
  if (period === "today") {
    const start = new Date(nowMs);
    start.setHours(0, 0, 0, 0);
    return start.getTime();
  }
  return period === "7d" ? nowMs - 7 * DAY_MS : nowMs - 30 * DAY_MS;
}

export function DashboardHome({ data }: { data: DashboardData }) {
  const { bots: serverBots, leads, botActivity, dbBotIds, nowMs } = data;

  const [showForm, setShowForm] = useState(false);
  const [editingBot, setEditingBot] = useState<Chatbot | null>(null);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState<string>("all");
  const [status, setStatus] = useState<LeadStatus | "all">("all");
  const [period, setPeriod] = useState<PeriodFilter>("all");

  // Bots registered through the UI live only in the browser (localStorage), read
  // as an external store so SSR and the first client render agree (both empty).
  const createdBots = useSyncExternalStore(
    subscribeCreatedBots,
    getCreatedBots,
    getServerCreatedBots,
  );

  // Exclude from localStorage any bot already fetched from the server (DB),
  // so bots don't appear twice after a page reload once they're persisted.
  const serverBotIds = useMemo(
    () => new Set(serverBots.map((b) => b.id)),
    [serverBots],
  );

  const bots = useMemo(
    () => [...serverBots, ...createdBots.filter((b) => !serverBotIds.has(b.id))],
    [serverBots, createdBots, serverBotIds],
  );

  const editableBotIds = useMemo(
    () => new Set(createdBots.map((bot) => bot.id)),
    [createdBots],
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

  const metrics = useMemo(
    () => computeMetrics(bots, leads, nowMs),
    [bots, leads, nowMs],
  );

  const selectedBot = selectedBotId ? botsById[selectedBotId] ?? null : null;

  function handleCreate(input: ChatbotInput): Chatbot {
    const existingIds = new Set(bots.map((bot) => bot.id));
    const bot = buildChatbot(input, existingIds, Date.now());
    // Save to localStorage immediately for instant UI feedback.
    saveCreatedBots([...createdBots, bot]);
    setSelectedBotId(bot.id);
    // Persist to DB in the background; on next page load server provides the bot.
    apiCreateChatbot(bot).catch((err) =>
      console.warn("Failed to save bot to API:", err),
    );
    return bot;
  }

  function handleUpdate(input: ChatbotInput): Chatbot {
    if (!editingBot) {
      throw new Error("handleUpdate called without editingBot");
    }
    const base = normalizeStoredChatbot(editingBot) ?? editingBot;
    const updated = updateChatbot(base, input);
    saveCreatedBots(
      createdBots.map((bot) => (bot.id === updated.id ? updated : bot)),
    );
    setSelectedBotId(updated.id);
    apiUpdateChatbot(updated).catch((err) =>
      console.warn("Failed to update bot in API:", err),
    );
    return updated;
  }

  function handleDelete(id: string) {
    saveCreatedBots(createdBots.filter((bot) => bot.id !== id));
    if (selectedBotId === id) setSelectedBotId(null);
  }

  function closeForm() {
    setShowForm(false);
    setEditingBot(null);
  }

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();
    const threshold = periodThreshold(period, nowMs);
    return leads.filter((lead) => {
      if (selectedBotId && lead.botId !== selectedBotId) return false;
      if (clientId !== "all" && lead.clientId !== clientId) return false;
      if (status !== "all" && lead.status !== status) return false;
      if (threshold !== null && Date.parse(lead.createdAt) < threshold) {
        return false;
      }
      if (query) {
        const haystack =
          `${lead.name} ${lead.email} ${lead.phone} ${lead.message} ${lead.sourceUrl}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [leads, selectedBotId, clientId, status, period, search, nowMs]);

  const hasActiveFilters =
    selectedBotId !== null ||
    clientId !== "all" ||
    status !== "all" ||
    period !== "all" ||
    search.trim() !== "";

  function clearFilters() {
    setSelectedBotId(null);
    setSearch("");
    setClientId("all");
    setStatus("all");
    setPeriod("all");
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            VisÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o geral
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Monitore seus chatbots e os leads recebidos por cada um.
          </p>
        </div>
        <div className="flex items-center gap-3 sm:justify-end">
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            {bots.length} {bots.length === 1 ? "chatbot" : "chatbots"} ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â·{" "}
            {clients.length} {clients.length === 1 ? "cliente" : "clientes"}
          </p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="btn-brand px-3 py-1.5"
          >
            <IconPlus className="size-4" />
            Novo chatbot
          </button>
        </div>
      </div>

      <MetricsRow metrics={metrics} />

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
              Cadastre um bot em poucos passos, copie o cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo de instalaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o e
              acompanhe os leads aqui no painel ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â com origem do Google, Meta e
              campanhas quando configurado.
            </p>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="btn-brand px-4 py-2"
            >
              <IconPlus className="size-4" />
              Criar primeiro chatbot
            </button>
          </div>
        </section>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="min-w-0 overflow-hidden rounded-xl border border-zinc-200/70 bg-white/80 backdrop-blur-xl dark:border-zinc-800/70 dark:bg-zinc-900/55 lg:col-span-2">
          <header className="flex items-center justify-between gap-2 border-b border-zinc-200/70 px-4 py-3 dark:border-zinc-800/70">
            <div className="flex items-baseline gap-2">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Leads
              </h2>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {filteredLeads.length === leads.length
                  ? `${leads.length} no total`
                  : `${filteredLeads.length} de ${leads.length}`}
              </span>
            </div>
            {selectedBot ? (
              <span className="flex min-w-0 items-center gap-1.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                <span
                  className={`size-1.5 shrink-0 rounded-full ${ACCENTS[selectedBot.accent].dot}`}
                />
                <span className="truncate">filtrando por {selectedBot.name}</span>
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
            period={period}
            onPeriod={setPeriod}
            bots={bots}
            clients={clients}
            hasActiveFilters={hasActiveFilters}
            onClear={clearFilters}
          />

          {filteredLeads.length > 0 ? (
            <LeadsTable
              leads={filteredLeads}
              botsById={botsById}
              showBotColumn={selectedBotId === null}
              nowMs={nowMs}
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

        <div className="space-y-5">
          <ChatbotList
            bots={bots}
            activity={botActivity}
            selectedBotId={selectedBotId}
            editableBotIds={editableBotIds}
            onSelect={setSelectedBotId}
            onCreate={() => setShowForm(true)}
            onEdit={(bot) => {
              const normalized = normalizeStoredChatbot(bot);
              if (normalized) setEditingBot(normalized);
            }}
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
                description="Escolha um bot na lista para filtrar seus leads e copiar o cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³digo de incorporaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o."
              />
            </div>
          )}
        </div>
      </div>

      {showForm || editingBot ? (
        <ChatbotForm
          key={editingBot?.id ?? "new"}
          onClose={closeForm}
          onCreate={handleCreate}
          initialBot={editingBot ?? undefined}
          onUpdate={editingBot ? handleUpdate : undefined}
        />
      ) : null}
    </main>
  );
}
