"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import type { ChatAccess, Chatbot, Lead } from "@/lib/chatbots/types";
import { ACCENTS } from "@/lib/chatbots/accents";
import {
  getCreatedBots,
  getServerCreatedBots,
  subscribeCreatedBots,
} from "@/lib/chatbots/create";
import { computeMetrics } from "@/lib/metrics";
import { percentPrecise } from "@/lib/format";
import {
  computeChannelReports,
  isEmptyReport,
  periodStartMs,
  tilePoints,
  PERIOD_OPTIONS,
  type ChannelReport,
  type PeriodDays,
  type TileMetric,
} from "@/lib/bot-report";
import { MetricsRow } from "./metrics-row";
import { EmptyState } from "./ui";
import { IconArrowLeft, IconInboxStack } from "./icons";

const PERIOD_LABELS: Record<PeriodDays, string> = {
  7: "7 dias",
  30: "30 dias",
  90: "90 dias",
};

/**
 * Resolves the bot before rendering the report. Bots created through the
 * dashboard may live only in the browser's localStorage (their DB write never
 * persisted), so the server-rendered `serverBots` list can miss them — the same
 * reason the home list merges both sources. We fall back to localStorage so a
 * bot visible in the list never 404s on its own metrics page.
 */
export function BotReportClient({
  botId,
  serverBots,
  leads,
  accesses,
  nowMs,
}: {
  botId: string;
  serverBots: Chatbot[];
  leads: Lead[];
  accesses: ChatAccess[];
  nowMs: number;
}) {
  const createdBots = useSyncExternalStore(
    subscribeCreatedBots,
    getCreatedBots,
    getServerCreatedBots,
  );

  const bot =
    serverBots.find((entry) => entry.id === botId) ??
    createdBots.find((entry) => entry.id === botId) ??
    null;

  // First paint is server HTML (localStorage unread yet). Wait for the store to
  // hydrate before deciding a localStorage-only bot is truly missing.
  const hydrated = useSyncExternalStore(
    subscribeCreatedBots,
    () => true,
    () => false,
  );

  if (!bot) {
    if (!hydrated) {
      return (
        <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Carregando desempenho…
          </p>
        </main>
      );
    }
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Chatbot não encontrado
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Esse bot não está na sua lista. Volte ao painel e tente de novo.
        </p>
        <Link href="/" className="btn-brand mt-4 inline-flex px-4 py-2">
          Voltar ao painel
        </Link>
      </main>
    );
  }

  return (
    <BotReport
      bot={bot}
      leads={leads.filter((lead) => lead.botId === bot.id)}
      accesses={accesses.filter((access) => access.botId === bot.id)}
      nowMs={nowMs}
    />
  );
}

