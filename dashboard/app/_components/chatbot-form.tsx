"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { AccentKey, Chatbot, ChatbotStatus } from "@/lib/chatbots/types";
import { ACCENTS, ACCENT_ORDER } from "@/lib/chatbots/accents";
import { BOT_STATUS } from "@/lib/labels";
import { DEFAULT_EMBED, chatbotToInput, type ChatbotInput } from "@/lib/chatbots/create";
import {
  buildFlowPreview,
  BUILTIN_SAVE_AS,
  createFlowId,
  FLOW_FIELD_LABELS,
  FLOW_INPUT_TYPE_LABELS,
  FLOW_MAPS_TO_LABELS,
  FLOW_SHAPE_GUIDE,
  FLOW_SHAPE_LABELS,
  FLOW_TEMPLATES,
  FLOW_TEMPLATE_ORDER,
  FLOW_TONE_LABELS,
  INSURANCE_MODE_LABELS,
  INSURANCE_MODE_ORDER,
  applyToneToDialogue,
  isBuiltinSaveAs,
  labelForSaveAs,
  MEDICAL_SPECIALTIES,
  resolveStepSaveAs,
  seedDialogueFromTemplate,
  slugifySaveAsKey,
  suggestTemplateForSpecialty,
  type DialogueFlow,
  type FlowFieldKey,
  type FlowInputType,
  type FlowMapsTo,
  type FlowShape,
  type FlowStep,
  type FlowStepOption,
  type FlowTemplateId,
  type FlowTone,
  type InsuranceMode,
} from "@/lib/chatbots/flows";
import {
  validateChatbotInput,
  type ChatbotField,
  type ChatbotFieldErrors,
} from "@/lib/chatbots/validate";
import {
  DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
  previewWhatsAppMessage,
  listWhatsAppVariables,
  whatsAppUrl,
} from "@/lib/chatbots/whatsapp";
import {
  DEFAULT_LAUNCHER,
  DEFAULT_LAUNCHER_TEASER,
  LAUNCHER_AVATAR_PRESETS,
  resolveLauncherAvatarPath,
} from "@/lib/chatbots/launcher";
import { embedSnippet, slugify } from "@/lib/format";
import {
  IconArrowLeft,
  IconChevronDown,
  IconCheck,
  IconCopy,
  IconExternal,
  IconX,
} from "./icons";
import { LauncherPreview } from "./launcher-preview";

const STATUS_ORDER: ChatbotStatus[] = ["active", "paused", "draft", "error"];

const ACCENT_LABELS: Record<AccentKey, string> = {
  indigo: "Índigo",
  violet: "Violeta",
  sky: "Azul",
  emerald: "Verde",
  amber: "Âmbar",
  rose: "Rosa",
};

const SPECIALTY_SUGGESTIONS = MEDICAL_SPECIALTIES;

const STEPS = [
  {
    title: "Sobre a clínica",
    shortTitle: "Clínica",
    description: "Nome do assistente, clínica e especialidade médica.",
  },
  {
    title: "Atendimento",
    shortTitle: "Atendimento",
    description:
      "Monte as perguntas do chat: texto livre ou opções, linear ou com ramificações.",
  },
  {
    title: "WhatsApp",
    shortTitle: "WhatsApp",
    description: "Opcional: leve o paciente para continuar no WhatsApp.",
  },
  {
    title: "Aparência",
    shortTitle: "Aparência",
    description:
      "Balão no site, foto, cor no painel e situação do bot.",
  },
  {
    title: "Revisar e criar",
    shortTitle: "Revisar",
    description: "Confira tudo antes de criar. Dá para voltar e ajustar.",
  },
] as const;

const STEP_FIELDS: ReadonlyArray<ReadonlyArray<ChatbotField>> = [
  ["name", "clientName", "specialty"],
  ["flowTemplateId", "flowCollectFields", "flowDialogue"],
  ["whatsappPhoneNumber", "whatsappMessageTemplate"],
  ["launcherTeaserTexts"],
  ["gaMeasurementId", "metaPixelId", "apiBaseUrl", "appBaseUrl", "scriptPath"],
];

const INPUT_TYPE_ORDER: FlowInputType[] = [
  "text",
  "single_choice",
  "multi_choice",
];

const SHAPE_GUIDE_STORAGE_KEY = "imagin:shape-guide-dismissed";

function readDismissedShapeGuides(): Set<FlowShape> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(SHAPE_GUIDE_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter(
        (value): value is FlowShape =>
          value === "linear" || value === "branching",
      ),
    );
  } catch {
    return new Set();
  }
}

