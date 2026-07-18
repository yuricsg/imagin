"use client";

import { useState } from "react";
import type { Chatbot } from "@/lib/chatbots/types";
import type { BotActivity } from "@/lib/metrics";
import { ACCENTS } from "@/lib/chatbots/accents";
import { BOT_STATUS } from "@/lib/labels";
import { relativeTime } from "@/lib/format";
import { chatbotDisplayName } from "@/lib/chatbots/display";
import { resolveLauncherAvatarPath } from "@/lib/chatbots/launcher";
import { Avatar, Badge, EmptyState } from "./ui";
import { IconBot, IconCopy, IconPencil, IconPlus, IconTrash, IconX } from "./icons";

export function ChatbotList({
  bots,
  activity,
  selectedBotId,
  editableBotIds,
  onSelect,
  onCreate,
  onEdit,
  onDuplicate,
  onDelete,
  nowMs,
}: {
  bots: Chatbot[];
  activity: Record<string, BotActivity>;
  selectedBotId: string | null;
  editableBotIds: ReadonlySet<string>;
  onSelect: (id: string | null) => void;
  onCreate?: () => void;
  onEdit?: (bot: Chatbot) => void;
  onDuplicate?: (bot: Chatbot) => void;
  onDelete?: (id: string) => void;
  nowMs: number;
}) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const confirmBot = confirmDeleteId
    ? bots.find((b) => b.id === confirmDeleteId)
    : null;

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200/70 bg-white/85 backdrop-blur-xl dark:border-zinc-800/70 dark:bg-zinc-900/55">
      <header className="flex items-center justify-between gap-2 border-b border-zinc-200/70 px-5 py-4 dark:border-zinc-800/70">
        <div className="flex items-center gap-2">
          <IconBot className="size-5 text-zinc-400" />
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Chatbots
          </h2>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {bots.length}
          </span>
        </div>
        {selectedBotId ? (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            Ver todos
          </button>
        ) : null}
      </header>

      {bots.length === 0 ? (
        <EmptyState
          icon={<IconBot className="size-5" />}
          title="Nenhum chatbot ainda"
          description="Crie o primeiro chatbot para captar leads no site do cliente."
          action={
            onCreate ? (
              <button
                type="button"
                onClick={onCreate}
                className="btn-brand"
              >
                <IconPlus className="size-4" />
                Criar chatbot
              </button>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-1 p-2">
          {bots.map((bot) => {
            const stats = activity[bot.id];
            const selected = bot.id === selectedBotId;
            const editable = editableBotIds.has(bot.id);
            const displayName = chatbotDisplayName(bot);
            const accent = ACCENTS[bot.accent];
            const status = BOT_STATUS[bot.status];
            const metaClass = selected
              ? `${accent.text} opacity-90`
              : "text-zinc-500 dark:text-zinc-400";
            const statsClass = selected
              ? "text-zinc-700 dark:text-zinc-300"
              : "text-zinc-400 dark:text-zinc-500";
            return (
              <li key={bot.id} className="group flex items-stretch gap-0.5">
                <button
                  type="button"
                  onClick={() => onSelect(selected ? null : bot.id)}
                  aria-pressed={selected}
                  aria-label={`${displayName}, ${bot.clientName}`}
                  className={`relative flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors duration-150 ${
                    selected
                      ? `${accent.surface} ring-1 ring-inset ${accent.ring}`
                      : "hover:bg-zinc-100/80 dark:hover:bg-zinc-800/50"
                  }`}
                >
                  <Avatar
                    name={displayName}
                    className={accent.avatar}
                    imageSrc={resolveLauncherAvatarPath(bot.launcher?.avatarUrl)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {displayName}
                      </p>
                      <span
                        className={`size-2 shrink-0 rounded-full ring-2 ring-white dark:ring-zinc-900 ${status.dot}`}
                        title={status.label}
                      />
                    </div>
                    <p className={`truncate text-xs ${metaClass}`}>
                      {bot.clientName}
                    </p>
                    <div
                      className={`mt-1 flex items-center gap-2 text-xs ${statsClass}`}
                    >
                      <span className="tabular-nums">
                        {stats?.leadCount ?? 0} leads
                      </span>
                      <span aria-hidden>·</span>
                      <span className="truncate">
                        {stats?.lastLeadAt
                          ? relativeTime(stats.lastLeadAt, nowMs)
                          : "sem leads"}
                      </span>
                      {stats?.newCount ? (
                        <Badge
                          label={`${stats.newCount} novo${stats.newCount > 1 ? "s" : ""}`}
                          className="ml-auto bg-blue-500/15 text-blue-700 ring-blue-600/25 dark:bg-blue-400/15 dark:text-blue-300 dark:ring-blue-400/25"
                        />
                      ) : null}
                    </div>
                  </div>
                </button>
                {editable && (onEdit || onDuplicate || onDelete) ? (
                  <div
                    className={`flex shrink-0 flex-col justify-center gap-0.5 pr-1 transition-opacity ${
                      selected
                        ? "opacity-100"
                        : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                    }`}
                  >
                    {onEdit ? (
                      <button
                        type="button"
                        onClick={() => onEdit(bot)}
                        aria-label={`Editar ${displayName}`}
                        className="flex size-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-indigo-400"
                      >
                        <IconPencil className="size-3.5" />
                      </button>
                    ) : null}
                    {onDuplicate ? (
                      <button
                        type="button"
                        onClick={() => onDuplicate(bot)}
                        aria-label={`Duplicar ${displayName}`}
                        className="flex size-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-emerald-400"
                      >
                        <IconCopy className="size-3.5" />
                      </button>
                    ) : null}
                    {onDelete ? (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(bot.id)}
                        aria-label={`Excluir ${displayName}`}
                        className="flex size-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-rose-400"
                      >
                        <IconTrash className="size-3.5" />
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {confirmBot && onDelete ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            aria-label="Cancelar exclusão"
            onClick={() => setConfirmDeleteId(null)}
            className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm"
          />
          <div
            role="alertdialog"
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-desc"
            className="relative z-10 w-full max-w-sm rounded-2xl border border-zinc-200/70 bg-white p-5 shadow-2xl dark:border-zinc-800/70 dark:bg-zinc-900"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3
                  id="delete-dialog-title"
                  className="text-base font-semibold text-zinc-900 dark:text-zinc-50"
                >
                  Excluir chatbot?
                </h3>
                <p
                  id="delete-dialog-desc"
                  className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400"
                >
                  <span className="font-medium text-zinc-700 dark:text-zinc-200">
                    {chatbotDisplayName(confirmBot)}
                  </span>{" "}
                  será removido da sua lista. O código de instalação deixa de
                  funcionar até você criar um novo bot.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                aria-label="Fechar"
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <IconX className="size-4" />
              </button>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete(confirmBot.id);
                  setConfirmDeleteId(null);
                }}
                className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