export function BotReport({
  bot,
  leads,
  accesses,
  nowMs,
}: {
  bot: Chatbot;
  leads: Lead[];
  accesses: ChatAccess[];
  nowMs: number;
}) {
  const [days, setDays] = useState<PeriodDays>(30);

  // The period scopes every number on the page, so the summary row and the
  // channel tiles can never disagree.
  const startMs = periodStartMs(nowMs, days);
  const periodLeads = useMemo(
    () => leads.filter((lead) => Date.parse(lead.createdAt) >= startMs),
    [leads, startMs],
  );
  const periodAccesses = useMemo(
    () => accesses.filter((access) => Date.parse(access.openedAt) >= startMs),
    [accesses, startMs],
  );
  const metrics = useMemo(
    () => computeMetrics(periodLeads, periodAccesses),
    [periodLeads, periodAccesses],
  );
  const reports = useMemo(
    () => computeChannelReports(leads, accesses, { nowMs, days }),
    [leads, accesses, nowMs, days],
  );

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <Link
          href="/"
          className="mb-3 inline-flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <IconArrowLeft className="size-3.5" />
          Voltar ao painel
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={`flex size-11 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold text-white ${ACCENTS[bot.accent].avatar}`}
              aria-hidden="true"
            >
              {bot.name.charAt(0)}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                {bot.name}
              </h1>
              <p className="mt-0.5 truncate text-sm text-zinc-500 dark:text-zinc-400">
                {[bot.specialty, bot.clientName].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>

          {/* One filter row, scoping everything below it. */}
          <div
            role="group"
            aria-label="Período do relatório"
            className="flex shrink-0 gap-1 rounded-xl border border-zinc-200/70 bg-white/70 p-1 dark:border-zinc-800/70 dark:bg-zinc-900/50"
          >
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setDays(option)}
                aria-pressed={days === option}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 ${
                  days === option
                    ? "bg-teal-600 text-white"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {PERIOD_LABELS[option]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <MetricsRow metrics={metrics} />

      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Desempenho por canal
          </h2>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            De onde vieram os acessos e quanto cada origem virou lead nos últimos{" "}
            {PERIOD_LABELS[days]}.
          </p>
        </div>

        {isEmptyReport(reports) ? (
          <div className="rounded-2xl border border-dashed border-zinc-300/90 bg-white/60 dark:border-zinc-700/80 dark:bg-zinc-900/40">
            <EmptyState
              icon={<IconInboxStack className="size-5" />}
              title="Nenhum acesso no período"
              description="Assim que alguém abrir este chatbot no site, o desempenho por canal aparece aqui."
            />
          </div>
        ) : (
          reports.map((report) => (
            <ChannelSection key={report.id} report={report} />
          ))
        )}
      </section>
    </main>
  );
}

function ChannelSection({ report }: { report: ChannelReport }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
        {report.label}
      </h3>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <ChannelTile
          label="Leads gerados"
          value={String(report.leads)}
          series={report.series}
          metric="leads"
        />
        <ChannelTile
          label="Taxa de conversão"
          value={percentPrecise(report.conversionRate)}
          hint="leads ÷ acessos"
          series={report.series}
          metric="conversion"
        />
        <ChannelTile
          label="Acessos únicos"
          value={String(report.accesses)}
          series={report.series}
          metric="accesses"
        />
        <ChannelTile
          label="Leads completos"
          value={percentPrecise(report.completionRate)}
          hint={`${report.completed} de ${report.leads} concluíram`}
          series={report.series}
          metric="completion"
        />
      </div>
    </div>
  );
}

function ChannelTile({
  label,
  value,
  hint,
  series,
  metric,
}: {
  label: string;
  value: string;
  hint?: string;
  series: ChannelReport["series"];
  metric: TileMetric;
}) {
  const points = useMemo(() => tilePoints(series, metric), [series, metric]);

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-4 shadow-sm dark:border-zinc-800/70 dark:bg-zinc-900/60">
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      {/* Proportional figures: a standalone value reads loose with tabular-nums. */}
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {value}
      </p>
      <p className="mt-0.5 h-4 truncate text-xs text-zinc-400 dark:text-zinc-500">
        {hint ?? ""}
      </p>
      {/* currentColor lets one hue follow the light/dark text token. */}
      <div className="mt-2 h-10 text-teal-600 dark:text-teal-400">
        <Sparkline values={points.map((point) => point.value)} />
      </div>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const width = 160;
  const height = 40;
  const max = Math.max(...values, 0);
  const range = max || 1;
  const coordinates = values.map((value, index) => ({
    x: values.length <= 1 ? width / 2 : (index / (values.length - 1)) * width,
    y: height - 3 - (value / range) * (height - 6),
  }));
  const line = coordinates.map(({ x, y }) => `${x},${y}`).join(" ");
  const area = coordinates.length
    ? `M ${coordinates[0].x} ${height} L ${coordinates
        .map(({ x, y }) => `${x} ${y}`)
        .join(" L ")} L ${coordinates.at(-1)?.x ?? width} ${height} Z`
    : "";

  return (
    <svg
      aria-hidden="true"
      className="h-full w-full overflow-visible"
      preserveAspectRatio="none"
      viewBox={`0 0 ${width} ${height}`}
    >
      <path d={area} fill="currentColor" opacity="0.1" />
      <polyline
        fill="none"
        points={line}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
