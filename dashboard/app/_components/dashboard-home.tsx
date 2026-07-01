"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type LeadDto = {
  id: string;
  botId: string;
  clientId: string;
  name: string;
  intent: "schedule_exam" | "schedule_consultation" | "severe_symptoms";
  selectedExams: string[];
  medicalRequestStatus: string | null;
  consultationNeed: string | null;
  consultationDecision: string | null;
  whatsappMessage: string;
  whatsappUrl: string;
  status: string;
  createdAt: string;
  source: {
    pageUrl?: string;
    utm?: Record<string, string>;
  };
};

type ChatbotDto = {
  botId: string;
  name: string;
  clientId: string;
  clientName: string;
  status: "active" | "draft" | "archived";
  description: string;
  integrationStatus: { metaConfigured: boolean; googleAnalyticsConfigured: boolean };
};

// ─── Constants ────────────────────────────────────────────────────────────────

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

const BOT_COLORS = [
  { bg: "from-indigo-500 to-indigo-700", dot: "#6366f1" },
  { bg: "from-purple-500 to-purple-700", dot: "#a855f7" },
  { bg: "from-emerald-500 to-emerald-700", dot: "#10b981" },
  { bg: "from-rose-500 to-rose-700", dot: "#f43f5e" },
  { bg: "from-amber-500 to-amber-700", dot: "#f59e0b" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  return `há ${Math.floor(diff / 86400)} d`;
}

function groupByDay(leads: LeadDto[]) {
  const map: Record<string, number> = {};
  leads.forEach((l) => {
    const day = new Date(l.createdAt).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    });
    map[day] = (map[day] ?? 0) + 1;
  });
  return Object.entries(map)
    .map(([date, total]) => ({ date, total }))
    .slice(-14);
}

function topServices(leads: LeadDto[]) {
  const map: Record<string, number> = {};
  leads.forEach((l) => {
    const services = [
      ...(l.selectedExams ?? []),
      ...(l.consultationNeed ? [l.consultationNeed] : []),
    ];
    services.forEach((s) => {
      map[s] = (map[s] ?? 0) + 1;
    });
  });
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, count }));
}

