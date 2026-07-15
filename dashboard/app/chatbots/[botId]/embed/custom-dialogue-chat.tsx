"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Chatbot } from "@/lib/chatbots/types";
import {
  extractLeadFieldsFromAnswers,
  getDialogueStep,
  hasCustomDialogue,
  resolveGreeting,
  resolveNextStepId,
  resolveStepSaveAs,
  type DialogueFlow,
  type FlowStep,
} from "@/lib/chatbots/flows";
import {
  DEFAULT_WHATSAPP_ROUTING_QUESTION,
  needsWhatsAppRouting,
  resolveWhatsAppMessage,
  whatsAppUrl,
  type WhatsAppDestination,
} from "@/lib/chatbots/whatsapp";
import type { ChatSessionTracker, LeadSource } from "./chat-session";

type LeadResponse = {
  lead: { id: string };
  whatsappMessage: string;
  whatsappUrl: string;
};

type ChatMessage = {
  id: string;
  sender: "bot" | "user";
  text: string;
};

type DialogueUiStep = "idle" | "step" | "routing" | "complete";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

type Props = {
  bot: Chatbot;
  botId: string;
  clientId: string;
  source: LeadSource;
  parentOrigin?: string;
  sessionTracker: ChatSessionTracker;
  /**
   * Dashboard preview: run the whole flow without registering a lead. The
   * closing WhatsApp message/URL are built client-side from the bot config.
   * A no-op sessionTracker keeps event calls harmless in this mode.
   */
  preview?: boolean;
};

