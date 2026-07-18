import type { ReactNode } from "react";
import type { Chatbot, Client, LeadStatus } from "@/lib/chatbots/types";
import type { DateRange } from "@/lib/lead-report";
import { chatbotDisplayName } from "@/lib/chatbots/display";
import { LEAD_STATUS, LEAD_STATUS_ORDER } from "@/lib/labels";
import { IconChevronDown, IconDownload, IconSearch, IconX } from "./icons";

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
    <div className="relative min-w-0">
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full appearance-none rounded-lg border border-zinc-200 bg-white py-2 pl-3 pr-8 text-sm text-zinc-700 transition-colors hover:border-zinc-300 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/25 max-sm:min-h-11 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:border-zinc-700"
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
  dateRange,
  onDateRange,
  bots,
  clients,
  onlyNew,
  onOnlyNew,
  newCount,
  hasActiveFilters,
  onClear,
  onExport,
  exportDisabled,
}: {
  search: string;
  onSearch: (value: string) => void;
  botId: string;
  onBot: (value: string) => void;
  clientId: string;
  onClient: (value: string) => void;
  status: LeadStatus | "all";
  onStatus: (value: LeadStatus | "all") => void;
  dateRange: DateRange;
  onDateRange: (value: DateRange) => void;
  bots: Chatbot[];
  clients: Client[];
  onlyNew: boolean;
  onOnlyNew: (value: boolean) => void;
  newCount: number;
  hasActiveFilters: boolean;
  onClear: () => void;
  onExport: () => void;
  exportDisabled: boolean;
}) {
  return (
    <div className="space-y-3 border-b border-zinc-200/70 px-4 py-3 dark:border-zinc-800/70">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-0 flex-1 sm:min-w-56">
          <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <input
            id="leads-search"
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Buscar por nome, contato ou assunto  ( / )"
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm text-zinc-800 placeholder:text-zinc-500 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/25 max-sm:min-h-11 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-100 dark:placeholder:text-zinc-400"
          />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Select label="Filtrar por chatbot" value={botId} onChange={onBot}>
            <option value="all">Todos os chatbots</option>
            {bots.map((bot) => (
              <option key={bot.id} value={bot.id}>{chatbotDisplayName(bot)}</option>
            ))}
          </Select>
          <Select label="Filtrar por cliente" value={clientId} onChange={onClient}>
            <option value="all">Todos os clientes</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </Select>
          <Select
            label="Filtrar por status"
            value={status}
            onChange={(value) => onStatus(value as LeadStatus | "all")}
          >
            <option value="all">Todos os status</option>
            {LEAD_STATUS_ORDER.map((value) => (
              <option key={value} value={value}>{LEAD_STATUS[value].label}</option>
            ))}
          </Select>
        </div>
        <button
          type="button"
          aria-pressed={onlyNew}
          onClick={() => onOnlyNew(!onlyNew)}
          title="Filtrar apenas leads com status novo"
          className={`inline-flex items-center gap-1.5 self-start rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30 max-sm:min-h-11 sm:self-center ${
            onlyNew
              ? "border-teal-400 bg-teal-50 text-teal-800 dark:border-teal-600 dark:bg-teal-950/50 dark:text-teal-200"
              : "border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:text-zinc-800 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
          }`}
        >
          <span
            className={`size-1.5 rounded-full ${onlyNew ? "bg-teal-500" : "bg-zinc-300 dark:bg-zinc-600"}`}
          />
          Somente novos
          <span
            className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
              onlyNew
                ? "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200"
                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {newCount}
          </span>
        </button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <label className="space-y-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
            <span>Data inicial</span>
            <input
              type="date"
              value={dateRange.start}
              max={dateRange.end || undefined}
              onChange={(event) =>
                onDateRange({ ...dateRange, start: event.target.value })
              }
              className="block w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/25 max-sm:min-h-11 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-200"
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
            <span>Data final</span>
            <input
              type="date"
              value={dateRange.end}
              min={dateRange.start || undefined}
              onChange={(event) =>
                onDateRange({ ...dateRange, end: event.target.value })
              }
              className="block w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/25 max-sm:min-h-11 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-200"
            />
          </label>
        </div>
        <div className="flex items-center justify-end gap-2">
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-teal-500/25 max-sm:min-h-11 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
            >
              <IconX className="size-4" />
              Limpar
            </button>
          ) : null}
          <button
            type="button"
            disabled={exportDisabled}
            onClick={onExport}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-teal-500/25 disabled:cursor-not-allowed disabled:opacity-45 max-sm:min-h-11 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <IconDownload className="size-4" />
            Exportar CSV
          </button>
        </div>
      </div>
    </div>
  );
}
