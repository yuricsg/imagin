import type { Chatbot } from "./chatbots/types";
import { EMPTY_TRACKING } from "./chatbots/tracking";
import { EMPTY_WHATSAPP, hasWhatsAppConfigured } from "./chatbots/whatsapp";

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Compact "há X" label relative to a fixed reference, computed once server-side. */
export function relativeTime(iso: string, nowMs: number): string {
  const diffMs = nowMs - Date.parse(iso);
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `há ${days} d`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `há ${weeks} sem`;
  const months = Math.round(days / 30);
  return `há ${months} m`;
}

export function absoluteTime(iso: string): string {
  return dateFmt.format(new Date(iso));
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/** URL-safe id from a human name: strips accents, lowercases, hyphenates. */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The exact `<script>` a client pastes into their site to mount the widget. */
export function embedSnippet(bot: Chatbot): string {
  const src = `${bot.embed.appBaseUrl}${bot.embed.scriptPath}`;
  const tracking = bot.tracking ?? EMPTY_TRACKING;
  const whatsapp = bot.whatsapp ?? EMPTY_WHATSAPP;
  const lines = [
    `<script`,
    `  src="${src}"`,
    `  data-bot-id="${bot.id}"`,
    `  data-client-id="${bot.clientId}"`,
    `  data-api-base-url="${bot.embed.apiBaseUrl}"`,
  ];
  if (tracking.gaMeasurementId) {
    lines.push(`  data-ga-id="${tracking.gaMeasurementId}"`);
  }
  if (tracking.metaPixelId) {
    lines.push(`  data-meta-pixel-id="${tracking.metaPixelId}"`);
  }
  if (hasWhatsAppConfigured(whatsapp)) {
    lines.push(`  data-whatsapp-enabled="true"`);
    lines.push(`  data-whatsapp-phone="${whatsapp.phoneNumber}"`);
    lines.push(
      `  data-whatsapp-message="${encodeURIComponent(whatsapp.messageTemplate)}"`,
    );
    lines.push(`  data-bot-name="${bot.name.replace(/"/g, "&quot;")}"`);
  }
  lines.push(`  defer`, `></script>`);
  return lines.join("\n");
}

export function iframeUrl(bot: Chatbot): string {
  return `${bot.embed.appBaseUrl}/chatbots/${bot.id}/embed`;
}