export function CustomDialogueChat({
  bot,
  botId,
  clientId,
  source,
  parentOrigin,
  sessionTracker,
  preview = false,
}: Props) {
  const dialogue = bot.flow.dialogue as DialogueFlow;
  const [uiStep, setUiStep] = useState<DialogueUiStep>("idle");
  const [currentStepId, setCurrentStepId] = useState(
    dialogue.startStepId || dialogue.steps[0]?.id || "",
  );
  const [answers, setAnswers] = useState<Record<string, string | string[]>>(
    {},
  );
  const [textValue, setTextValue] = useState("");
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [destination, setDestination] = useState<WhatsAppDestination | null>(
    null,
  );
  const [leadResponse, setLeadResponse] = useState<LeadResponse | null>(null);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageCounterRef = useRef(0);
  const sequenceRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const introStartedRef = useRef(false);

  const currentStep = useMemo(
    () => getDialogueStep(dialogue, currentStepId),
    [dialogue, currentStepId],
  );

  const whatsappDestinations = useMemo(
    () => bot.whatsapp.destinations ?? [],
    [bot.whatsapp.destinations],
  );
  // With a single office there is nothing to ask — keep the old flow verbatim.
  const asksForDestination = needsWhatsAppRouting(bot.whatsapp);
  const routingQuestion =
    bot.whatsapp.routingQuestion?.trim() || DEFAULT_WHATSAPP_ROUTING_QUESTION;

  const clearScheduled = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
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

  const playBotMessages = useCallback(
    async (lines: string[], onDone?: () => void) => {
      clearScheduled();
      sequenceRef.current += 1;
      const sequence = sequenceRef.current;
      setUiStep("idle");

      const wait = (ms: number) =>
        new Promise<void>((resolve) => {
          const timer = window.setTimeout(resolve, ms);
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
    [addMessage, clearScheduled],
  );

  useEffect(() => {
    return () => {
      sequenceRef.current += 1;
      clearScheduled();
    };
  }, [clearScheduled]);

  useEffect(() => {
    if (introStartedRef.current) return;
    introStartedRef.current = true;
    const greeting = resolveGreeting(bot.flow, {
      botName: bot.name,
      clientName: bot.clientName,
    });
    const first = getDialogueStep(
      dialogue,
      dialogue.startStepId || dialogue.steps[0]?.id || "",
    );
    const lines = first ? [greeting, first.question] : [greeting];
    void playBotMessages(lines, () => {
      if (first) {
        setCurrentStepId(first.id);
        setUiStep("step");
      } else {
        setUiStep("complete");
      }
    });
  }, [bot, dialogue, playBotMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [uiStep, messages.length, leadResponse, error, isBotTyping]);

  useEffect(() => {
    // The dashboard preview isn't inside the embed iframe — nothing listens for
    // resize there, and the chat is height-bounded by the modal instead.
    if (preview) return;
    const frame = window.requestAnimationFrame(() => {
      try {
        window.parent.postMessage(
          {
            type: "imagin:resize",
            height: document.documentElement.scrollHeight,
          },
          parentOrigin || "*",
        );
      } catch {
        window.parent.postMessage(
          {
            type: "imagin:resize",
            height: document.documentElement.scrollHeight,
          },
          "*",
        );
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    preview,
    parentOrigin,
    uiStep,
    messages.length,
    leadResponse,
    error,
    isBotTyping,
  ]);

  async function finishFlow(
    nextAnswers: Record<string, string | string[]>,
    chosen: WhatsAppDestination | null,
  ) {
    setIsSubmitting(true);
    setError("");
    setUiStep("idle");
    const fields = extractLeadFieldsFromAnswers(dialogue, nextAnswers);
    const name = fields.name.trim();
    if (!name) {
      setError("Este fluxo precisa coletar o nome antes de concluir o atendimento.");
      setUiStep("step");
      setIsSubmitting(false);
      return;
    }
    // Feeds the {unidade} placeholder in the WhatsApp message template.
    const customFields = chosen?.label
      ? { ...fields.custom, unidade: chosen.label }
      : fields.custom;
    const intent = intentForTemplate(bot.flow.templateId);
    try {
      if (preview) {
        // Preview never touches the network: resolve the WhatsApp handoff from
        // the in-progress config so the operator sees the real message/link.
        setLeadResponse(buildPreviewLeadResponse(bot, name, fields, chosen));
      } else {
        await sessionTracker.trackEvent({
          type: "intent_selected",
          intent,
          label: bot.flow.templateId,
          flowMode: "custom_dialogue",
        });
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
              name,
              phone: fields.phone || undefined,
              email: fields.email || undefined,
              message: fields.message || undefined,
              customFields: Object.keys(customFields).length
                ? customFields
                : undefined,
              intent,
              answers: nextAnswers,
              flowMode: "custom_dialogue",
              whatsappDestinationId: chosen?.id,
              source,
            }),
          },
        );
        if (!response.ok) throw new Error(`API respondeu ${response.status}`);
        setLeadResponse((await response.json()) as LeadResponse);
        await sessionTracker.trackEvent({
          type: "flow_completed",
          flowMode: "custom_dialogue",
        });
      }
      setIsSubmitting(false);
      const isFormalTone = bot.flow.tone === "formal";
      const office = chosen?.label;
      const handoff = isFormalTone
        ? office
          ? `Continue o atendimento pelo WhatsApp do ${office} para confirmar os detalhes.`
          : "Continue o atendimento pelo WhatsApp para confirmar os detalhes."
        : office
          ? `Continue no WhatsApp para falar com a equipe do ${office}.`
          : "Continue no WhatsApp para falar com nossa equipe.";
      const closing = isFormalTone
        ? [
            "Obrigado. Suas informações foram registradas. 🙏",
            bot.whatsapp.enabled
              ? handoff
              : "Nossa equipe entrará em contato em breve.",
          ]
        : [
            "Prontinho! Já recebemos seus dados. 🙏",
            bot.whatsapp.enabled
              ? handoff
              : "Nossa equipe entrará em contato em breve para dar sequência.",
          ];
      await playBotMessages(closing, () => setUiStep("complete"));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível registrar o lead.",
      );
      // Send the visitor back to whichever question they last answered.
      setUiStep(chosen ? "routing" : "step");
      setIsSubmitting(false);
    }
  }

  /** Last question of the run: which office should receive this visitor? */
  function askForDestination() {
    void playBotMessages([routingQuestion], () => setUiStep("routing"));
  }

  function endDialogue(nextAnswers: Record<string, string | string[]>) {
    if (asksForDestination) {
      setAnswers(nextAnswers);
      askForDestination();
      return;
    }
    void finishFlow(nextAnswers, whatsappDestinations[0] ?? null);
  }

  function selectDestination(chosen: WhatsAppDestination) {
    addMessage("user", chosen.label);
    void sessionTracker.trackEvent({
      type: "answer_submitted",
      stepId: "whatsappDestination",
      label: chosen.label,
      value: chosen.id,
      flowMode: "custom_dialogue",
    });
    setDestination(chosen);
    void finishFlow(answers, chosen);
  }

  function advance(step: FlowStep, answer: string | string[], display: string) {
    addMessage("user", display);
    void sessionTracker.trackEvent({
      type: "answer_submitted",
      stepId: step.id,
      label: display,
      value: answer,
      flowMode: "custom_dialogue",
    });
    if (resolveStepSaveAs(step) === "name" && typeof answer === "string") {
      void sessionTracker.trackEvent({
        type: "name_captured",
        stepId: step.id,
        name: answer,
        flowMode: "custom_dialogue",
      });
    }
    const nextAnswers = { ...answers, [step.id]: answer };
    setAnswers(nextAnswers);
    setTextValue("");
    setMultiSelected([]);

    const nextId = resolveNextStepId(dialogue, step.id, answer);
    const nextStep = nextId ? getDialogueStep(dialogue, nextId) : null;
    if (!nextId || !nextStep) {
      endDialogue(nextAnswers);
      return;
    }
    setCurrentStepId(nextId);
    void playBotMessages([nextStep.question], () => setUiStep("step"));
  }

  function submitText() {
    if (!currentStep || currentStep.inputType !== "text") return;
    const trimmed = textValue.trim();
    if (!trimmed) return;
    advance(currentStep, trimmed, trimmed);
  }

  function selectSingle(optionId: string, label: string) {
    if (!currentStep) return;
    advance(currentStep, optionId, label);
  }

  function confirmMulti() {
    if (!currentStep || currentStep.inputType !== "multi_choice") return;
    if (multiSelected.length === 0) return;
    const labels = (currentStep.options ?? [])
      .filter((o) => multiSelected.includes(o.id))
      .map((o) => o.label);
    advance(currentStep, multiSelected, labels.join(", "));
  }

  const isFormal = bot.flow.tone === "formal";

  return (
    <div
      className={`flex flex-col bg-white font-sans text-[#172033] ${
        preview ? "h-full min-h-104" : "min-h-dvh"
      }`}
    >
      <div className="flex items-center gap-3 border-b border-[#e8ecf3] bg-[#205ea8] px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-base font-bold text-white">
          {bot.name.charAt(0)}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{bot.name}</p>
          <p className="text-xs text-blue-200">
            {bot.specialty || "Assistente"}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {messages.map((message) =>
          message.sender === "bot" ? (
            <BubbleBot key={message.id}>{message.text}</BubbleBot>
          ) : (
            <BubbleUser key={message.id}>{message.text}</BubbleUser>
          ),
        )}

        {isBotTyping && <TypingDots />}

        {uiStep === "step" && currentStep && !isSubmitting && (
          <div className="space-y-3">
            {currentStep.inputType === "text" ? (
              <div className="flex gap-2">
                <input
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitText();
                  }}
                  placeholder={
                    resolveStepSaveAs(currentStep) === "phone"
                      ? "(11) 99999-0000"
                      : resolveStepSaveAs(currentStep) === "email"
                        ? "seu@email.com"
                        : isFormal
                          ? "Sua resposta"
                          : "Digite aqui…"
                  }
                  autoFocus
                  className="min-w-0 flex-1 rounded-xl border border-[#d0d7e5] px-3 py-2 text-sm outline-none transition focus:border-[#205ea8] focus:ring-2 focus:ring-[#205ea8]/10"
                />
                <button
                  type="button"
                  disabled={!textValue.trim()}
                  onClick={submitText}
                  className="rounded-xl bg-[#205ea8] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#184d8a] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  OK
                </button>
              </div>
            ) : null}

            {currentStep.inputType === "single_choice" ? (
              <div className="space-y-2">
                {(currentStep.options ?? []).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => selectSingle(option.id, option.label)}
                    className="block w-full rounded-xl border border-[#d0d7e5] bg-white px-3 py-2.5 text-left text-sm font-medium transition hover:border-[#205ea8] hover:bg-[#f0f4fb] hover:text-[#205ea8]"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}

            {currentStep.inputType === "multi_choice" ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  {(currentStep.options ?? []).map((option) => {
                    const checked = multiSelected.includes(option.id);
                    return (
                      <label
                        key={option.id}
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
                            setMultiSelected((cur) =>
                              cur.includes(option.id)
                                ? cur.filter((id) => id !== option.id)
                                : [...cur, option.id],
                            )
                          }
                          className="accent-[#205ea8]"
                        />
                        <span>{option.label}</span>
                      </label>
                    );
                  })}
                </div>
                <button
                  type="button"
                  disabled={multiSelected.length === 0}
                  onClick={confirmMulti}
                  className="w-full rounded-xl bg-[#205ea8] py-3 text-sm font-semibold text-white transition hover:bg-[#184d8a] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Continuar
                  {multiSelected.length > 0
                    ? ` (${multiSelected.length})`
                    : ""}
                </button>
              </div>
            ) : null}
          </div>
        )}

        {uiStep === "routing" && !isSubmitting && (
          <div className="space-y-2">
            {whatsappDestinations.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => selectDestination(entry)}
                className="block w-full rounded-xl border border-[#d0d7e5] bg-white px-3 py-2.5 text-left text-sm font-medium transition hover:border-[#205ea8] hover:bg-[#f0f4fb] hover:text-[#205ea8]"
              >
                {entry.label}
              </button>
            ))}
          </div>
        )}

        {isSubmitting && (
          <p className="text-center text-xs text-[#8792a5]">
            Registrando atendimento...
          </p>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {uiStep === "complete" && leadResponse && (
          <div className="space-y-3">
            {bot.whatsapp.enabled && leadResponse.whatsappUrl ? (
              <a
                href={leadResponse.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  void sessionTracker.trackEvent({
                    type: "whatsapp_clicked",
                    flowMode: "custom_dialogue",
                  });
                }}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#25d366] py-3 text-sm font-semibold text-white transition hover:bg-[#1ebe5a]"
              >
                {destination?.label
                  ? `Continuar no WhatsApp — ${destination.label}`
                  : "Continuar no WhatsApp"}
              </a>
            ) : null}
            {leadResponse.whatsappMessage ? (
              <p className="rounded-xl bg-[#f5f7fb] px-3 py-2 text-xs leading-5 text-[#4f5d73]">
                {leadResponse.whatsappMessage}
              </p>
            ) : null}
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

type LeadFields = ReturnType<typeof extractLeadFieldsFromAnswers>;

/**
 * Rebuilds the handoff the backend would produce, but entirely client-side, so
 * the dashboard preview can show the real WhatsApp message and link without
 * creating a lead.
 */
export function buildPreviewLeadResponse(
  bot: Chatbot,
  name: string,
  fields: LeadFields,
  chosen: WhatsAppDestination | null,
): LeadResponse {
  const message = bot.whatsapp.enabled
    ? resolveWhatsAppMessage(
        bot.whatsapp.messageTemplate,
        bot.name,
        {
          nome: name,
          telefone: fields.phone,
          email: fields.email,
          mensagem: fields.message,
          unidade: chosen?.label ?? "",
          ...fields.custom,
        },
        bot.flow.dialogue?.customSaveLabels,
      )
    : "";
  const phone = chosen?.phoneNumber || bot.whatsapp.phoneNumber;
  return {
    lead: { id: "preview" },
    whatsappMessage: message,
    whatsappUrl: bot.whatsapp.enabled && phone ? whatsAppUrl(phone, message) : "",
  };
}

function BubbleBot({ children }: { children: React.ReactNode }) {
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

function BubbleUser({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[#205ea8] px-3 py-2 text-sm leading-6 text-white">
        {children}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-end gap-2" aria-label="Assistente digitando">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#205ea8] text-[10px] font-bold text-white">
        A
      </div>
      <div className="flex h-10 items-center gap-1.5 rounded-2xl rounded-bl-sm bg-[#f0f4fb] px-3">
        <span className="h-1.5 w-1.5 rounded-full bg-[#7d8da8] opacity-40 motion-safe:animate-pulse" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#7d8da8] opacity-70 motion-safe:animate-pulse [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#7d8da8] motion-safe:animate-pulse [animation-delay:300ms]" />
      </div>
    </div>
  );
}

/** Returns true when the public config carries a custom dialogue. */
export function configHasCustomDialogue(dashboardConfig: unknown): boolean {
  const bot =
    dashboardConfig && typeof dashboardConfig === "object"
      ? (dashboardConfig as { flow?: unknown })
      : null;
  if (!bot?.flow || typeof bot.flow !== "object") return false;
  return hasCustomDialogue(bot.flow as Parameters<typeof hasCustomDialogue>[0]);
}

function intentForTemplate(
  templateId: Chatbot["flow"]["templateId"],
): "schedule_exam" | "schedule_consultation" | "severe_symptoms" {
  if (templateId === "exam-scheduling") return "schedule_exam";
  if (templateId === "triage") return "severe_symptoms";
  return "schedule_consultation";
}
