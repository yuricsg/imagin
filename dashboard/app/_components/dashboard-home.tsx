"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

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
    landingPageUrl?: string;
    referrer?: string;
    parentOrigin?: string;
    utm?: {
      source?: string;
      medium?: string;
      campaign?: string;
      content?: string;
      term?: string;
      id?: string;
    };
    clickIds?: {
      fbclid?: string;
      gclid?: string;
      gbraid?: string;
      wbraid?: string;
      msclkid?: string;
    };
    cookies?: {
      fbp?: string;
      fbc?: string;
      gaClientId?: string;
    };
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
  integrationStatus: {
    metaConfigured: boolean;
    googleAnalyticsConfigured: boolean;
  };
};

type DashboardData = {
  chatbots: ChatbotDto[];
  leads: LeadDto[];
};

type ChatbotFormState = {
  botId: string;
  name: string;
  clientId: string;
  clientName: string;
  status: ChatbotDto["status"];
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

const initialFormState: ChatbotFormState = {
  botId: "",
  name: "",
  clientId: "",
  clientName: "",
  status: "active",
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

export function DashboardHome() {
  const [chatbots, setChatbots] = useState<ChatbotDto[]>([]);
  const [leads, setLeads] = useState<LeadDto[]>([]);
  const [selectedBotId, setSelectedBotId] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<ChatbotFormState>(initialFormState);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [isCreatingChatbot, setIsCreatingChatbot] = useState(false);

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

  async function createChatbot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError("");
    setCreateSuccess("");
    setIsCreatingChatbot(true);

    try {
      const payload = {
        botId: form.botId.trim(),
        name: form.name.trim(),
        clientId: form.clientId.trim(),
        clientName: form.clientName.trim(),
        status: form.status,
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
      };

      const response = await fetch(`${apiBaseUrl}/api/chatbots`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
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

      const createdChatbot = body.chatbot;

      setChatbots((currentChatbots) => [
        ...currentChatbots.filter(
          (chatbot) => chatbot.botId !== createdChatbot.botId,
        ),
        createdChatbot,
      ]);
      setSelectedBotId(createdChatbot.botId);
      setCreateSuccess("Chatbot criado.");
      setForm(initialFormState);
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
                        <span className="mt-2 flex flex-wrap gap-1">
                          <IntegrationBadge
                            label="Meta"
                            active={chatbot.integrationStatus.metaConfigured}
                          />
                          <IntegrationBadge
                            label="GA4"
                            active={
                              chatbot.integrationStatus.googleAnalyticsConfigured
                            }
                          />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-[#d8dde7] bg-white p-4">
              <h2 className="text-base font-semibold">Criar chatbot</h2>
              <form className="mt-4 space-y-3" onSubmit={createChatbot}>
                <TextField
                  label="Nome do bot"
                  value={form.name}
                  required
                  onChange={(value) =>
                    setForm((currentForm) => {
                      const currentSlug = slugify(currentForm.name);

                      return {
                        ...currentForm,
                        name: value,
                        botId:
                          !currentForm.botId || currentForm.botId === currentSlug
                            ? slugify(value)
                            : currentForm.botId,
                      };
                    })
                  }
                />
                <TextField
                  label="Bot ID"
                  value={form.botId}
                  required
                  onChange={(value) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      botId: slugify(value),
                    }))
                  }
                />
                <TextField
                  label="Client ID"
                  value={form.clientId}
                  required
                  onChange={(value) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      clientId: slugify(value),
                    }))
                  }
                />
                <TextField
                  label="Cliente"
                  value={form.clientName}
                  required
                  onChange={(value) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      clientName: value,
                    }))
                  }
                />

                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-[#414b5f]">
                    Status
                  </span>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        status: event.target.value as ChatbotDto["status"],
                      }))
                    }
                    className="h-10 w-full rounded-md border border-[#cfd6e4] bg-white px-3 text-sm outline-none transition focus:border-[#205ea8]"
                  >
                    <option value="active">Ativo</option>
                    <option value="draft">Rascunho</option>
                    <option value="archived">Arquivado</option>
                  </select>
                </label>

                <TextField
                  label="WhatsApp"
                  value={form.whatsappPhone}
                  onChange={(value) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      whatsappPhone: value,
                    }))
                  }
                />
                <TextareaField
                  label="Descrição"
                  value={form.description}
                  rows={2}
                  onChange={(value) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      description: value,
                    }))
                  }
                />
                <TextareaField
                  label="Botões flutuantes"
                  value={form.buttonTexts}
                  rows={3}
                  onChange={(value) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      buttonTexts: value,
                    }))
                  }
                />
                <TextareaField
                  label="Exames"
                  value={form.examOptions}
                  rows={4}
                  onChange={(value) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      examOptions: value,
                    }))
                  }
                />
                <TextareaField
                  label="Solicitação médica"
                  value={form.medicalRequestOptions}
                  rows={3}
                  onChange={(value) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      medicalRequestOptions: value,
                    }))
                  }
                />
                <TextareaField
                  label="Necessidades de consulta"
                  value={form.consultationNeeds}
                  rows={4}
                  onChange={(value) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      consultationNeeds: value,
                    }))
                  }
                />
                <TextareaField
                  label="Decisão de consulta"
                  value={form.consultationDecisions}
                  rows={3}
                  onChange={(value) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      consultationDecisions: value,
                    }))
                  }
                />

                <div className="border-t border-[#e4e8f0] pt-3">
                  <h3 className="text-sm font-semibold text-[#202636]">
                    Integrações
                  </h3>
                  <div className="mt-3 space-y-3">
                    <TextField
                      label="Meta Pixel ID"
                      value={form.metaPixelId}
                      onChange={(value) =>
                        setForm((currentForm) => ({
                          ...currentForm,
                          metaPixelId: value,
                        }))
                      }
                    />
                    <TextField
                      label="Meta Access Token"
                      value={form.metaAccessToken}
                      type="password"
                      autoComplete="off"
                      onChange={(value) =>
                        setForm((currentForm) => ({
                          ...currentForm,
                          metaAccessToken: value,
                        }))
                      }
                    />
                    <TextField
                      label="Meta Test Event Code"
                      value={form.metaTestEventCode}
                      onChange={(value) =>
                        setForm((currentForm) => ({
                          ...currentForm,
                          metaTestEventCode: value,
                        }))
                      }
                    />
                    <TextField
                      label="GA4 Measurement ID"
                      value={form.ga4MeasurementId}
                      onChange={(value) =>
                        setForm((currentForm) => ({
                          ...currentForm,
                          ga4MeasurementId: value,
                        }))
                      }
                    />
                    <TextField
                      label="GA4 API Secret"
                      value={form.ga4ApiSecret}
                      type="password"
                      autoComplete="off"
                      onChange={(value) =>
                        setForm((currentForm) => ({
                          ...currentForm,
                          ga4ApiSecret: value,
                        }))
                      }
                    />
                  </div>
                </div>

                {createError ? (
                  <p className="rounded-md bg-[#fff3f3] px-3 py-2 text-sm text-[#9a1f1f]">
                    {createError}
                  </p>
                ) : null}
                {createSuccess ? (
                  <p className="rounded-md bg-[#eef9f0] px-3 py-2 text-sm text-[#1f6b35]">
                    {createSuccess}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={isCreatingChatbot}
                  className="h-10 w-full rounded-md bg-[#205ea8] px-4 text-sm font-medium text-white transition hover:bg-[#184d8a] disabled:cursor-not-allowed disabled:bg-[#a9b7cc]"
                >
                  {isCreatingChatbot ? "Criando..." : "Criar chatbot"}
                </button>
              </form>
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
                            {formatLeadSource(lead.source)}
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

function IntegrationBadge({
  active,
  label,
}: {
  active: boolean;
  label: string;
}) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
        active ? "bg-[#e5f7ec] text-[#1f6b35]" : "bg-[#f0f3f8] text-[#65738a]"
      }`}
    >
      {label} {active ? "on" : "off"}
    </span>
  );
}

function TextField({
  autoComplete,
  label,
  onChange,
  required,
  type = "text",
  value,
}: {
  autoComplete?: string;
  label: string;
  onChange(value: string): void;
  required?: boolean;
  type?: "password" | "text";
  value: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-[#414b5f]">{label}</span>
      <input
        autoComplete={autoComplete}
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-[#cfd6e4] bg-white px-3 text-sm outline-none transition focus:border-[#205ea8]"
      />
    </label>
  );
}

function TextareaField({
  label,
  onChange,
  rows,
  value,
}: {
  label: string;
  onChange(value: string): void;
  rows: number;
  value: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-[#414b5f]">{label}</span>
      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-y rounded-md border border-[#cfd6e4] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#205ea8]"
      />
    </label>
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

function formatLeadSource(source: LeadDto["source"]) {
  if (source.utm?.source) {
    return [source.utm.source, source.utm.medium, source.utm.campaign]
      .filter(Boolean)
      .join(" / ");
  }

  if (source.clickIds?.gclid || source.clickIds?.gbraid || source.clickIds?.wbraid) {
    return "Google Ads";
  }

  if (source.clickIds?.fbclid || source.cookies?.fbc || source.cookies?.fbp) {
    return "Meta Ads";
  }

  return source.referrer ?? source.parentOrigin ?? source.pageUrl ?? "Direto";
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
