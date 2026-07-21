"use client";

import { useState } from "react";
import type { Chatbot } from "@/lib/chatbots/types";
import { ACCENTS } from "@/lib/chatbots/accents";
import { embedSnippet, iframeUrl } from "@/lib/format";
import { chatbotDisplayName } from "@/lib/chatbots/display";
import { resolveLauncherAvatarPath } from "@/lib/chatbots/launcher";
import { Avatar } from "./ui";
import { IconCheck, IconCopy, IconExternal } from "./icons";

type CopyTarget = "snippet" | "url";

export function EmbedBlock({ bot }: { bot: Chatbot }) {
  const [copied, setCopied] = useState<CopyTarget | null>(null);
  const snippet = embedSnippet(bot);
  const url = iframeUrl(bot);
  const accent = ACCENTS[bot.accent];

  async function copy(target: CopyTarget, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(target);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      // Clipboard can be blocked (insecure context / permissions); fail quietly.
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200/70 bg-white dark:border-zinc-800/70 dark:bg-zinc-900">
      <header
        className={`flex items-center gap-3 border-b border-zinc-200/70 px-4 py-3 dark:border-zinc-800/70 ${accent.surface}`}
      >
        <Avatar
          name={chatbotDisplayName(bot)}
          className={accent.avatar}
          size="sm"
          imageSrc={resolveLauncherAvatarPath(bot.launcher?.avatarUrl)}
        />
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Incorporar {chatbotDisplayName(bot)}
          </h2>
          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
            {bot.clientName}
          </p>
        </div>
      </header>

      <div className="space-y-4 p-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Script do site
            </span>
            <CopyButton
              copied={copied === "snippet"}
              onClick={() => copy("snippet", snippet)}
            />
          </div>
          <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-[11px] leading-relaxed text-zinc-200">
            <code className="font-mono whitespace-pre">{snippet}</code>
          </pre>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              URL do iframe
            </span>
            <CopyButton
              copied={copied === "url"}
              onClick={() => copy("url", url)}
            />
          </div>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 font-mono text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              {url}
            </code>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 sm:size-8 dark:border-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              title="Abrir iframe em nova aba"
            >
              <IconExternal className="size-4" />
            </a>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          O loader lê <code className="font-mono text-[11px]">data-bot-id</code>,{" "}
          <code className="font-mono text-[11px]">data-client-id</code> e{" "}
          <code className="font-mono text-[11px]">data-api-base-url</code>, busca a
          configuração pública do bot e abre o iframe acima no site do cliente.
        </p>
      </div>
    </section>
  );
}

function CopyButton({
  copied,
  onClick,
}: {
  copied: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 max-sm:min-h-11 max-sm:px-2.5 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
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
  );
}
