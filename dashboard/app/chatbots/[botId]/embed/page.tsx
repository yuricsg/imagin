import { EmbeddedChatbot } from "./embedded-chatbot";

type PageProps = {
  params: Promise<{ botId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ChatbotEmbedPage({ params, searchParams }: PageProps) {
  const { botId } = await params;
  const query = await searchParams;

  return (
    <EmbeddedChatbot
      botId={botId}
      clientId={readQueryParam(query.clientId) ?? "unknown-client"}
      pageUrl={readQueryParam(query.pageUrl)}
      parentOrigin={readQueryParam(query.parentOrigin)}
    />
  );
}

function readQueryParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}
