"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChatbotForm } from "@/app/_components/chatbot-form";
import { useChatbotActions } from "@/app/_components/use-chatbot-actions";
import { apiListChatbots } from "@/lib/api/chatbots";
import type { Chatbot } from "@/lib/chatbots/types";
import { normalizeStoredChatbot } from "@/lib/chatbots/create";

export default function EditChatbotPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = use(params);
  const router = useRouter();
  const { findBot, update } = useChatbotActions();
  const [remoteBot, setRemoteBot] = useState<Chatbot | null>(null);
  const [loadingRemote, setLoadingRemote] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiListChatbots()
      .then((list) => {
        if (cancelled) return;
        const found = list.find((b) => b.id === botId);
        setRemoteBot(found ? normalizeStoredChatbot(found) ?? found : null);
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
  }, [botId]);

  const initialBot = useMemo(() => {
    return findBot(botId) ?? remoteBot;
  }, [findBot, botId, remoteBot]);

  if (!initialBot && loadingRemote) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Carregando chatbot…
        </p>
      </main>
    );
  }

  if (!initialBot) {
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
      key={initialBot.id}
      initialBot={initialBot}
      onClose={() => router.push("/")}
      onCreate={() => {
        throw new Error("onCreate should not run in edit mode");
      }}
      onUpdate={(input) => update(initialBot, input)}
    />
  );
}
