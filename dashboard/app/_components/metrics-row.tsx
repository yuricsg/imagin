import type { ReactNode } from "react";
import type { DashboardMetrics } from "@/lib/chatbots/types";
import { percent } from "@/lib/format";
import { IconBolt, IconInbox, IconTrendingUp, IconUsers } from "./icons";

function MetricCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  icon: ReactNode;
  accent: "emerald" | "indigo" | "sky" | "violet";
}) {
  const accents = {
    emerald: {
      ring: "border-emerald-200/80 dark:border-emerald-900/40",
      icon: "bg-emerald-600 text-white",
      value: "text-zinc-900 dark:text-zinc-50",
    },
    indigo: {
      ring: "border-indigo-200/80 dark:border-indigo-900/40",
      icon: "bg-indigo-600 text-white",
      value: "text-zinc-900 dark:text-zinc-50",
    },
    sky: {
      ring: "border-sky-200/80 dark:border-sky-900/40",
      icon: "bg-sky-600 text-white",
      value: "text-zinc-900 dark:text-zinc-50",
    },
    violet: {
      ring: "border-violet-200/80 dark:border-violet-900/40",
      icon: "bg-violet-600 text-white",
      value: "text-zinc-900 dark:text-zinc-50",
    },
  } as const;
  const style = accents[accent];

  return (
    <div
      className={`rounded-xl border bg-white/90 p-4 shadow-sm transition-shadow hover:shadow-md dark:bg-zinc-900/60 ${style.ring}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {label}
        </span>
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${style.icon}`}
        >
          {icon}
        </span>
      </div>
      <p
        className={`mt-2.5 text-2xl font-semibold tracking-tight tabular-nums ${style.value}`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{sub}</p>
    </div>
  );
}

export function MetricsRow({ metrics }: { metrics: DashboardMetrics }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricCard
        label="Chatbots ativos"
        value={String(metrics.activeBots)}
        sub={`de ${metrics.totalBots} no catálogo`}
        icon={<IconBolt className="size-4" />}
        accent="emerald"
      />
      <MetricCard
        label="Leads no total"
        value={String(metrics.totalLeads)}
        sub={`${metrics.leads7d} nos últimos 7 dias`}
        icon={<IconUsers className="size-4" />}
        accent="indigo"
      />
      <MetricCard
        label="Leads hoje"
        value={String(metrics.leadsToday)}
        sub={`${metrics.newLeads} aguardando contato`}
        icon={<IconInbox className="size-4" />}
        accent="sky"
      />
      <MetricCard
        label="Taxa de conversão"
        value={percent(metrics.conversionRate)}
        sub="sobre o total de leads"
        icon={<IconTrendingUp className="size-4" />}
        accent="violet"
      />
    </div>
  );
}
