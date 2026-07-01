"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
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
  flowKey: ConversationFlowKey;
  conversationFlow?: ConversationFlowOption;
  description: string;
  integrationStatus: { metaConfigured: boolean; googleAnalyticsConfigured: boolean };
};

type ConversationFlowKey =
  | "cardiology_exam_consultation"
  | "exam_scheduling"
  | "consultation_scheduling"
  | "urgent_triage";

type ConversationFlowOption = {
  key: ConversationFlowKey;
  label: string;
  description: string;
  intents: LeadDto["intent"][];
};

type ChatbotFormState = {
  botId: string;
  name: string;
  clientId: string;
  clientName: string;
  status: ChatbotDto["status"];
  flowKey: ConversationFlowKey;
  description: string;
  whatsappPhone: string;
  buttonTexts: string;
  examOptions: string;
  medicalRequestOptions: string;
  consultationNeeds: string;
  consultationDecisions: string;
  metaPixelId: string;
  metaAccessToken: string;
  metaTestEventCode: string;
  ga4MeasurementId: string;
  ga4ApiSecret: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

const FLOW_OPTIONS: ConversationFlowOption[] = [
  {
    key: "cardiology_exam_consultation",
    label: "Consulta + exames cardiologicos",
    description:
      "Mostra exames, consulta cardiologica e triagem de sintomas graves.",
    intents: ["schedule_exam", "schedule_consultation", "severe_symptoms"],
  },
  {
    key: "exam_scheduling",
    label: "Agendamento de exames",
    description: "Mostra apenas selecao de exames e solicitacao medica.",
    intents: ["schedule_exam"],
  },
  {
    key: "consultation_scheduling",
    label: "Agendamento de consulta",
    description:
      "Mostra necessidade da consulta, investimento, endereco e decisao de agenda.",
    intents: ["schedule_consultation"],
  },
  {
    key: "urgent_triage",
    label: "Triagem urgente",
    description: "Mostra apenas o caminho direto para atendimento humano.",
    intents: ["severe_symptoms"],
  },
];

const initialFormState: ChatbotFormState = {
  botId: "",
  name: "",
  clientId: "",
  clientName: "",
  status: "active",
  flowKey: "cardiology_exam_consultation",
  description: "",
  whatsappPhone: "",
  buttonTexts: "Iniciar atendimento",
  examOptions: "Exame",
  medicalRequestOptions: "Sim\nNão\nTenho dúvidas",
  consultationNeeds: "Avaliação\nAcompanhamento\nCheck-up\nSintomas\nOutro",
  consultationDecisions:
    "Quero agendar uma consulta\nTenho dúvidas\nNão tenho interesse no momento",
  metaPixelId: "",
  metaAccessToken: "",
  metaTestEventCode: "",
  ga4MeasurementId: "",
  ga4ApiSecret: "",
};

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
  const [form, setForm] = useState<ChatbotFormState>(initialFormState);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [isCreatingChatbot, setIsCreatingChatbot] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      try {
        const [cb, ld] = await Promise.all([
          fetch(`${apiBaseUrl}/api/chatbots`, { cache: "no-store" }).then((r) => r.json()),
          fetch(`${apiBaseUrl}/api/leads`, { cache: "no-store" }).then((r) => r.json()),
        ]);

        if (isMounted) {
          setChatbots(cb.chatbots ?? []);
          setLeads(ld.leads ?? []);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, []);

  async function createChatbot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError("");
    setCreateSuccess("");
    setIsCreatingChatbot(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/chatbots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botId: form.botId.trim(),
          name: form.name.trim(),
          clientId: form.clientId.trim(),
          clientName: form.clientName.trim(),
          status: form.status,
          flowKey: form.flowKey,
          description: form.description.trim(),
          whatsappPhone: form.whatsappPhone.trim(),
          buttonTexts: splitLines(form.buttonTexts),
          examOptions: splitLines(form.examOptions),
          medicalRequestOptions: splitLines(form.medicalRequestOptions),
          consultationNeeds: splitLines(form.consultationNeeds),
          consultationDecisions: splitLines(form.consultationDecisions),
          tracking: {
            meta: {
              pixelId: form.metaPixelId.trim(),
              accessToken: form.metaAccessToken.trim(),
              testEventCode: form.metaTestEventCode.trim(),
            },
            googleAnalytics: {
              measurementId: form.ga4MeasurementId.trim(),
              apiSecret: form.ga4ApiSecret.trim(),
            },
          },
        }),
      });
      const body = (await response.json()) as {
        chatbot?: ChatbotDto;
        error?: string;
        issues?: string[];
      };

      if (!response.ok || !body.chatbot) {
        throw new Error(
          body.issues?.join(", ") ??
            body.error ??
            `API de chatbots respondeu ${response.status}`,
        );
      }

      setChatbots((current) => [...current, body.chatbot!]);
      setSelectedBotId(body.chatbot.botId);
      setCreateSuccess("Chatbot criado e pronto para receber leads.");
      setForm(initialFormState);
      setShowNewBot(false);
    } catch (caughtError) {
      setCreateError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível criar o chatbot.",
      );
    } finally {
      setIsCreatingChatbot(false);
    }
  }

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
    <div className="flex min-h-screen flex-col bg-[#0d0f14] text-white lg:flex-row">
      {/* ── Sidebar ── */}
      <aside className="flex w-full shrink-0 flex-col border-b border-[#1e2130] bg-[#0d0f14] lg:h-screen lg:w-60 lg:border-b-0 lg:border-r">
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
        <div className="mt-4 px-3 pb-4 lg:mt-5 lg:pb-0">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-[#4b5563]">
            Chatbots
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-0.5 lg:overflow-visible lg:pb-0">
            {chatbots.map((bot, i) => {
              const color = BOT_COLORS[i % BOT_COLORS.length];
              const botLeads = leads.filter((l) => l.botId === bot.botId).length;
              const isActive = selectedBotId === bot.botId;
              return (
                <button
                  key={bot.botId}
                  type="button"
                  onClick={() => setSelectedBotId(bot.botId)}
                  className={`flex min-w-56 items-center gap-3 rounded-lg px-3 py-2 text-left transition lg:min-w-0 lg:w-full ${
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
                    <p className="truncate text-[10px] text-[#818cf8]">
                      {bot.conversationFlow?.label ?? flowLabel(bot.flowKey)}
                    </p>
                    <div className="mt-1 flex gap-1">
                      <IntegrationPill active={bot.integrationStatus.metaConfigured} label="Meta" />
                      <IntegrationPill active={bot.integrationStatus.googleAnalyticsConfigured} label="GA4" />
                    </div>
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
        <div className="mt-auto hidden border-t border-[#1e2130] px-4 py-4 lg:block">
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
      <div className="flex min-w-0 flex-1 flex-col lg:h-screen lg:overflow-y-auto">
        {/* Topbar */}
        <div className="flex shrink-0 flex-col gap-3 border-b border-[#1e2130] px-4 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div>
            <h1 className="text-xl font-bold">{title}</h1>
            <p className="text-sm text-[#6b7280]">{subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
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
        <div className="flex-1 space-y-6 px-4 py-5 lg:px-8 lg:py-6">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center text-[#4b5563]">
              Carregando dados...
            </div>
          ) : (
            <>
              {/* ── Metric cards ── */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
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
                          <span className="w-28 truncate text-xs text-[#9ca3af] sm:w-32">{name}</span>
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
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
                <Card>
                  <p className="mb-1 font-semibold">Para onde vão as conversas · por chatbot</p>
                  <p className="mb-5 text-xs text-[#6b7280]">Quem concluiu vs. onde abandonaram</p>
                  <div className="space-y-5">
                    {chatbots
                      .filter((b) => selectedBotId === "all" || b.botId === selectedBotId)
                      .map((bot) => {
                        const botLeads = leads.filter((l) => l.botId === bot.botId);
                        const totalLeads = botLeads.length;
                        const totalForPercent = Math.max(totalLeads, 1);
                        const concluded = botLeads.filter(
                          (l) => l.consultationDecision || l.medicalRequestStatus,
                        ).length;
                        const rest = totalLeads - concluded;
                        const endPct = Math.round((concluded / totalForPercent) * 100);
                        const midPct = Math.round((rest * 0.4));
                        const startPct = rest - midPct;
                        return (
                          <div key={bot.botId}>
                            <div className="mb-1.5 flex items-baseline justify-between">
                              <div>
                                <p className="text-sm font-semibold">{bot.name}</p>
                                <p className="text-xs text-[#6b7280]">{bot.description || bot.clientName}</p>
                              </div>
                              <span className="text-sm text-[#6b7280]">{totalLeads} conversas</span>
                            </div>
                            {totalLeads === 0 ? (
                              <div className="h-3 rounded-full bg-[#1e2130]" />
                            ) : (
                              <div className="flex h-3 overflow-hidden rounded-full">
                                <div className="bg-emerald-500 transition-all" style={{ width: `${endPct}%` }} />
                                <div className="bg-amber-400 transition-all" style={{ width: `${Math.round((midPct / totalForPercent) * 100)}%` }} />
                                <div className="bg-orange-500 transition-all" style={{ width: `${Math.round((startPct / totalForPercent) * 100)}%` }} />
                                <div className="flex-1 bg-rose-500" />
                              </div>
                            )}
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
                        className="flex flex-col gap-3 rounded-xl border border-[#1e2130] bg-[#12141a] px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
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
                        <div className="w-full shrink-0 sm:w-36">
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
                        <span className="w-full shrink-0 text-left text-xs text-[#4b5563] sm:w-14 sm:text-right">
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

      {/* ── New bot modal ── */}
      {showNewBot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={() => setShowNewBot(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-[#252836] bg-[#171923] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-[#252836] px-6 py-5">
              <div>
                <p className="text-lg font-bold">Novo chatbot</p>
                <p className="text-sm text-[#6b7280]">
                  Configure o bot, escolha o fluxo e salve as integrações do cliente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewBot(false)}
                className="rounded-lg border border-[#252836] px-3 py-1.5 text-sm text-[#9ca3af] hover:border-[#374151] hover:text-white"
              >
                Fechar
              </button>
            </div>

            <form className="max-h-[calc(92vh-88px)] overflow-y-auto px-6 py-5" onSubmit={createChatbot}>
              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  label="Nome do chatbot"
                  hint="Nome visível no dashboard e no topo do atendimento."
                  value={form.name}
                  required
                  onChange={(value) =>
                    setForm((current) => {
                      const currentSlug = slugify(current.name);

                      return {
                        ...current,
                        name: value,
                        botId:
                          !current.botId || current.botId === currentSlug
                            ? slugify(value)
                            : current.botId,
                      };
                    })
                  }
                />
                <TextField
                  label="ID do chatbot"
                  hint="Slug usado no embed e na API. Use letras minusculas, numeros e hifen."
                  value={form.botId}
                  required
                  onChange={(value) =>
                    setForm((current) => ({ ...current, botId: slugify(value) }))
                  }
                />
                <TextField
                  label="ID do cliente"
                  hint="Identificador interno para filtrar leads de um cliente/site."
                  value={form.clientId}
                  required
                  onChange={(value) =>
                    setForm((current) => ({ ...current, clientId: slugify(value) }))
                  }
                />
                <TextField
                  label="Nome do cliente"
                  hint="Nome comercial do cliente que aparecera no dashboard."
                  value={form.clientName}
                  required
                  onChange={(value) =>
                    setForm((current) => ({ ...current, clientName: value }))
                  }
                />
                <label className="block text-sm">
                  <span className="mb-1 block font-semibold text-[#d1d5db]">Fluxo de conversa</span>
                  <select
                    value={form.flowKey}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        flowKey: event.target.value as ConversationFlowKey,
                      }))
                    }
                    className="h-10 w-full rounded-lg border border-[#303445] bg-[#0f1117] px-3 text-sm text-white outline-none transition focus:border-indigo-500"
                  >
                    {FLOW_OPTIONS.map((flow) => (
                      <option key={flow.key} value={flow.key}>
                        {flow.label}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs leading-5 text-[#6b7280]">
                    {FLOW_OPTIONS.find((flow) => flow.key === form.flowKey)?.description}
                  </span>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-semibold text-[#d1d5db]">Status</span>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        status: event.target.value as ChatbotDto["status"],
                      }))
                    }
                    className="h-10 w-full rounded-lg border border-[#303445] bg-[#0f1117] px-3 text-sm text-white outline-none transition focus:border-indigo-500"
                  >
                    <option value="active">Ativo</option>
                    <option value="draft">Rascunho</option>
                    <option value="archived">Arquivado</option>
                  </select>
                  <span className="mt-1 block text-xs leading-5 text-[#6b7280]">
                    Use rascunho para preparar um bot antes de entregar o snippet ao cliente.
                  </span>
                </label>
                <TextField
                  label="WhatsApp de destino"
                  hint="Numero da secretaria em formato internacional, sem +. Ex.: 5587999999999."
                  value={form.whatsappPhone}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, whatsappPhone: value }))
                  }
                />
                <TextareaField
                  label="Descricao interna"
                  hint="Resumo do objetivo do bot. Ajuda a equipe a reconhecer o projeto."
                  value={form.description}
                  rows={3}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, description: value }))
                  }
                />
              </div>

              <SectionTitle
                title="Textos e opcoes"
                subtitle="Uma opcao por linha. O fluxo escolhido decide quais listas serao usadas."
              />
              <div className="grid gap-4 md:grid-cols-2">
                <TextareaField
                  label="Textos do botao flutuante"
                  hint="Frases que alternam no botao instalado no site do cliente."
                  value={form.buttonTexts}
                  rows={4}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, buttonTexts: value }))
                  }
                />
                <TextareaField
                  label="Exames disponiveis"
                  hint="Usado nos fluxos de agendamento de exames."
                  value={form.examOptions}
                  rows={4}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, examOptions: value }))
                  }
                />
                <TextareaField
                  label="Status da solicitacao medica"
                  hint="Respostas mostradas depois que o lead seleciona exames."
                  value={form.medicalRequestOptions}
                  rows={3}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      medicalRequestOptions: value,
                    }))
                  }
                />
                <TextareaField
                  label="Necessidades da consulta"
                  hint="Usado nos fluxos de consulta para entender a demanda principal."
                  value={form.consultationNeeds}
                  rows={4}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, consultationNeeds: value }))
                  }
                />
                <TextareaField
                  label="Decisoes de agendamento"
                  hint="Opcoes finais depois de explicar consulta, valor e endereco."
                  value={form.consultationDecisions}
                  rows={3}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      consultationDecisions: value,
                    }))
                  }
                />
              </div>

              <SectionTitle
                title="Integracoes de origem e conversao"
                subtitle="Essas chaves ficam no backend. Elas nao aparecem no embed nem na configuracao publica do bot."
              />
              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  label="Meta Pixel ID"
                  hint="ID numerico do Pixel no Meta Events Manager. Usado para enviar Lead via Conversions API."
                  value={form.metaPixelId}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, metaPixelId: value }))
                  }
                />
                <TextField
                  label="Meta Access Token"
                  hint="Token da Conversions API do Pixel. Cole aqui somente o token server-side do cliente."
                  value={form.metaAccessToken}
                  type="password"
                  autoComplete="off"
                  onChange={(value) =>
                    setForm((current) => ({ ...current, metaAccessToken: value }))
                  }
                />
                <TextField
                  label="Meta Test Event Code"
                  hint="Opcional. Codigo da aba Test Events para validar eventos antes de producao."
                  value={form.metaTestEventCode}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, metaTestEventCode: value }))
                  }
                />
                <TextField
                  label="GA4 Measurement ID"
                  hint="ID do stream web no GA4, geralmente no formato G-XXXXXXXXXX."
                  value={form.ga4MeasurementId}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, ga4MeasurementId: value }))
                  }
                />
                <TextField
                  label="GA4 API Secret"
                  hint="Secret do Measurement Protocol em Admin > Data Streams > Measurement Protocol API secrets."
                  value={form.ga4ApiSecret}
                  type="password"
                  autoComplete="off"
                  onChange={(value) =>
                    setForm((current) => ({ ...current, ga4ApiSecret: value }))
                  }
                />
              </div>

              {createError ? (
                <p className="mt-5 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                  {createError}
                </p>
              ) : null}
              {createSuccess ? (
                <p className="mt-5 rounded-lg border border-emerald-900/60 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200">
                  {createSuccess}
                </p>
              ) : null}

              <div className="mt-6 flex justify-end gap-3 border-t border-[#252836] pt-5">
                <button
                  type="button"
                  onClick={() => setShowNewBot(false)}
                  className="rounded-lg border border-[#303445] px-4 py-2 text-sm font-semibold text-[#9ca3af] transition hover:border-[#4b5563] hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingChatbot}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCreatingChatbot ? "Criando..." : "Criar chatbot"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({
  subtitle,
  title,
}: {
  subtitle: string;
  title: string;
}) {
  return (
    <div className="mb-4 mt-6 border-t border-[#252836] pt-5">
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-1 text-sm text-[#6b7280]">{subtitle}</p>
    </div>
  );
}

function TextField({
  autoComplete,
  hint,
  label,
  onChange,
  required,
  type = "text",
  value,
}: {
  autoComplete?: string;
  hint: string;
  label: string;
  onChange(value: string): void;
  required?: boolean;
  type?: "password" | "text";
  value: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-semibold text-[#d1d5db]">{label}</span>
      <input
        autoComplete={autoComplete}
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-[#303445] bg-[#0f1117] px-3 text-sm text-white outline-none transition focus:border-indigo-500"
      />
      <span className="mt-1 block text-xs leading-5 text-[#6b7280]">{hint}</span>
    </label>
  );
}

function TextareaField({
  hint,
  label,
  onChange,
  rows,
  value,
}: {
  hint: string;
  label: string;
  onChange(value: string): void;
  rows: number;
  value: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-semibold text-[#d1d5db]">{label}</span>
      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-y rounded-lg border border-[#303445] bg-[#0f1117] px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-500"
      />
      <span className="mt-1 block text-xs leading-5 text-[#6b7280]">{hint}</span>
    </label>
  );
}

function IntegrationPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${
        active ? "bg-emerald-500/15 text-emerald-300" : "bg-[#252836] text-[#6b7280]"
      }`}
    >
      {label} {active ? "on" : "off"}
    </span>
  );
}

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

function splitLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function flowLabel(flowKey: ConversationFlowKey) {
  return FLOW_OPTIONS.find((flow) => flow.key === flowKey)?.label ?? flowKey;
}
