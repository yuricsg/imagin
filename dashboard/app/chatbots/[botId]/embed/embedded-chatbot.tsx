"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizeStoredChatbot } from "@/lib/chatbots/create";
import { hasCustomDialogue, farewellMessageForTone, resolveGreeting } from "@/lib/chatbots/flows";
import { CustomDialogueChat } from "./custom-dialogue-chat";
import {
  CHAT_ERROR,
  CHAT_STATUS_TEXT,
  BubbleBot,
  BubbleUser,
  ChatHeader,
  ChatOption,
  TypingDots,
} from "./chat-ui";
import {
  createChatSessionTracker,
  type LeadSource,
} from "./chat-session";

type LeadIntent =
  | "schedule_exam"
  | "schedule_consultation"
  | "severe_symptoms";

type Step =
  | "idle"
  | "name"
  | "intent"
  | "examSelection"
  | "medicalRequest"
  | "consultationNeed"
  | "consultationDecision"
  | "complete";

type DashboardFlowConfig = {
  greeting?: string;
  tone?: string;
  templateId?: string;
  collectFields?: string[];
};

type DashboardConfig = {
  flow?: DashboardFlowConfig;
  clientName?: string;
  specialty?: string;
};

type ChatbotConfig = {
  botId: string;
  name: string;
  flowKey: ConversationFlowKey;
  conversationFlow: {
    key: ConversationFlowKey;
    label: string;
    description: string;
    intents: LeadIntent[];
  };
  buttonTexts: string[];
  examOptions: string[];
  medicalRequestOptions: string[];
  consultationNeeds: string[];
  consultationDecisions: string[];
  dashboardConfig?: DashboardConfig;
};

type ConversationFlowKey =
  | "cardiology_exam_consultation"
  | "exam_scheduling"
  | "consultation_scheduling"
  | "urgent_triage";

type LeadResponse = {
  lead: { id: string; intent: LeadIntent };
  whatsappMessage: string;
  whatsappUrl: string;
};

type ChatMessage = {
  id: string;
  sender: "bot" | "user";
  text: string;
};

