"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { AccentKey, Chatbot, ChatbotStatus } from "@/lib/chatbots/types";
import { ACCENTS, ACCENT_ORDER } from "@/lib/chatbots/accents";
import { BOT_STATUS } from "@/lib/labels";
import { DEFAULT_EMBED, chatbotToInput, type ChatbotInput } from "@/lib/chatbots/create";
import {
  buildFlowPreview,
  FLOW_FIELD_LABELS,
  FLOW_TEMPLATES,
  FLOW_TEMPLATE_ORDER,
  FLOW_TONE_LABELS,
  suggestTemplateForSpecialty,
  type FlowFieldKey,
  type FlowTemplateId,
  type FlowTone,
} from "@/lib/chatbots/flows";
import {
  validateChatbotInput,
  type ChatbotField,
  type ChatbotFieldErrors,
} from "@/lib/chatbots/validate";
import {
  DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
  previewWhatsAppMessage,
  WHATSAPP_VARIABLES,
  whatsAppUrl,
} from "@/lib/chatbots/whatsapp";
import { embedSnippet, initials, slugify } from "@/lib/format";
import { IconChevronDown, IconCheck, IconCopy, IconExternal, IconX } from "./icons";

const STATUS_ORDER: ChatbotStatus[] = ["active", "paused", "draft", "error"];

const ACCENT_LABELS: Record<AccentKey, string> = {
  indigo: "Índigo",
  violet: "Violeta",
  sky: "Azul",
  emerald: "Verde",
  amber: "Âmbar",
  rose: "Rosa",
};

const SPECIALTY_SUGGESTIONS = [
  "Captação de pacientes — Dermatologia",
  "Agendamento — Clínica odontológica",
  "Captação de leads — Imobiliária",
  "Atendimento — Advocacia",
];

const STEPS = [
  {
    title: "Sobre o bot",
    description: "Conte para quem é o chatbot. Sem termos técnicos.",
  },
  {
    title: "Conversa",
    description: "Escolha o modelo e veja como o visitante vai ser atendido.",
  },
  {
    title: "WhatsApp",
    description: "Opcional: leve o visitante para continuar no WhatsApp.",
  },
  {
    title: "Aparência",
    description: "Escolha a cor e veja como o bot aparece no painel.",
  },
  {
    title: "Revisar e criar",
    description: "Confira tudo antes de criar. Dá para voltar e ajustar.",
  },
] as const;

const STEP_FIELDS: ReadonlyArray<ReadonlyArray<ChatbotField>> = [
  ["name", "clientName", "specialty"],
  ["flowTemplateId", "flowCollectFields"],
  ["whatsappPhoneNumber", "whatsappMessageTemplate"],
  [],
  ["gaMeasurementId", "metaPixelId", "apiBaseUrl", "appBaseUrl", "scriptPath"],
];

