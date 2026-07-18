"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChatbotForm } from "@/app/_components/chatbot-form";
import { useChatbotActions } from "@/app/_components/use-chatbot-actions";
import { apiListChatbots } from "@/lib/api/chatbots";
import { getChatbotById } from "@/lib/chatbots/catalog";
import type { Chatbot } from "@/lib/chatbots/types";
import { normalizeStoredChatbot } from "@/lib/chatbots/create";

export default function NewChatbotPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const params = use(searchParams);
  // ?from=<botId> opens the wizard pre-filled as a duplicate of that bot.
  const fromId = Array.isArray(params.from) ? params.from[0] : params.from;
  const router = useRouter();
  const { create, findBot } = useChatbotActions();
  // Static catalog fallback: the demo bot resolves synchronously, no flash.
  const catalogBot = fromId ? (getChatbotById(fromId) ?? null) : null;
  const [remoteBot, setRemoteBot] = useState<Chatbot | null>(null);
  const [loadingRemote, setLoadingRemote] = useState(
    Boolean(fromId) && !catalogBot,
  );

  useEffect(() => {
    if (!fromId || catalogBot) return;
    let cancelled = false;
    apiListChatbots()
      .then((list) => {
        if (cancelled) return;
        const found = list.find((b) => b.id === fromId);
        setRemoteBot(found ? (normalizeStoredChatbot(found) ?? found) : null);
      })
      .catch(() => {
        if (!cancelled) setRemoteBot(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingRemote(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fromId, catalogBot]);

  const duplicateFrom = useMemo(() => {
    if (!fromId) return null;
    return findBot(fromId) ?? catalogBot ?? remoteBot;
  }, [findBot, fromId, catalogBot, remoteBot]);

  if (fromId && !duplicateFrom && loadingRemote) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Carregando chatbot…
        </p>
      </main>
    );
  }

  if (fromId && !duplicateFrom) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Chatbot não encontrado
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Esse bot não está na sua lista. Volte ao painel e tente de novo.
        </p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="btn-brand mt-4 px-4 py-2"
        >
          Voltar ao painel
        </button>
      </main>
    );
  }

  return (
    <ChatbotForm
      key={duplicateFrom ? `from-${duplicateFrom.id}` : "new"}
      duplicateFrom={duplicateFrom ?? undefined}
      onClose={() => {
        // Re-fetch the server data so the freshly persisted bot shows up.
        router.push("/");
        router.refresh();
      }}
      onCreate={create}
    />
  );
}
