"use client";

import { useEffect, useMemo, useState } from "react";

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
  source: {
    pageUrl?: string;
    referrer?: string;
    parentOrigin?: string;
  };
  whatsappMessage: string;
  whatsappUrl: string;
  status: string;
  createdAt: string;
};

type ChatbotDto = {
  botId: string;
  name: string;
  clientId: string;
  clientName: string;
  status: "active" | "draft" | "archived";
  description: string;
  buttonTexts: string[];
};

type DashboardData = {
  chatbots: ChatbotDto[];
  leads: LeadDto[];
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const widgetBaseUrl =
  process.env.NEXT_PUBLIC_WIDGET_BASE_URL ?? "http://localhost:3000";

const intentLabels: Record<LeadDto["intent"], string> = {
  schedule_exam: "Agendar exame",
  schedule_consultation: "Consulta cardiológica",
  severe_symptoms: "Sintomas graves",
};

const statusLabels: Record<ChatbotDto["status"], string> = {
  active: "Ativo",
  draft: "Rascunho",
  archived: "Arquivado",
};

export function DashboardHome() {
  const [chatbots, setChatbots] = useState<ChatbotDto[]>([]);
  const [leads, setLeads] = useState<LeadDto[]>([]);
  const [selectedBotId, setSelectedBotId] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const selectedChatbot =
    chatbots.find((chatbot) => chatbot.botId === selectedBotId) ?? chatbots[0];
  const filteredLeads =
    selectedBotId === "all"
      ? leads
      : leads.filter((lead) => lead.botId === selectedBotId);
  const chatbotById = useMemo(
    () => new Map(chatbots.map((chatbot) => [chatbot.botId, chatbot])),
    [chatbots],
  );
  const uniqueClients = new Set(leads.map((lead) => lead.clientId)).size;
  const activeChatbots = chatbots.filter(
    (chatbot) => chatbot.status === "active",
  ).length;
  const severeLeads = filteredLeads.filter(
    (lead) => lead.intent === "severe_symptoms",
  ).length;
  const snippet = useMemo(
    () =>
      selectedChatbot
        ? [
            "<script",
            `  src="${widgetBaseUrl}/embed/widget.js"`,
            `  data-api-base-url="${apiBaseUrl}"`,
            `  data-bot-id="${selectedChatbot.botId}"`,
            `  data-client-id="${selectedChatbot.clientId}"`,
            "></script>",
          ].join("\n")
        : "",
    [selectedChatbot],
  );

  async function loadDashboardData() {
    setIsLoading(true);
    setError("");

    try {
      const nextData = await fetchDashboardData();

      setChatbots(nextData.chatbots);
      setLeads(nextData.leads);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível carregar os dados.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      try {
        const nextData = await fetchDashboardData();

        if (isMounted) {
          setChatbots(nextData.chatbots);
          setLeads(nextData.leads);
        }
      } catch (caughtError) {
        if (isMounted) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Não foi possível carregar os dados.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#14171f]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8">
        <header className="flex flex-col justify-between gap-4 border-b border-[#d8dde7] pb-5 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-medium text-[#647084]">Imagin</p>
            <h1 className="text-3xl font-semibold tracking-normal">
              Operação de chatbots
            </h1>
          </div>
          <button
            type="button"
            onClick={() => void loadDashboardData()}
            className="h-10 rounded-md border border-[#b9c1d1] bg-white px-4 text-sm font-medium text-[#202636] shadow-sm transition hover:bg-[#eef2f7]"
          >
            Atualizar
          </button>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <Metric label="Leads" value={leads.length} />
          <Metric label="Chatbots ativos" value={activeChatbots} />
          <Metric label="Clientes" value={uniqueClients} />
          <Metric label="Urgências no filtro" value={severeLeads} />
        </section>

        <section className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="flex flex-col gap-4">
            <section className="rounded-lg border border-[#d8dde7] bg-white">
              <div className="border-b border-[#e4e8f0] px-4 py-3">
                <h2 className="text-base font-semibold">Chatbots</h2>
              </div>

              <div className="p-3">
                <button
                  type="button"
                  onClick={() => setSelectedBotId("all")}
                  className={`mb-2 w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                    selectedBotId === "all"
                      ? "border-[#205ea8] bg-[#eef5ff]"
                      : "border-[#d8deea] bg-white hover:bg-[#f5f7fb]"
                  }`}
                >
                  <span className="block font-medium">Todos os chatbots</span>
                  <span className="text-xs text-[#65738a]">
                    {leads.length} leads totais
                  </span>
                </button>

                <div className="space-y-2">
                  {chatbots.map((chatbot) => {
                    const chatbotLeads = leads.filter(
                      (lead) => lead.botId === chatbot.botId,
                    ).length;

                    return (
                      <button
                        key={chatbot.botId}
                        type="button"
                        onClick={() => setSelectedBotId(chatbot.botId)}
                        className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                          selectedBotId === chatbot.botId
                            ? "border-[#205ea8] bg-[#eef5ff]"
                            : "border-[#d8deea] bg-white hover:bg-[#f5f7fb]"
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-medium">{chatbot.name}</span>
                          <span className="rounded-full bg-[#e8edf6] px-2 py-0.5 text-xs text-[#41506a]">
                            {statusLabels[chatbot.status]}
                          </span>
                        </span>
                        <span className="mt-1 block text-xs text-[#65738a]">
                          {chatbot.clientName} · {chatbotLeads} leads
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-[#d8dde7] bg-white p-4">
              <h2 className="text-base font-semibold">Embed selecionado</h2>
              {selectedChatbot ? (
                <>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div>
                      <dt className="text-[#647084]">Bot</dt>
                      <dd className="font-medium">{selectedChatbot.name}</dd>
                    </div>
                    <div>
                      <dt className="text-[#647084]">Cliente</dt>
                      <dd>{selectedChatbot.clientName}</dd>
                    </div>
                  </dl>
                  <pre className="mt-3 overflow-x-auto rounded-md bg-[#101623] p-3 text-xs leading-5 text-[#e8edf7]">
                    <code>{snippet}</code>
                  </pre>
                </>
              ) : (
                <p className="mt-3 text-sm text-[#647084]">
                  Nenhum chatbot cadastrado.
                </p>
              )}
            </section>
          </aside>

          <section className="overflow-hidden rounded-lg border border-[#d8dde7] bg-white">
            <div className="flex flex-col gap-3 border-b border-[#e4e8f0] px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-base font-semibold">Leads capturados</h2>
                <p className="text-sm text-[#647084]">
                  {selectedBotId === "all"
                    ? "Todos os bots"
                    : chatbotById.get(selectedBotId)?.name ?? selectedBotId}
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm text-[#647084]">
                Filtro
                <select
                  value={selectedBotId}
                  onChange={(event) => setSelectedBotId(event.target.value)}
                  className="h-9 rounded-md border border-[#cfd6e4] bg-white px-3 text-sm text-[#202636] outline-none"
                >
                  <option value="all">Todos</option>
                  {chatbots.map((chatbot) => (
                    <option key={chatbot.botId} value={chatbot.botId}>
                      {chatbot.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {error ? (
              <div className="border-b border-[#f0c7c7] bg-[#fff3f3] px-4 py-3 text-sm text-[#9a1f1f]">
                {error}
              </div>
            ) : null}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[840px] border-collapse text-left text-sm">
                <thead className="bg-[#f0f3f8] text-xs uppercase text-[#647084]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Lead</th>
                    <th className="px-4 py-3 font-semibold">Chatbot</th>
                    <th className="px-4 py-3 font-semibold">Tipo</th>
                    <th className="px-4 py-3 font-semibold">Detalhe</th>
                    <th className="px-4 py-3 font-semibold">Origem</th>
                    <th className="px-4 py-3 font-semibold">Entrada</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td className="px-4 py-6 text-[#647084]" colSpan={6}>
                        Carregando dados...
                      </td>
                    </tr>
                  ) : filteredLeads.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-[#647084]" colSpan={6}>
                        Nenhum lead encontrado para este filtro.
                      </td>
                    </tr>
                  ) : (
                    filteredLeads.map((lead) => {
                      const chatbot = chatbotById.get(lead.botId);

                      return (
                        <tr
                          key={lead.id}
                          className="border-t border-[#eef1f5] align-top"
                        >
                          <td className="px-4 py-3 font-medium">{lead.name}</td>
                          <td className="px-4 py-3">
                            <span className="block font-medium">
                              {chatbot?.name ?? lead.botId}
                            </span>
                            <span className="font-mono text-xs text-[#647084]">
                              {lead.clientId}
                            </span>
                          </td>
                          <td className="px-4 py-3">{intentLabels[lead.intent]}</td>
                          <td className="max-w-md px-4 py-3 text-[#4e5b70]">
                            {lead.intent === "schedule_exam"
                              ? lead.selectedExams.join(", ")
                              : lead.consultationNeed ?? lead.whatsappMessage}
                          </td>
                          <td className="max-w-[140px] px-4 py-3 text-xs text-[#647084]">
                            {lead.source.parentOrigin ??
                              lead.source.pageUrl ??
                              "Não informado"}
                          </td>
                          <td className="px-4 py-3 text-[#647084]">
                            {formatDate(lead.createdAt)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[#d8dde7] bg-white p-4">
      <p className="text-sm text-[#647084]">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

async function fetchDashboardData(): Promise<DashboardData> {
  const [chatbotsResponse, leadsResponse] = await Promise.all([
    fetch(`${apiBaseUrl}/api/chatbots`, { cache: "no-store" }),
    fetch(`${apiBaseUrl}/api/leads`, { cache: "no-store" }),
  ]);

  if (!chatbotsResponse.ok) {
    throw new Error(`API de chatbots respondeu ${chatbotsResponse.status}`);
  }

  if (!leadsResponse.ok) {
    throw new Error(`API de leads respondeu ${leadsResponse.status}`);
  }

  const chatbotsBody = (await chatbotsResponse.json()) as {
    chatbots: ChatbotDto[];
  };
  const leadsBody = (await leadsResponse.json()) as { leads: LeadDto[] };

  return {
    chatbots: chatbotsBody.chatbots,
    leads: leadsBody.leads,
  };
}
