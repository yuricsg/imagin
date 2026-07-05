import type { ReactNode } from "react";
import type { Chatbot, Client, LeadStatus } from "@/lib/chatbots/types";
import { LEAD_STATUS, LEAD_STATUS_ORDER } from "@/lib/labels";
import { IconChevronDown, IconSearch, IconX } from "./icons";

export type PeriodFilter = "all" | "today" | "7d" | "30d";

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  all: "Todo o período",
  today: "Hoje",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
};

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full appearance-none rounded-lg border border-zinc-200 bg-white/70 py-1.5 pl-3 pr-8 text-sm text-zinc-700 transition-colors hover:border-zinc-300 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:border-zinc-700"
      >
        {children}
      </select>
      <IconChevronDown className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
    </div>
  );
}

export function LeadsToolbar({
  search,
  onSearch,
  botId,
  onBot,
  clientId,
  onClient,
  status,
  onStatus,
  period,
  onPeriod,
  bots,
  clients,
  hasActiveFilters,
  onClear,
}: {
  search: string;
  onSearch: (value: string) => void;
  botId: string;
  onBot: (value: string) => void;
  clientId: string;
  onClient: (value: string) => void;
  status: LeadStatus | "all";
  onStatus: (value: LeadStatus | "all") => void;
  period: PeriodFilter;
  onPeriod: (value: PeriodFilter) => void;
  bots: Chatbot[];
  clients: Client[];
  hasActiveFilters: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-2.5 border-b border-zinc-200/70 px-4 py-3 dark:border-zinc-800/70 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative min-w-0 flex-1 sm:min-w-56">
        <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Buscar por nome, e-mail ou mensagem"
          className="w-full rounded-lg border border-zinc-200 bg-white/70 py-1.5 pl-8 pr-3 text-sm text-zinc-700 placeholder:text-zinc-400 transition-colors hover:border-zinc-300 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:border-zinc-700"
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-nowrap">
        <Select label="Filtrar por chatbot" value={botId} onChange={onBot}>
          <option value="all">Todos os chatbots</option>
          {bots.map((bot) => (
            <option key={bot.id} value={bot.id}>
              {bot.name}
            </option>
          ))}
        </Select>

        <Select label="Filtrar por cliente" value={clientId} onChange={onClient}>
          <option value="all">Todos os clientes</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </Select>

        <Select
          label="Filtrar por status"
          value={status}
          onChange={(value) => onStatus(value as LeadStatus | "all")}
        >
          <option value="all">Todos os status</option>
          {LEAD_STATUS_ORDER.map((key) => (
            <option key={key} value={key}>
              {LEAD_STATUS[key].label}
            </option>
          ))}
        </Select>

        <Select
          label="Filtrar por período"
          value={period}
          onChange={(value) => onPeriod(value as PeriodFilter)}
        >
          {(Object.keys(PERIOD_LABELS) as PeriodFilter[]).map((key) => (
            <option key={key} value={key}>
              {PERIOD_LABELS[key]}
            </option>
          ))}
        </Select>
      </div>

      {hasActiveFilters ? (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <IconX className="size-3.5" />
          Limpar
        </button>
      ) : null}
    </div>
  );
}