type EmbeddedChatbotProps = {
  botId: string;
  clientId: string;
  pageUrl?: string;
  parentOrigin?: string;
  initialSource: LeadSource;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

/** Resolves the dashboard Chatbot (with defaults) from the config, if present. */
function resolveDashboardBot(config: ChatbotConfig) {
  return config.dashboardConfig
    ? normalizeStoredChatbot(config.dashboardConfig)
    : null;
}

function resolveIntroMessages(config: ChatbotConfig): string[] {
  const bot = resolveDashboardBot(config);
  if (bot) {
    // Always meaningful: uses the operator's custom greeting, or the template
    // default greeting with the bot/clinic names filled in.
    const greeting = resolveGreeting(bot.flow, {
      botName: bot.name,
      clientName: bot.clientName,
    });
    const namePrompt =
      bot.flow.tone === "formal"
        ? "Para começar, como podemos chamá-lo(a)?"
        : "Como posso te chamar?";
    return [greeting, namePrompt];
  }
  return [
    "Olá, tudo bem? 😊",
    "Para iniciar o atendimento preciso de algumas informações rápidas.",
    "Como posso te chamar?",
  ];
}

export function resolveCompletionMessages(config: ChatbotConfig): string[] {
  const bot = resolveDashboardBot(config);
  if (bot?.whatsapp.enabled) {
    // Operator-defined closing line wins over the tone default.
    const customClosing = bot.whatsapp.closingMessage?.trim();
    return bot.flow.tone === "formal"
      ? [
          "Obrigado. Suas informações foram registradas. 🙏",
          customClosing ||
            "Continue o atendimento pelo WhatsApp para confirmar os detalhes.",
        ]
      : [
          "Prontinho! Já recebemos seus dados. 🙏",
          customClosing ||
            "Continue no WhatsApp para falar com nossa equipe e ver os horários.",
        ];
  }
  if (bot) {
    return bot.flow.tone === "formal"
      ? [
          "Obrigado. Suas informações foram registradas. 🙏",
          "Nossa equipe entrará em contato em breve.",
        ]
      : [
          "Prontinho! Já recebemos seus dados. 🙏",
          "Nossa equipe entrará em contato em breve para dar sequência.",
        ];
  }
  return [
    "Certo. Obrigada! 🙏",
    "Envie a mensagem para a secretária para tirar dúvidas e verificar os horários disponíveis.",
  ];
}

/**
 * Mirrors `isNotInterestedText` in backend/src/conversations/session-state.ts —
 * keep the terms in sync so the widget treats as no-interest exactly what the
 * funnel will classify as `not_interested`.
 */
export function isNotInterestedDecision(text: string): boolean {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  return ["nao tenho interesse", "sem interesse", "nao quero", "agora nao"].some(
    (term) => normalized.includes(term),
  );
}

/** Goodbye bubbles when the visitor declines — no handoff, no WhatsApp CTA. */
export function resolveFarewellMessages(config: ChatbotConfig): string[] {
  const bot = resolveDashboardBot(config);
  return [farewellMessageForTone(bot?.flow.tone ?? "friendly")];
}

const fallbackConfig: ChatbotConfig = {
  botId: "loading",
  name: "Assistente",
  flowKey: "cardiology_exam_consultation",
  conversationFlow: {
    key: "cardiology_exam_consultation",
    label: "Consulta + exames cardiologicos",
    description: "Fluxo completo de atendimento.",
    intents: ["schedule_exam", "schedule_consultation", "severe_symptoms"],
  },
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
  const [activeStep, setActiveStep] = useState<Step>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [name, setName] = useState("");
  const [selectedExams, setSelectedExams] = useState<string[]>([]);
  const [consultationNeed, setConsultationNeed] = useState("");
  const [leadResponse, setLeadResponse] = useState<LeadResponse | null>(null);
  // True when the visitor declined: the lead is still registered, but the
  // ending shows a polite goodbye instead of the WhatsApp handoff CTA.
  const [endedWithoutWhatsApp, setEndedWithoutWhatsApp] = useState(false);
  const [isConfigLoading, setIsConfigLoading] = useState(true);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [configError, setConfigError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageCounterRef = useRef(0);
  const sequenceRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const introStartedRef = useRef(false);

  const clearScheduledMessages = useCallback(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }, []);

  const addMessage = useCallback((sender: ChatMessage["sender"], text: string) => {
    messageCounterRef.current += 1;
    setMessages((current) => [
      ...current,
      {
        id: `${Date.now()}-${messageCounterRef.current}`,
        sender,
        text,
      },
    ]);
  }, []);

  const addUserMessage = useCallback(
    (text: string) => addMessage("user", text),
    [addMessage],
  );

  const playBotMessages = useCallback(
    async (lines: string[], onDone?: () => void) => {
      clearScheduledMessages();
      sequenceRef.current += 1;
      const sequence = sequenceRef.current;
      setActiveStep("idle");

      const wait = (milliseconds: number) =>
        new Promise<void>((resolve) => {
          const timer = window.setTimeout(resolve, milliseconds);
          timersRef.current.push(timer);
        });

      for (const line of lines) {
        setIsBotTyping(true);
        await wait(Math.min(1100, 420 + line.length * 12));
        if (sequence !== sequenceRef.current) return;
        setIsBotTyping(false);
        addMessage("bot", line);
        await wait(240);
        if (sequence !== sequenceRef.current) return;
      }

      onDone?.();
    },
    [addMessage, clearScheduledMessages],
  );

  useEffect(() => {
    clearScheduledMessages();
    sequenceRef.current += 1;
    introStartedRef.current = false;

    async function loadConfig() {
      const response = await fetch(
        `${apiBaseUrl}/api/public/chatbots/${encodeURIComponent(botId)}/config`,
      );
      if (!response.ok) {
        setConfigError("Não foi possível carregar este assistente.");
        setIsConfigLoading(false);
        return;
      }

      const body = (await response.json()) as { chatbot: ChatbotConfig };
      setConfig(body.chatbot);
      setConfigError("");
      setIsConfigLoading(false);
    }
    void loadConfig().catch(() => {
      setConfigError("Não foi possível carregar este assistente.");
      setIsConfigLoading(false);
    });
  }, [botId, clearScheduledMessages]);

  useEffect(() => {
    return () => {
      sequenceRef.current += 1;
      clearScheduledMessages();
    };
  }, [clearScheduledMessages]);

  useEffect(() => {
    if (isConfigLoading || configError || introStartedRef.current) return;
    const bot = resolveDashboardBot(config);
    if (bot && hasCustomDialogue(bot.flow)) return;
    introStartedRef.current = true;
    const frame = window.requestAnimationFrame(() => {
      void playBotMessages(resolveIntroMessages(config), () => setActiveStep("name"));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [config, configError, isConfigLoading, playBotMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeStep, messages.length, selectedExams.length, leadResponse, error, isBotTyping]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      postToParent(parentOrigin, {
        type: "imagin:resize",
        height: document.documentElement.scrollHeight,
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [parentOrigin, activeStep, messages.length, selectedExams, leadResponse, error, isBotTyping]);

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
  const sessionTracker = useMemo(
    () =>
      createChatSessionTracker({
        apiBaseUrl,
        botId,
        clientId,
        source,
      }),
    [botId, clientId, source],
  );
  useEffect(() => {
    void sessionTracker.ensureSession();
  }, [sessionTracker]);
  const allowedIntents = config.conversationFlow?.intents ?? fallbackConfig.conversationFlow.intents;
  const canScheduleExam = allowedIntents.includes("schedule_exam");
  const canScheduleConsultation = allowedIntents.includes("schedule_consultation");
  const canTriageUrgency = allowedIntents.includes("severe_symptoms");
  const dashBot = useMemo(() => resolveDashboardBot(config), [config]);
  const isFormal = dashBot?.flow.tone === "formal";
  const usesCustomDialogue = Boolean(
    dashBot && hasCustomDialogue(dashBot.flow),
  );

  if (!isConfigLoading && !configError && usesCustomDialogue && dashBot) {
    return (
      <CustomDialogueChat
        bot={dashBot}
        botId={botId}
        clientId={clientId}
        source={source}
        parentOrigin={parentOrigin}
        sessionTracker={sessionTracker}
      />
    );
  }

  function submitName() {
    const trimmedName = name.trim();
    if (trimmedName.length < 2) return;

    addUserMessage(trimmedName);
    void sessionTracker.trackEvent({
      type: "name_captured",
      stepId: "name",
      name: trimmedName,
    });
    void playBotMessages(
      isFormal
        ? [`Obrigado, ${trimmedName}.`, "Como podemos ajudar você hoje?"]
        : [`Prazer, ${trimmedName}! 👋`, "O que você deseja fazer hoje?"],
      () => setActiveStep("intent"),
    );
  }

  function selectIntent(intent: LeadIntent) {
    const label =
      intent === "schedule_exam"
        ? "Agendar exame"
        : intent === "schedule_consultation"
          ? "Marcar consulta cardiológica"
          : "Avaliação de sintomas graves";
    void sessionTracker.trackEvent({
      type: "intent_selected",
      stepId: "intent",
      intent,
      label,
    });
    if (intent === "schedule_exam") {
      addUserMessage("Agendar exame");
      setSelectedExams([]);
      void playBotMessages(
        ["Qual exame você deseja realizar? Pode selecionar mais de um."],
        () => setActiveStep("examSelection"),
      );
      return;
    }

    if (intent === "schedule_consultation") {
      addUserMessage("Marcar consulta cardiológica");
      void playBotMessages(
        ["Qual é sua principal necessidade hoje? 🤔"],
        () => setActiveStep("consultationNeed"),
      );
      return;
    }

    addUserMessage(
      config.dashboardConfig
        ? "Urgência / sintomas graves"
        : "Avaliação de sintomas graves (pressão alta ou dor no peito)",
    );
    void submitLead({ intent: "severe_symptoms" }, "intent");
  }

  function continueWithSelectedExams() {
    if (selectedExams.length === 0) return;
    addUserMessage(selectedExams.join(", "));
    void sessionTracker.trackEvent({
      type: "answer_submitted",
      stepId: "examSelection",
      label: selectedExams.join(", "),
      value: selectedExams,
    });
    void playBotMessages(
      ["Você possui solicitação médica para esse(s) exame(s)?"],
      () => setActiveStep("medicalRequest"),
    );
  }

  function selectConsultationNeed(need: string) {
    addUserMessage(need);
    void sessionTracker.trackEvent({
      type: "answer_submitted",
      stepId: "consultationNeed",
      label: need,
      value: need,
    });
    setConsultationNeed(need);
    const isNewBot = Boolean(config.dashboardConfig);
    const messages = isNewBot
      ? [`Ótimo! Vou registrar seu interesse em "${need}".`, "Deseja confirmar?"]
      : [
          `A consulta com ${config.name} dura em média 1 hora, com eletrocardiograma incluso. 😊`,
          "Investimento: R$ 430,00, com direito a retorno.",
          "Atendimento na Av. Djalma Dutra, 606, Medcenter, Heliópolis — Garanhuns.",
          "Quer agendar a consulta agora?",
        ];
    void playBotMessages(messages, () => setActiveStep("consultationDecision"));
  }

  async function submitLead(payload: {
    intent: LeadIntent;
    medicalRequestStatus?: string;
    consultationDecision?: string;
  }, restoreStep: Step, ending: "handoff" | "farewell" = "handoff") {
    setIsSubmitting(true);
    setError("");
    setActiveStep("idle");
    try {
      await sessionTracker.flush();
      const sessionId = await sessionTracker.ensureSession();
      const response = await fetch(
        `${apiBaseUrl}/api/public/chatbots/${encodeURIComponent(botId)}/leads`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId,
            sessionId: sessionId ?? undefined,
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
      await sessionTracker.trackEvent({ type: "flow_completed" });
      setIsSubmitting(false);
      setEndedWithoutWhatsApp(ending === "farewell");
      await playBotMessages(
        ending === "farewell"
          ? resolveFarewellMessages(config)
          : resolveCompletionMessages(config),
        () => setActiveStep("complete"),
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível registrar o lead.",
      );
      setActiveStep(restoreStep);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white font-sans text-[#18181b]">
      {/* Header */}
      <ChatHeader
        name={config.name}
        subtitle={config.dashboardConfig?.specialty || "Assistente de agendamento"}
      />

      {/* Messages */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {messages.map((message) =>
          message.sender === "bot" ? (
            <BubbleBot key={message.id}>{message.text}</BubbleBot>
          ) : (
            <BubbleUser key={message.id}>{message.text}</BubbleUser>
          ),
        )}

        {isConfigLoading && (
          <p className={CHAT_STATUS_TEXT}>
            Carregando assistente...
          </p>
        )}

        {configError && (
          <div className={CHAT_ERROR}>
            {configError}
          </div>
        )}

        {isBotTyping && <TypingDots />}

        {/* Step: name */}
        {activeStep === "name" && !isConfigLoading && !configError && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitName();
                }}
                placeholder="Seu nome"
                autoFocus
                className="min-w-0 flex-1 rounded-xl border border-[#d4d4d8] px-3 py-2 text-sm outline-none transition focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10"
              />
              <button
                type="button"
                disabled={name.trim().length < 2}
                onClick={submitName}
                className="rounded-xl bg-[#0d9488] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0f766e] disabled:cursor-not-allowed disabled:opacity-40"
              >
                OK
              </button>
            </div>
          </div>
        )}

        {/* Step: intent */}
        {activeStep === "intent" && (
          <div className="space-y-2">
            {canScheduleExam && (
              <ChatOption onClick={() => selectIntent("schedule_exam")}>🔬 Agendar exame</ChatOption>
            )}
            {canScheduleConsultation && (
              <ChatOption onClick={() => selectIntent("schedule_consultation")}>
                🩺 {config.dashboardConfig ? "Marcar consulta" : "Marcar consulta cardiológica"}
              </ChatOption>
            )}
            {canTriageUrgency && (
              <ChatOption onClick={() => selectIntent("severe_symptoms")}>
                {config.dashboardConfig
                  ? "🚨 Urgência / sintomas graves"
                  : "🚨 Avaliação de sintomas graves (pressão alta ou dor no peito)"}
              </ChatOption>
            )}
            {!canScheduleExam && !canScheduleConsultation && !canTriageUrgency && (
              <div className={CHAT_ERROR}>
                Nenhum fluxo ativo foi configurado para este assistente.
              </div>
            )}
          </div>
        )}

        {/* Step: examSelection */}
        {activeStep === "examSelection" && (
          <div className="space-y-3">
            <div className="space-y-2">
              {config.examOptions.map((exam) => {
                const checked = selectedExams.includes(exam);
                return (
                  <label
                    key={exam}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${
                      checked
                        ? "border-[#0d9488] bg-[#f0fdfa] text-[#0d9488]"
                        : "border-[#d4d4d8] bg-white hover:border-[#0d9488]/40"
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
                      className="accent-[#0d9488]"
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
                onClick={continueWithSelectedExams}
                className="w-full rounded-xl bg-[#0d9488] py-3 text-sm font-semibold text-white transition hover:bg-[#0f766e] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continuar {selectedExams.length > 0 ? `(${selectedExams.length} selecionado${selectedExams.length > 1 ? "s" : ""})` : ""}
              </button>
            </div>
          </div>
        )}

        {/* Step: medicalRequest */}
        {activeStep === "medicalRequest" && (
          <div className="space-y-2">
            {config.medicalRequestOptions.map((option) => (
              <ChatOption
                key={option}
                disabled={isSubmitting}
                onClick={() => {
                  addUserMessage(option);
                  void sessionTracker.trackEvent({
                    type: "answer_submitted",
                    stepId: "medicalRequest",
                    label: option,
                    value: option,
                  });
                  void submitLead(
                    { intent: "schedule_exam", medicalRequestStatus: option },
                    "medicalRequest",
                  );
                }}
              >
                {option}
              </ChatOption>
            ))}
          </div>
        )}

        {/* Step: consultationNeed */}
        {activeStep === "consultationNeed" && (
          <div className="space-y-2">
            {config.consultationNeeds.map((need) => (
              <ChatOption
                key={need}
                onClick={() => selectConsultationNeed(need)}
              >
                {need}
              </ChatOption>
            ))}
          </div>
        )}

        {/* Step: consultationDecision */}
        {activeStep === "consultationDecision" && (
          <div className="space-y-2">
            {config.consultationDecisions.map((decision) => (
              <ChatOption
                key={decision}
                disabled={isSubmitting}
                onClick={() => {
                  addUserMessage(decision);
                  void sessionTracker.trackEvent({
                    type: "answer_submitted",
                    stepId: "consultationDecision",
                    label: decision,
                    value: decision,
                  });
                  void submitLead(
                    {
                      intent: "schedule_consultation",
                      consultationDecision: decision,
                    },
                    "consultationDecision",
                    isNotInterestedDecision(decision) ? "farewell" : "handoff",
                  );
                }}
              >
                {decision}
              </ChatOption>
            ))}
          </div>
        )}

        {isSubmitting && (
          <p className={CHAT_STATUS_TEXT}>Registrando atendimento...</p>
        )}

        {error && (
          <div className={CHAT_ERROR}>
            {error}
          </div>
        )}

        {activeStep === "complete" && leadResponse && !endedWithoutWhatsApp && (
          <div className="space-y-3">
            <a
              href={leadResponse.whatsappUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                void sessionTracker.trackEvent({ type: "whatsapp_clicked" });
              }}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#25d366] py-3 text-sm font-semibold text-white transition hover:bg-[#1ebe5a]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Falar com a secretária
            </a>
            <p className="rounded-xl bg-[#f4f4f5] px-3 py-2 text-xs leading-5 text-[#52525b]">
              {leadResponse.whatsappMessage}
            </p>
          </div>
        )}

        <div ref={activeStep !== "examSelection" ? bottomRef : undefined} />
      </div>
    </div>
  );
}

function postToParent(parentOrigin: string | undefined, message: unknown) {
  try {
    window.parent.postMessage(message, parentOrigin || "*");
  } catch {
    window.parent.postMessage(message, "*");
  }
}
