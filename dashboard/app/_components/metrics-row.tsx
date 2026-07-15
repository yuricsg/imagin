import type { ReactNode } from "react";
import type { DashboardMetrics } from "@/lib/chatbots/types";
import { percent } from "@/lib/format";
import { IconInbox, IconTrendingUp, IconUsers } from "./icons";

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
      className={`rounded-2xl border bg-white/90 p-5 shadow-sm transition-shadow hover:shadow-md dark:bg-zinc-900/60 ${style.ring}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          {label}
        </span>
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${style.icon}`}
        >
          {icon}
        </span>
      </div>
      <p
        className={`mt-3 text-3xl font-semibold tracking-tight tabular-nums ${style.value}`}
      >
        {value}
      </p>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{sub}</p>
    </div>
  );
}

export function MetricsRow({ metrics }: { metrics: DashboardMetrics }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <MetricCard
        label="Acessos"
        value={String(metrics.totalAccesses)}
        sub="pessoas que abriram o chatbot"
        icon={<IconUsers className="size-4.5" />}
        accent="emerald"
      />
      <MetricCard
        label="Leads identificados"
        value={String(metrics.totalLeads)}
        sub="informaram o nome no fluxo"
        icon={<IconInbox className="size-4.5" />}
        accent="indigo"
      />
      <MetricCard
        label="Agendamentos solicitados"
        value={String(metrics.appointmentRequests)}
        sub="intenção explícita de agendar"
        icon={<IconTrendingUp className="size-4.5" />}
        accent="sky"
      />
      <MetricCard
        label="Taxa de conversão"
        value={percent(metrics.conversionRate)}
        sub={`${metrics.convertedLeads} confirmados externamente`}
        icon={<IconTrendingUp className="size-4.5" />}
        accent="violet"
      />
    </div>
  );
}
