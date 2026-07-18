import type { Chatbot } from "./types";

/**
 * Name shown on operator surfaces (bot list, selected-bot contexts, embed
 * block, lead views). Falls back to the visitor-facing `name` when the bot
 * has no `flowName`. Never use this in visitor-facing code (widget, embed
 * script, iframe) — those always use `bot.name`.
 */
export function chatbotDisplayName(
  bot: Pick<Chatbot, "name" | "flowName">,
): string {
  return bot.flowName?.trim() || bot.name;
}