export function ChatbotForm({
  onClose,
  onCreate,
  initialBot,
  onUpdate,
}: {
  onClose: () => void;
  /** Builds and persists the bot; returns it so the success screen can show the embed code. */
  onCreate: (input: ChatbotInput) => Chatbot;
  /** When set, the form opens in edit mode with fields pre-filled. */
  initialBot?: Chatbot;
  /** Persists edits; keeps the bot id unchanged. */
  onUpdate?: (input: ChatbotInput) => Chatbot;
}) {
  const isEditing = Boolean(initialBot);
  const seed = initialBot ? chatbotToInput(initialBot) : null;

  const [step, setStep] = useState(0);
  const [createdBot, setCreatedBot] = useState<Chatbot | null>(null);
  const [copied, setCopied] = useState(false);

  const [name, setName] = useState(seed?.name ?? "");
  const [clientName, setClientName] = useState(seed?.clientName ?? "");
  const [specialty, setSpecialty] = useState(seed?.specialty ?? "");
  const [status, setStatus] = useState<ChatbotStatus>(seed?.status ?? "active");
  const [accent, setAccent] = useState<AccentKey>(seed?.accent ?? "indigo");
  const [apiBaseUrl, setApiBaseUrl] = useState(
    seed?.apiBaseUrl ?? DEFAULT_EMBED.apiBaseUrl,
  );
  const [appBaseUrl, setAppBaseUrl] = useState(
    seed?.appBaseUrl ?? DEFAULT_EMBED.appBaseUrl,
  );
  const [scriptPath, setScriptPath] = useState(
    seed?.scriptPath ?? DEFAULT_EMBED.scriptPath,
  );
  const [flowTemplateId, setFlowTemplateId] = useState<FlowTemplateId>(
    seed?.flowTemplateId ?? "patient-capture",
  );
  const [flowTone, setFlowTone] = useState<FlowTone>(seed?.flowTone ?? "friendly");
  const [flowGreeting, setFlowGreeting] = useState(seed?.flowGreeting ?? "");
  const [flowCollectFields, setFlowCollectFields] = useState<FlowFieldKey[]>(
    () =>
      seed?.flowCollectFields
        ? [...seed.flowCollectFields]
        : [...FLOW_TEMPLATES["patient-capture"].defaultCollectFields],
  );
  const [gaMeasurementId, setGaMeasurementId] = useState(
    seed?.gaMeasurementId ?? "",
  );
  const [metaPixelId, setMetaPixelId] = useState(seed?.metaPixelId ?? "");
  const [whatsappEnabled, setWhatsappEnabled] = useState(
    seed?.whatsappEnabled ?? false,
  );
  const [whatsappPhoneNumber, setWhatsappPhoneNumber] = useState(
    seed?.whatsappPhoneNumber ?? "",
  );
  const [whatsappMessageTemplate, setWhatsappMessageTemplate] = useState(
    seed?.whatsappMessageTemplate ?? DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
  );
  const [showTracking, setShowTracking] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<ChatbotFieldErrors>({});

  const titleId = useId();
  const descId = useId();
  const formId = useId();
  const advancedId = useId();
  const trackingId = useId();
  const lastSyncedSpecialty = useRef(seed?.specialty.trim() ?? "");

  const dialogRef = useRef<HTMLDivElement>(null);
  const whatsappMessageRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Focus returns to the trigger ("Novo chatbot") when the dialog unmounts.
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    function focusableElements(): HTMLElement[] {
      const dialog = dialogRef.current;
      if (!dialog) return [];
      return [
        ...dialog.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => !el.hasAttribute("disabled"));
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = focusableElements();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus();
    };
  }, [onClose]);

  function currentInput(): ChatbotInput {
    return {
      name,
      clientName,
      specialty,
      status,
      accent,
      flowTemplateId,
      flowTone,
      flowGreeting,
      flowCollectFields,
      gaMeasurementId,
      metaPixelId,
      whatsappEnabled,
      whatsappPhoneNumber,
      whatsappMessageTemplate,
      apiBaseUrl,
      appBaseUrl,
      scriptPath,
    };
  }

  function toggleWhatsappEnabled(next: boolean) {
    setWhatsappEnabled(next);
    clearFieldError("whatsappPhoneNumber");
    clearFieldError("whatsappMessageTemplate");
    if (next && !whatsappMessageTemplate.trim()) {
      setWhatsappMessageTemplate(DEFAULT_WHATSAPP_MESSAGE_TEMPLATE);
    }
  }

  function insertWhatsAppVariable(token: string) {
    const field = whatsappMessageRef.current;
    const insertion = `{${token}}`;
    if (!field) {
      setWhatsappMessageTemplate((prev) => `${prev}${prev.endsWith("\n") || !prev ? "" : " "}${insertion}`);
      return;
    }
    const start = field.selectionStart ?? whatsappMessageTemplate.length;
    const end = field.selectionEnd ?? start;
    const next =
      whatsappMessageTemplate.slice(0, start) +
      insertion +
      whatsappMessageTemplate.slice(end);
    setWhatsappMessageTemplate(next);
    clearFieldError("whatsappMessageTemplate");
    requestAnimationFrame(() => {
      field.focus();
      const cursor = start + insertion.length;
      field.setSelectionRange(cursor, cursor);
    });
  }

  function syncFlowFromSpecialty(nextSpecialty: string) {
    const suggested = suggestTemplateForSpecialty(nextSpecialty);
    const template = FLOW_TEMPLATES[suggested];
    setFlowTemplateId(suggested);
    setFlowCollectFields([...template.defaultCollectFields]);
    setFlowGreeting("");
    lastSyncedSpecialty.current = nextSpecialty.trim();
  }

  function selectFlowTemplate(id: FlowTemplateId) {
    const template = FLOW_TEMPLATES[id];
    setFlowTemplateId(id);
    setFlowCollectFields([...template.defaultCollectFields]);
    setFlowGreeting("");
    clearFieldError("flowTemplateId");
  }

  function toggleCollectField(field: FlowFieldKey) {
    setFlowCollectFields((prev) => {
      if (prev.includes(field)) {
        if (prev.length <= 1) return prev;
        return prev.filter((item) => item !== field);
      }
      return [...prev, field];
    });
    clearFieldError("flowCollectFields");
  }

  function clearFieldError(field: ChatbotField) {
    if (!fieldErrors[field]) return;
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  /** Errors limited to the fields owned by the given step. */
  function stepErrors(target: number): ChatbotFieldErrors | null {
    const all = validateChatbotInput(currentInput());
    if (!all) return null;
    const scoped: ChatbotFieldErrors = {};
    for (const field of STEP_FIELDS[target]) {
      if (all[field]) scoped[field] = all[field];
    }
    return Object.keys(scoped).length > 0 ? scoped : null;
  }

  function focusFirstInvalid() {
    // After React re-renders (the advanced section may only mount now).
    requestAnimationFrame(() => {
      dialogRef.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
    });
  }

  function goToStep(target: number) {
    setFieldErrors({});
    setStep(target);
    requestAnimationFrame(() => {
      dialogRef.current
        ?.querySelector<HTMLElement>("input, select, button:not([disabled])")
        ?.focus();
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const errors = stepErrors(step);
    if (errors) {
      setFieldErrors(errors);
      if (errors.apiBaseUrl || errors.appBaseUrl || errors.scriptPath) {
        setShowAdvanced(true);
      }
      if (errors.gaMeasurementId || errors.metaPixelId) {
        setShowTracking(true);
      }
      focusFirstInvalid();
      return;
    }
    if (step < STEPS.length - 1) {
      if (step === 0 && specialty.trim() !== lastSyncedSpecialty.current) {
        syncFlowFromSpecialty(specialty);
      }
      goToStep(step + 1);
      return;
    }
    if (isEditing && onUpdate) {
      setCreatedBot(onUpdate(currentInput()));
    } else {
      setCreatedBot(onCreate(currentInput()));
    }
  }

  async function copySnippet(bot: Chatbot) {
    try {
      await navigator.clipboard.writeText(embedSnippet(bot));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be blocked (insecure context / permissions); fail quietly.
    }
  }

  const derivedId = slugify(name) || "chatbot";
  const isLastStep = step === STEPS.length - 1;
  const flowPreview = buildFlowPreview(
    {
      templateId: flowTemplateId,
      tone: flowTone,
      greeting: flowGreeting,
      collectFields: flowCollectFields,
    },
    { botName: name, clientName },
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative z-10 flex max-h-[min(94vh,820px)] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200/70 bg-white/95 shadow-2xl backdrop-blur-xl dark:border-zinc-800/70 dark:bg-zinc-900/90 sm:rounded-2xl"
      >
        <header className="shrink-0 border-b border-zinc-200/70 px-6 py-5 dark:border-zinc-800/70">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 pr-2">
              <h2
                id={titleId}
                className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
              >
                {createdBot
                  ? isEditing
                    ? "Alterações salvas!"
                    : "Chatbot criado!"
                  : isEditing
                    ? "Editar chatbot"
                    : "Novo chatbot"}
              </h2>
              <p
                id={descId}
                className="mt-1.5 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400"
              >
                {createdBot
                  ? isEditing
                    ? "As mudanças já estão na sua lista."
                    : "Agora é só instalar no site do cliente."
                  : STEPS[step].description}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="flex size-10 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <IconX className="size-4" />
            </button>
          </div>

          {!createdBot ? (
            <ol
              aria-label="Etapas do cadastro"
              className="mt-4 flex items-center gap-1.5"
            >
              {STEPS.map((s, index) => {
                const isCurrent = index === step;
                const isDone = index < step;
                return (
                  <li
                    key={s.title}
                    aria-current={isCurrent ? "step" : undefined}
                    className={`flex min-w-0 items-center gap-2 ${isCurrent ? "flex-1" : "shrink-0"}`}
                  >
                    <span
                      className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                        isDone || isCurrent
                          ? "bg-cyan-500 text-teal-950 dark:bg-cyan-400"
                          : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
                      }`}
                    >
                      {isDone ? <IconCheck className="size-4" /> : index + 1}
                    </span>
                    <span
                      className={`truncate text-sm ${
                        isCurrent
                          ? "font-semibold text-zinc-900 dark:text-zinc-100"
                          : "hidden font-medium text-zinc-400 dark:text-zinc-500 sm:inline"
                      }`}
                    >
                      {s.title}
                    </span>
                    {index < STEPS.length - 1 ? (
                      <span
                        aria-hidden
                        className={`hidden h-px flex-1 sm:block ${
                          isDone ? "bg-cyan-400/60" : "bg-zinc-200 dark:bg-zinc-800"
                        }`}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ol>
          ) : null}
        </header>

        {createdBot ? (
          <SuccessScreen
            bot={createdBot}
            copied={copied}
            onCopy={() => copySnippet(createdBot)}
            onDone={onClose}
            isEditing={isEditing}
          />
        ) : (
          <form
            id={formId}
            onSubmit={handleSubmit}
            noValidate
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              {step === 0 ? (
                <>
                  <Field
                    label="Nome do chatbot"
                    required
                    hint={
                      isEditing
                        ? `endereço: ${initialBot!.id}`
                        : name.trim()
                          ? `endereço: ${derivedId}`
                          : undefined
                    }
                    error={fieldErrors.name}
                    htmlFor={`${formId}-name`}
                  >
                    <input
                      id={`${formId}-name`}
                      autoFocus
                      required
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        clearFieldError("name");
                      }}
                      placeholder="Ex.: Dra. Renata Reis"
                      aria-invalid={Boolean(fieldErrors.name)}
                      aria-describedby={
                        fieldErrors.name ? `${formId}-name-error` : undefined
                      }
                      className={inputClass(Boolean(fieldErrors.name))}
                    />
                  </Field>

                  <Field
                    label="Cliente"
                    required
                    error={fieldErrors.clientName}
                    htmlFor={`${formId}-client`}
                  >
                    <input
                      id={`${formId}-client`}
                      required
                      value={clientName}
                      onChange={(e) => {
                        setClientName(e.target.value);
                        clearFieldError("clientName");
                      }}
                      placeholder="Ex.: Clínica Renata Reis"
                      aria-invalid={Boolean(fieldErrors.clientName)}
                      aria-describedby={
                        fieldErrors.clientName
                          ? `${formId}-client-error`
                          : undefined
                      }
                      className={inputClass(Boolean(fieldErrors.clientName))}
                    />
                  </Field>

                  <Field
                    label="O que o bot faz?"
                    required
                    error={fieldErrors.specialty}
                    htmlFor={`${formId}-specialty`}
                  >
                    <input
                      id={`${formId}-specialty`}
                      required
                      value={specialty}
                      onChange={(e) => {
                        setSpecialty(e.target.value);
                        clearFieldError("specialty");
                      }}
                      placeholder="Ex.: Captação de pacientes — Dermatologia"
                      aria-invalid={Boolean(fieldErrors.specialty)}
                      aria-describedby={
                        fieldErrors.specialty
                          ? `${formId}-specialty-error`
                          : undefined
                      }
                      className={inputClass(Boolean(fieldErrors.specialty))}
                    />
                  </Field>

                  <div className="space-y-1.5">
                    <span className="block text-xs font-medium text-zinc-400 dark:text-zinc-500">
                      Sugestões — toque para usar
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {SPECIALTY_SUGGESTIONS.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => {
                            setSpecialty(suggestion);
                            clearFieldError("specialty");
                            syncFlowFromSpecialty(suggestion);
                          }}
                          className="rounded-full border border-zinc-200 bg-white/70 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:border-indigo-400 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300 dark:hover:border-indigo-600 dark:hover:text-indigo-300"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}

              {step === 1 ? (
                <>
                  <div className="space-y-2">
                    <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                      Modelo de conversa
                    </span>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {FLOW_TEMPLATE_ORDER.map((id) => {
                        const template = FLOW_TEMPLATES[id];
                        const selected = id === flowTemplateId;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => selectFlowTemplate(id)}
                            aria-pressed={selected}
                            className={`rounded-xl border px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 ${
                              selected
                                ? "border-indigo-400 bg-indigo-50/80 dark:border-indigo-600 dark:bg-indigo-950/40"
                                : "border-zinc-200 bg-white/70 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700"
                            }`}
                          >
                            <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {template.label}
                            </span>
                            <span className="mt-1 block text-xs leading-snug text-zinc-500 dark:text-zinc-400">
                              {template.description}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {fieldErrors.flowTemplateId ? (
                      <p className="text-xs text-rose-600 dark:text-rose-400">
                        {fieldErrors.flowTemplateId}
                      </p>
                    ) : null}
                  </div>

                  <div
                    role="group"
                    aria-label="Tom da conversa"
                    className="space-y-2"
                  >
                    <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                      Tom da conversa
                    </span>
                    <div className="flex gap-2">
                      {(["friendly", "formal"] as const).map((tone) => (
                        <button
                          key={tone}
                          type="button"
                          onClick={() => setFlowTone(tone)}
                          aria-pressed={flowTone === tone}
                          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 ${
                            flowTone === tone
                              ? "border-indigo-400 bg-indigo-50 text-indigo-800 dark:border-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-200"
                              : "border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700"
                          }`}
                        >
                          {FLOW_TONE_LABELS[tone]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Field
                    label="Mensagem de boas-vindas"
                    hint="opcional"
                    htmlFor={`${formId}-greeting`}
                  >
                    <textarea
                      id={`${formId}-greeting`}
                      value={flowGreeting}
                      onChange={(e) => setFlowGreeting(e.target.value)}
                      rows={2}
                      placeholder={
                        FLOW_TEMPLATES[flowTemplateId].defaultGreeting
                          .replace("{botName}", name.trim() || "assistente")
                          .replace(
                            "{clientName}",
                            clientName.trim() || "nossa equipe",
                          )
                      }
                      className={`${inputClass(false)} resize-none`}
                    />
                  </Field>

                  <div className="space-y-2">
                    <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                      O que o bot vai pedir ao visitante
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {(["name", "phone", "email"] as const).map((field) => {
                        const checked = flowCollectFields.includes(field);
                        return (
                          <button
                            key={field}
                            type="button"
                            onClick={() => toggleCollectField(field)}
                            aria-pressed={checked}
                            className={`rounded-full border px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 ${
                              checked
                                ? "border-indigo-400 bg-indigo-50 text-indigo-800 dark:border-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-200"
                                : "border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
                            }`}
                          >
                            {FLOW_FIELD_LABELS[field]}
                          </button>
                        );
                      })}
                    </div>
                    {fieldErrors.flowCollectFields ? (
                      <p className="text-xs text-rose-600 dark:text-rose-400">
                        {fieldErrors.flowCollectFields}
                      </p>
                    ) : null}
                  </div>

                  <FlowPreview messages={flowPreview} botName={name} />
                </>
              ) : null}

              {step === 2 ? (
                <>
                  <div className="rounded-xl border border-zinc-200/70 bg-zinc-50/60 px-4 py-3 text-sm leading-relaxed text-zinc-600 dark:border-zinc-800/70 dark:bg-zinc-950/40 dark:text-zinc-300">
                    Depois que o visitante preenche os dados no chat, muitos
                    clientes preferem continuar no WhatsApp. Ative abaixo para
                    mostrar um botão que abre o WhatsApp com uma mensagem já
                    preenchida — usando nome, telefone, e-mail e assunto
                    coletados no chat.
                  </div>

                  <div
                    role="group"
                    aria-label="Enviar para WhatsApp"
                    className="space-y-2"
                  >
                    <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                      Continuar no WhatsApp
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => toggleWhatsappEnabled(false)}
                        aria-pressed={!whatsappEnabled}
                        className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/45 ${
                          !whatsappEnabled
                            ? "border-cyan-500/60 bg-cyan-50 text-teal-900 dark:border-cyan-500/50 dark:bg-cyan-950/40 dark:text-cyan-100"
                            : "border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700"
                        }`}
                      >
                        Desativado
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleWhatsappEnabled(true)}
                        aria-pressed={whatsappEnabled}
                        className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/45 ${
                          whatsappEnabled
                            ? "border-cyan-500/60 bg-cyan-50 text-teal-900 dark:border-cyan-500/50 dark:bg-cyan-950/40 dark:text-cyan-100"
                            : "border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700"
                        }`}
                      >
                        Ativado
                      </button>
                    </div>
                  </div>

                  {whatsappEnabled ? (
                    <>
                      <Field
                        label="Número do WhatsApp"
                        required
                        hint="Com DDI do país, ex.: +55 11 99999-0000"
                        error={fieldErrors.whatsappPhoneNumber}
                        htmlFor={`${formId}-whatsapp-phone`}
                      >
                        <input
                          id={`${formId}-whatsapp-phone`}
                          type="tel"
                          autoComplete="tel"
                          value={whatsappPhoneNumber}
                          onChange={(e) => {
                            setWhatsappPhoneNumber(e.target.value);
                            clearFieldError("whatsappPhoneNumber");
                          }}
                          placeholder="+55 11 99999-0000"
                          aria-invalid={Boolean(fieldErrors.whatsappPhoneNumber)}
                          className={inputClass(
                            Boolean(fieldErrors.whatsappPhoneNumber),
                          )}
                        />
                      </Field>

                      <div className="space-y-2">
                        <Field
                          label="Mensagem ao abrir o WhatsApp"
                          required
                          hint="Use as variáveis abaixo — elas serão trocadas pelos dados reais do visitante"
                          error={fieldErrors.whatsappMessageTemplate}
                          htmlFor={`${formId}-whatsapp-message`}
                        >
                          <textarea
                            ref={whatsappMessageRef}
                            id={`${formId}-whatsapp-message`}
                            value={whatsappMessageTemplate}
                            onChange={(e) => {
                              setWhatsappMessageTemplate(e.target.value);
                              clearFieldError("whatsappMessageTemplate");
                            }}
                            rows={7}
                            aria-invalid={Boolean(
                              fieldErrors.whatsappMessageTemplate,
                            )}
                            className={`${inputClass(Boolean(fieldErrors.whatsappMessageTemplate))} resize-y font-mono text-xs leading-relaxed`}
                          />
                        </Field>

                        <div className="rounded-xl border border-zinc-200/70 bg-white/70 p-3 dark:border-zinc-800/70 dark:bg-zinc-900/50">
                          <p className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                            Variáveis disponíveis
                          </p>
                          <p className="mt-1 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                            Clique para inserir na mensagem. A variável{" "}
                            <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[10px] dark:bg-zinc-800">
                              {"{bot}"}
                            </code>{" "}
                            vira o nome do chatbot ({name.trim() || "assistente"}
                            ). As demais vêm dos dados que o visitante informar.
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {WHATSAPP_VARIABLES.map((variable) => (
                              <button
                                key={variable.token}
                                type="button"
                                onClick={() =>
                                  insertWhatsAppVariable(variable.token)
                                }
                                title={variable.description}
                                className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 font-mono text-[11px] text-zinc-700 transition-colors hover:border-cyan-500 hover:ring-1 hover:ring-cyan-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/45 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-200 dark:hover:border-cyan-500"
                              >
                                {variable.key}
                              </button>
                            ))}
                          </div>
                          <ul className="mt-2.5 space-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                            {WHATSAPP_VARIABLES.map((variable) => (
                              <li key={`${variable.token}-desc`}>
                                <span className="font-mono text-zinc-600 dark:text-zinc-300">
                                  {variable.key}
                                </span>{" "}
                                — {variable.description}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <WhatsAppPreview
                        phone={whatsappPhoneNumber}
                        message={previewWhatsAppMessage(
                          whatsappMessageTemplate,
                          name,
                        )}
                      />
                    </>
                  ) : (
                    <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                      Com o WhatsApp desativado, o visitante termina o fluxo
                      apenas no chatbot. Você pode ativar depois editando o bot.
                    </p>
                  )}
                </>
              ) : null}

              {step === 3 ? (
                <>
                  <BotPreview
                    name={name}
                    specialty={specialty}
                    accent={accent}
                    derivedId={derivedId}
                  />

                  <div
                    role="group"
                    aria-label="Cor de identificação"
                    className="space-y-2"
                  >
                    <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                      Cor de identificação
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {ACCENT_ORDER.map((key) => {
                        const selected = key === accent;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setAccent(key)}
                            aria-label={ACCENT_LABELS[key]}
                            aria-pressed={selected}
                            title={ACCENT_LABELS[key]}
                            className={`flex size-11 items-center justify-center rounded-full transition-[transform,box-shadow] duration-150 motion-safe:hover:scale-105 motion-reduce:transition-none ${ACCENTS[key].avatar} ${
                              selected
                                ? "ring-2 ring-zinc-900 ring-offset-2 ring-offset-zinc-50 dark:ring-zinc-100 dark:ring-offset-zinc-900"
                                : "opacity-90 hover:opacity-100"
                            }`}
                          >
                            {selected ? (
                              <IconCheck className="size-4 text-white" />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <Field label="Situação do bot" htmlFor={`${formId}-status`}>
                    <div className="relative">
                      <select
                        id={`${formId}-status`}
                        value={status}
                        onChange={(e) =>
                          setStatus(e.target.value as ChatbotStatus)
                        }
                        className={`${inputClass(false)} appearance-none pr-9`}
                      >
                        {STATUS_ORDER.map((key) => (
                          <option key={key} value={key}>
                            {BOT_STATUS[key].label}
                          </option>
                        ))}
                      </select>
                      <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
                    </div>
                  </Field>
                </>
              ) : null}

              {step === 4 ? (
                <>
                  <dl className="space-y-2.5 rounded-xl border border-zinc-200/60 bg-zinc-50/50 p-4 text-sm dark:border-zinc-800/60 dark:bg-zinc-950/30">
                    <ReviewRow label="Chatbot" value={name.trim()} />
                    <ReviewRow label="Cliente" value={clientName.trim()} />
                    <ReviewRow label="Função" value={specialty.trim()} />
                    <ReviewRow
                      label="Conversa"
                      value={FLOW_TEMPLATES[flowTemplateId].label}
                    />
                    <ReviewRow
                      label="Tom"
                      value={FLOW_TONE_LABELS[flowTone]}
                    />
                    <ReviewRow
                      label="Coleta"
                      value={flowCollectFields
                        .map((f) => FLOW_FIELD_LABELS[f])
                        .join(", ")}
                    />
                    <ReviewRow
                      label="WhatsApp"
                      value={
                        whatsappEnabled
                          ? whatsappPhoneNumber.trim()
                            ? whatsappPhoneNumber.trim()
                            : "Ativado (número pendente)"
                          : "Desativado"
                      }
                    />
                    <ReviewRow
                      label="Situação"
                      value={BOT_STATUS[status].label}
                    />
                    <div className="flex items-center justify-between gap-3">
                      <dt className="shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        Cor
                      </dt>
                      <dd className="flex items-center gap-1.5 text-zinc-900 dark:text-zinc-100">
                        <span
                          className={`size-3 rounded-full ${ACCENTS[accent].dot}`}
                        />
                        {ACCENT_LABELS[accent]}
                      </dd>
                    </div>
                    <ReviewRow label="Endereço" value={derivedId} mono />
                  </dl>

                  <div className="overflow-hidden rounded-xl border border-zinc-200/70 dark:border-zinc-800/70">
                    <button
                      type="button"
                      onClick={() => setShowTracking((open) => !open)}
                      aria-expanded={showTracking}
                      aria-controls={trackingId}
                      className="flex min-h-11 w-full items-center justify-between gap-2 px-3.5 py-3 text-left text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/30 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
                    >
                      <span>Google Analytics e Meta Ads</span>
                      <span className="flex items-center gap-2 text-[11px] font-normal text-zinc-400">
                        {showTracking
                          ? "Ocultar"
                          : gaMeasurementId.trim() || metaPixelId.trim()
                            ? "Configurado"
                            : "Opcional — rastrear origem dos leads"}
                        <IconChevronDown
                          className={`size-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${showTracking ? "rotate-180" : ""}`}
                        />
                      </span>
                    </button>

                    {showTracking ? (
                      <fieldset
                        id={trackingId}
                        className="space-y-4 border-t border-zinc-200/70 px-3.5 pb-3.5 pt-3 dark:border-zinc-800/70"
                      >
                        <legend className="sr-only">
                          Rastreamento de origem
                        </legend>
                        <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                          IDs usados no site do cliente para identificar se o
                          lead veio do Google, Meta ou campanhas pagas. Deixe
                          em branco se ainda não tiver.
                        </p>
                        <Field
                          label="Google Analytics (GA4)"
                          hint="G-XXXXXXXXXX"
                          error={fieldErrors.gaMeasurementId}
                          htmlFor={`${formId}-ga-id`}
                        >
                          <input
                            id={`${formId}-ga-id`}
                            value={gaMeasurementId}
                            onChange={(e) => {
                              setGaMeasurementId(e.target.value);
                              clearFieldError("gaMeasurementId");
                            }}
                            placeholder="G-XXXXXXXXXX"
                            spellCheck={false}
                            aria-invalid={Boolean(fieldErrors.gaMeasurementId)}
                            className={`${inputClass(Boolean(fieldErrors.gaMeasurementId))} font-mono text-xs`}
                          />
                        </Field>
                        <Field
                          label="Meta Pixel ID"
                          error={fieldErrors.metaPixelId}
                          htmlFor={`${formId}-meta-pixel`}
                        >
                          <input
                            id={`${formId}-meta-pixel`}
                            value={metaPixelId}
                            onChange={(e) => {
                              setMetaPixelId(e.target.value);
                              clearFieldError("metaPixelId");
                            }}
                            placeholder="123456789012345"
                            inputMode="numeric"
                            spellCheck={false}
                            aria-invalid={Boolean(fieldErrors.metaPixelId)}
                            className={`${inputClass(Boolean(fieldErrors.metaPixelId))} font-mono text-xs`}
                          />
                        </Field>
                      </fieldset>
                    ) : null}
                  </div>

                  <div className="overflow-hidden rounded-xl border border-zinc-200/70 dark:border-zinc-800/70">
                    <button
                      type="button"
                      onClick={() => setShowAdvanced((open) => !open)}
                      aria-expanded={showAdvanced}
                      aria-controls={advancedId}
                      className="flex min-h-11 w-full items-center justify-between gap-2 px-3.5 py-3 text-left text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/30 dark:text-zinc-300 dark:hover:bg-zinc-800/50"
                    >
                      <span>Configuração avançada</span>
                      <span className="flex items-center gap-2 text-[11px] font-normal text-zinc-400">
                        {showAdvanced ? "Ocultar" : "Você não precisa mexer aqui"}
                        <IconChevronDown
                          className={`size-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${showAdvanced ? "rotate-180" : ""}`}
                        />
                      </span>
                    </button>

                    {showAdvanced ? (
                      <fieldset
                        id={advancedId}
                        className="space-y-4 border-t border-zinc-200/70 px-3.5 pb-3.5 pt-3 dark:border-zinc-800/70"
                      >
                        <legend className="sr-only">
                          Configuração de incorporação
                        </legend>
                        <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                          Endereços técnicos do widget. Só altere se a equipe
                          indicar outro ambiente.
                        </p>
                        <Field
                          label="API base URL"
                          error={fieldErrors.apiBaseUrl}
                          htmlFor={`${formId}-api`}
                        >
                          <input
                            id={`${formId}-api`}
                            value={apiBaseUrl}
                            onChange={(e) => {
                              setApiBaseUrl(e.target.value);
                              clearFieldError("apiBaseUrl");
                            }}
                            placeholder={DEFAULT_EMBED.apiBaseUrl}
                            spellCheck={false}
                            aria-invalid={Boolean(fieldErrors.apiBaseUrl)}
                            className={`${inputClass(Boolean(fieldErrors.apiBaseUrl))} font-mono text-xs`}
                          />
                        </Field>
                        <Field
                          label="App base URL"
                          error={fieldErrors.appBaseUrl}
                          htmlFor={`${formId}-app`}
                        >
                          <input
                            id={`${formId}-app`}
                            value={appBaseUrl}
                            onChange={(e) => {
                              setAppBaseUrl(e.target.value);
                              clearFieldError("appBaseUrl");
                            }}
                            placeholder={DEFAULT_EMBED.appBaseUrl}
                            spellCheck={false}
                            aria-invalid={Boolean(fieldErrors.appBaseUrl)}
                            className={`${inputClass(Boolean(fieldErrors.appBaseUrl))} font-mono text-xs`}
                          />
                        </Field>
                        <Field
                          label="Caminho do script"
                          error={fieldErrors.scriptPath}
                          htmlFor={`${formId}-script`}
                        >
                          <input
                            id={`${formId}-script`}
                            value={scriptPath}
                            onChange={(e) => {
                              setScriptPath(e.target.value);
                              clearFieldError("scriptPath");
                            }}
                            placeholder={DEFAULT_EMBED.scriptPath}
                            spellCheck={false}
                            aria-invalid={Boolean(fieldErrors.scriptPath)}
                            className={`${inputClass(Boolean(fieldErrors.scriptPath))} font-mono text-xs`}
                          />
                        </Field>
                      </fieldset>
                    ) : null}
                  </div>
                </>
              ) : null}

              {Object.keys(fieldErrors).length > 0 ? (
                <p
                  role="alert"
                  className="rounded-lg border border-rose-200/80 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  Corrija os campos destacados antes de continuar.
                </p>
              ) : null}
            </div>

            <footer className="sticky bottom-0 flex shrink-0 items-center justify-between gap-2 border-t border-zinc-200/70 bg-white/95 px-5 py-3.5 backdrop-blur-xl dark:border-zinc-800/70 dark:bg-zinc-900/95">
              <div>
                {step > 0 ? (
                  <button
                    type="button"
                    onClick={() => goToStep(step - 1)}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/30 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Voltar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/30 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Cancelar
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="btn-brand px-4 py-2"
              >
                {isLastStep
                  ? isEditing
                    ? "Salvar alterações"
                    : "Criar chatbot"
                  : "Continuar"}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
}

function SuccessScreen({
  bot,
  copied,
  onCopy,
  onDone,
  isEditing = false,
}: {
  bot: Chatbot;
  copied: boolean;
  onCopy: () => void;
  onDone: () => void;
  isEditing?: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
            <IconCheck className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
              {isEditing ? `${bot.name} foi atualizado` : `${bot.name} está pronto`}
            </p>
            <p className="text-xs text-emerald-800 dark:text-emerald-300">
              {isEditing
                ? "O endereço do bot permanece o mesmo — não precisa reinstalar."
                : "O bot já aparece na sua lista de chatbots."}
            </p>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Código de instalação
            </span>
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              {copied ? (
                <>
                  <IconCheck className="size-3.5 text-emerald-500" />
                  Copiado
                </>
              ) : (
                <>
                  <IconCopy className="size-3.5" />
                  Copiar
                </>
              )}
            </button>
          </div>
          <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-[11px] leading-relaxed text-zinc-200">
            <code className="whitespace-pre font-mono">{embedSnippet(bot)}</code>
          </pre>
        </div>

        <ol className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
          <li className="flex gap-2.5">
            <StepNumber>1</StepNumber>
            Copie o código acima.
          </li>
          <li className="flex gap-2.5">
            <StepNumber>2</StepNumber>
            <span>
              Cole no site do cliente, antes da tag{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[11px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                &lt;/body&gt;
              </code>
              . Quem cuida do site sabe onde fica.
            </span>
          </li>
          <li className="flex gap-2.5">
            <StepNumber>3</StepNumber>
            Pronto — o chatbot aparece no site e os leads chegam aqui no painel.
          </li>
        </ol>
      </div>

      <footer className="sticky bottom-0 flex shrink-0 items-center justify-end gap-2 border-t border-zinc-200/70 bg-white/95 px-5 py-3.5 backdrop-blur-xl dark:border-zinc-800/70 dark:bg-zinc-900/95">
        <button
          type="button"
          onClick={onDone}
          className="btn-brand px-4 py-2"
        >
          Concluir
        </button>
      </footer>
    </div>
  );
}

function StepNumber({ children }: { children: ReactNode }) {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
      {children}
    </span>
  );
}

function WhatsAppPreview({
  phone,
  message,
}: {
  phone: string;
  message: string;
}) {
  const digits = phone.replace(/\D/g, "");
  const href =
    digits.length >= 10 ? whatsAppUrl(digits, message) : undefined;

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200/70 dark:border-zinc-800/70">
      <div className="border-b border-zinc-200/70 bg-zinc-50/80 px-3.5 py-2 dark:border-zinc-800/70 dark:bg-zinc-950/40">
        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
          Prévia no site do visitante
        </p>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          Exemplo com dados fictícios — no site entram os dados reais do lead
        </p>
      </div>
      <div className="space-y-3 p-3.5">
        <button
          type="button"
          disabled
          className="w-full rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white opacity-95"
        >
          Continuar no WhatsApp
        </button>
        <pre className="whitespace-pre-wrap rounded-lg border border-zinc-200/70 bg-white/80 p-3 text-[11px] leading-relaxed text-zinc-700 dark:border-zinc-800/70 dark:bg-zinc-900/60 dark:text-zinc-200">
          {message}
        </pre>
        {href ? (
          <div className="space-y-1.5">
            <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              Teste agora: abre o WhatsApp com esta mensagem preenchida, como o
              visitante verá depois de conversar com o bot.
            </p>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-600/30 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/60"
            >
              Testar conversa no WhatsApp
              <IconExternal className="size-3.5 shrink-0 opacity-80" />
            </a>
          </div>
        ) : (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Informe um número válido com DDI e DDD para testar a conversa.
          </p>
        )}
      </div>
    </div>
  );
}

function FlowPreview({
  messages,
  botName,
}: {
  messages: ReturnType<typeof buildFlowPreview>;
  botName: string;
}) {
  const display = botName.trim() || "Assistente";
  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
        Prévia da conversa no site
      </span>
      <div
        aria-label="Prévia da conversa"
        className="space-y-2 rounded-xl border border-zinc-200/70 bg-zinc-50/80 p-3 dark:border-zinc-800/70 dark:bg-zinc-950/40"
      >
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`flex ${message.role === "visitor" ? "justify-end" : "justify-start"}`}
          >
            <p
              className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                message.role === "bot"
                  ? "rounded-bl-md bg-white text-zinc-800 ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700/80"
                  : "rounded-br-md bg-indigo-600 text-white"
              }`}
            >
              {message.role === "bot" && index === 0 ? (
                <span className="mb-0.5 block text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                  {display}
                </span>
              ) : null}
              {message.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function BotPreview({
  name,
  specialty,
  accent,
  derivedId,
}: {
  name: string;
  specialty: string;
  accent: AccentKey;
  derivedId: string;
}) {
  const display = name.trim() || "Seu chatbot";
  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
        Como vai aparecer no painel
      </span>
      <div className="flex items-center gap-3 rounded-xl border border-zinc-200/70 bg-white px-3 py-3 dark:border-zinc-800/70 dark:bg-zinc-900/60">
        <span
          className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${ACCENTS[accent].avatar}`}
        >
          {initials(display)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {display}
          </p>
          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
            {specialty.trim() || "Função do bot"} ·{" "}
            <span className="font-mono text-[11px]">{derivedId}</span>
          </p>
        </div>
        <span
          className={`ml-auto size-2 shrink-0 rounded-full ${ACCENTS[accent].dot}`}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

function ReviewRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="shrink-0 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </dt>
      <dd
        className={`min-w-0 truncate text-right text-zinc-900 dark:text-zinc-100 ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

function inputClass(hasError: boolean): string {
  const base =
    "w-full rounded-xl border bg-white/70 px-3.5 py-2.5 text-[15px] text-zinc-800 placeholder:text-zinc-400 transition-colors focus:outline-none focus-visible:ring-2 dark:bg-zinc-900/60 dark:text-zinc-100";
  if (hasError) {
    return `${base} border-rose-400 focus-visible:border-rose-500 focus-visible:ring-rose-500/25 dark:border-rose-500/70`;
  }
  return `${base} border-zinc-200 hover:border-zinc-300 focus-visible:border-indigo-500 focus-visible:ring-indigo-500/25 dark:border-zinc-800 dark:hover:border-zinc-700`;
}

function Field({
  label,
  required,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;

  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="block">
        <span className="flex items-center justify-between gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          <span>
            {label}
            {required ? (
              <span className="ml-0.5 text-rose-500" aria-hidden="true">
                *
              </span>
            ) : null}
          </span>
          {hint ? (
            <span className="truncate font-mono text-xs font-normal text-zinc-400">
              {hint}
            </span>
          ) : null}
        </span>
      </label>
      {children}
      {error ? (
        <p id={errorId} className="text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
