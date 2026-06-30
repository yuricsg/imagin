"use client";

import { useEffect, useMemo, useState } from "react";

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
  lead: {
    id: string;
    intent: LeadIntent;
  };
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
          headers: {
            "Content-Type": "application/json",
          },
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

      if (!response.ok) {
        throw new Error(`API respondeu ${response.status}`);
      }

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
    <main className="min-h-screen bg-[#f6f8fb] p-3 text-[#172033]">
      <section className="mx-auto flex min-h-[560px] max-w-md flex-col overflow-hidden rounded-lg border border-[#d8deea] bg-white shadow-sm">
        <header className="border-b border-[#e6eaf1] bg-[#ffffff] px-4 py-3">
          <p className="text-sm font-semibold text-[#1f2a44]">{config.name}</p>
          <p className="text-xs text-[#6b778c]">Assistente de agendamento</p>
        </header>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
          <BotBubble>Olá, tudo bem?😊</BotBubble>
          <BotBubble>
            Para iniciar o atendimento preciso de algumas informações rápidas 🙂
          </BotBubble>

          {step === "name" ? (
            <div className="space-y-3">
              <BotBubble>Como posso te chamar?</BotBubble>
              <div className="flex gap-2">
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Seu nome"
                  className="min-w-0 flex-1 rounded-md border border-[#cfd6e4] px-3 py-2 text-sm outline-none transition focus:border-[#3f6fb6]"
                />
                <button
                  type="button"
                  disabled={name.trim().length < 2}
                  onClick={() => setStep("intent")}
                  className="rounded-md bg-[#205ea8] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#184d8a] disabled:cursor-not-allowed disabled:bg-[#a9b7cc]"
                >
                  OK
                </button>
              </div>
            </div>
          ) : null}

          {step !== "name" ? <UserBubble>{name.trim()}</UserBubble> : null}

          {step === "intent" ? (
            <div className="space-y-3">
              <BotBubble>Prazer {name.trim()} 👋</BotBubble>
              <BotBubble>O que você deseja fazer hoje?</BotBubble>
              <OptionButton onClick={() => setStep("examSelection")}>
                Agendar exame
              </OptionButton>
              <OptionButton onClick={() => setStep("consultationNeed")}>
                Marcar consulta cardiológica
              </OptionButton>
              <OptionButton
                onClick={() => void submitLead({ intent: "severe_symptoms" })}
              >
                Avaliação de sintomas graves (pico de pressão alta ou dor no peito)
              </OptionButton>
            </div>
          ) : null}

          {step === "examSelection" ? (
            <div className="space-y-3">
              <BotBubble>
                Qual exame você deseja realizar? Pode selecionar mais de um.
              </BotBubble>
              <div className="space-y-2">
                {config.examOptions.map((exam) => (
                  <label
                    key={exam}
                    className="flex cursor-pointer gap-2 rounded-md border border-[#d8deea] px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedExams.includes(exam)}
                      onChange={() => toggleExam(exam, setSelectedExams)}
                    />
                    <span>{exam}</span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                disabled={selectedExams.length === 0}
                onClick={() => setStep("medicalRequest")}
                className="w-full rounded-md bg-[#205ea8] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#184d8a] disabled:cursor-not-allowed disabled:bg-[#a9b7cc]"
              >
                Continuar
              </button>
            </div>
          ) : null}

          {step === "medicalRequest" ? (
            <div className="space-y-3">
              <BotBubble>
                Você possui solicitação médica para esse(s) exame(s)?
              </BotBubble>
              {config.medicalRequestOptions.map((option) => (
                <OptionButton
                  key={option}
                  disabled={isSubmitting}
                  onClick={() =>
                    void submitLead({
                      intent: "schedule_exam",
                      medicalRequestStatus: option,
                    })
                  }
                >
                  {option}
                </OptionButton>
              ))}
            </div>
          ) : null}

          {step === "consultationNeed" ? (
            <div className="space-y-3">
              <BotBubble>Qual é sua principal necessidade hoje? 🤔</BotBubble>
              {config.consultationNeeds.map((need) => (
                <OptionButton
                  key={need}
                  onClick={() => {
                    setConsultationNeed(need);
                    setStep("consultationDecision");
                  }}
                >
                  {need}
                </OptionButton>
              ))}
            </div>
          ) : null}

          {step === "consultationDecision" ? (
            <div className="space-y-3">
              <BotBubble>
                A consulta com a Dra. Renata Reis dura em média 1 hora, com
                eletrocardiograma incluso. 😊
              </BotBubble>
              <BotBubble>
                O investimento da consulta é de R$ 430,00, com direito a retorno.
              </BotBubble>
              <BotBubble>
                O atendimento é realizado na Av. Djalma Dutra, 606, Medcenter,
                Heliópolis, Garanhuns.
              </BotBubble>
              <BotBubble>Quer agendar a consulta agora?</BotBubble>
              {config.consultationDecisions.map((decision) => (
                <OptionButton
                  key={decision}
                  disabled={isSubmitting}
                  onClick={() =>
                    void submitLead({
                      intent: "schedule_consultation",
                      consultationDecision: decision,
                    })
                  }
                >
                  {decision}
                </OptionButton>
              ))}
            </div>
          ) : null}

          {isSubmitting ? (
            <p className="text-sm text-[#6b778c]">Registrando atendimento...</p>
          ) : null}

          {error ? (
            <div className="rounded-md border border-[#f0c7c7] bg-[#fff3f3] px-3 py-2 text-sm text-[#9a1f1f]">
              {error}
            </div>
          ) : null}

          {step === "complete" && leadResponse ? (
            <div className="space-y-3">
              <BotBubble>Certo. Obrigada.</BotBubble>
              <BotBubble>
                Envie a mensagem para a secretária para tirar dúvidas e verificar
                os horários disponíveis.
              </BotBubble>
              <a
                href={leadResponse.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="block rounded-md bg-[#1f7a4f] px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#17623f]"
              >
                Enviar para a secretária
              </a>
              <p className="rounded-md bg-[#f0f3f8] px-3 py-2 text-xs leading-5 text-[#4f5d73]">
                {leadResponse.whatsappMessage}
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function BotBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[88%] self-start rounded-lg rounded-bl-sm bg-[#eef3fa] px-3 py-2 text-sm leading-6">
      {children}
    </div>
  );
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[88%] self-end rounded-lg rounded-br-sm bg-[#205ea8] px-3 py-2 text-sm leading-6 text-white">
      {children}
    </div>
  );
}

function OptionButton({
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
      className="block w-full rounded-md border border-[#cfd6e4] bg-white px-3 py-2 text-left text-sm transition hover:border-[#205ea8] hover:bg-[#f3f7fc] disabled:cursor-not-allowed disabled:bg-[#eef1f5] disabled:text-[#8792a5]"
    >
      {children}
    </button>
  );
}

function toggleExam(
  exam: string,
  setSelectedExams: React.Dispatch<React.SetStateAction<string[]>>,
) {
  setSelectedExams((current) =>
    current.includes(exam)
      ? current.filter((currentExam) => currentExam !== exam)
      : [...current, exam],
  );
}

function postToParent(parentOrigin: string | undefined, message: unknown) {
  try {
    window.parent.postMessage(message, parentOrigin || "*");
  } catch {
    window.parent.postMessage(message, "*");
  }
}
