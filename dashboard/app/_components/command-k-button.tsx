"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconSearch } from "./icons";
import { useModifierKey } from "./use-modifier-key";

/** Window event toggling the home command palette (dashboard-home listens). */
export const COMMAND_PALETTE_EVENT = "imagin:toggle-command-palette";

const BUTTON_CLASS =
  "inline-flex items-center gap-2 rounded-lg border border-zinc-200/80 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 max-sm:min-h-11 max-sm:min-w-11 max-sm:justify-center dark:border-zinc-700/80 dark:bg-zinc-900/60 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";

const KBD_CLASS =
  "hidden rounded border border-zinc-200 bg-zinc-50 px-1 py-0.5 text-[10px] font-semibold text-zinc-400 sm:inline-block dark:border-zinc-700 dark:bg-zinc-800";

/**
 * Header "⌘K" affordance. On the home it fires the palette event; elsewhere
 * it links back to the home (where the palette lives).
 */
export function CommandKButton() {
  const pathname = usePathname();
  const modifierLabel = useModifierKey();
  const content = (
    <>
      <IconSearch className="size-3.5" />
      <span className="hidden sm:inline">Comandos</span>
      <kbd className={KBD_CLASS}>{modifierLabel}</kbd>
    </>
  );
  if (pathname !== "/") {
    return (
      <Link
        href="/"
        className={BUTTON_CLASS}
        title={`Voltar ao painel (${modifierLabel} na página inicial)`}
      >
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={BUTTON_CLASS}
      title={`Abrir comandos (${modifierLabel})`}
      aria-keyshortcuts="meta+k control+k"
      onClick={() => window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_EVENT))}
    >
      {content}
    </button>
  );
}
