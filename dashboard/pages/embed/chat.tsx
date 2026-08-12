import Head from "next/head";
import { useRouter } from "next/router";
import { useMemo } from "react";
import { EmbeddedChatbot } from "@/app/chatbots/[botId]/embed/embedded-chatbot";
import type { LeadSource } from "@/app/chatbots/[botId]/embed/chat-session";

export default function StaticChatbotEmbedPage() {
  const router = useRouter();
  const query = router.query;
  const botId = readQueryParam(query.botId);
  const initialSource = useMemo(
    () => readAttribution(readQueryParam(query.attribution)),
    [query.attribution],
  );

  return (
    <>
      <Head>
        <title>Imagin Assistant</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      {!router.isReady || !botId ? (
        <main className="flex min-h-dvh items-center justify-center bg-white text-sm text-zinc-500">
          Loading assistant…
        </main>
      ) : (
        <EmbeddedChatbot
          key={botId}
          botId={botId}
          clientId={readQueryParam(query.clientId) ?? "unknown-client"}
          pageUrl={readQueryParam(query.pageUrl)}
          parentOrigin={readQueryParam(query.parentOrigin)}
          initialSource={initialSource}
          preloaded={readQueryParam(query.preload) === "1"}
          expectParentConfig={readQueryParam(query.configHandoff) === "1"}
        />
      )}
    </>
  );
}

function readQueryParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function readAttribution(rawValue: string | undefined): LeadSource {
  if (!rawValue) return {};

  try {
    const parsed: unknown = JSON.parse(rawValue);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as LeadSource)
      : {};
  } catch {
    return {};
  }
}
