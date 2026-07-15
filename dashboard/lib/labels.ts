import type { ChatbotStatus, LeadChannel, LeadStatus } from "./chatbots/types";

interface StatusMeta {
  label: string;
  /** Literal badge classes — never interpolate (Tailwind v4 needs to see them). */
  badge: string;
  dot: string;
}

export const LEAD_STATUS: Record<LeadStatus, StatusMeta> = {
  new: {
    label: "Novo",
    badge:
      "bg-blue-500/15 text-blue-700 ring-blue-600/25 dark:bg-blue-400/15 dark:text-blue-300 dark:ring-blue-400/25",
    dot: "bg-blue-500",
  },
  whatsapp_handoff: {
    label: "Encaminhado para WhatsApp",
    badge:
      "bg-amber-500/15 text-amber-700 ring-amber-600/25 dark:bg-amber-400/15 dark:text-amber-300 dark:ring-amber-400/25",
    dot: "bg-amber-500",
  },
  appointment_requested: {
    label: "Agendamento solicitado",
    badge:
      "bg-violet-500/15 text-violet-700 ring-violet-600/25 dark:bg-violet-400/15 dark:text-violet-300 dark:ring-violet-400/25",
    dot: "bg-violet-500",
  },
  converted: {
    label: "Convertido",
    badge:
      "bg-emerald-500/15 text-emerald-700 ring-emerald-600/25 dark:bg-emerald-400/15 dark:text-emerald-300 dark:ring-emerald-400/25",
    dot: "bg-emerald-500",
  },
  not_interested: {
    label: "Sem interesse",
    badge:
      "bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:bg-rose-400/10 dark:text-rose-300 dark:ring-rose-400/20",
    dot: "bg-rose-400",
  },
  abandoned: {
    label: "Abandonado",
    badge:
      "bg-zinc-500/10 text-zinc-600 ring-zinc-500/20 dark:bg-zinc-400/10 dark:text-zinc-400 dark:ring-zinc-400/20",
    dot: "bg-zinc-400",
  },
};

export const LEAD_STATUS_ORDER: LeadStatus[] = [
  "new",
  "whatsapp_handoff",
  "appointment_requested",
  "not_interested",
  "abandoned",
  "converted",
];

export const LEAD_CHANNEL: Record<
  LeadChannel,
  { label: string; badge: string }
> = {
  google: {
    label: "Google",
    badge:
      "bg-sky-500/15 text-sky-800 ring-sky-600/25 dark:bg-sky-400/15 dark:text-sky-200 dark:ring-sky-400/25",
  },
  meta: {
    label: "Meta Ads",
    badge:
      "bg-indigo-500/15 text-indigo-800 ring-indigo-600/25 dark:bg-indigo-400/15 dark:text-indigo-200 dark:ring-indigo-400/25",
  },
  organic: {
    label: "Orgânico",
    badge:
      "bg-emerald-500/15 text-emerald-800 ring-emerald-600/25 dark:bg-emerald-400/15 dark:text-emerald-200 dark:ring-emerald-400/25",
  },
  direct: {
    label: "Direto",
    badge:
      "bg-zinc-500/10 text-zinc-700 ring-zinc-500/20 dark:bg-zinc-400/10 dark:text-zinc-300 dark:ring-zinc-400/20",
  },
  referral: {
    label: "Indicação",
    badge:
      "bg-violet-500/15 text-violet-800 ring-violet-600/25 dark:bg-violet-400/15 dark:text-violet-200 dark:ring-violet-400/25",
  },
  unknown: {
    label: "Desconhecido",
    badge:
      "bg-zinc-500/10 text-zinc-600 ring-zinc-500/20 dark:bg-zinc-400/10 dark:text-zinc-400 dark:ring-zinc-400/20",
  },
};

export const BOT_STATUS: Record<ChatbotStatus, StatusMeta> = {
  active: {
    label: "Ativo",
    badge:
      "bg-emerald-500/15 text-emerald-700 ring-emerald-600/25 dark:bg-emerald-400/15 dark:text-emerald-300 dark:ring-emerald-400/25",
    dot: "bg-emerald-500",
  },
  paused: {
    label: "Pausado",
    badge:
      "bg-amber-500/15 text-amber-700 ring-amber-600/25 dark:bg-amber-400/15 dark:text-amber-300 dark:ring-amber-400/25",
    dot: "bg-amber-500",
  },
  draft: {
    label: "Rascunho",
    badge:
      "bg-zinc-500/10 text-zinc-600 ring-zinc-500/20 dark:bg-zinc-400/10 dark:text-zinc-400 dark:ring-zinc-400/20",
    dot: "bg-zinc-400",
  },
  error: {
    label: "Erro",
    badge:
      "bg-rose-500/15 text-rose-700 ring-rose-600/25 dark:bg-rose-400/15 dark:text-rose-300 dark:ring-rose-400/25",
    dot: "bg-rose-500",
  },
};
