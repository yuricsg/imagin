"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Chatbot } from "@/lib/chatbots/types";
import type { BotActivity } from "@/lib/metrics";
import { ACCENTS } from "@/lib/chatbots/accents";
import { BOT_STATUS } from "@/lib/labels";
import { relativeTime } from "@/lib/format";
import { chatbotDisplayName } from "@/lib/chatbots/display";
import { resolveLauncherAvatarPath } from "@/lib/chatbots/launcher";
import { Avatar, Badge, EmptyState, Skeleton } from "./ui";
import {
  IconBot,
  IconChartBar,
  IconCopy,
  IconDots,
  IconPencil,
  IconPlus,
  IconTrash,
  IconX,
} from "./icons";

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
  /** One open kebab menu at a time; opening another closes the previous. */
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const confirmBot = confirmDeleteId
    ? bots.find((b) => b.id === confirmDeleteId)
    : null;

  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800/80 dark:bg-zinc-900/70">
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
            className="text-sm font-medium text-teal-700 transition-colors hover:text-teal-800 dark:text-teal-300 dark:hover:text-teal-200"
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
          {bots.map((bot, index) => {
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
              <li key={bot.id} className="relative flex items-stretch gap-0.5">
                <button
                  type="button"
                  onClick={() => onSelect(selected ? null : bot.id)}
                  aria-pressed={selected}
                  aria-label={`${displayName}, ${bot.clientName}`}
                  style={{
                    animationDelay: `${Math.min(index, 9) * 35}ms`,
                  }}
                  className={`motion-enter motion-lift relative flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors duration-150 ${
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
                          className="motion-pulse ml-auto bg-teal-500/15 text-teal-700 ring-teal-600/25 dark:bg-teal-400/15 dark:text-teal-300 dark:ring-teal-400/25"
                        />
                      ) : null}
                    </div>
                  </div>
                </button>
                {/* Menu is always shown — the report action is available to every bot. */}
                <BotActionsMenu
                  bot={bot}
                  displayName={displayName}
                  open={openMenuId === bot.id}
                  onOpen={() => setOpenMenuId(bot.id)}
                  onClose={() => setOpenMenuId(null)}
                  onEdit={editable ? onEdit : undefined}
                  onDuplicate={onDuplicate}
                  onRequestDelete={
                    editable && onDelete
                      ? () => setConfirmDeleteId(bot.id)
                      : undefined
                  }
                />
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
            <div className="mt-5 flex justify-end gap-2 max-sm:flex-col-reverse">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 max-sm:py-3 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete(confirmBot.id);
                  setConfirmDeleteId(null);
                }}
                className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 max-sm:py-3"
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

/** Skeleton mirroring the bot list rows; used by the route-level loading shell. */
export function ChatbotListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="space-y-1 p-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-2.5 py-2.5">
          <Skeleton className="size-9 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-36 max-w-full" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface MenuAction {
  id: string;
  label: string;
  icon: ReactNode;
  destructive?: boolean;
  run: () => void;
}

/**
 * Always-visible kebab menu for an editable bot row. WAI-ARIA menu button
 * pattern: opens on click / Enter / Space / ↓, ↑↓ move real focus between
 * items, Enter activates, Esc closes and returns focus to the trigger,
 * outside click closes, Tab closes. Parent guarantees one open menu at a time.
 */
function BotActionsMenu({
  bot,
  displayName,
  open,
  onOpen,
  onClose,
  onEdit,
  onDuplicate,
  onRequestDelete,
}: {
  bot: Chatbot;
  displayName: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onEdit?: (bot: Chatbot) => void;
  onDuplicate?: (bot: Chatbot) => void;
  onRequestDelete?: () => void;
}) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const actions: MenuAction[] = [
    // Read-only report — available to every bot, not just editable ones.
    {
      id: "report",
      label: "Ver desempenho",
      icon: <IconChartBar className="size-4" />,
      run: () => router.push(`/chatbots/${bot.id}`),
    },
    ...(onEdit
      ? [
          {
            id: "edit",
            label: "Editar",
            icon: <IconPencil className="size-4" />,
            run: () => onEdit(bot),
          },
        ]
      : []),
    ...(onDuplicate
      ? [
          {
            id: "duplicate",
            label: "Duplicar",
            icon: <IconCopy className="size-4" />,
            run: () => onDuplicate(bot),
          },
        ]
      : []),
    ...(onRequestDelete
      ? [
          {
            id: "delete",
            label: "Excluir",
            icon: <IconTrash className="size-4" />,
            destructive: true,
            run: onRequestDelete,
          },
        ]
      : []),
  ];

  function openMenu() {
    setActiveIndex(0);
    onOpen();
  }

  // Move real focus to the highlighted item while open.
  useEffect(() => {
    if (open) itemRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  // Close on outside pointer down.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (
        !menuRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open, onClose]);

  function onTriggerKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openMenu();
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      onClose();
    }
  }

  function onMenuKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      triggerRef.current?.focus();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % actions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + actions.length) % actions.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(actions.length - 1);
    } else if (event.key === "Tab") {
      onClose();
    }
  }

  return (
    <div className="flex shrink-0 items-center pr-1">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Ações de ${displayName}`}
        title="Ações"
        onClick={() => (open ? onClose() : openMenu())}
        onKeyDown={onTriggerKeyDown}
        className="flex size-11 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 sm:size-8 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      >
        <IconDots className="size-4" />
      </button>
      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`Ações de ${displayName}`}
          onKeyDown={onMenuKeyDown}
          className="motion-menu absolute right-2 top-full z-30 mt-1 w-44 rounded-xl border border-zinc-200/80 bg-white p-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          {actions.map((action, index) => (
            <div key={action.id}>
              {action.destructive && index > 0 ? (
                <div
                  role="separator"
                  className="my-1 border-t border-zinc-200/80 dark:border-zinc-800"
                />
              ) : null}
              <button
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                role="menuitem"
                onClick={() => {
                  onClose();
                  action.run();
                }}
                onMouseMove={() => setActiveIndex(index)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none max-sm:py-3 ${
                  action.destructive
                    ? "text-rose-600 hover:bg-rose-50 focus-visible:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 dark:focus-visible:bg-rose-950/40"
                    : "text-zinc-700 hover:bg-zinc-100 focus-visible:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:focus-visible:bg-zinc-800"
                }`}
              >
                <span
                  className={
                    action.destructive
                      ? "text-rose-500 dark:text-rose-400"
                      : "text-zinc-400 dark:text-zinc-500"
                  }
                >
                  {action.icon}
                </span>
                {action.label}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