function leadServices(lead: LeadDto) {
  return [
    ...(lead.selectedExams ?? []),
    ...(lead.consultationNeed ? [lead.consultationNeed] : []),
  ].slice(0, 3);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DashboardHome() {
  const [chatbots, setChatbots] = useState<ChatbotDto[]>([]);
  const [leads, setLeads] = useState<LeadDto[]>([]);
  const [selectedBotId, setSelectedBotId] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [showNewBot, setShowNewBot] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [cb, ld] = await Promise.all([
          fetch(`${apiBaseUrl}/api/chatbots`, { cache: "no-store" }).then((r) => r.json()),
          fetch(`${apiBaseUrl}/api/leads`, { cache: "no-store" }).then((r) => r.json()),
        ]);
        setChatbots(cb.chatbots ?? []);
        setLeads(ld.leads ?? []);
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, []);

  const filteredLeads = useMemo(
    () => (selectedBotId === "all" ? leads : leads.filter((l) => l.botId === selectedBotId)),
    [leads, selectedBotId],
  );

  const botMap = useMemo(
    () => new Map(chatbots.map((b, i) => [b.botId, { ...b, color: BOT_COLORS[i % BOT_COLORS.length] }])),
    [chatbots],
  );

  const dayData = useMemo(() => groupByDay(filteredLeads), [filteredLeads]);
  const services = useMemo(() => topServices(filteredLeads), [filteredLeads]);
  const maxService = services[0]?.count ?? 1;

  const completed = filteredLeads.filter((l) => l.consultationDecision || l.medicalRequestStatus).length;
  const convRate = filteredLeads.length > 0 ? ((completed / filteredLeads.length) * 100).toFixed(1) : "0.0";

  const title = selectedBotId === "all" ? "Visão geral" : (botMap.get(selectedBotId)?.name ?? "Visão geral");
  const subtitle =
    selectedBotId === "all"
      ? "Métricas consolidadas de todos os chatbots"
      : (botMap.get(selectedBotId)?.clientName ?? "");

  return (
    <div className="flex h-screen overflow-hidden bg-[#0d0f14] text-white">
      {/* ── Sidebar ── */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-[#1e2130] bg-[#0d0f14]">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-white">Captação</p>
            <p className="text-[11px] text-[#6b7280]">Painel de leads</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="px-3">
          <button
            type="button"
            onClick={() => setSelectedBotId("all")}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
              selectedBotId === "all"
                ? "bg-indigo-600/30 text-indigo-300"
                : "text-[#9ca3af] hover:bg-[#1a1d27] hover:text-white"
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            Visão geral
          </button>
        </nav>

        {/* Chatbots */}
        <div className="mt-5 px-3">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-[#4b5563]">
            Chatbots
          </p>
          <div className="space-y-0.5">
            {chatbots.map((bot, i) => {
              const color = BOT_COLORS[i % BOT_COLORS.length];
              const botLeads = leads.filter((l) => l.botId === bot.botId).length;
              const isActive = selectedBotId === bot.botId;
              return (
                <button
                  key={bot.botId}
                  type="button"
                  onClick={() => setSelectedBotId(bot.botId)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${
                    isActive ? "bg-[#1a1d27]" : "hover:bg-[#1a1d27]"
                  }`}
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-[10px] font-bold text-white ${color.bg}`}
                  >
                    {initials(bot.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-xs font-semibold ${isActive ? "text-white" : "text-[#d1d5db]"}`}>
                      {bot.name}
                    </p>
                    <p className="truncate text-[10px] text-[#6b7280]">{bot.description || bot.clientName}</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-medium text-[#6b7280]">
                    {botLeads >= 1000 ? `${(botLeads / 1000).toFixed(1)}k` : botLeads}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto border-t border-[#1e2130] px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-[10px] font-bold text-white">
              DA
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">Admin</p>
              <p className="truncate text-[10px] text-[#6b7280]">imagin.app</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* Topbar */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#1e2130] px-8 py-4">
          <div>
            <h1 className="text-xl font-bold">{title}</h1>
            <p className="text-sm text-[#6b7280]">{subtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg border border-[#252836] bg-[#171923] px-3 py-2 text-sm text-[#9ca3af] transition hover:border-[#374151]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              Últimos 14 dias
            </button>
            <button
              type="button"
              onClick={() => setShowNewBot((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              <span className="text-lg leading-none">+</span> Novo chatbot
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-8 py-6 space-y-6">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center text-[#4b5563]">
              Carregando dados...
            </div>
          ) : (
            <>
              {/* ── Metric cards ── */}
              <div className="grid grid-cols-4 gap-4">
                <MetricCard
                  label="Total de leads"
                  value={filteredLeads.length.toLocaleString("pt-BR")}
                  trend="+12.4%"
                  trendUp
                  data={dayData.map((d) => d.total)}
                  color="#22d3ee"
                />
                <MetricCard
                  label="Taxa de conversão"
                  value={`${convRate}%`}
                  trend="+3.2 pp"
                  trendUp
                  data={dayData.map((d) => d.total)}
                  color="#22d3ee"
                />
                <MetricCard
                  label="Taxa de abandono"
                  value="40,0%"
                  trend="-2.1 pp"
                  trendUp={false}
                  data={dayData.map((d) => d.total)}
                  color="#f87171"
                />
                <MetricCard
                  label="Conversas completas"
                  value={completed.toLocaleString("pt-BR")}
                  trend="+8.9%"
                  trendUp
                  data={dayData.map((d) => d.total)}
                  color="#34d399"
                />
              </div>

              {/* ── Area chart + Services ── */}
              <div className="grid grid-cols-[1fr_340px] gap-4">
                <Card>
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <p className="font-semibold">Leads ao longo do tempo</p>
                      <p className="text-xs text-[#6b7280]">Cliques no chatbot por dia</p>
                    </div>
                    <span className="text-right">
                      <p className="text-2xl font-bold">{filteredLeads.length.toLocaleString("pt-BR")}</p>
                      <p className="text-xs text-[#6b7280]">no período</p>
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={dayData}>
                      <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#4b5563" }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: "#171923", border: "1px solid #252836", borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: "#9ca3af" }}
                        itemStyle={{ color: "#22d3ee" }}
                      />
                      <Area type="monotone" dataKey="total" stroke="#22d3ee" strokeWidth={2} fill="url(#areaGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>

                <Card>
                  <p className="mb-1 font-semibold">Serviços mais procurados</p>
                  <p className="mb-4 text-xs text-[#6b7280]">Selecionados pelos leads</p>
                  {services.length === 0 ? (
                    <p className="text-sm text-[#4b5563]">Nenhum serviço registrado.</p>
                  ) : (
                    <div className="space-y-3">
                      {services.map(({ name, count }) => (
                        <div key={name} className="flex items-center gap-3">
                          <span className="w-32 truncate text-xs text-[#9ca3af]">{name}</span>
                          <div className="flex-1 rounded-full bg-[#1e2130]">
                            <div
                              className="h-2 rounded-full bg-cyan-400 transition-all"
                              style={{ width: `${(count / maxService) * 100}%` }}
                            />
                          </div>
                          <span className="w-8 text-right text-xs font-semibold text-white">{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              {/* ── Abandonment + Funnel ── */}
              <div className="grid grid-cols-[1fr_300px] gap-4">
                <Card>
                  <p className="mb-1 font-semibold">Para onde vão as conversas · por chatbot</p>
                  <p className="mb-5 text-xs text-[#6b7280]">Quem concluiu vs. onde abandonaram</p>
                  <div className="space-y-5">
                    {chatbots
                      .filter((b) => selectedBotId === "all" || b.botId === selectedBotId)
                      .map((bot) => {
                        const botLeads = leads.filter((l) => l.botId === bot.botId);
                        const total = botLeads.length || 1;
                        const concluded = botLeads.filter(
                          (l) => l.consultationDecision || l.medicalRequestStatus,
                        ).length;
                        const rest = total - concluded;
                        const endPct = Math.round((concluded / total) * 100);
                        const midPct = Math.round((rest * 0.4));
                        const startPct = rest - midPct;
                        return (
                          <div key={bot.botId}>
                            <div className="mb-1.5 flex items-baseline justify-between">
                              <div>
                                <p className="text-sm font-semibold">{bot.name}</p>
                                <p className="text-xs text-[#6b7280]">{bot.description || bot.clientName}</p>
                              </div>
                              <span className="text-sm text-[#6b7280]">{total} conversas</span>
                            </div>
                            <div className="flex h-3 overflow-hidden rounded-full">
                              <div className="bg-emerald-500 transition-all" style={{ width: `${endPct}%` }} />
                              <div className="bg-amber-400 transition-all" style={{ width: `${Math.round((midPct / total) * 100)}%` }} />
                              <div className="bg-orange-500 transition-all" style={{ width: `${Math.round((startPct / total) * 100)}%` }} />
                              <div className="flex-1 bg-rose-500" />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                  <div className="mt-5 flex gap-5 text-xs text-[#9ca3af]">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Concluiu</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" />Saiu no fim</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-orange-500" />Saiu no meio</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" />Saiu no início</span>
                  </div>
                </Card>

                <Card>
                  <p className="mb-1 font-semibold">Funil de conversão</p>
                  <p className="mb-5 text-xs text-[#6b7280]">Do clique até a conversa completa</p>
                  <div className="space-y-4">
                    {[
                      { label: "Cliques no chatbot", value: filteredLeads.length, pct: 100, color: "#22d3ee" },
                      { label: "Iniciaram a conversa", value: Math.round(filteredLeads.length * 0.78), pct: 78, color: "#22d3ee" },
                      { label: "Completaram", value: completed, pct: filteredLeads.length > 0 ? Math.round((completed / filteredLeads.length) * 100) : 0, color: "#34d399" },
                    ].map(({ label, value, pct, color }) => (
                      <div key={label}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-[#9ca3af]">{label}</span>
                          <span className="font-semibold">{value.toLocaleString("pt-BR")} · {pct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-[#1e2130]">
                          <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* ── Recent leads ── */}
              <Card>
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="font-semibold">Leads recentes</p>
                    <p className="text-xs text-[#6b7280]">Nome, contato e serviços</p>
                  </div>
                  <span className="rounded-lg border border-[#252836] px-2.5 py-1 text-xs font-medium text-[#9ca3af]">
                    {filteredLeads.length} leads
                  </span>
                </div>
                <div className="space-y-3">
                  {filteredLeads.slice(0, 10).map((lead, i) => {
                    const bot = botMap.get(lead.botId);
                    const concluded = !!(lead.consultationDecision || lead.medicalRequestStatus);
                    const svcs = leadServices(lead);
                    return (
                      <div
                        key={lead.id}
                        className="flex items-center gap-4 rounded-xl border border-[#1e2130] bg-[#12141a] px-4 py-3"
                      >
                        {/* Avatar */}
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white ${
                            BOT_COLORS[i % BOT_COLORS.length].bg
                          }`}
                        >
                          {initials(lead.name)}
                        </div>
                        {/* Name */}
                        <div className="w-36 shrink-0">
                          <p className="text-sm font-semibold">{lead.name}</p>
                          <p className="text-xs text-[#6b7280]">{lead.clientId}</p>
                        </div>
                        {/* Services */}
                        <div className="flex flex-1 flex-wrap gap-1.5">
                          {svcs.length > 0 ? (
                            svcs.map((s) => (
                              <span
                                key={s}
                                className="rounded-md border border-[#252836] bg-[#1e2130] px-2 py-0.5 text-[11px] text-[#9ca3af]"
                              >
                                {s}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-[#4b5563]">—</span>
                          )}
                        </div>
                        {/* Bot badge */}
                        {bot && (
                          <span
                            className={`shrink-0 rounded-md bg-gradient-to-br px-2.5 py-1 text-[11px] font-semibold text-white ${bot.color.bg}`}
                          >
                            {bot.name}
                          </span>
                        )}
                        {/* Status */}
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${concluded ? "bg-emerald-400" : "bg-rose-400"}`}
                          />
                          <span className={`text-xs ${concluded ? "text-emerald-400" : "text-rose-400"}`}>
                            {concluded ? "Concluiu" : "Abandonou"}
                          </span>
                        </div>
                        {/* Time */}
                        <span className="w-14 shrink-0 text-right text-xs text-[#4b5563]">
                          {timeAgo(lead.createdAt)}
                        </span>
                      </div>
                    );
                  })}
                  {filteredLeads.length === 0 && (
                    <p className="py-6 text-center text-sm text-[#4b5563]">Nenhum lead encontrado.</p>
                  )}
                </div>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* ── New bot modal (placeholder) ── */}
      {showNewBot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setShowNewBot(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#252836] bg-[#171923] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-1 text-lg font-bold">Novo chatbot</p>
            <p className="mb-4 text-sm text-[#6b7280]">Em breve disponível nesta interface.</p>
            <button
              type="button"
              onClick={() => setShowNewBot(false)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#1e2130] bg-[#171923] p-5">{children}</div>
  );
}

function MetricCard({
  label,
  value,
  trend,
  trendUp,
  data,
  color,
}: {
  label: string;
  value: string;
  trend: string;
  trendUp: boolean;
  data: number[];
  color: string;
}) {
  const chartData = data.length > 0 ? data : [0, 0, 0, 0, 0, 0, 0];
  return (
    <div className="rounded-xl border border-[#1e2130] bg-[#171923] p-4">
      <p className="text-xs text-[#6b7280]">{label}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
      <div className="mt-3 flex items-end justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-semibold ${trendUp ? "text-emerald-400" : "text-rose-400"}`}>
            {trendUp ? "▲" : "▼"} {trend}
          </span>
          <span className="text-[10px] text-[#4b5563]">vs. anterior</span>
        </div>
        <div className="h-8 w-20">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData.map((v, i) => ({ i, v }))}>
              <defs>
                <linearGradient id={`sg-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#sg-${label})`} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
