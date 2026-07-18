"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { IconSearch } from "./icons";

export interface CommandItem {
  id: string;
  /** Small group header ("Ações", "Chatbots") shown above the first item of each run. */
  group: string;
  label: string;
  /** Extra lowercase terms matched by the query. */
  keywords?: string;
  /** Right-side affordance (e.g. "N", a count, "⌘K"). */
  hint?: string;
  icon?: ReactNode;
  /**
   * Executes the command. May return a short notice string (e.g. "Copiado!")
   * shown in the footer before the palette closes, or a promise of one.
   */
  run: () => void | string | Promise<void | string>;
}

/**
 * Linear-style ⌘K palette: large input on top, grouped action list, full
 * keyboard navigation (combobox + listbox semantics). Data-agnostic — the
 * caller builds the command list, the palette handles filter/nav/ARIA.
 * State resets by remounting the dialog every time it opens.
 */
export function CommandPalette({
  open,
  onClose,
  commands,
}: {
  open: boolean;
  onClose: () => void;
  commands: CommandItem[];
}) {
  if (!open) return null;
  return <PaletteDialog commands={commands} onClose={onClose} />;
}

function optionId(id: string) {
  return `command-option-${id}`;
}

function PaletteDialog({
  commands,
  onClose,
}: {
  commands: CommandItem[];
  onClose: () => void;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((cmd) =>
      `${cmd.label} ${cmd.keywords ?? ""} ${cmd.group}`
        .toLowerCase()
        .includes(q),
    );
  }, [commands, query]);

  // Derived, never stored: keeps the highlight valid when the list shrinks.
  const clampedIndex = Math.min(
    activeIndex,
    Math.max(0, filtered.length - 1),
  );

  // Focus the input on open; restore focus to the trigger on close.
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      previous?.focus();
    };
  }, []);

  // Keep the active option visible while navigating (jsdom lacks scrollIntoView).
  useEffect(() => {
    const active = filtered[clampedIndex];
    if (active) {
      document
        .getElementById(optionId(active.id))
        ?.scrollIntoView?.({ block: "nearest" });
    }
  }, [clampedIndex, filtered]);

  async function runCommand(cmd: CommandItem | undefined) {
    if (!cmd) return;
    const result = await cmd.run();
    if (typeof result === "string" && result) {
      setNotice(result);
      window.setTimeout(onClose, 1100);
    } else {
      onClose();
    }
  }

  function onInputKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (filtered.length ? (i + 1) % filtered.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) =>
        filtered.length ? (i - 1 + filtered.length) % filtered.length : 0,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      void runCommand(filtered[clampedIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  }

  let lastGroup: string | null = null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative mx-auto mt-[12vh] w-[calc(100%-2rem)] max-w-lg px-0 pb-[12vh]">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Paleta de comandos"
          className="motion-enter overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex items-center gap-2.5 border-b border-zinc-200/80 px-4 dark:border-zinc-800">
            <IconSearch className="size-4 shrink-0 text-zinc-400" />
            <input
              ref={inputRef}
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={
                filtered.length
                  ? optionId(filtered[clampedIndex].id)
                  : undefined
              }
              aria-label="Buscar comandos"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onInputKeyDown}
              placeholder="Digite um comando ou busque…"
              className="h-12 w-full bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100"
            />
            <kbd className="shrink-0 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800">
              Esc
            </kbd>
          </div>

          <ul
            id={listId}
            role="listbox"
            aria-label="Comandos disponíveis"
            className="max-h-80 overflow-y-auto p-2"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-zinc-400">
                Nenhum comando encontrado.
              </li>
            ) : (
              filtered.map((cmd, index) => {
                const header =
                  cmd.group !== lastGroup ? (
                    <li
                      key={`group-${cmd.group}-${cmd.id}`}
                      aria-hidden="true"
                      className="px-3 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 first:pt-1 dark:text-zinc-500"
                    >
                      {cmd.group}
                    </li>
                  ) : null;
                lastGroup = cmd.group;
                const active = index === clampedIndex;
                return [
                  header,
                  <li
                    key={cmd.id}
                    id={optionId(cmd.id)}
                    role="option"
                    aria-selected={active}
                    onClick={() => void runCommand(cmd)}
                    onMouseMove={() => setActiveIndex(index)}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm ${
                      active
                        ? "bg-teal-50 text-teal-900 dark:bg-teal-950/50 dark:text-teal-100"
                        : "text-zinc-700 dark:text-zinc-200"
                    }`}
                  >
                    {cmd.icon ? (
                      <span
                        className={`flex size-7 shrink-0 items-center justify-center rounded-md ${
                          active
                            ? "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300"
                            : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {cmd.icon}
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1 truncate">{cmd.label}</span>
                    {cmd.hint ? (
                      <kbd className="shrink-0 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
                        {cmd.hint}
                      </kbd>
                    ) : null}
                  </li>,
                ];
              })
            )}
          </ul>

          <div className="flex items-center justify-between border-t border-zinc-200/80 px-4 py-2 text-[11px] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
            <span aria-live="polite">
              {notice ?? "↑↓ navegar · Enter executar · Esc fechar"}
            </span>
            <span>⌘K</span>
          </div>
        </div>
      </div>
    </div>
  );
}