function persistDismissedShapeGuide(shape: FlowShape) {
  if (typeof window === "undefined") return;
  const next = readDismissedShapeGuides();
  next.add(shape);
  window.localStorage.setItem(
    SHAPE_GUIDE_STORAGE_KEY,
    JSON.stringify([...next]),
  );
}

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
  const [flowServices, setFlowServices] = useState<string[]>(
    () =>
      seed?.flowServices && seed.flowServices.length > 0
        ? [...seed.flowServices]
        : [...FLOW_TEMPLATES["patient-capture"].defaultServices],
  );
  const [newService, setNewService] = useState("");
  const [flowInsuranceMode, setFlowInsuranceMode] = useState<InsuranceMode>(
    seed?.flowInsuranceMode ?? "both",
  );
  const [flowInsurances, setFlowInsurances] = useState<string[]>(
    () => (seed?.flowInsurances ? [...seed.flowInsurances] : []),
  );
  const [newInsurance, setNewInsurance] = useState("");
  /** New bots always get a dialogue; legacy edits keep undefined. */
  const [flowDialogue, setFlowDialogue] = useState<DialogueFlow | undefined>(
    () => {
      if (seed?.flowDialogue) {
        return structuredClone(seed.flowDialogue);
      }
      if (initialBot) return undefined;
      return seedDialogueFromTemplate("patient-capture");
    },
  );
  const isDialogueMode = flowDialogue !== undefined;
  const [shapeGuide, setShapeGuide] = useState<FlowShape | null>(null);
  const [dontShowShapeGuide, setDontShowShapeGuide] = useState(false);
  const [addingSaveAsForStep, setAddingSaveAsForStep] = useState<string | null>(
    null,
  );
  const [newSaveAsLabel, setNewSaveAsLabel] = useState("");
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
  const [launcherTeaserTexts, setLauncherTeaserTexts] = useState<string[]>(
    () =>
      seed?.launcherTeaserTexts?.length
        ? [...seed.launcherTeaserTexts]
        : [...DEFAULT_LAUNCHER.teaserTexts],
  );
  const [launcherAvatarUrl, setLauncherAvatarUrl] = useState<string | null>(
    seed?.launcherAvatarUrl ?? null,
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

  const pageRef = useRef<HTMLElement>(null);
  const whatsappMessageRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // Don't close the page while a nested guide dialog is open.
      if (shapeGuide) return;
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, shapeGuide]);

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
      flowServices,
      flowInsuranceMode,
      flowInsurances,
      flowDialogue: flowDialogue
        ? {
            ...flowDialogue,
            greeting: flowGreeting.trim() || flowDialogue.greeting,
          }
        : undefined,
      gaMeasurementId,
      metaPixelId,
      whatsappEnabled,
      whatsappPhoneNumber,
      whatsappMessageTemplate,
      launcherTeaserTexts,
      launcherAvatarUrl,
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
    setFlowServices([...template.defaultServices]);
    setFlowGreeting("");
    if (isDialogueMode) {
      setFlowDialogue(
        seedDialogueFromTemplate(suggested, {
          shape: flowDialogue?.shape ?? "linear",
          services: [...template.defaultServices],
          collectFields: [...template.defaultCollectFields],
          insuranceMode: flowInsuranceMode,
          insurances: flowInsurances,
          tone: flowTone,
        }),
      );
      clearFieldError("flowDialogue");
    }
    lastSyncedSpecialty.current = nextSpecialty.trim();
  }

  function selectFlowTemplate(id: FlowTemplateId) {
    const template = FLOW_TEMPLATES[id];
    setFlowTemplateId(id);
    setFlowCollectFields([...template.defaultCollectFields]);
    setFlowServices([...template.defaultServices]);
    setFlowGreeting("");
    if (isDialogueMode) {
      setFlowDialogue(
        seedDialogueFromTemplate(id, {
          shape: flowDialogue?.shape ?? "linear",
          services: [...template.defaultServices],
          collectFields: [...template.defaultCollectFields],
          insuranceMode: flowInsuranceMode,
          insurances: flowInsurances,
          tone: flowTone,
        }),
      );
      clearFieldError("flowDialogue");
    }
    clearFieldError("flowTemplateId");
  }

  /** Updates tone and rewrites stock greeting/questions so the change is visible. */
  function selectFlowTone(tone: FlowTone) {
    setFlowTone(tone);
    if (isDialogueMode) {
      updateDialogue((prev) =>
        applyToneToDialogue(prev, tone, flowTemplateId),
      );
      setFlowGreeting((prev) => {
        if (!prev.trim()) return prev;
        // Keep the textarea in sync when it still holds stock copy.
        const stock = new Set([
          ...Object.values(
            FLOW_TEMPLATES[flowTemplateId].greetingsByTone,
          ),
          FLOW_TEMPLATES[flowTemplateId].defaultGreeting,
        ]);
        if (!stock.has(prev.trim())) return prev;
        return FLOW_TEMPLATES[flowTemplateId].greetingsByTone[tone];
      });
    }
  }

  function updateDialogue(updater: (prev: DialogueFlow) => DialogueFlow) {
    setFlowDialogue((prev) => {
      if (!prev) return prev;
      return updater(prev);
    });
    clearFieldError("flowDialogue");
  }

  function setDialogueShape(shape: FlowShape) {
    updateDialogue((prev) => ({ ...prev, shape }));
    const dismissed = readDismissedShapeGuides();
    if (!dismissed.has(shape)) {
      setDontShowShapeGuide(false);
      setShapeGuide(shape);
    }
  }

  function confirmShapeGuide() {
    if (shapeGuide && dontShowShapeGuide) {
      persistDismissedShapeGuide(shapeGuide);
    }
    setShapeGuide(null);
    setDontShowShapeGuide(false);
  }

  function setStepSaveAs(stepId: string, value: string) {
    updateDialogue((prev) => ({
      ...prev,
      steps: prev.steps.map((s) => {
        if (s.id !== stepId) return s;
        if (!value) {
          const { saveAs: _s, mapsTo: _m, ...rest } = s;
          return rest;
        }
        if (isBuiltinSaveAs(value)) {
          return { ...s, saveAs: value, mapsTo: value };
        }
        const { mapsTo: _m, ...rest } = s;
        return { ...rest, saveAs: value };
      }),
    }));
    setAddingSaveAsForStep(null);
    setNewSaveAsLabel("");
  }

  function addCustomSaveAs(stepId: string) {
    const label = newSaveAsLabel.trim();
    if (!label) return;
    let key = slugifySaveAsKey(label);
    updateDialogue((prev) => {
      const existing = new Set([
        ...BUILTIN_SAVE_AS,
        ...Object.keys(prev.customSaveLabels ?? {}),
      ]);
      let unique = key;
      let n = 2;
      while (existing.has(unique)) {
        unique = `${key}-${n}`;
        n += 1;
      }
      key = unique;
      return {
        ...prev,
        customSaveLabels: {
          ...(prev.customSaveLabels ?? {}),
          [key]: label,
        },
        steps: prev.steps.map((s) =>
          s.id === stepId
            ? { ...s, saveAs: key, mapsTo: undefined }
            : s,
        ),
      };
    });
    setAddingSaveAsForStep(null);
    setNewSaveAsLabel("");
  }

  function updateStep(stepId: string, patch: Partial<FlowStep>) {
    updateDialogue((prev) => ({
      ...prev,
      steps: prev.steps.map((s) =>
        s.id === stepId ? { ...s, ...patch } : s,
      ),
    }));
  }

  function addDialogueStep() {
    updateDialogue((prev) => {
      const step: FlowStep = {
        id: createFlowId("step"),
        question: "Nova pergunta",
        inputType: "text",
        required: true,
      };
      const steps = [...prev.steps, step];
      return {
        ...prev,
        steps,
        startStepId: prev.startStepId || step.id,
      };
    });
  }

  function removeDialogueStep(stepId: string) {
    updateDialogue((prev) => {
      if (prev.steps.length <= 1) return prev;
      const steps = prev.steps.filter((s) => s.id !== stepId);
      return {
        ...prev,
        steps,
        startStepId:
          prev.startStepId === stepId ? steps[0].id : prev.startStepId,
      };
    });
  }

  function moveDialogueStep(stepId: string, direction: -1 | 1) {
    updateDialogue((prev) => {
      const index = prev.steps.findIndex((s) => s.id === stepId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= prev.steps.length) return prev;
      const steps = [...prev.steps];
      const [item] = steps.splice(index, 1);
      steps.splice(target, 0, item);
      return { ...prev, steps, startStepId: steps[0].id };
    });
  }

  function addStepOption(stepId: string) {
    updateDialogue((prev) => ({
      ...prev,
      steps: prev.steps.map((s) => {
        if (s.id !== stepId) return s;
        const options: FlowStepOption[] = [
          ...(s.options ?? []),
          { id: createFlowId("opt"), label: "Nova opção" },
        ];
        return { ...s, options };
      }),
    }));
  }

  function updateStepOption(
    stepId: string,
    optionId: string,
    patch: Partial<FlowStepOption>,
  ) {
    updateDialogue((prev) => ({
      ...prev,
      steps: prev.steps.map((s) => {
        if (s.id !== stepId) return s;
        return {
          ...s,
          options: (s.options ?? []).map((o) =>
            o.id === optionId ? { ...o, ...patch } : o,
          ),
        };
      }),
    }));
  }

  function removeStepOption(stepId: string, optionId: string) {
    updateDialogue((prev) => ({
      ...prev,
      steps: prev.steps.map((s) => {
        if (s.id !== stepId) return s;
        return {
          ...s,
          options: (s.options ?? []).filter((o) => o.id !== optionId),
        };
      }),
    }));
  }

  function changeStepInputType(stepId: string, inputType: FlowInputType) {
    updateDialogue((prev) => ({
      ...prev,
      steps: prev.steps.map((s) => {
        if (s.id !== stepId) return s;
        if (inputType === "text") {
          return { ...s, inputType, options: undefined };
        }
        const options =
          s.options && s.options.length >= 2
            ? s.options
            : [
                { id: createFlowId("opt"), label: "Opção 1" },
                { id: createFlowId("opt"), label: "Opção 2" },
              ];
        return { ...s, inputType, options };
      }),
    }));
  }

  function addService() {
    const value = newService.trim();
    if (!value) return;
    setFlowServices((prev) =>
      prev.some((s) => s.toLowerCase() === value.toLowerCase())
        ? prev
        : [...prev, value],
    );
    setNewService("");
  }

  function removeService(service: string) {
    setFlowServices((prev) => prev.filter((s) => s !== service));
  }

  function addInsurance() {
    const value = newInsurance.trim();
    if (!value) return;
    setFlowInsurances((prev) =>
      prev.some((s) => s.toLowerCase() === value.toLowerCase())
        ? prev
        : [...prev, value],
    );
    setNewInsurance("");
  }

  function removeInsurance(insurance: string) {
    setFlowInsurances((prev) => prev.filter((s) => s !== insurance));
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
      pageRef.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
    });
  }

  function goToStep(target: number) {
    setFieldErrors({});
    setStep(target);
    requestAnimationFrame(() => {
      pageRef.current
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
  const whatsappVariables = listWhatsAppVariables(
    flowDialogue?.customSaveLabels,
  );
  const flowPreview = buildFlowPreview(
    {
      templateId: flowTemplateId,
      tone: flowTone,
      greeting: flowGreeting,
      collectFields: flowCollectFields,
      services: flowServices,
      insuranceMode: flowInsuranceMode,
      insurances: flowInsurances,
      dialogue: flowDialogue
        ? {
            ...flowDialogue,
            greeting: flowGreeting.trim() || flowDialogue.greeting,
          }
        : undefined,
    },
    { botName: name, clientName },
  );

  return (
    <main
      ref={pageRef}
      className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="mb-3 inline-flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <IconArrowLeft className="size-3.5" />
            Voltar ao painel
          </button>
          <h1
            id={titleId}
            className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            {createdBot
              ? isEditing
                ? "Alterações salvas!"
                : "Chatbot criado!"
              : isEditing
                ? "Editar chatbot"
                : "Novo chatbot"}
          </h1>
          <p
            id={descId}
            className="mt-1.5 max-w-xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400"
          >
            {createdBot
              ? isEditing
                ? "As mudanças já estão na sua lista."
                : "Agora é só instalar no site do cliente."
              : STEPS[step].description}
          </p>
        </div>
      </div>

      {createdBot ? (
        <div className="overflow-hidden rounded-2xl border border-zinc-200/70 bg-white/80 shadow-sm backdrop-blur-xl dark:border-zinc-800/70 dark:bg-zinc-900/55">
          <SuccessScreen
            bot={createdBot}
            copied={copied}
            onCopy={() => copySnippet(createdBot)}
            onDone={onClose}
            isEditing={isEditing}
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200/70 bg-white/80 shadow-sm backdrop-blur-xl dark:border-zinc-800/70 dark:bg-zinc-900/55">
          <div className="grid lg:grid-cols-[minmax(11.5rem,13rem)_minmax(0,1fr)]">
            {/* Desktop vertical stepper */}
            <nav
              aria-label="Etapas do cadastro"
              className="hidden border-b border-zinc-200/70 px-3 py-4 dark:border-zinc-800/70 lg:block lg:border-b-0 lg:border-r"
            >
              <ol className="space-y-0.5">
                {STEPS.map((s, index) => {
                  const isCurrent = index === step;
                  const isDone = index < step;
                  return (
                    <li key={s.title}>
                      <button
                        type="button"
                        onClick={() => {
                          if (index < step) goToStep(index);
                        }}
                        disabled={index > step}
                        aria-current={isCurrent ? "step" : undefined}
                        aria-label={s.title}
                        title={s.title}
                        className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 ${
                          isCurrent
                            ? "bg-indigo-50 text-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-100"
                            : isDone
                              ? "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800/80"
                              : "cursor-default text-zinc-400 dark:text-zinc-500"
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                            isDone || isCurrent
                              ? "bg-indigo-500 text-white dark:bg-indigo-400 dark:text-indigo-950"
                              : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
                          }`}
                        >
                          {isDone ? (
                            <IconCheck className="size-3" />
                          ) : (
                            index + 1
                          )}
                        </span>
                        <span
                          className={`min-w-0 text-[13px] leading-snug ${
                            isCurrent ? "font-semibold" : "font-medium"
                          }`}
                        >
                          {s.shortTitle}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>

            <div className="min-w-0">
              {/* Mobile horizontal progress */}
              <div className="border-b border-zinc-200/70 px-5 py-3 dark:border-zinc-800/70 lg:hidden">
                <div className="mb-2 flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="font-medium text-zinc-700 dark:text-zinc-200">
                    {STEPS[step].title}
                  </span>
                  <span>
                    Etapa {step + 1} de {STEPS.length}
                  </span>
                </div>
                <ol aria-label="Progresso" className="flex gap-1.5">
                  {STEPS.map((s, index) => {
                    const isCurrent = index === step;
                    const isDone = index < step;
                    return (
                      <li key={s.title} className="min-w-0 flex-1">
                        <span
                          aria-current={isCurrent ? "step" : undefined}
                          aria-label={`${s.title}${isDone ? ", concluída" : isCurrent ? ", atual" : ""}`}
                          className={`block h-1.5 rounded-full transition-colors ${
                            isDone || isCurrent
                              ? "bg-indigo-500 dark:bg-indigo-400"
                              : "bg-zinc-200 dark:bg-zinc-800"
                          }`}
                        />
                      </li>
                    );
                  })}
                </ol>
              </div>

              <form
                id={formId}
                onSubmit={handleSubmit}
                noValidate
                className="flex min-h-0 flex-col"
              >
                <div className="space-y-6 px-5 py-6 sm:px-7 sm:py-7">
                  {step === 0 ? (
                    <>
                      <div className="grid gap-5 sm:grid-cols-2">
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
                          className="sm:col-span-2"
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
                              fieldErrors.name
                                ? `${formId}-name-error`
                                : undefined
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
                            className={inputClass(
                              Boolean(fieldErrors.clientName),
                            )}
                          />
                        </Field>

                        <Field
                          label="Especialidade / área médica"
                          required
                          error={fieldErrors.specialty}
                          htmlFor={`${formId}-specialty`}
                        >
                          <input
                            id={`${formId}-specialty`}
                            required
                            list={`${formId}-specialty-list`}
                            value={specialty}
                            onChange={(e) => {
                              setSpecialty(e.target.value);
                              clearFieldError("specialty");
                            }}
                            onBlur={() => {
                              if (specialty.trim()) {
                                syncFlowFromSpecialty(specialty);
                              }
                            }}
                            placeholder="Ex.: Cardiologia"
                            aria-invalid={Boolean(fieldErrors.specialty)}
                            aria-describedby={
                              fieldErrors.specialty
                                ? `${formId}-specialty-error`
                                : `${formId}-specialty-hint`
                            }
                            className={inputClass(
                              Boolean(fieldErrors.specialty),
                            )}
                          />
                          <datalist id={`${formId}-specialty-list`}>
                            {SPECIALTY_SUGGESTIONS.map((suggestion) => (
                              <option key={suggestion} value={suggestion} />
                            ))}
                          </datalist>
                        </Field>
                      </div>

                      <div className="space-y-2">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span
                            id={`${formId}-specialty-hint`}
                            className="text-xs font-medium text-zinc-500 dark:text-zinc-400"
                          >
                            Sugestões rápidas
                          </span>
                          <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                            Toque para preencher
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {SPECIALTY_SUGGESTIONS.map((suggestion) => {
                            const selected =
                              specialty.trim().toLowerCase() ===
                              suggestion.toLowerCase();
                            return (
                              <button
                                key={suggestion}
                                type="button"
                                onClick={() => {
                                  setSpecialty(suggestion);
                                  clearFieldError("specialty");
                                  syncFlowFromSpecialty(suggestion);
                                }}
                                aria-pressed={selected}
                                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 ${
                                  selected
                                    ? "border-indigo-400 bg-indigo-50 font-medium text-indigo-800 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-200"
                                    : "border-zinc-200 bg-zinc-50/80 text-zinc-700 hover:border-zinc-300 hover:bg-white dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/60"
                                }`}
                              >
                                {suggestion}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  ) : null}

              {step === 1 ? (
                <>
                  <div className="space-y-2">
                    <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                      Modelo inicial
                    </span>
                    <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                      Escolha um ponto de partida. Depois você edita cada
                      pergunta e o tipo de resposta.
                    </p>
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

                  {isDialogueMode && flowDialogue ? (
                    <>
                      <div
                        role="group"
                        aria-label="Formato do fluxo"
                        className="space-y-2"
                      >
                        <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                          Formato do fluxo
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          {(["linear", "branching"] as const).map((shape) => (
                            <button
                              key={shape}
                              type="button"
                              onClick={() => setDialogueShape(shape)}
                              aria-pressed={flowDialogue.shape === shape}
                              className={`rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 ${
                                flowDialogue.shape === shape
                                  ? "border-indigo-400 bg-indigo-50 text-indigo-800 dark:border-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-200"
                                  : "border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700"
                              }`}
                            >
                              <span className="block text-sm font-semibold">
                                {FLOW_SHAPE_LABELS[shape]}
                              </span>
                              <span className="mt-0.5 block text-[11px] leading-snug opacity-80">
                                {shape === "linear"
                                  ? "Perguntas em sequência fixa."
                                  : "Cada opção pode levar a outra pergunta."}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div
                        role="group"
                        aria-label="Tom da conversa"
                        className="space-y-2"
                      >
                        <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                          Tom da conversa
                        </span>
                        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                          Muda a saudação, as perguntas padrão e o fechamento
                          (amigável usa linguagem casual; formal é mais
                          objetiva). Textos que você editou à mão não mudam.
                        </p>
                        <div className="flex gap-2">
                          {(["friendly", "formal"] as const).map((tone) => (
                            <button
                              key={tone}
                              type="button"
                              onClick={() => selectFlowTone(tone)}
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
                          placeholder={FLOW_TEMPLATES[flowTemplateId]
                            .greetingsByTone[flowTone]
                            .replace("{botName}", name.trim() || "assistente")
                            .replace(
                              "{clientName}",
                              clientName.trim() || "nossa equipe",
                            )}
                          className={`${inputClass(false)} resize-none`}
                        />
                      </Field>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                            Perguntas do diálogo
                          </span>
                          <button
                            type="button"
                            onClick={addDialogueStep}
                            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                          >
                            + Adicionar pergunta
                          </button>
                        </div>
                        {fieldErrors.flowDialogue ? (
                          <p className="text-xs text-rose-600 dark:text-rose-400">
                            {fieldErrors.flowDialogue}
                          </p>
                        ) : null}
                        <ul className="space-y-3">
                          {flowDialogue.steps.map((dialogueStep, index) => (
                            <li
                              key={dialogueStep.id}
                              className="rounded-xl border border-zinc-200/80 bg-white/80 p-3 dark:border-zinc-800/80 dark:bg-zinc-950/40"
                            >
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                                  Etapa {index + 1}
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      moveDialogueStep(dialogueStep.id, -1)
                                    }
                                    disabled={index === 0}
                                    aria-label="Mover para cima"
                                    className="rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      moveDialogueStep(dialogueStep.id, 1)
                                    }
                                    disabled={
                                      index === flowDialogue.steps.length - 1
                                    }
                                    aria-label="Mover para baixo"
                                    className="rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"
                                  >
                                    ↓
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeDialogueStep(dialogueStep.id)
                                    }
                                    disabled={flowDialogue.steps.length <= 1}
                                    aria-label="Remover pergunta"
                                    className="rounded-md px-2 py-1 text-xs text-rose-500 hover:bg-rose-50 disabled:opacity-30 dark:hover:bg-rose-950/40"
                                  >
                                    Remover
                                  </button>
                                </div>
                              </div>

                              <label className="block space-y-1">
                                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                                  Pergunta
                                </span>
                                <textarea
                                  value={dialogueStep.question}
                                  onChange={(e) =>
                                    updateStep(dialogueStep.id, {
                                      question: e.target.value,
                                    })
                                  }
                                  rows={2}
                                  className={`${inputClass(false)} resize-none`}
                                />
                              </label>

                              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                <label className="block space-y-1">
                                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                                    Tipo de resposta
                                  </span>
                                  <select
                                    value={dialogueStep.inputType}
                                    onChange={(e) =>
                                      changeStepInputType(
                                        dialogueStep.id,
                                        e.target.value as FlowInputType,
                                      )
                                    }
                                    className={inputClass(false)}
                                  >
                                    {INPUT_TYPE_ORDER.map((type) => (
                                      <option key={type} value={type}>
                                        {FLOW_INPUT_TYPE_LABELS[type]}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <div className="block space-y-1">
                                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                                    Salvar como
                                  </span>
                                  <select
                                    value={
                                      resolveStepSaveAs(dialogueStep) ?? ""
                                    }
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      if (value === "__new__") {
                                        setAddingSaveAsForStep(
                                          dialogueStep.id,
                                        );
                                        setNewSaveAsLabel("");
                                        return;
                                      }
                                      setStepSaveAs(dialogueStep.id, value);
                                    }}
                                    className={inputClass(false)}
                                  >
                                    <option value="">Não mapear</option>
                                    {BUILTIN_SAVE_AS.map((key) => (
                                      <option key={key} value={key}>
                                        {FLOW_MAPS_TO_LABELS[key]}
                                      </option>
                                    ))}
                                    {Object.entries(
                                      flowDialogue.customSaveLabels ?? {},
                                    ).map(([key, label]) => (
                                      <option key={key} value={key}>
                                        {label}
                                      </option>
                                    ))}
                                    <option value="__new__">
                                      + Nova categoria…
                                    </option>
                                  </select>
                                  {addingSaveAsForStep === dialogueStep.id ? (
                                    <div className="flex gap-2 pt-1">
                                      <input
                                        value={newSaveAsLabel}
                                        onChange={(e) =>
                                          setNewSaveAsLabel(e.target.value)
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            e.preventDefault();
                                            addCustomSaveAs(dialogueStep.id);
                                          }
                                          if (e.key === "Escape") {
                                            setAddingSaveAsForStep(null);
                                            setNewSaveAsLabel("");
                                          }
                                        }}
                                        placeholder="Ex.: Convênio, Horário preferido"
                                        autoFocus
                                        className={inputClass(false)}
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          addCustomSaveAs(dialogueStep.id)
                                        }
                                        disabled={!newSaveAsLabel.trim()}
                                        className="shrink-0 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
                                      >
                                        Criar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setAddingSaveAsForStep(null);
                                          setNewSaveAsLabel("");
                                        }}
                                        className="shrink-0 rounded-lg px-2 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  ) : null}
                                  {resolveStepSaveAs(dialogueStep) &&
                                  !isBuiltinSaveAs(
                                    resolveStepSaveAs(dialogueStep)!,
                                  ) ? (
                                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                      Categoria:{" "}
                                      {labelForSaveAs(
                                        resolveStepSaveAs(dialogueStep)!,
                                        flowDialogue.customSaveLabels,
                                      )}
                                    </p>
                                  ) : null}
                                </div>
                              </div>

                              {dialogueStep.inputType !== "text" ? (
                                <div className="mt-3 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                                      Opções de resposta
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        addStepOption(dialogueStep.id)
                                      }
                                      className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                                    >
                                      + Opção
                                    </button>
                                  </div>
                                  {(dialogueStep.options ?? []).map(
                                    (option) => (
                                      <div
                                        key={option.id}
                                        className="flex flex-col gap-1.5 rounded-lg border border-zinc-200/70 p-2 dark:border-zinc-800/70 sm:flex-row sm:items-center"
                                      >
                                        <input
                                          value={option.label}
                                          onChange={(e) =>
                                            updateStepOption(
                                              dialogueStep.id,
                                              option.id,
                                              { label: e.target.value },
                                            )
                                          }
                                          className={inputClass(false)}
                                          placeholder="Texto da opção"
                                        />
                                        {flowDialogue.shape === "branching" &&
                                        dialogueStep.inputType ===
                                          "single_choice" ? (
                                          <select
                                            value={option.nextStepId ?? ""}
                                            onChange={(e) =>
                                              updateStepOption(
                                                dialogueStep.id,
                                                option.id,
                                                {
                                                  nextStepId:
                                                    e.target.value || undefined,
                                                },
                                              )
                                            }
                                            className={inputClass(false)}
                                            aria-label="Próxima etapa"
                                          >
                                            <option value="">
                                              Encerrar fluxo
                                            </option>
                                            {flowDialogue.steps
                                              .filter(
                                                (s) => s.id !== dialogueStep.id,
                                              )
                                              .map((s) => (
                                                <option key={s.id} value={s.id}>
                                                  Ir para etapa{" "}
                                                  {flowDialogue.steps.findIndex(
                                                    (x) => x.id === s.id,
                                                  ) + 1}
                                                  {s.question
                                                    ? `: ${s.question.slice(0, 28)}`
                                                    : ""}
                                                </option>
                                              ))}
                                          </select>
                                        ) : null}
                                        <button
                                          type="button"
                                          onClick={() =>
                                            removeStepOption(
                                              dialogueStep.id,
                                              option.id,
                                            )
                                          }
                                          aria-label="Remover opção"
                                          className="shrink-0 rounded-md px-2 py-1 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                        >
                                          ×
                                        </button>
                                      </div>
                                    ),
                                  )}
                                </div>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <FlowPreview
                        messages={flowPreview}
                        botName={name}
                        tone={flowTone}
                      />
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                          Serviços oferecidos
                        </span>
                        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                          Consultas, exames ou procedimentos da clínica. O
                          paciente escolhe entre eles na conversa.
                        </p>
                        {flowServices.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {flowServices.map((service) => (
                              <span
                                key={service}
                                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white/70 py-1 pl-3 pr-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200"
                              >
                                {service}
                                <button
                                  type="button"
                                  onClick={() => removeService(service)}
                                  aria-label={`Remover ${service}`}
                                  className="flex size-5 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                                >
                                  <IconX className="size-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            Adicione ao menos um serviço para o paciente
                            escolher.
                          </p>
                        )}
                        <div className="flex gap-2">
                          <input
                            value={newService}
                            onChange={(e) => setNewService(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addService();
                              }
                            }}
                            placeholder="Ex.: Ecocardiograma"
                            className={inputClass(false)}
                          />
                          <button
                            type="button"
                            onClick={addService}
                            disabled={!newService.trim()}
                            className="shrink-0 rounded-xl border border-zinc-200 px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:pointer-events-none disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                          >
                            Adicionar
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                          Convênios
                        </span>
                        <div className="grid grid-cols-3 gap-2">
                          {INSURANCE_MODE_ORDER.map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setFlowInsuranceMode(mode)}
                              aria-pressed={flowInsuranceMode === mode}
                              className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 sm:text-sm ${
                                flowInsuranceMode === mode
                                  ? "border-indigo-400 bg-indigo-50 text-indigo-800 dark:border-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-200"
                                  : "border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700"
                              }`}
                            >
                              {INSURANCE_MODE_LABELS[mode]}
                            </button>
                          ))}
                        </div>
                        {flowInsuranceMode !== "particular" ? (
                          <div className="space-y-2 pt-1">
                            <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                              Convênios aceitos (opcional). Ajuda o paciente a
                              saber se o plano dele é atendido.
                            </p>
                            {flowInsurances.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {flowInsurances.map((insurance) => (
                                  <span
                                    key={insurance}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white/70 py-1 pl-3 pr-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200"
                                  >
                                    {insurance}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeInsurance(insurance)
                                      }
                                      aria-label={`Remover ${insurance}`}
                                      className="flex size-5 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                                    >
                                      <IconX className="size-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            <div className="flex gap-2">
                              <input
                                value={newInsurance}
                                onChange={(e) =>
                                  setNewInsurance(e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    addInsurance();
                                  }
                                }}
                                placeholder="Ex.: Unimed, Bradesco Saúde"
                                className={inputClass(false)}
                              />
                              <button
                                type="button"
                                onClick={addInsurance}
                                disabled={!newInsurance.trim()}
                                className="shrink-0 rounded-xl border border-zinc-200 px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:pointer-events-none disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                              >
                                Adicionar
                              </button>
                            </div>
                          </div>
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
                        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                          Muda a saudação, as perguntas padrão e o fechamento
                          (amigável usa linguagem casual; formal é mais
                          objetiva). Textos que você editou à mão não mudam.
                        </p>
                        <div className="flex gap-2">
                          {(["friendly", "formal"] as const).map((tone) => (
                            <button
                              key={tone}
                              type="button"
                              onClick={() => selectFlowTone(tone)}
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
                        htmlFor={`${formId}-greeting-legacy`}
                      >
                        <textarea
                          id={`${formId}-greeting-legacy`}
                          value={flowGreeting}
                          onChange={(e) => setFlowGreeting(e.target.value)}
                          rows={2}
                          placeholder={FLOW_TEMPLATES[flowTemplateId]
                            .greetingsByTone[flowTone]
                            .replace("{botName}", name.trim() || "assistente")
                            .replace(
                              "{clientName}",
                              clientName.trim() || "nossa equipe",
                            )}
                          className={`${inputClass(false)} resize-none`}
                        />
                      </Field>

                      <div className="space-y-2">
                        <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                          O que o bot vai pedir ao visitante
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {(["name", "phone", "email"] as const).map(
                            (field) => {
                              const checked =
                                flowCollectFields.includes(field);
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
                            },
                          )}
                        </div>
                        {fieldErrors.flowCollectFields ? (
                          <p className="text-xs text-rose-600 dark:text-rose-400">
                            {fieldErrors.flowCollectFields}
                          </p>
                        ) : null}
                      </div>

                      <FlowPreview
                        messages={flowPreview}
                        botName={name}
                        tone={flowTone}
                      />
                    </>
                  )}
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
                            ). Categorias criadas em “Salvar como” também
                            aparecem aqui (ex.:{" "}
                            <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[10px] dark:bg-zinc-800">
                              {"{convenio}"}
                            </code>
                            ).
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {whatsappVariables.map((variable) => (
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
                            {whatsappVariables.map((variable) => (
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
                          flowDialogue?.customSaveLabels,
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
                  <LauncherPreview
                    teaserTexts={launcherTeaserTexts}
                    avatarUrl={launcherAvatarUrl}
                  />

                  <Field
                    label="Texto do balão"
                    required
                    error={fieldErrors.launcherTeaserTexts}
                    htmlFor={`${formId}-teasers`}
                    hint="uma frase por linha"
                  >
                    <textarea
                      id={`${formId}-teasers`}
                      value={launcherTeaserTexts.join("\n")}
                      onChange={(e) => {
                        const lines = e.target.value.split("\n");
                        setLauncherTeaserTexts(
                          lines.length > 0 ? lines : [""],
                        );
                        clearFieldError("launcherTeaserTexts");
                      }}
                      rows={4}
                      placeholder={`${DEFAULT_LAUNCHER_TEASER}\nQuer agendar? Clique aqui!`}
                      aria-invalid={Boolean(fieldErrors.launcherTeaserTexts)}
                      aria-describedby={
                        fieldErrors.launcherTeaserTexts
                          ? `${formId}-teasers-error`
                          : `${formId}-teasers-hint`
                      }
                      className={`${inputClass(Boolean(fieldErrors.launcherTeaserTexts))} resize-y`}
                    />
                    <p
                      id={`${formId}-teasers-hint`}
                      className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400"
                    >
                      Se houver mais de uma linha, o balão alterna as frases a
                      cada poucos segundos no site.
                    </p>
                  </Field>

                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                        Avatar do balão
                      </span>
                      <span className="rounded-full border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
                        Upload em desenvolvimento
                      </span>
                    </div>
                    <div
                      role="group"
                      aria-label="Escolher avatar"
                      className="grid gap-2 sm:grid-cols-2"
                    >
                      {LAUNCHER_AVATAR_PRESETS.map((preset) => {
                        const selected =
                          resolveLauncherAvatarPath(launcherAvatarUrl) ===
                          preset.path;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setLauncherAvatarUrl(preset.path)}
                            aria-pressed={selected}
                            className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 ${
                              selected
                                ? "border-indigo-400 bg-indigo-50/80 dark:border-indigo-600 dark:bg-indigo-950/40"
                                : "border-zinc-200 bg-white/70 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700"
                            }`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={preset.path}
                              alt=""
                              width={56}
                              height={56}
                              className="size-14 shrink-0 rounded-full border border-zinc-200 object-cover dark:border-zinc-700"
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                {preset.label}
                              </span>
                              <span className="mt-0.5 block text-xs leading-snug text-zinc-500 dark:text-zinc-400">
                                {preset.description}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        disabled
                        className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-400 dark:border-zinc-700 dark:text-zinc-500"
                      >
                        Enviar foto
                      </button>
                      <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                        Escolha um dos robôs por enquanto. Upload de foto
                        personalizada chega em breve.
                      </p>
                    </div>
                  </div>

                  <BotPreview
                    name={name}
                    specialty={specialty}
                    accent={accent}
                    derivedId={derivedId}
                    avatarUrl={launcherAvatarUrl}
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
                      label="Balão no site"
                      value={
                        launcherTeaserTexts
                          .map((t) => t.trim())
                          .filter(Boolean)
                          .join(" · ") || DEFAULT_LAUNCHER_TEASER
                      }
                    />
                    {flowDialogue ? (
                      <>
                        <ReviewRow
                          label="Formato"
                          value={FLOW_SHAPE_LABELS[flowDialogue.shape]}
                        />
                        <ReviewRow
                          label="Perguntas"
                          value={`${flowDialogue.steps.length} etapa${flowDialogue.steps.length === 1 ? "" : "s"}`}
                        />
                      </>
                    ) : (
                      <>
                        <ReviewRow
                          label="Coleta"
                          value={flowCollectFields
                            .map((f) => FLOW_FIELD_LABELS[f])
                            .join(", ")}
                        />
                        <ReviewRow
                          label="Serviços"
                          value={
                            flowServices.length > 0
                              ? flowServices.join(", ")
                              : "—"
                          }
                        />
                        <ReviewRow
                          label="Convênios"
                          value={
                            flowInsuranceMode === "particular"
                              ? INSURANCE_MODE_LABELS.particular
                              : `${INSURANCE_MODE_LABELS[flowInsuranceMode]}${
                                  flowInsurances.length > 0
                                    ? ` (${flowInsurances.join(", ")})`
                                    : ""
                                }`
                          }
                        />
                      </>
                    )}
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

            <footer className="sticky bottom-0 flex shrink-0 items-center justify-between gap-2 border-t border-zinc-200/70 bg-white/95 px-5 py-3.5 backdrop-blur-xl dark:border-zinc-800/70 dark:bg-zinc-900/95 sm:px-8">
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
              <button type="submit" className="btn-brand px-4 py-2">
                {isLastStep
                  ? isEditing
                    ? "Salvar alterações"
                    : "Criar chatbot"
                  : "Continuar"}
              </button>
            </footer>
          </form>
            </div>
          </div>
        </div>
      )}

      {shapeGuide ? (
        <ShapeGuideDialog
          shape={shapeGuide}
          dontShowAgain={dontShowShapeGuide}
          onDontShowAgainChange={setDontShowShapeGuide}
          onConfirm={confirmShapeGuide}
        />
      ) : null}
    </main>
  );
}

function ShapeGuideDialog({
  shape,
  dontShowAgain,
  onDontShowAgainChange,
  onConfirm,
}: {
  shape: FlowShape;
  dontShowAgain: boolean;
  onDontShowAgainChange: (value: boolean) => void;
  onConfirm: () => void;
}) {
  const guide = FLOW_SHAPE_GUIDE[shape];
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Fechar guia"
        onClick={onConfirm}
        className="absolute inset-0 bg-zinc-950/50 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shape-guide-title"
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="border-b border-zinc-200/70 px-5 py-4 dark:border-zinc-800/70">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            {FLOW_SHAPE_LABELS[shape]}
          </p>
          <h3
            id="shape-guide-title"
            className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50"
          >
            {guide.title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            {guide.summary}
          </p>
        </div>
        <div className="max-h-[min(60vh,420px)] space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              Benefícios
            </p>
            <ul className="mt-2 space-y-1.5">
              {guide.benefits.map((item) => (
                <li
                  key={item}
                  className="flex gap-2 text-sm leading-snug text-zinc-700 dark:text-zinc-200"
                >
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              Fragilidades
            </p>
            <ul className="mt-2 space-y-1.5">
              {guide.drawbacks.map((item) => (
                <li
                  key={item}
                  className="flex gap-2 text-sm leading-snug text-zinc-700 dark:text-zinc-200"
                >
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <p className="rounded-xl bg-zinc-50 px-3 py-2.5 text-sm leading-relaxed text-zinc-600 dark:bg-zinc-950/50 dark:text-zinc-300">
            <span className="font-medium text-zinc-800 dark:text-zinc-100">
              Melhor para:{" "}
            </span>
            {guide.bestFor}
          </p>
        </div>
        <div className="flex flex-col gap-3 border-t border-zinc-200/70 px-5 py-4 dark:border-zinc-800/70 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => onDontShowAgainChange(e.target.checked)}
              className="size-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500/40 dark:border-zinc-600"
            />
            Não mostrar novamente
          </label>
          <button
            type="button"
            onClick={onConfirm}
            className="btn-brand px-4 py-2"
          >
            Entendi, continuar
          </button>
        </div>
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
  tone,
}: {
  messages: ReturnType<typeof buildFlowPreview>;
  botName: string;
  tone: FlowTone;
}) {
  const display = botName.trim() || "Assistente";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Prévia da conversa no site
        </span>
        <span
          className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${
            tone === "friendly"
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          Tom: {FLOW_TONE_LABELS[tone]}
        </span>
      </div>
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
  avatarUrl,
}: {
  name: string;
  specialty: string;
  accent: AccentKey;
  derivedId: string;
  avatarUrl: string | null;
}) {
  const display = name.trim() || "Seu chatbot";
  const photo = resolveLauncherAvatarPath(avatarUrl);
  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
        Como vai aparecer no painel
      </span>
      <div className="flex items-center gap-3 rounded-xl border border-zinc-200/70 bg-white px-3 py-3 dark:border-zinc-800/70 dark:bg-zinc-900/60">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo}
          alt=""
          width={36}
          height={36}
          className="size-9 shrink-0 rounded-lg object-cover ring-1 ring-zinc-200/80 dark:ring-zinc-700/80"
        />
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
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}) {
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;

  return (
    <div className={className ? `space-y-2 ${className}` : "space-y-2"}>
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
