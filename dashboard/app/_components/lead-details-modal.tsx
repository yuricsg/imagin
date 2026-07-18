"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { Chatbot, Lead, LeadEvent } from "@/lib/chatbots/types";
import { absoluteTime } from "@/lib/format";
import { chatbotDisplayName } from "@/lib/chatbots/display";
import {
  getDialogueStep,
  labelForSaveAs,
  resolveAnswerLabels,
  resolveStepSaveAs,
} from "@/lib/chatbots/flows";
import { LEAD_CHANNEL, LEAD_STATUS } from "@/lib/labels";
import { Badge } from "./ui";
import { IconX } from "./icons";

export function LeadDetailsModal({
  lead,
  bot,
  onClose,
}: {
  lead: Lead;
  bot?: Chatbot;
  onClose: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const status = LEAD_STATUS[lead.status];
  const channel = LEAD_CHANNEL[lead.attribution.channel];
  const dialogue = bot?.flow.dialogue;
  // Answers persist option ids for branching — resolve them back to the labels
  // the visitor saw, and name each entry after its question/save category.
  const answers = Object.entries(lead.answers ?? {}).map(([key, value]) => {
    const step = dialogue ? getDialogueStep(dialogue, key) : undefined;
    const saveAs = step ? resolveStepSaveAs(step) : undefined;
    const label = step
      ? (saveAs ? labelForSaveAs(saveAs, dialogue?.customSaveLabels) : "") ||
        step.question.trim() ||
        key
      : key;
    const resolved = step ? resolveAnswerLabels(step, value) : value;
    return {
      key,
      label,
      value: Array.isArray(resolved) ? resolved.join(", ") : resolved,
    };
  });

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end bg-zinc-950/45 sm:items-center sm:justify-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-details-title"
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl dark:bg-zinc-950 sm:max-w-3xl sm:rounded-2xl"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-zinc-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="lead-details-title" className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {lead.name}
              </h2>
              <Badge label={status.label} className={status.badge} dot={status.dot} />
            </div>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {bot ? chatbotDisplayName(bot) : lead.botId} · {absoluteTime(lead.createdAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhes do lead"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            <IconX className="size-5" />
          </button>
        </header>

        <div className="divide-y divide-zinc-200 px-5 dark:divide-zinc-800 sm:px-6">
          <ModalSection title="Identificação">
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <Detail label="Nome" value={lead.name} />
              <Detail label="Telefone" value={lead.phone || "Não informado"} />
              <Detail label="E-mail" value={lead.email || "Não informado"} />
              <Detail label="Cliente" value={bot?.clientName ?? lead.clientId} />
            </dl>
          </ModalSection>

          <ModalSection title="Classificação">
            <div className="flex flex-wrap items-center gap-2">
              <Badge label={lead.classification.primary} className="bg-cyan-500/10 text-cyan-800 ring-cyan-600/20 dark:text-cyan-200" />
              <Badge label={channel.label} className={channel.badge} />
            </div>
            {lead.classification.details.length > 0 ? (
              <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                {lead.classification.details.map((detail) => (
                  <Detail key={`${detail.label}-${detail.value}`} label={detail.label} value={detail.value} />
                ))}
              </dl>
            ) : null}
          </ModalSection>

          <ModalSection title="Origem do lead">
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <Detail label="Página" value={lead.source.pageUrl || "Não identificada"} />
              <Detail label="Página de entrada" value={lead.source.landingPageUrl || "Não identificada"} />
              <Detail label="Referência" value={lead.source.referrer || "Acesso direto"} />
              <Detail label="Campanha" value={lead.attribution.utmCampaign || "Sem campanha"} />
              <Detail label="Fonte / mídia" value={[lead.attribution.utmSource, lead.attribution.utmMedium].filter(Boolean).join(" / ") || "Não informado"} />
              <Detail label="Origem do iframe" value={lead.source.parentOrigin || "Não informada"} />
            </dl>
          </ModalSection>

          <ModalSection title="Dados preenchidos">
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <Detail label="Intenção" value={intentLabel(lead.intent)} />
              <Detail label="Necessidade" value={lead.consultationNeed || "Não informada"} />
              <Detail label="Decisão" value={lead.consultationDecision || "Não informada"} />
              <Detail label="Solicitação médica" value={lead.medicalRequestStatus || "Não informada"} />
              {lead.selectedExams.length > 0 ? (
                <Detail label="Exames" value={lead.selectedExams.join(", ")} />
              ) : null}
              {answers.map((answer) => (
                <Detail key={answer.key} label={answer.label} value={answer.value} />
              ))}
            </dl>
            {lead.whatsappMessage ? (
              <div className="mt-4">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Mensagem preparada para o WhatsApp</p>
                <p className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-200">{lead.whatsappMessage}</p>
              </div>
            ) : null}
          </ModalSection>

          <ModalSection title="Progresso no fluxo">
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <Detail label="Última etapa" value={lead.progress.currentStep || "Não identificada"} />
              <Detail label="Última atividade" value={formatOptionalDate(lead.progress.lastActivityAt)} />
              <Detail label="Fluxo concluído" value={formatBooleanDate(lead.progress.completedAt)} />
              <Detail label="Clicou no WhatsApp" value={formatBooleanDate(lead.progress.whatsappClickedAt)} />
              <Detail label="Solicitou agendamento" value={formatBooleanDate(lead.progress.appointmentRequestedAt)} />
              <Detail label="Conversão confirmada" value={formatBooleanDate(lead.progress.convertedAt)} />
            </dl>
            {lead.events.length > 0 ? (
              <ol className="mt-5 space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                {lead.events.map((event) => (
                  <li key={event.id} className="flex gap-3 text-sm">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-cyan-500" />
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-800 dark:text-zinc-100">{eventLabel(event)}</p>
                      {event.label ? <p className="mt-0.5 text-zinc-500 dark:text-zinc-400">{event.label}</p> : null}
                      <p className="mt-0.5 text-xs text-zinc-400">{absoluteTime(event.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : null}
          </ModalSection>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function ModalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="py-5 sm:py-6">
      <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      {children}
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="mt-1 break-words text-sm text-zinc-800 dark:text-zinc-100">{value}</dd>
    </div>
  );
}

function intentLabel(intent: string | null): string {
  if (intent === "schedule_exam") return "Agendar exame";
  if (intent === "schedule_consultation") return "Marcar consulta cardiológica";
  if (intent === "severe_symptoms") return "Avaliação de sintomas graves";
  return "Não identificada";
}

function formatOptionalDate(value: string | null): string {
  return value ? absoluteTime(value) : "Não registrada";
}

function formatBooleanDate(value: string | null): string {
  return value ? `Sim, em ${absoluteTime(value)}` : "Não";
}

function eventLabel(event: LeadEvent): string {
  const labels: Record<string, string> = {
    chat_opened: "Abriu o chatbot",
    name_captured: "Informou o nome",
    intent_selected: "Escolheu o objetivo",
    answer_submitted: "Respondeu uma etapa",
    flow_completed: "Concluiu o fluxo",
    lead_created: "Lead registrado",
    whatsapp_clicked: "Abriu o WhatsApp",
    conversion_confirmed: "Conversão confirmada",
  };
  return labels[event.type] ?? event.type;
}
