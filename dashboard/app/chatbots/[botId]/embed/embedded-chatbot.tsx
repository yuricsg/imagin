"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type LeadIntent =
  | "schedule_exam"
  | "schedule_consultation"
  | "severe_symptoms";

type Step =
  | "name"
  | "intent"
  | "examSelection"
  | "medicalRequest"
  | "consultationNeed"
  | "consultationDecision"
  | "complete";

type ChatbotConfig = {
  botId: string;
  name: string;
  buttonTexts: string[];
  examOptions: string[];
  medicalRequestOptions: string[];
  consultationNeeds: string[];
  consultationDecisions: string[];
};

type LeadResponse = {
  lead: { id: string; intent: LeadIntent };
  whatsappMessage: string;
  whatsappUrl: string;
};

type LeadSource = {
  pageUrl?: string;
  landingPageUrl?: string;
  referrer?: string;
  parentOrigin?: string;
  utm?: Record<string, string>;
  clickIds?: Record<string, string>;
  cookies?: Record<string, string>;
};

type EmbeddedChatbotProps = {
  botId: string;
  clientId: string;
  pageUrl?: string;
  parentOrigin?: string;
  initialSource: LeadSource;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

const fallbackConfig: ChatbotConfig = {
  botId: "loading",
  name: "Assistente",
  buttonTexts: ["Iniciar atendimento"],
  examOptions: [],
  medicalRequestOptions: [],
  consultationNeeds: [],
  consultationDecisions: [],
};

export function EmbeddedChatbot({
  botId,
  clientId,
  initialSource,
  pageUrl,
  parentOrigin,
}: EmbeddedChatbotProps) {
  const [config, setConfig] = useState<ChatbotConfig>(fallbackConfig);
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [selectedExams, setSelectedExams] = useState<string[]>([]);
  const [consultationNeed, setConsultationNeed] = useState("");
  const [leadResponse, setLeadResponse] = useState<LeadResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadConfig() {
      const response = await fetch(
        `${apiBaseUrl}/api/public/chatbots/${encodeURIComponent(botId)}/config`,
      );
      if (response.ok) {
        const body = (await response.json()) as { chatbot: ChatbotConfig };
        setConfig(body.chatbot);
      }
    }
    void loadConfig().catch(() => undefined);
  }, [botId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [step]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      postToParent(parentOrigin, {
        type: "imagin:resize",
        height: document.documentElement.scrollHeight,
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [parentOrigin, step, selectedExams, leadResponse, error]);

  const source = useMemo(
    () => ({
      ...initialSource,
      pageUrl,
      landingPageUrl: initialSource.landingPageUrl ?? pageUrl,
      parentOrigin,
      referrer:
        initialSource.referrer ??
        (typeof document === "undefined" ? undefined : document.referrer),
    }),
    [initialSource, pageUrl, parentOrigin],
  );

  async function submitLead(payload: {
    intent: LeadIntent;
    medicalRequestStatus?: string;
    consultationDecision?: string;
  }) {
    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/public/chatbots/${encodeURIComponent(botId)}/leads`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId,
            name: name.trim(),
            intent: payload.intent,
            selectedExams,
            medicalRequestStatus: payload.medicalRequestStatus,
            consultationNeed,
            consultationDecision: payload.consultationDecision,
            source,
          }),
        },
      );
      if (!response.ok) throw new Error(`API respondeu ${response.status}`);
      setLeadResponse((await response.json()) as LeadResponse);
      setStep("complete");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível registrar o lead.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-white font-sans text-[#172033]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#e8ecf3] bg-[#205ea8] px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-base font-bold text-white">
          {config.name.charAt(0)}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{config.name}</p>
          <p className="text-xs text-blue-200">Assistente de agendamento</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        <Bot>Olá, tudo bem? 😊</Bot>
        <Bot>Para iniciar o atendimento preciso de algumas informações rápidas.</Bot>

        {/* Step: name */}
        {step === "name" && (
          <div className="space-y-3">
            <Bot>Como posso te chamar?</Bot>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim().length >= 2) setStep("intent");
                }}
                placeholder="Seu nome"
                autoFocus
                className="min-w-0 flex-1 rounded-xl border border-[#d0d7e5] px-3 py-2 text-sm outline-none transition focus:border-[#205ea8] focus:ring-2 focus:ring-[#205ea8]/10"
              />
              <button
                type="button"
                disabled={name.trim().length < 2}
                onClick={() => setStep("intent")}
                className="rounded-xl bg-[#205ea8] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#184d8a] disabled:cursor-not-allowed disabled:opacity-40"
              >
                OK
              </button>
            </div>
          </div>
        )}

        {step !== "name" && <User>{name.trim()}</User>}

        {/* Step: intent */}
        {step === "intent" && (
          <div className="space-y-2">
            <Bot>Prazer, {name.trim()}! 👋 O que você deseja fazer hoje?</Bot>
            <Option onClick={() => setStep("examSelection")}>🔬 Agendar exame</Option>
            <Option onClick={() => setStep("consultationNeed")}>🩺 Marcar consulta cardiológica</Option>
            <Option onClick={() => void submitLead({ intent: "severe_symptoms" })}>
              🚨 Avaliação de sintomas graves (pressão alta ou dor no peito)
            </Option>
          </div>
        )}

        {/* Step: examSelection */}
        {step === "examSelection" && (
          <div className="space-y-3">
            <Bot>Qual exame você deseja realizar? Pode selecionar mais de um.</Bot>
            <div className="space-y-2">
              {config.examOptions.map((exam) => {
                const checked = selectedExams.includes(exam);
                return (
                  <label
                    key={exam}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${
                      checked
                        ? "border-[#205ea8] bg-[#eef4ff] text-[#205ea8]"
                        : "border-[#d8deea] bg-white hover:border-[#205ea8]/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedExams((cur) =>
                          cur.includes(exam)
                            ? cur.filter((e) => e !== exam)
                            : [...cur, exam],
                        )
                      }
                      className="accent-[#205ea8]"
                    />
                    <span>{exam}</span>
                  </label>
                );
              })}
            </div>
            {/* Botão fixo dentro do scroll, sempre visível */}
            <div ref={bottomRef} className="pt-1">
              <button
                type="button"
                disabled={selectedExams.length === 0}
                onClick={() => setStep("medicalRequest")}
                className="w-full rounded-xl bg-[#205ea8] py-3 text-sm font-semibold text-white transition hover:bg-[#184d8a] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continuar {selectedExams.length > 0 ? `(${selectedExams.length} selecionado${selectedExams.length > 1 ? "s" : ""})` : ""}
              </button>
            </div>
          </div>
        )}

        {/* Step: medicalRequest */}
        {step === "medicalRequest" && (
          <div className="space-y-2">
            <Bot>Você possui solicitação médica para esse(s) exame(s)?</Bot>
            {config.medicalRequestOptions.map((option) => (
              <Option
                key={option}
                disabled={isSubmitting}
                onClick={() => void submitLead({ intent: "schedule_exam", medicalRequestStatus: option })}
              >
                {option}
              </Option>
            ))}
          </div>
        )}

        {/* Step: consultationNeed */}
        {step === "consultationNeed" && (
          <div className="space-y-2">
            <Bot>Qual é sua principal necessidade hoje? 🤔</Bot>
            {config.consultationNeeds.map((need) => (
              <Option
                key={need}
                onClick={() => {
                  setConsultationNeed(need);
                  setStep("consultationDecision");
                }}
              >
                {need}
              </Option>
            ))}
          </div>
        )}

        {/* Step: consultationDecision */}
        {step === "consultationDecision" && (
          <div className="space-y-2">
            <Bot>A consulta com a Dra. Renata Reis dura em média 1 hora, com eletrocardiograma incluso. 😊</Bot>
            <Bot>Investimento: R$ 430,00, com direito a retorno.</Bot>
            <Bot>Atendimento na Av. Djalma Dutra, 606, Medcenter, Heliópolis — Garanhuns.</Bot>
            <Bot>Quer agendar a consulta agora?</Bot>
            {config.consultationDecisions.map((decision) => (
              <Option
                key={decision}
                disabled={isSubmitting}
                onClick={() => void submitLead({ intent: "schedule_consultation", consultationDecision: decision })}
              >
                {decision}
              </Option>
            ))}
          </div>
        )}

        {isSubmitting && (
          <p className="text-center text-xs text-[#8792a5]">Registrando atendimento...</p>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {step === "complete" && leadResponse && (
          <div className="space-y-3">
            <Bot>Certo. Obrigada! 🙏</Bot>
            <Bot>Envie a mensagem para a secretária para tirar dúvidas e verificar os horários disponíveis.</Bot>
            <a
              href={leadResponse.whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-[#25d366] py-3 text-sm font-semibold text-white transition hover:bg-[#1ebe5a]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Falar com a secretária
            </a>
            <p className="rounded-xl bg-[#f5f7fb] px-3 py-2 text-xs leading-5 text-[#4f5d73]">
              {leadResponse.whatsappMessage}
            </p>
          </div>
        )}

        <div ref={step !== "examSelection" ? bottomRef : undefined} />
      </div>
    </div>
  );
}

function Bot({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-end gap-2">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#205ea8] text-[10px] font-bold text-white">
        A
      </div>
      <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-[#f0f4fb] px-3 py-2 text-sm leading-6 text-[#1f2a44]">
        {children}
      </div>
    </div>
  );
}

function User({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[#205ea8] px-3 py-2 text-sm leading-6 text-white">
        {children}
      </div>
    </div>
  );
}

function Option({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="block w-full rounded-xl border border-[#d0d7e5] bg-white px-3 py-2.5 text-left text-sm font-medium transition hover:border-[#205ea8] hover:bg-[#f0f4fb] hover:text-[#205ea8] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function postToParent(parentOrigin: string | undefined, message: unknown) {
  try {
    window.parent.postMessage(message, parentOrigin || "*");
  } catch {
    window.parent.postMessage(message, "*");
  }
}
