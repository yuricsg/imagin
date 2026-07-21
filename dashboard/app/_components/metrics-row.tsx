import type { ReactNode } from "react";
import type { DashboardMetrics } from "@/lib/chatbots/types";
import { percent } from "@/lib/format";
import { IconInbox, IconTrendingUp, IconUsers } from "./icons";
import { Skeleton } from "./ui";

/** Stagger step between sibling entrances (globals.css motion tokens). */
const STAGGER_MS = 35;

function MetricCard({
  label,
  value,
  sub,
  icon,
  index,
}: {
  label: string;
  value: string;
  sub: string;
  icon: ReactNode;
  index: number;
}) {
  return (
    <div
      className="motion-enter rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-5 dark:border-zinc-800/80 dark:bg-zinc-900/70"
      style={{ animationDelay: `${Math.min(index, 9) * STAGGER_MS}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {label}
        </span>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {icon}
        </span>
      </div>
      {/* key remounts on change so updates replay the soft entrance. */}
      <p
        key={value}
        className="motion-enter mt-3 text-2xl font-semibold tracking-tight tabular-nums text-zinc-900 sm:text-3xl dark:text-zinc-50"
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{sub}</p>
    </div>
  );
}

export function MetricsRow({ metrics }: { metrics: DashboardMetrics }) {
  const cards = [
    {
      label: "Acessos",
      value: String(metrics.totalAccesses),
      sub: "pessoas que abriram o chatbot",
      icon: <IconUsers className="size-4.5" />,
    },
    {
      label: "Leads identificados",
      value: String(metrics.totalLeads),
      sub: "informaram o nome no fluxo",
      icon: <IconInbox className="size-4.5" />,
    },
    {
      label: "Agendamentos solicitados",
      value: String(metrics.appointmentRequests),
      sub: "intenção explícita de agendar",
      icon: <IconTrendingUp className="size-4.5" />,
    },
    {
      label: "Taxa de conversão",
      value: percent(metrics.conversionRate),
      sub: `${metrics.convertedLeads} confirmados externamente`,
      icon: <IconTrendingUp className="size-4.5" />,
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card, index) => (
        <MetricCard key={card.label} index={index} {...card} />
      ))}
    </div>
  );
}

/** Skeleton mirroring MetricsRow; used by the route-level loading shell. */
export function MetricsRowSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-5 dark:border-zinc-800/80 dark:bg-zinc-900/70"
        >
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="size-9 rounded-xl" />
          </div>
          <Skeleton className="mt-3 h-8 w-16" />
          <Skeleton className="mt-2 h-3 w-28" />
        </div>
      ))}
    </div>
  );
}
